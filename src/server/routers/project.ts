import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, managerProcedure, protectedProcedure, publicProcedure, router } from "../trpc";
import { generateUnitsForTower, recomputeProjectPrices } from "../services/inventory";
import { slugify } from "@/lib/utils";
import { ProjectStage, PriceRuleKind, PoiCategory, PoiGroup } from "@/lib/domain";
import { publish } from "../events";

const projectInclude = {
  towers: { orderBy: { code: "asc" as const } },
  typologies: { orderBy: { code: "asc" as const } },
  amenities: { orderBy: { order: "asc" as const } },
  pois: { orderBy: [{ group: "asc" as const }, { minutes: "asc" as const }] },
  mediaAssets: { orderBy: { order: "asc" as const } },
  priceRules: { orderBy: { order: "asc" as const } },
  company: true,
};

const typologyInput = z.object({
  code: z.string().min(1).max(4),
  name: z.string().min(1),
  description: z.string().optional(),
  builtArea: z.number().positive(),
  privateArea: z.number().positive(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  basePrice: z.number().positive(),
  color: z.string().optional(),
  features: z.array(z.string()).default([]),
  variants: z
    .array(z.object({ name: z.string(), description: z.string().optional(), deltaPrice: z.number() }))
    .default([]),
});

const towerInput = z.object({
  code: z.string().min(1).max(6),
  name: z.string().min(1),
  floors: z.number().int().min(1).max(80),
  firstResidentialFloor: z.number().int().min(1).default(1),
  floorHeight: z.number().positive().default(2.8),
  footprintWidth: z.number().positive().default(32),
  footprintDepth: z.number().positive().default(18),
  positionX: z.number().default(0),
  positionZ: z.number().default(0),
  rotationY: z.number().default(0),
  releaseStatus: z.string().default("EN_VENTA"),
  matrix: z.array(
    z.object({
      position: z.number().int().min(1),
      typologyCode: z.string(),
      orientation: z.string().optional(),
      viewTag: z.string().optional(),
    })
  ),
});

export const createProjectInput = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  stage: ProjectStage.default("LANZAMIENTO"),
  priceValidUntil: z.date().optional(),
  deliveryDate: z.date().optional(),
  primaryColor: z.string().default("#0f172a"),
  secondaryColor: z.string().default("#1e3a5f"),
  accentColor: z.string().default("#c9a227"),
  logoUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  separationAmount: z.number().min(0).default(2_000_000),
  downPaymentPct: z.number().min(0).max(1).default(0.3),
  downPaymentMonths: z.number().int().min(1).default(36),
  annualRate: z.number().min(0).max(1).default(0.12),
  loanYears: z.number().int().min(1).max(30).default(20),
  typologies: z.array(typologyInput).min(1),
  towers: z.array(towerInput).min(1),
  priceRules: z
    .array(
      z.object({
        kind: PriceRuleKind,
        label: z.string(),
        value: z.number(),
        isPercent: z.boolean().default(true),
        criteria: z.record(z.string(), z.unknown()).default({}),
        order: z.number().int().default(0),
      })
    )
    .default([]),
  amenities: z.array(z.object({ name: z.string(), zone: z.string().optional(), icon: z.string().optional() })).default([]),
  pois: z
    .array(
      z.object({
        name: z.string(),
        category: PoiCategory.default("OTRO"),
        minutes: z.number().int().min(0),
        group: PoiGroup.default("SECTOR"),
      })
    )
    .default([]),
});

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db.project.findMany({
      where: { companyId: ctx.user.companyId },
      include: {
        towers: true,
        typologies: true,
        _count: { select: { units: true, leads: true, quotes: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const stats = await ctx.db.unit.groupBy({
      by: ["projectId", "status"],
      _count: { _all: true },
      where: { projectId: { in: projects.map((p) => p.id) } },
    });
    return projects.map((p) => ({
      ...p,
      statusCounts: Object.fromEntries(
        stats.filter((s) => s.projectId === p.id).map((s) => [s.status, s._count._all])
      ) as Record<string, number>,
    }));
  }),

  bySlug: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const project = await ctx.db.project.findFirst({
      where: { slug: input.slug, companyId: ctx.user.companyId },
      include: projectInclude,
    });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    return project;
  }),

  /** Acceso público para modo presentación (enlace compartible). */
  byPublicToken: publicProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const project = await ctx.db.project.findUnique({
      where: { publicToken: input.token },
      include: { ...projectInclude, presentations: { where: { isDefault: true }, take: 1 } },
    });
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    return project;
  }),

  create: adminProcedure.input(createProjectInput).mutation(async ({ ctx, input }) => {
    const slug = slugify(input.slug ?? input.name);
    const exists = await ctx.db.project.findUnique({ where: { slug } });
    if (exists) throw new TRPCError({ code: "CONFLICT", message: `Ya existe un proyecto con slug ${slug}` });

    const { typologies, towers, priceRules, amenities, pois, ...rest } = input;

    const project = await ctx.db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...rest,
          slug,
          companyId: ctx.user.companyId,
          typologies: {
            create: typologies.map((t) => ({
              ...t,
              features: JSON.stringify(t.features),
              variants: JSON.stringify(t.variants),
            })),
          },
          priceRules: {
            create: priceRules.map((r) => ({ ...r, criteria: JSON.stringify(r.criteria) })),
          },
          amenities: { create: amenities.map((a, i) => ({ ...a, order: i })) },
          pois: { create: pois.map((p, i) => ({ ...p, order: i })) },
        },
      });

      for (const t of towers) {
        const { matrix, ...towerData } = t;
        const tower = await tx.tower.create({
          data: { ...towerData, unitsPerFloor: matrix.length, projectId: project.id, modelNodeName: t.code },
        });
        await generateUnitsForTower(tx, {
          projectId: project.id,
          towerId: tower.id,
          towerCode: tower.code,
          floors: tower.floors,
          firstResidentialFloor: tower.firstResidentialFloor,
          matrix,
        });
      }
      await recomputeProjectPrices(tx, project.id);
      await tx.presentation.create({
        data: {
          projectId: project.id,
          name: "Presentación comercial",
          isDefault: true,
          blocks: JSON.stringify(defaultPresentationBlocks(project.name)),
        },
      });
      await tx.auditLog.create({
        data: { userId: ctx.user.id, projectId: project.id, entity: "Project", entityId: project.id, action: "CREATE" },
      });
      return project;
    }, { timeout: 60_000 });

    return project;
  }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        data: createProjectInput
          .omit({ typologies: true, towers: true, priceRules: true, amenities: true, pois: true })
          .partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.update({ where: { id: input.id }, data: input.data });
      publish({ type: "project.updated", projectId: project.id });
      return project;
    }),

  recomputePrices: managerProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ ctx, input }) => {
    const updated = await ctx.db.$transaction((tx) => recomputeProjectPrices(tx, input.projectId), { timeout: 60_000 });
    publish({ type: "project.updated", projectId: input.projectId });
    return { updated };
  }),

  upsertPriceRule: managerProcedure
    .input(
      z.object({
        id: z.string().optional(),
        projectId: z.string(),
        kind: PriceRuleKind,
        label: z.string(),
        value: z.number(),
        isPercent: z.boolean(),
        criteria: z.record(z.string(), z.unknown()).default({}),
        active: z.boolean().default(true),
        order: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, criteria, ...data } = input;
      const payload = { ...data, criteria: JSON.stringify(criteria) };
      const rule = id
        ? await ctx.db.priceRule.update({ where: { id }, data: payload })
        : await ctx.db.priceRule.create({ data: payload });
      await ctx.db.$transaction((tx) => recomputeProjectPrices(tx, input.projectId), { timeout: 60_000 });
      publish({ type: "project.updated", projectId: input.projectId });
      return rule;
    }),

  deletePriceRule: managerProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const rule = await ctx.db.priceRule.delete({ where: { id: input.id } });
    await ctx.db.$transaction((tx) => recomputeProjectPrices(tx, rule.projectId), { timeout: 60_000 });
    publish({ type: "project.updated", projectId: rule.projectId });
    return rule;
  }),

  setSiteModel: managerProcedure
    .input(z.object({ projectId: z.string(), siteModelUrl: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.update({ where: { id: input.projectId }, data: { siteModelUrl: input.siteModelUrl } });
    }),

  addMedia: managerProcedure
    .input(
      z.object({
        projectId: z.string(),
        typologyId: z.string().optional(),
        kind: z.string(),
        title: z.string(),
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.db.mediaAsset.count({ where: { projectId: input.projectId } });
      return ctx.db.mediaAsset.create({ data: { ...input, order: count } });
    }),

  removeMedia: managerProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.mediaAsset.delete({ where: { id: input.id } })
  ),
});

export function defaultPresentationBlocks(projectName: string) {
  return [
    { id: "b1", type: "PORTADA", title: projectName, subtitle: "Elige cómo quieres empezar" },
    { id: "b2", type: "UBICACION", title: "Un sector que crece" },
    { id: "b3", type: "AMENIDADES", title: "Zonas comunes" },
    { id: "b4", type: "TIPOLOGIAS", title: "Apartamentos pensados para distintas formas de vivir" },
    { id: "b5", type: "VISOR_3D", title: "Recorre el proyecto" },
    { id: "b6", type: "INVENTARIO", title: "Disponibilidad en tiempo real" },
    { id: "b7", type: "COMPARADOR", title: "Compara tipologías" },
    { id: "b8", type: "COTIZADOR", title: "Cotiza tu apartamento" },
    { id: "b9", type: "CONSTRUCTORA", title: "Respaldo y trayectoria" },
    { id: "b10", type: "CIERRE", title: "Hablemos" },
  ];
}

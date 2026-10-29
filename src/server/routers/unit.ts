import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { managerProcedure, protectedProcedure, publicProcedure, router } from "../trpc";
import { UnitStatus } from "@/lib/domain";
import { publish } from "../events";
import { recomputeProjectPrices } from "../services/inventory";

const unitFilters = z.object({
  projectId: z.string(),
  towerId: z.string().optional(),
  typologyId: z.string().optional(),
  status: UnitStatus.optional(),
  floorMin: z.number().int().optional(),
  floorMax: z.number().int().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  viewTag: z.string().optional(),
  search: z.string().optional(),
});

const unitListInclude = {
  typology: { select: { id: true, code: true, name: true, builtArea: true, privateArea: true, bedrooms: true, bathrooms: true, color: true } },
  tower: { select: { id: true, code: true, name: true } },
} as const;

export const unitRouter = router({
  list: protectedProcedure.input(unitFilters).query(async ({ ctx, input }) => {
    return ctx.db.unit.findMany({
      where: {
        projectId: input.projectId,
        towerId: input.towerId,
        typologyId: input.typologyId,
        status: input.status,
        viewTag: input.viewTag,
        floor: { gte: input.floorMin, lte: input.floorMax },
        listPrice: { gte: input.priceMin, lte: input.priceMax },
        code: input.search ? { contains: input.search } : undefined,
      },
      include: unitListInclude,
      orderBy: [{ tower: { code: "asc" } }, { floor: "desc" }, { position: "asc" }],
    });
  }),

  /** Lista ligera para el visor 3D / presentación pública. */
  publicList: publicProcedure.input(z.object({ token: z.string() })).query(async ({ ctx, input }) => {
    const project = await ctx.db.project.findUnique({ where: { publicToken: input.token }, select: { id: true } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    return ctx.db.unit.findMany({
      where: { projectId: project.id },
      include: unitListInclude,
      orderBy: [{ floor: "desc" }, { position: "asc" }],
    });
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const unit = await ctx.db.unit.findUnique({
      where: { id: input.id },
      include: {
        typology: true,
        tower: true,
        project: { include: { priceRules: true } },
        reservations: { where: { status: "ACTIVA" }, include: { buyer: true, advisor: true } },
        sale: { include: { buyer: true } },
        quotes: { orderBy: { createdAt: "desc" }, take: 10, include: { buyer: true, advisor: true } },
        leads: { include: { buyer: true, advisor: true }, orderBy: { updatedAt: "desc" } },
      },
    });
    if (!unit) throw new TRPCError({ code: "NOT_FOUND" });
    return unit;
  }),

  /** Historial de auditoría de la unidad y de sus separaciones / ventas. */
  history: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const unit = await ctx.db.unit.findUnique({
      where: { id: input.id },
      select: { id: true, reservations: { select: { id: true } }, sale: { select: { id: true } } },
    });
    if (!unit) throw new TRPCError({ code: "NOT_FOUND" });
    const ids = [unit.id, ...unit.reservations.map((r) => r.id), ...(unit.sale ? [unit.sale.id] : [])];
    return ctx.db.auditLog.findMany({
      where: { entityId: { in: ids } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  updateStatus: managerProcedure
    .input(z.object({ id: z.string(), status: UnitStatus, notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.update({
        where: { id: input.id },
        data: { status: input.status, notes: input.notes },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          projectId: unit.projectId,
          entity: "Unit",
          entityId: unit.id,
          action: "STATUS",
          diff: JSON.stringify({ status: input.status }),
        },
      });
      publish({ type: "unit.updated", projectId: unit.projectId, unitId: unit.id, status: unit.status });
      return unit;
    }),

  setPriceOverride: managerProcedure
    .input(z.object({ id: z.string(), priceOverride: z.number().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.update({ where: { id: input.id }, data: { priceOverride: input.priceOverride } });
      publish({ type: "unit.updated", projectId: unit.projectId, unitId: unit.id, status: unit.status });
      return unit;
    }),

  /** Exporta el inventario a Excel (base64) para quienes siguen usando hojas de cálculo. */
  exportExcel: protectedProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ ctx, input }) => {
    const units = await ctx.db.unit.findMany({
      where: { projectId: input.projectId },
      include: { typology: true, tower: true, sale: { include: { buyer: true } }, reservations: { where: { status: "ACTIVA" }, include: { buyer: true } } },
      orderBy: [{ tower: { code: "asc" } }, { floor: "asc" }, { position: "asc" }],
    });
    const rows = units.map((u) => {
      const buyer = u.sale?.buyer ?? u.reservations[0]?.buyer;
      return {
        Codigo: u.code,
        Torre: u.tower.code,
        Piso: u.floor,
        Posicion: u.position,
        Tipologia: u.typology.name,
        "Area construida": u.typology.builtArea,
        "Area privada": u.typology.privateArea,
        Orientacion: u.orientation ?? "",
        Vista: u.viewTag ?? "",
        Estado: u.status,
        "Precio lista": u.listPrice,
        "Precio especial": u.priceOverride ?? "",
        Comprador: buyer ? `${buyer.firstName} ${buyer.lastName}` : "",
        Documento: buyer?.documentNumber ?? "",
        Telefono: buyer?.phone ?? "",
        Notas: u.notes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
    return { filename: `inventario-${Date.now()}.xlsx`, base64 };
  }),

  /**
   * Importa estado y precio especial desde un Excel (columnas Codigo, Estado,
   * Precio especial, Notas). Migración desde los archivos actuales.
   */
  importExcel: managerProcedure
    .input(z.object({ projectId: z.string(), base64: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wb = XLSX.read(Buffer.from(input.base64, "base64"), { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      let updated = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const code = String(row["Codigo"] ?? row["Código"] ?? "").trim();
        if (!code) continue;
        const status = String(row["Estado"] ?? "").toUpperCase().trim();
        const override = row["Precio especial"];
        const data: { status?: string; priceOverride?: number | null; notes?: string } = {};
        if (status) {
          const parsed = UnitStatus.safeParse(status);
          if (!parsed.success) {
            errors.push(`${code}: estado inválido "${status}"`);
            continue;
          }
          data.status = parsed.data;
        }
        if (override !== undefined && override !== "") {
          const n = Number(override);
          if (Number.isFinite(n)) data.priceOverride = n;
        }
        if (row["Notas"]) data.notes = String(row["Notas"]);
        const res = await ctx.db.unit.updateMany({ where: { projectId: input.projectId, code }, data });
        if (res.count === 0) errors.push(`${code}: no existe`);
        else updated += res.count;
      }
      publish({ type: "project.updated", projectId: input.projectId });
      return { updated, errors };
    }),

  recompute: managerProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ ctx, input }) => {
    const n = await ctx.db.$transaction((tx) => recomputeProjectPrices(tx, input.projectId), { timeout: 60_000 });
    publish({ type: "project.updated", projectId: input.projectId });
    return { updated: n };
  }),
});

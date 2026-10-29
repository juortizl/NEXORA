import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { computeQuote } from "@/lib/quote-engine";
import { TypologyVariant, parseJson } from "@/lib/domain";
import { effectivePrice } from "../services/inventory";
import { publish } from "../events";

export const quoteInput = z.object({
  unitId: z.string(),
  buyerId: z.string().optional(),
  discountPct: z.number().min(0).max(0.5).default(0),
  selectedVariants: z.array(z.string()).default([]),
  separation: z.number().min(0).optional(),
  downPaymentPct: z.number().min(0.05).max(1).optional(),
  downPaymentMonths: z.number().int().min(1).max(72).optional(),
  subsidy: z.number().min(0).default(0),
  annualRate: z.number().min(0).max(1).optional(),
  loanYears: z.number().int().min(1).max(30).optional(),
  notes: z.string().optional(),
  validDays: z.number().int().min(1).max(90).default(15),
});

/** Resuelve parámetros y calcula sin persistir (vista previa en vivo). */
async function resolveQuote(db: PrismaClient, input: z.infer<typeof quoteInput>) {
  const unit = await db.unit.findUnique({
    where: { id: input.unitId },
    include: { typology: true, tower: true, project: true },
  });
  if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidad no encontrada" });
  const variants = parseJson(unit.typology.variants, z.array(TypologyVariant), []);
  const variantsTotal = variants
    .filter((v) => input.selectedVariants.includes(v.name))
    .reduce((acc, v) => acc + v.deltaPrice, 0);
  const listPrice = effectivePrice(unit);
  const result = computeQuote({
    listPrice,
    discount: Math.round(listPrice * input.discountPct),
    variantsTotal,
    separation: input.separation ?? unit.project.separationAmount,
    downPaymentPct: input.downPaymentPct ?? unit.project.downPaymentPct,
    downPaymentMonths: input.downPaymentMonths ?? unit.project.downPaymentMonths,
    subsidy: input.subsidy,
    annualRate: input.annualRate ?? unit.project.annualRate,
    loanYears: input.loanYears ?? unit.project.loanYears,
  });
  return { unit, result, variants };
}

export const quoteRouter = router({
  preview: protectedProcedure.input(quoteInput).query(async ({ ctx, input }) => {
    const { unit, result, variants } = await resolveQuote(ctx.db, input);
    return { unitCode: unit.code, typology: unit.typology.name, variants, result };
  }),

  create: protectedProcedure.input(quoteInput).mutation(async ({ ctx, input }) => {
    const { unit, result } = await resolveQuote(ctx.db, input);
    const last = await ctx.db.quote.findFirst({
      where: { unitId: unit.id, buyerId: input.buyerId ?? null },
      orderBy: { version: "desc" },
    });
    const validUntil = new Date(Date.now() + input.validDays * 86_400_000);
    const quote = await ctx.db.quote.create({
      data: {
        projectId: unit.projectId,
        unitId: unit.id,
        buyerId: input.buyerId,
        advisorId: ctx.user.id,
        version: (last?.version ?? 0) + 1,
        listPrice: result.listPrice,
        discount: result.discount,
        variantsTotal: result.variantsTotal,
        finalPrice: result.finalPrice,
        separation: result.separation,
        downPaymentPct: result.downPaymentPct,
        downPaymentTotal: result.downPaymentTotal,
        downPaymentMonths: result.downPaymentMonths,
        downPaymentMonthly: result.downPaymentMonthly,
        subsidy: result.subsidy,
        loanAmount: result.loanAmount,
        annualRate: result.annualRate,
        loanYears: result.loanYears,
        loanMonthly: result.loanMonthly,
        selectedVariants: JSON.stringify(input.selectedVariants),
        notes: input.notes,
        validUntil,
      },
    });
    // Avanza el lead a COTIZADO si existe para este comprador
    if (input.buyerId) {
      await ctx.db.lead.updateMany({
        where: { buyerId: input.buyerId, projectId: unit.projectId, stage: { in: ["LEAD", "VISITA"] } },
        data: { stage: "COTIZADO", unitId: unit.id },
      });
    }
    publish({ type: "quote.created", projectId: unit.projectId, quoteId: quote.id, unitId: unit.id });
    return quote;
  }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string(), unitId: z.string().optional(), buyerId: z.string().optional() }))
    .query(({ ctx, input }) =>
      ctx.db.quote.findMany({
        where: input,
        include: { unit: { include: { typology: true } }, buyer: true, advisor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const quote = await ctx.db.quote.findUnique({
      where: { id: input.id },
      include: {
        unit: { include: { typology: true, tower: true } },
        buyer: true,
        advisor: { select: { name: true, email: true } },
        project: { include: { company: true } },
      },
    });
    if (!quote) throw new TRPCError({ code: "NOT_FOUND" });
    return quote;
  }),
});

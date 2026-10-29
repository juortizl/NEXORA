import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { LeadStage } from "@/lib/domain";
import { publish } from "../events";

const buyerInput = z.object({
  projectId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  documentType: z.string().default("CC"),
  documentNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  monthlyIncome: z.number().min(0).optional(),
  consentAccepted: z.boolean().default(false),
  notes: z.string().optional(),
});

export const crmRouter = router({
  buyers: protectedProcedure
    .input(z.object({ projectId: z.string(), search: z.string().optional() }))
    .query(({ ctx, input }) =>
      ctx.db.buyer.findMany({
        where: {
          projectId: input.projectId,
          OR: input.search
            ? [
                { firstName: { contains: input.search } },
                { lastName: { contains: input.search } },
                { documentNumber: { contains: input.search } },
                { phone: { contains: input.search } },
              ]
            : undefined,
        },
        include: {
          leads: { include: { unit: { select: { code: true } } }, orderBy: { updatedAt: "desc" } },
          _count: { select: { quotes: true, reservations: true, sales: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
    ),

  buyerById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const buyer = await ctx.db.buyer.findUnique({
      where: { id: input.id },
      include: {
        leads: { include: { unit: true, advisor: { select: { name: true } }, tasks: { orderBy: { dueAt: "asc" } } } },
        quotes: { include: { unit: { include: { typology: true } } }, orderBy: { createdAt: "desc" } },
        reservations: { include: { unit: true } },
        sales: { include: { unit: true } },
        documents: true,
      },
    });
    if (!buyer) throw new TRPCError({ code: "NOT_FOUND" });
    return buyer;
  }),

  createBuyer: protectedProcedure
    .input(buyerInput.extend({ unitId: z.string().optional(), source: z.string().optional(), stage: LeadStage.default("LEAD") }))
    .mutation(async ({ ctx, input }) => {
      const { unitId, source, stage, ...data } = input;
      const buyer = await ctx.db.buyer.create({
        data: {
          ...data,
          email: data.email || null,
          consentAt: data.consentAccepted ? new Date() : null,
          leads: {
            create: { projectId: data.projectId, advisorId: ctx.user.id, unitId, source, stage },
          },
        },
        include: { leads: true },
      });
      publish({ type: "lead.updated", projectId: buyer.projectId, leadId: buyer.leads[0].id, stage });
      return buyer;
    }),

  updateBuyer: protectedProcedure
    .input(z.object({ id: z.string(), data: buyerInput.omit({ projectId: true }).partial() }))
    .mutation(({ ctx, input }) =>
      ctx.db.buyer.update({
        where: { id: input.id },
        data: {
          ...input.data,
          email: input.data.email === "" ? null : input.data.email,
          consentAt: input.data.consentAccepted ? new Date() : undefined,
        },
      })
    ),

  leads: protectedProcedure
    .input(z.object({ projectId: z.string(), advisorId: z.string().optional(), stage: LeadStage.optional() }))
    .query(({ ctx, input }) =>
      ctx.db.lead.findMany({
        where: input,
        include: {
          buyer: true,
          unit: { select: { id: true, code: true, listPrice: true, status: true, typology: { select: { name: true, color: true } } } },
          advisor: { select: { id: true, name: true } },
          tasks: { where: { done: false }, orderBy: { dueAt: "asc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      })
    ),

  moveLead: protectedProcedure
    .input(z.object({ id: z.string(), stage: LeadStage, notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.update({
        where: { id: input.id },
        data: { stage: input.stage, notes: input.notes },
      });
      publish({ type: "lead.updated", projectId: lead.projectId, leadId: lead.id, stage: lead.stage });
      return lead;
    }),

  updateLead: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        unitId: z.string().nullable().optional(),
        advisorId: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
        nextAction: z.string().optional(),
        nextActionAt: z.date().nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.lead.update({ where: { id }, data });
    }),

  addTask: protectedProcedure
    .input(z.object({ leadId: z.string(), title: z.string().min(1), dueAt: z.date().optional() }))
    .mutation(({ ctx, input }) => ctx.db.leadTask.create({ data: input })),

  toggleTask: protectedProcedure
    .input(z.object({ id: z.string(), done: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.leadTask.update({ where: { id: input.id }, data: { done: input.done } })),

  addDocument: protectedProcedure
    .input(z.object({ buyerId: z.string(), name: z.string(), kind: z.string().default("OTRO"), url: z.string().url() }))
    .mutation(({ ctx, input }) => ctx.db.buyerDocument.create({ data: input })),

  advisors: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      where: { companyId: ctx.user.companyId, active: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    })
  ),
});

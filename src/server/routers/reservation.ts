import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, protectedProcedure, router } from "../trpc";
import { publish } from "../events";
import { effectivePrice } from "../services/inventory";

export const reservationRouter = router({
  /**
   * Separa una unidad. La transacción relee el estado dentro del lock y
   * falla si la unidad ya no está disponible (evita doble venta).
   */
  reserve: protectedProcedure
    .input(
      z.object({
        unitId: z.string(),
        buyerId: z.string(),
        amount: z.number().min(0),
        expiresInDays: z.number().int().min(1).max(60).default(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async (tx) => {
        // updateMany condicional actúa como bloqueo optimista atómico:
        // sólo pasa a SEPARADO si sigue DISPONIBLE.
        const locked = await tx.unit.updateMany({
          where: { id: input.unitId, status: "DISPONIBLE" },
          data: { status: "SEPARADO" },
        });
        if (locked.count === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "La unidad ya no está disponible" });
        }
        const unit = await tx.unit.findUniqueOrThrow({ where: { id: input.unitId } });
        const reservation = await tx.reservation.create({
          data: {
            unitId: unit.id,
            buyerId: input.buyerId,
            advisorId: ctx.user.id,
            amount: input.amount,
            expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
          },
        });
        await tx.lead.updateMany({
          where: { buyerId: input.buyerId, projectId: unit.projectId, stage: { notIn: ["PROMESA", "ESCRITURADO", "PERDIDO"] } },
          data: { stage: "SEPARADO", unitId: unit.id },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            projectId: unit.projectId,
            entity: "Reservation",
            entityId: reservation.id,
            action: "CREATE",
            diff: JSON.stringify({ unit: unit.code, buyerId: input.buyerId, amount: input.amount }),
          },
        });
        return { reservation, unit };
      });
      publish({ type: "unit.updated", projectId: result.unit.projectId, unitId: result.unit.id, status: "SEPARADO" });
      return result.reservation;
    }),

  cancel: managerProcedure.input(z.object({ reservationId: z.string(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const result = await ctx.db.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { id: input.reservationId },
        data: { status: "CANCELADA" },
      });
      const unit = await tx.unit.update({ where: { id: reservation.unitId }, data: { status: "DISPONIBLE" } });
      await tx.lead.updateMany({
        where: { buyerId: reservation.buyerId, unitId: unit.id, stage: "SEPARADO" },
        data: { stage: "PERDIDO", notes: input.reason },
      });
      await tx.auditLog.create({
        data: { userId: ctx.user.id, projectId: unit.projectId, entity: "Reservation", entityId: reservation.id, action: "CANCEL", diff: input.reason },
      });
      return { reservation, unit };
    });
    publish({ type: "unit.updated", projectId: result.unit.projectId, unitId: result.unit.id, status: "DISPONIBLE" });
    return result.reservation;
  }),

  /** Convierte una separación en venta (promesa). */
  convertToSale: managerProcedure
    .input(z.object({ reservationId: z.string(), price: z.number().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUniqueOrThrow({
          where: { id: input.reservationId },
          include: { unit: true },
        });
        if (reservation.status !== "ACTIVA") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La separación no está activa" });
        }
        const sale = await tx.sale.create({
          data: {
            unitId: reservation.unitId,
            buyerId: reservation.buyerId,
            advisorId: reservation.advisorId,
            price: input.price ?? effectivePrice(reservation.unit),
          },
        });
        await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CONVERTIDA" } });
        const unit = await tx.unit.update({ where: { id: reservation.unitId }, data: { status: "VENDIDO" } });
        await tx.lead.updateMany({
          where: { buyerId: reservation.buyerId, unitId: unit.id },
          data: { stage: "PROMESA" },
        });
        await tx.auditLog.create({
          data: { userId: ctx.user.id, projectId: unit.projectId, entity: "Sale", entityId: sale.id, action: "CREATE" },
        });
        return { sale, unit };
      });
      publish({ type: "unit.updated", projectId: result.unit.projectId, unitId: result.unit.id, status: "VENDIDO" });
      return result.sale;
    }),

  markDeeded: managerProcedure.input(z.object({ saleId: z.string() })).mutation(async ({ ctx, input }) => {
    const sale = await ctx.db.sale.update({ where: { id: input.saleId }, data: { status: "ESCRITURADO" } });
    await ctx.db.lead.updateMany({ where: { buyerId: sale.buyerId, unitId: sale.unitId }, data: { stage: "ESCRITURADO" } });
    return sale;
  }),

  listActive: protectedProcedure.input(z.object({ projectId: z.string() })).query(({ ctx, input }) =>
    ctx.db.reservation.findMany({
      where: { status: "ACTIVA", unit: { projectId: input.projectId } },
      include: { unit: { include: { typology: true } }, buyer: true, advisor: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    })
  ),
});

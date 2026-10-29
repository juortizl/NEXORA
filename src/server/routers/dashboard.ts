import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { LEAD_STAGE_META, type LeadStage } from "@/lib/domain";

export const dashboardRouter = router({
  summary: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => {
    const { projectId } = input;
    const [units, leads, quotes, sales, reservations, advisors] = await Promise.all([
      ctx.db.unit.findMany({
        where: { projectId },
        select: { status: true, floor: true, listPrice: true, priceOverride: true, typology: { select: { name: true, code: true, color: true } }, tower: { select: { code: true } } },
      }),
      ctx.db.lead.findMany({ where: { projectId }, select: { stage: true, advisorId: true, createdAt: true, source: true } }),
      ctx.db.quote.findMany({ where: { projectId }, select: { createdAt: true, finalPrice: true, advisorId: true } }),
      ctx.db.sale.findMany({ where: { unit: { projectId } }, select: { price: true, signedAt: true, advisorId: true, status: true } }),
      ctx.db.reservation.findMany({ where: { unit: { projectId }, status: "ACTIVA" }, select: { amount: true, createdAt: true, advisorId: true, expiresAt: true } }),
      ctx.db.user.findMany({ where: { companyId: ctx.user.companyId, active: true }, select: { id: true, name: true } }),
    ]);

    const total = units.length;
    const byStatus = count(units.map((u) => u.status));
    const sold = byStatus.VENDIDO ?? 0;
    const reserved = byStatus.SEPARADO ?? 0;
    const absorption = total ? (sold + reserved) / total : 0;
    const inventoryValue = units.reduce((a, u) => a + (u.priceOverride ?? u.listPrice), 0);
    const availableValue = units.filter((u) => u.status === "DISPONIBLE").reduce((a, u) => a + (u.priceOverride ?? u.listPrice), 0);
    const soldValue = sales.reduce((a, s) => a + s.price, 0);

    // Ventas por tipología
    const typologies = Array.from(new Set(units.map((u) => u.typology.code)));
    const byTypology = typologies.map((code) => {
      const list = units.filter((u) => u.typology.code === code);
      return {
        code,
        name: list[0].typology.name,
        color: list[0].typology.color,
        total: list.length,
        vendidos: list.filter((u) => u.status === "VENDIDO").length,
        separados: list.filter((u) => u.status === "SEPARADO").length,
        disponibles: list.filter((u) => u.status === "DISPONIBLE").length,
      };
    });

    // Ocupación por piso (para heatmap)
    const floors = Array.from(new Set(units.map((u) => u.floor))).sort((a, b) => a - b);
    const byFloor = floors.map((floor) => {
      const list = units.filter((u) => u.floor === floor);
      return {
        floor,
        total: list.length,
        vendidos: list.filter((u) => u.status === "VENDIDO").length,
        separados: list.filter((u) => u.status === "SEPARADO").length,
      };
    });

    // Embudo
    const funnel = (Object.keys(LEAD_STAGE_META) as LeadStage[])
      .sort((a, b) => LEAD_STAGE_META[a].order - LEAD_STAGE_META[b].order)
      .map((stage) => ({ stage, label: LEAD_STAGE_META[stage].label, count: leads.filter((l) => l.stage === stage).length }));

    // Desempeño por asesor
    const byAdvisor = advisors.map((a) => ({
      id: a.id,
      name: a.name,
      leads: leads.filter((l) => l.advisorId === a.id).length,
      cotizaciones: quotes.filter((q) => q.advisorId === a.id).length,
      separaciones: reservations.filter((r) => r.advisorId === a.id).length,
      ventas: sales.filter((s) => s.advisorId === a.id).length,
      valorVendido: sales.filter((s) => s.advisorId === a.id).reduce((acc, s) => acc + s.price, 0),
    }));

    // Serie mensual de cotizaciones y ventas (últimos 12 meses)
    const months: { key: string; label: string; cotizaciones: number; ventas: number; leads: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }),
        cotizaciones: quotes.filter((q) => monthKey(q.createdAt) === key).length,
        ventas: sales.filter((s) => monthKey(s.signedAt) === key).length,
        leads: leads.filter((l) => monthKey(l.createdAt) === key).length,
      });
    }

    const bySource = count(leads.map((l) => l.source ?? "SIN_FUENTE"));

    return {
      total,
      byStatus,
      absorption,
      inventoryValue,
      availableValue,
      soldValue,
      avgTicket: sales.length ? soldValue / sales.length : 0,
      quotesCount: quotes.length,
      leadsCount: leads.length,
      activeReservations: reservations.length,
      expiringSoon: reservations.filter((r) => r.expiresAt && r.expiresAt.getTime() - Date.now() < 3 * 86_400_000).length,
      byTypology,
      byFloor,
      funnel,
      byAdvisor,
      months,
      bySource,
    };
  }),
});

function count(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

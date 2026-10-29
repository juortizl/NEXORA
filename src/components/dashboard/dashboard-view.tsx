"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Stat } from "@/components/ui/tabs";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { cn, formatCOP, formatCOPCompact, formatDate, formatPct } from "@/lib/utils";

const TOOLTIP_STYLE = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 };

export function DashboardView() {
  const project = useProject();
  useRealtime({ projectId: project.id });
  const { data, isLoading } = trpc.dashboard.summary.useQuery({ projectId: project.id });
  const { data: reservations = [], dataUpdatedAt } = trpc.reservation.listActive.useQuery({ projectId: project.id });
  // Instante de referencia estable por render (se actualiza con cada refetch) para evitar llamar Date.now() al renderizar.
  const now = dataUpdatedAt || 0;
  const expiresSoon = (expiresAt: Date | string | null) => !!expiresAt && new Date(expiresAt).getTime() - now < 3 * 86_400_000;
  const exportExcel = trpc.unit.exportExcel.useMutation({
    onSuccess: ({ filename, base64 }) => {
      const a = document.createElement("a");
      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
      a.download = filename;
      a.click();
    },
  });

  const statusData = useMemo(
    () =>
      data
        ? (Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => ({ name: UNIT_STATUS_META[s].label, value: data.byStatus[s] ?? 0, color: UNIT_STATUS_META[s].hex }))
        : [],
    [data]
  );

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const available = data.byStatus.DISPONIBLE ?? 0;
  const expiring = reservations.filter((r) => expiresSoon(r.expiresAt));

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard gerencial</h1>
          <p className="text-sm text-muted-foreground">Indicadores comerciales de {project.name} en tiempo real.</p>
        </div>
        <Button variant="outline" loading={exportExcel.isPending} onClick={() => exportExcel.mutate({ projectId: project.id })}>
          <Download /> Exportar inventario
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Absorción" value={formatPct(data.absorption, 1)} hint={`${(data.byStatus.VENDIDO ?? 0) + (data.byStatus.SEPARADO ?? 0)} de ${data.total} unidades vendidas o separadas`} />
        <Stat label="Valor vendido" value={formatCOPCompact(data.soldValue)} hint={`Ticket promedio ${formatCOP(data.avgTicket)}`} />
        <Stat label="Inventario disponible" value={available} hint={`${formatCOPCompact(data.availableValue)} por vender`} />
        <Stat
          label="Separaciones activas"
          value={data.activeReservations}
          hint={data.expiringSoon > 0 ? `${data.expiringSoon} vencen en menos de 3 días` : "Ninguna próxima a vencer"}
          className={cn(data.expiringSoon > 0 && "border-amber-500/40")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Estado del inventario</CardTitle>
            <CardDescription>{data.total} unidades</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas por tipología</CardTitle>
            <CardDescription>Disponibles, separados y vendidos por tipo.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byTypology} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" width={70} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="disponibles" name="Disponibles" stackId="a" fill={UNIT_STATUS_META.DISPONIBLE.hex} />
                <Bar dataKey="separados" name="Separados" stackId="a" fill={UNIT_STATUS_META.SEPARADO.hex} />
                <Bar dataKey="vendidos" name="Vendidos" stackId="a" fill={UNIT_STATUS_META.VENDIDO.hex} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Actividad comercial</CardTitle>
            <CardDescription>Leads, cotizaciones y ventas por mes (últimos 12 meses).</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cotizaciones" name="Cotizaciones" stroke="#e0b45a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embudo de ventas</CardTitle>
            <CardDescription>{data.leadsCount} leads en total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.funnel
              .filter((f) => f.stage !== "PERDIDO")
              .map((f, i, arr) => {
                const max = Math.max(1, ...arr.map((x) => x.count));
                return (
                  <div key={f.stage} className="text-xs">
                    <div className="flex justify-between">
                      <span>{f.label}</span>
                      <span className="tabular-nums text-muted-foreground">{f.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${(f.count / max) * 100}%`, opacity: 1 - i * 0.12 }} />
                    </div>
                  </div>
                );
              })}
            <p className="pt-2 text-[11px] text-muted-foreground">Perdidos: {data.funnel.find((f) => f.stage === "PERDIDO")?.count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Desempeño por asesor</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1.5">Asesor</th>
                  <th className="py-1.5 text-right">Leads</th>
                  <th className="py-1.5 text-right">Cotiz.</th>
                  <th className="py-1.5 text-right">Separ.</th>
                  <th className="py-1.5 text-right">Ventas</th>
                  <th className="py-1.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.byAdvisor
                  .filter((a) => a.leads + a.cotizaciones + a.separaciones + a.ventas > 0)
                  .sort((a, b) => b.valorVendido - a.valorVendido || b.ventas - a.ventas)
                  .map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-1.5">{a.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{a.leads}</td>
                      <td className="py-1.5 text-right tabular-nums">{a.cotizaciones}</td>
                      <td className="py-1.5 text-right tabular-nums">{a.separaciones}</td>
                      <td className="py-1.5 text-right tabular-nums">{a.ventas}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatCOPCompact(a.valorVendido)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Separaciones activas
              {expiring.length > 0 && <AlertTriangle className="size-4 text-amber-400" />}
            </CardTitle>
            <CardDescription>Ordenadas por fecha de vencimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reservations.length === 0 && <p className="text-sm text-muted-foreground">No hay separaciones activas.</p>}
            {reservations.map((r) => {
              const soon = expiresSoon(r.expiresAt);
              return (
                <Link
                  key={r.id}
                  href={`/proyectos/${project.slug}/unidades/${r.unit.id}`}
                  className={cn("flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-muted/50", soon && "border-amber-500/40")}
                >
                  <div>
                    <p className="font-medium">
                      {r.unit.code} · {r.unit.typology.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.buyer.firstName} {r.buyer.lastName} · {r.advisor.name}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="tabular-nums">{formatCOP(r.amount)}</p>
                    <p className={cn("text-muted-foreground", soon && "text-amber-400")}>vence {formatDate(r.expiresAt)}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ocupación por piso</CardTitle>
          <CardDescription>Proporción de unidades vendidas o separadas en cada piso.</CardDescription>
        </CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byFloor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="floor" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="separados" name="Separados" stackId="f" fill={UNIT_STATUS_META.SEPARADO.hex} />
              <Bar dataKey="vendidos" name="Vendidos" stackId="f" fill={UNIT_STATUS_META.VENDIDO.hex} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
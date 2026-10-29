"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Mail, Plus, Search, CalendarClock, Building2 } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRealtime } from "@/hooks/use-realtime";
import { useRole } from "@/hooks/use-session-role";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StageBadge, StatusBadge } from "@/components/ui/badge";
import { Tabs, Stat } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { LEAD_STAGE_META, type LeadStage } from "@/lib/domain";
import { cn, formatCOP, formatDate, initials } from "@/lib/utils";
import { BuyerQuickCreate } from "./buyer-quick-create";

const STAGES = (Object.keys(LEAD_STAGE_META) as LeadStage[]).sort((a, b) => LEAD_STAGE_META[a].order - LEAD_STAGE_META[b].order);

export function CrmBoard() {
  const project = useProject();
  const { userId, isManager } = useRole();
  const utils = trpc.useUtils();
  useRealtime({ projectId: project.id });
  const [tab, setTab] = useState<"pipeline" | "buyers">("pipeline");
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { data: leads = [] } = trpc.crm.leads.useQuery({ projectId: project.id });
  const { data: buyers = [] } = trpc.crm.buyers.useQuery({ projectId: project.id, search: search || undefined });
  const { data: advisors = [] } = trpc.crm.advisors.useQuery();

  const moveLead = trpc.crm.moveLead.useMutation({
    onSuccess: () => {
      void utils.crm.invalidate();
      toast.success("Etapa actualizada");
    },
    onError: (e) => toast.error("Error", e.message),
  });
  const updateLead = trpc.crm.updateLead.useMutation({ onSuccess: () => void utils.crm.invalidate() });

  const visibleLeads = useMemo(() => {
    let list = leads;
    if (onlyMine && userId) list = list.filter((l) => l.advisorId === userId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => `${l.buyer.firstName} ${l.buyer.lastName} ${l.buyer.documentNumber ?? ""} ${l.unit?.code ?? ""}`.toLowerCase().includes(q));
    }
    return list;
  }, [leads, onlyMine, userId, search]);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !["ESCRITURADO", "PERDIDO"].includes(l.stage));
    const overdue = leads.filter((l) => l.nextActionAt && new Date(l.nextActionAt) < new Date() && !["ESCRITURADO", "PERDIDO"].includes(l.stage));
    const conv = leads.length ? leads.filter((l) => ["SEPARADO", "PROMESA", "ESCRITURADO"].includes(l.stage)).length / leads.length : 0;
    return { total: leads.length, active: active.length, overdue: overdue.length, conv };
  }, [leads]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CRM comercial</h1>
          <p className="text-sm text-muted-foreground">Compradores, embudo de ventas y seguimiento por asesor.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "pipeline", label: "Pipeline", count: leads.length },
              { value: "buyers", label: "Compradores", count: buyers.length },
            ]}
          />
          <Button variant="accent" onClick={() => setShowNew(true)}>
            <Plus /> Nuevo comprador
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads totales" value={stats.total} />
        <Stat label="En gestión" value={stats.active} />
        <Stat label="Seguimientos vencidos" value={stats.overdue} className={cn(stats.overdue > 0 && "border-amber-500/40")} />
        <Stat label="Conversión a separación" value={`${Math.round(stats.conv * 100)} %`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Buscar comprador, documento o unidad" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Sólo mis leads
        </label>
      </div>

      {tab === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const items = visibleLeads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="flex w-72 shrink-0 flex-col rounded-lg border bg-card/60">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <StageBadge stage={stage} />
                  <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                  {items.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Sin leads</p>}
                  {items.map((l) => {
                    const overdue = l.nextActionAt && new Date(l.nextActionAt) < new Date();
                    return (
                      <div key={l.id} className="rounded-md border bg-card p-3 text-sm shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/proyectos/${project.slug}/crm/${l.buyer.id}`} className="font-medium hover:text-accent">
                            {l.buyer.firstName} {l.buyer.lastName}
                          </Link>
                          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px]" title={l.advisor.name}>
                            {initials(l.advisor.name)}
                          </span>
                        </div>
                        {l.unit ? (
                          <Link href={`/proyectos/${project.slug}/unidades/${l.unit.id}`} className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                            <Building2 className="size-3" /> {l.unit.code} · {l.unit.typology.name} · {formatCOP(l.unit.listPrice)}
                          </Link>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Sin unidad asociada</p>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {l.buyer.phone && (
                            <a href={`https://wa.me/${l.buyer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                              <Phone className="size-3" /> {l.buyer.phone}
                            </a>
                          )}
                          {l.buyer.email && (
                            <a href={`mailto:${l.buyer.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                              <Mail className="size-3" />
                            </a>
                          )}
                        </div>
                        {(l.nextAction || l.tasks[0]) && (
                          <p className={cn("mt-2 flex items-center gap-1 text-[11px]", overdue ? "text-amber-400" : "text-muted-foreground")}>
                            <CalendarClock className="size-3" /> {l.nextAction ?? l.tasks[0]?.title} · {formatDate(l.nextActionAt ?? l.tasks[0]?.dueAt)}
                          </p>
                        )}
                        <div className="mt-2 flex gap-1">
                          <Select
                            value={l.stage}
                            onChange={(e) => moveLead.mutate({ id: l.id, stage: e.target.value as LeadStage })}
                            className="h-7 flex-1 text-xs"
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {LEAD_STAGE_META[s].label}
                              </option>
                            ))}
                          </Select>
                          {isManager && (
                            <Select
                              value={l.advisorId}
                              onChange={(e) => updateLead.mutate({ id: l.id, advisorId: e.target.value })}
                              className="h-7 w-24 text-xs"
                              title="Reasignar asesor"
                            >
                              {advisors.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name.split(" ")[0]}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Comprador</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Unidades de interés</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2 text-right">Cotiz.</th>
                <th className="px-3 py-2">Consentimiento</th>
                <th className="px-3 py-2">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link href={`/proyectos/${project.slug}/crm/${b.id}`} className="font-medium hover:text-accent">
                      {b.firstName} {b.lastName}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {b.documentType} {b.documentNumber ?? "—"} {b.occupation ? `· ${b.occupation}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {b.phone ?? "—"}
                    <br />
                    {b.email ?? ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{b.leads.map((l) => l.unit?.code).filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{b.leads[0] ? <StageBadge stage={b.leads[0].stage} /> : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b._count.quotes}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.consentAccepted ? "DISPONIBLE" : "BLOQUEADO"} className="[&>span:last-child]:hidden" />
                    <span className="ml-1 text-xs">{b.consentAccepted ? "Sí" : "Pendiente"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(b.updatedAt)}</td>
                </tr>
              ))}
              {buyers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No hay compradores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <BuyerQuickCreate open={showNew} onOpenChange={setShowNew} projectId={project.id} onCreated={() => void utils.crm.invalidate()} />
    </div>
  );
}

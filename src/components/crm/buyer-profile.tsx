"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Save, Plus, Check, FileText, Link2, Calculator } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRealtime } from "@/hooks/use-realtime";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StageBadge, StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { LEAD_STAGE_META, type LeadStage } from "@/lib/domain";
import { cn, formatCOP, formatDate, initials } from "@/lib/utils";

const STAGES = (Object.keys(LEAD_STAGE_META) as LeadStage[]).sort((a, b) => LEAD_STAGE_META[a].order - LEAD_STAGE_META[b].order);
const DOC_KINDS = ["CEDULA", "CARTA_LABORAL", "EXTRACTOS", "DECLARACION_RENTA", "PREAPROBADO", "PROMESA", "OTRO"];

export function BuyerProfile({ buyerId }: { buyerId: string }) {
  const project = useProject();
  const utils = trpc.useUtils();
  useRealtime({ projectId: project.id });
  const { data: buyer, isLoading } = trpc.crm.buyerById.useQuery({ id: buyerId });
  const { data: units = [] } = trpc.unit.list.useQuery({ projectId: project.id });

  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // Sincroniza el formulario con la versión del comprador cargada desde el servidor
  // (patrón "ajustar estado cuando cambia una prop", sin efectos).
  const buyerVersion = buyer ? `${buyer.id}:${buyer.updatedAt.toISOString()}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null>(null);
  if (buyer && buyerVersion !== syncedVersion) {
    setSyncedVersion(buyerVersion);
    setForm({
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      documentType: buyer.documentType,
      documentNumber: buyer.documentNumber ?? "",
      phone: buyer.phone ?? "",
      email: buyer.email ?? "",
      address: buyer.address ?? "",
      city: buyer.city ?? "",
      occupation: buyer.occupation ?? "",
      monthlyIncome: buyer.monthlyIncome ? String(buyer.monthlyIncome) : "",
      notes: buyer.notes ?? "",
      consentAccepted: buyer.consentAccepted,
    });
  }

  const update = trpc.crm.updateBuyer.useMutation({
    onSuccess: () => {
      toast.success("Ficha guardada");
      void utils.crm.invalidate();
    },
    onError: (e) => toast.error("No se pudo guardar", e.message),
  });
  const moveLead = trpc.crm.moveLead.useMutation({ onSuccess: () => void utils.crm.invalidate() });
  const updateLead = trpc.crm.updateLead.useMutation({ onSuccess: () => void utils.crm.invalidate() });
  const addTask = trpc.crm.addTask.useMutation({ onSuccess: () => void utils.crm.invalidate() });
  const toggleTask = trpc.crm.toggleTask.useMutation({ onSuccess: () => void utils.crm.invalidate() });
  const addDocument = trpc.crm.addDocument.useMutation({
    onSuccess: () => {
      toast.success("Documento vinculado");
      void utils.crm.invalidate();
    },
    onError: (e) => toast.error("Error", e.message),
  });

  const [newTask, setNewTask] = useState({ title: "", dueAt: "" });
  const [newDoc, setNewDoc] = useState({ name: "", kind: "CEDULA", url: "" });

  if (isLoading || !buyer) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const str = (k: string) => (form[k] as string) ?? "";

  const projectLeads = buyer.leads.filter((l) => l.projectId === project.id);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/proyectos/${project.slug}/crm`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> CRM
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent/20 text-lg font-semibold text-accent">
              {initials(`${buyer.firstName} ${buyer.lastName}`)}
            </span>
            <div>
              <h1 className="text-2xl font-semibold">
                {buyer.firstName} {buyer.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {buyer.documentType} {buyer.documentNumber ?? "—"} · Registrado {formatDate(buyer.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {buyer.phone && (
            <a href={`https://wa.me/${buyer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              <Phone /> WhatsApp
            </a>
          )}
          {buyer.email && (
            <a href={`mailto:${buyer.email}`} className={buttonVariants({ variant: "outline" })}>
              <Mail /> Correo
            </a>
          )}
          <Link href={`/proyectos/${project.slug}/cotizador${projectLeads[0]?.unitId ? `?unit=${projectLeads[0].unitId}` : ""}`} className={buttonVariants({ variant: "accent" })}>
            <Calculator /> Cotizar
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del comprador</CardTitle>
            <CardDescription>Información personal, laboral y de contacto.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate({
                  id: buyer.id,
                  data: {
                    firstName: str("firstName"),
                    lastName: str("lastName"),
                    documentType: str("documentType"),
                    documentNumber: str("documentNumber") || undefined,
                    phone: str("phone") || undefined,
                    email: str("email"),
                    address: str("address") || undefined,
                    city: str("city") || undefined,
                    occupation: str("occupation") || undefined,
                    monthlyIncome: str("monthlyIncome") ? Number(str("monthlyIncome")) : undefined,
                    notes: str("notes") || undefined,
                    consentAccepted: Boolean(form.consentAccepted),
                  },
                });
              }}
            >
              <Field label="Nombres">
                <Input value={str("firstName")} onChange={set("firstName")} required />
              </Field>
              <Field label="Apellidos">
                <Input value={str("lastName")} onChange={set("lastName")} required />
              </Field>
              <Field label="Tipo y número de documento">
                <div className="flex gap-1">
                  <Select value={str("documentType")} onChange={set("documentType")} className="w-20">
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="PAS">PAS</option>
                    <option value="NIT">NIT</option>
                  </Select>
                  <Input value={str("documentNumber")} onChange={set("documentNumber")} />
                </div>
              </Field>
              <Field label="Celular">
                <Input value={str("phone")} onChange={set("phone")} />
              </Field>
              <Field label="Correo">
                <Input type="email" value={str("email")} onChange={set("email")} />
              </Field>
              <Field label="Ciudad">
                <Input value={str("city")} onChange={set("city")} />
              </Field>
              <Field label="Dirección" className="sm:col-span-2">
                <Input value={str("address")} onChange={set("address")} />
              </Field>
              <Field label="Ocupación">
                <Input value={str("occupation")} onChange={set("occupation")} />
              </Field>
              <Field label="Ingreso mensual (COP)" hint="Base para evaluar capacidad de crédito.">
                <Input type="number" value={str("monthlyIncome")} onChange={set("monthlyIncome")} step={100000} />
              </Field>
              <Field label="Notas" className="col-span-2 sm:col-span-3">
                <Textarea value={str("notes")} onChange={set("notes")} />
              </Field>
              <label className="col-span-2 flex items-start gap-2 text-xs text-muted-foreground sm:col-span-3">
                <input type="checkbox" checked={Boolean(form.consentAccepted)} onChange={set("consentAccepted")} className="mt-0.5" />
                Autorización de tratamiento de datos personales (Ley 1581 de 2012){buyer.consentAt ? ` · aceptada ${formatDate(buyer.consentAt)}` : ""}
              </label>
              <div className="col-span-2 flex justify-end sm:col-span-3">
                <Button type="submit" variant="accent" loading={update.isPending}>
                  <Save /> Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Oportunidades</CardTitle>
              <CardDescription>Etapa y unidad de interés en {project.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectLeads.length === 0 && <p className="text-sm text-muted-foreground">Sin oportunidades activas.</p>}
              {projectLeads.map((l) => (
                <div key={l.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <StageBadge stage={l.stage} />
                    <span className="text-xs text-muted-foreground">{l.advisor.name}</span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    <Select value={l.stage} onChange={(e) => moveLead.mutate({ id: l.id, stage: e.target.value as LeadStage })} className="h-8 text-xs">
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STAGE_META[s].label}
                        </option>
                      ))}
                    </Select>
                    <Select value={l.unitId ?? ""} onChange={(e) => updateLead.mutate({ id: l.id, unitId: e.target.value || null })} className="h-8 text-xs">
                      <option value="">Sin unidad</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} · {u.typology.name} · {formatCOP(u.listPrice)} {u.status !== "DISPONIBLE" ? `(${u.status.toLowerCase()})` : ""}
                        </option>
                      ))}
                    </Select>
                    {l.unit && (
                      <Link href={`/proyectos/${project.slug}/unidades/${l.unit.id}`} className="text-xs text-accent hover:underline">
                        Ver ficha de {l.unit.code} →
                      </Link>
                    )}
                  </div>
                  <div className="mt-3 border-t pt-2">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Tareas</p>
                    {l.tasks.map((t) => (
                      <label key={t.id} className={cn("flex items-center gap-2 py-0.5 text-xs", t.done && "text-muted-foreground line-through")}>
                        <input type="checkbox" checked={t.done} onChange={(e) => toggleTask.mutate({ id: t.id, done: e.target.checked })} />
                        {t.title} {t.dueAt && <span className="text-muted-foreground">· {formatDate(t.dueAt)}</span>}
                      </label>
                    ))}
                    <form
                      className="mt-1 flex gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newTask.title) return;
                        addTask.mutate({ leadId: l.id, title: newTask.title, dueAt: newTask.dueAt ? new Date(newTask.dueAt) : undefined });
                        setNewTask({ title: "", dueAt: "" });
                      }}
                    >
                      <Input value={newTask.title} onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))} placeholder="Llamar, enviar documentos…" className="h-8 text-xs" />
                      <Input type="date" value={newTask.dueAt} onChange={(e) => setNewTask((t) => ({ ...t, dueAt: e.target.value }))} className="h-8 w-36 text-xs" />
                      <Button type="submit" size="sm" variant="outline">
                        <Plus />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Separaciones y ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {buyer.reservations.length === 0 && buyer.sales.length === 0 && <p className="text-muted-foreground">Sin separaciones registradas.</p>}
            {buyer.reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <Link href={`/proyectos/${project.slug}/unidades/${r.unit.id}`} className="font-medium hover:text-accent">
                    {r.unit.code}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Separación {formatCOP(r.amount)} · vence {formatDate(r.expiresAt)}
                  </p>
                </div>
                <span className="text-xs">{r.status}</span>
              </div>
            ))}
            {buyer.sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-emerald-500/40 p-2.5">
                <div>
                  <Link href={`/proyectos/${project.slug}/unidades/${s.unit.id}`} className="font-medium hover:text-accent">
                    {s.unit.code}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Venta {formatCOP(s.price)} · {formatDate(s.createdAt)}
                  </p>
                </div>
                <StatusBadge status="VENDIDO" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {buyer.quotes.length === 0 && <p className="text-muted-foreground">Sin cotizaciones.</p>}
            {buyer.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="font-medium">
                    {q.unit.code} · {q.unit.typology.name} · v{q.version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCOP(q.finalPrice)} · {formatDate(q.createdAt)}
                  </p>
                </div>
                <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FileText /> PDF
                </a>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
            <CardDescription>Enlaces a documentos en Drive, SharePoint u otro almacenamiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {buyer.documents.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border p-2.5 hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <Link2 className="size-3.5 text-muted-foreground" /> {d.name}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">{d.kind}</span>
              </a>
            ))}
            <form
              className="space-y-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                addDocument.mutate({ buyerId: buyer.id, ...newDoc });
                setNewDoc({ name: "", kind: "CEDULA", url: "" });
              }}
            >
              <div className="flex gap-1">
                <Input value={newDoc.name} onChange={(e) => setNewDoc((d) => ({ ...d, name: e.target.value }))} placeholder="Nombre" className="h-8 text-xs" required />
                <Select value={newDoc.kind} onChange={(e) => setNewDoc((d) => ({ ...d, kind: e.target.value }))} className="h-8 w-36 text-xs">
                  {DOC_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-1">
                <Input type="url" value={newDoc.url} onChange={(e) => setNewDoc((d) => ({ ...d, url: e.target.value }))} placeholder="https://…" className="h-8 text-xs" required />
                <Button type="submit" size="sm" variant="outline" loading={addDocument.isPending}>
                  <Check />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

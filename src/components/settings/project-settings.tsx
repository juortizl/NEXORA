"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Plus, RefreshCw, Save, Trash2, Image as ImageIcon, History, Palette } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRole } from "@/hooks/use-session-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { MediaKind, PriceRuleCriteria, PriceRuleKind, ProjectStage, parseJson } from "@/lib/domain";
import { formatCOP, formatDate } from "@/lib/utils";

const RULE_LABEL: Record<PriceRuleKind, string> = {
  FLOOR_INCREMENT: "Incremento por piso",
  VIEW_PREMIUM: "Prima por vista",
  POSITION_PREMIUM: "Prima por posición",
  TYPOLOGY_ADJUST: "Ajuste por tipología",
};

type Tab = "general" | "precios" | "modelo" | "medios" | "auditoria";

export function ProjectSettings() {
  const project = useProject();
  const { isManager, isAdmin } = useRole();
  const [tab, setTab] = useState<Tab>("general");

  if (!isManager) {
    return <div className="p-6 text-sm text-muted-foreground">La configuración del proyecto está disponible para gerencia y administración.</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de {project.name}</h1>
          <p className="text-sm text-muted-foreground">Parámetros comerciales, reglas de precio, modelo 3D y recursos del proyecto.</p>
        </div>
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "general", label: "General" },
            { value: "precios", label: "Reglas de precio", count: project.priceRules.length },
            { value: "modelo", label: "Modelo 3D" },
            { value: "medios", label: "Medios", count: project.mediaAssets.length },
            ...(isAdmin ? [{ value: "auditoria" as Tab, label: "Auditoría" }] : []),
          ]}
        />
      </div>
      {tab === "general" && <GeneralTab />}
      {tab === "precios" && <PriceRulesTab />}
      {tab === "modelo" && <ModelTab />}
      {tab === "medios" && <MediaTab />}
      {tab === "auditoria" && <AuditTab />}
    </div>
  );
}

function GeneralTab() {
  const project = useProject();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: project.name,
    tagline: project.tagline ?? "",
    description: project.description ?? "",
    city: project.city ?? "",
    address: project.address ?? "",
    latitude: project.latitude?.toString() ?? "",
    longitude: project.longitude?.toString() ?? "",
    stage: project.stage,
    priceValidUntil: project.priceValidUntil ? new Date(project.priceValidUntil).toISOString().slice(0, 10) : "",
    deliveryDate: project.deliveryDate ? new Date(project.deliveryDate).toISOString().slice(0, 10) : "",
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    accentColor: project.accentColor,
    logoUrl: project.logoUrl ?? "",
    heroImageUrl: project.heroImageUrl ?? "",
    separationAmount: project.separationAmount,
    downPaymentPct: Math.round(project.downPaymentPct * 100),
    downPaymentMonths: project.downPaymentMonths,
    annualRate: Math.round(project.annualRate * 1000) / 10,
    loanYears: project.loanYears,
  });
  const update = trpc.project.update.useMutation({
    onSuccess: () => {
      toast.success("Proyecto actualizado");
      void utils.project.invalidate();
      router.refresh();
    },
    onError: (e) => toast.error("No se pudo guardar", e.message),
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({
          id: project.id,
          data: {
            name: form.name,
            tagline: form.tagline || undefined,
            description: form.description || undefined,
            city: form.city || undefined,
            address: form.address || undefined,
            latitude: form.latitude ? Number(form.latitude) : undefined,
            longitude: form.longitude ? Number(form.longitude) : undefined,
            stage: form.stage as never,
            priceValidUntil: form.priceValidUntil ? new Date(form.priceValidUntil) : undefined,
            deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : undefined,
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            accentColor: form.accentColor,
            logoUrl: form.logoUrl || undefined,
            heroImageUrl: form.heroImageUrl || undefined,
            separationAmount: Number(form.separationAmount),
            downPaymentPct: Number(form.downPaymentPct) / 100,
            downPaymentMonths: Number(form.downPaymentMonths),
            annualRate: Number(form.annualRate) / 100,
            loanYears: Number(form.loanYears),
          },
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Identidad del proyecto</CardTitle>
          <CardDescription>Nombre, ubicación, etapa y marca.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Nombre" className="col-span-2">
            <Input value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Eslogan" className="col-span-2">
            <Input value={form.tagline} onChange={set("tagline")} />
          </Field>
          <Field label="Descripción" className="col-span-2">
            <Textarea value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Ciudad">
            <Input value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Etapa">
            <Select value={form.stage} onChange={set("stage")}>
              {ProjectStage.options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dirección" className="col-span-2">
            <Input value={form.address} onChange={set("address")} />
          </Field>
          <Field label="Latitud">
            <Input value={form.latitude} onChange={set("latitude")} placeholder="6.33" />
          </Field>
          <Field label="Longitud">
            <Input value={form.longitude} onChange={set("longitude")} placeholder="-75.55" />
          </Field>
          <Field label="Precios vigentes hasta">
            <Input type="date" value={form.priceValidUntil} onChange={set("priceValidUntil")} />
          </Field>
          <Field label="Fecha de entrega">
            <Input type="date" value={form.deliveryDate} onChange={set("deliveryDate")} />
          </Field>
          <Field label="Color primario">
            <div className="flex gap-2">
              <input type="color" value={form.primaryColor} onChange={set("primaryColor")} className="h-9 w-12 rounded border bg-transparent" />
              <Input value={form.primaryColor} onChange={set("primaryColor")} />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex gap-2">
              <input type="color" value={form.secondaryColor} onChange={set("secondaryColor")} className="h-9 w-12 rounded border bg-transparent" />
              <Input value={form.secondaryColor} onChange={set("secondaryColor")} />
            </div>
          </Field>
          <Field label="Color de acento">
            <div className="flex gap-2">
              <input type="color" value={form.accentColor} onChange={set("accentColor")} className="h-9 w-12 rounded border bg-transparent" />
              <Input value={form.accentColor} onChange={set("accentColor")} />
            </div>
          </Field>
          <div className="flex items-end">
            <div className="flex h-9 w-full items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground">
              <Palette className="size-4" /> Vista previa
              <span className="ml-auto flex gap-1">
                <span className="size-4 rounded" style={{ background: form.primaryColor }} />
                <span className="size-4 rounded" style={{ background: form.secondaryColor }} />
                <span className="size-4 rounded" style={{ background: form.accentColor }} />
              </span>
            </div>
          </div>
          <Field label="Logo (URL)">
            <Input value={form.logoUrl} onChange={set("logoUrl")} placeholder="https://…/logo.svg" />
          </Field>
          <Field label="Imagen principal (URL)">
            <Input value={form.heroImageUrl} onChange={set("heroImageUrl")} placeholder="https://…/render.jpg" />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Parámetros financieros por defecto</CardTitle>
            <CardDescription>Valores iniciales del cotizador y del comparador.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Separación (COP)">
              <Input type="number" value={form.separationAmount} onChange={set("separationAmount")} step={100000} />
            </Field>
            <Field label="Cuota inicial (%)">
              <Input type="number" value={form.downPaymentPct} onChange={set("downPaymentPct")} min={0} max={100} />
            </Field>
            <Field label="Plazo cuota inicial (meses)">
              <Input type="number" value={form.downPaymentMonths} onChange={set("downPaymentMonths")} min={1} />
            </Field>
            <Field label="Tasa crédito E.A. (%)">
              <Input type="number" value={form.annualRate} onChange={set("annualRate")} step={0.1} />
            </Field>
            <Field label="Plazo crédito (años)">
              <Input type="number" value={form.loanYears} onChange={set("loanYears")} min={1} max={30} />
            </Field>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" variant="accent" loading={update.isPending}>
            <Save /> Guardar cambios
          </Button>
        </div>
      </div>
    </form>
  );
}

function PriceRulesTab() {
  const project = useProject();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<null | {
    id?: string;
    kind: PriceRuleKind;
    label: string;
    value: string;
    isPercent: boolean;
    active: boolean;
    criteria: PriceRuleCriteria;
  }>(null);

  const refresh = () => {
    void utils.project.invalidate();
    void utils.unit.invalidate();
    router.refresh();
  };
  const upsert = trpc.project.upsertPriceRule.useMutation({
    onSuccess: () => {
      toast.success("Regla guardada", "Los precios de lista se recalcularon.");
      setEditing(null);
      refresh();
    },
    onError: (e) => toast.error("Error", e.message),
  });
  const remove = trpc.project.deletePriceRule.useMutation({
    onSuccess: () => {
      toast.success("Regla eliminada");
      refresh();
    },
  });
  const recompute = trpc.project.recomputePrices.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.updated} precios recalculados`);
      void utils.unit.invalidate();
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Reglas de precio</CardTitle>
          <CardDescription>Se aplican sobre el precio base de cada tipología para generar la lista de precios. Reemplazan la fórmula del Excel.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={recompute.isPending} onClick={() => recompute.mutate({ projectId: project.id })}>
            <RefreshCw /> Recalcular
          </Button>
          <Button variant="accent" size="sm" onClick={() => setEditing({ kind: "FLOOR_INCREMENT", label: "", value: "", isPercent: true, active: true, criteria: {} })}>
            <Plus /> Nueva regla
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Regla</th>
              <th className="py-2">Tipo</th>
              <th className="py-2 pr-6 text-right">Valor</th>
              <th className="py-2 pl-2">Criterios</th>
              <th className="py-2">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {project.priceRules.map((r) => {
              const c = parseJson(r.criteria, PriceRuleCriteria, {});
              return (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-medium">{r.label}</td>
                  <td className="py-2 text-xs text-muted-foreground">{RULE_LABEL[r.kind as PriceRuleKind] ?? r.kind}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{r.isPercent ? `${(r.value * 100).toFixed(2)} %` : formatCOP(r.value)}</td>
                  <td className="py-2 pl-2 text-xs text-muted-foreground">{describeCriteria(c)}</td>
                  <td className="py-2 text-xs">{r.active ? "Activa" : "Inactiva"}</td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          kind: r.kind as PriceRuleKind,
                          label: r.label,
                          value: r.isPercent ? String(r.value * 100) : String(r.value),
                          isPercent: r.isPercent,
                          active: r.active,
                          criteria: c,
                        })
                      }
                    >
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => confirm(`¿Eliminar la regla "${r.label}"?`) && remove.mutate({ id: r.id })}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {project.priceRules.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Sin reglas: el precio de lista es igual al precio base de la tipología.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? "Editar regla" : "Nueva regla de precio"}>
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              upsert.mutate({
                id: editing.id,
                projectId: project.id,
                kind: editing.kind,
                label: editing.label,
                value: editing.isPercent ? Number(editing.value) / 100 : Number(editing.value),
                isPercent: editing.isPercent,
                active: editing.active,
                criteria: editing.criteria as Record<string, unknown>,
                order: project.priceRules.length,
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" className="col-span-2">
                <Select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as PriceRuleKind })}>
                  {PriceRuleKind.options.map((k) => (
                    <option key={k} value={k}>
                      {RULE_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nombre" className="col-span-2">
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} required placeholder="Incremento por altura" />
              </Field>
              <Field label={editing.isPercent ? "Valor (%)" : "Valor (COP)"} hint={editing.kind === "FLOOR_INCREMENT" ? "Por cada piso por encima de 'Desde piso'." : "Se aplica una vez si el criterio coincide."}>
                <Input type="number" step="any" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} required />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <Switch checked={editing.isPercent} onCheckedChange={(v) => setEditing({ ...editing, isPercent: v })} label="Porcentual" />
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} label="Activa" />
              </div>
              <Field label="Desde piso">
                <Input type="number" value={editing.criteria.fromFloor ?? ""} onChange={(e) => setEditing({ ...editing, criteria: { ...editing.criteria, fromFloor: e.target.value ? Number(e.target.value) : undefined } })} />
              </Field>
              <Field label="Hasta piso">
                <Input type="number" value={editing.criteria.toFloor ?? ""} onChange={(e) => setEditing({ ...editing, criteria: { ...editing.criteria, toFloor: e.target.value ? Number(e.target.value) : undefined } })} />
              </Field>
              <Field label="Vista">
                <Input value={editing.criteria.viewTag ?? ""} onChange={(e) => setEditing({ ...editing, criteria: { ...editing.criteria, viewTag: e.target.value || undefined } })} placeholder="QUITASOL" />
              </Field>
              <Field label="Posiciones" hint="Separadas por coma">
                <Input
                  value={editing.criteria.positions?.join(",") ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      criteria: { ...editing.criteria, positions: e.target.value ? e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)) : undefined },
                    })
                  }
                  placeholder="1,8"
                />
              </Field>
              <Field label="Tipología">
                <Select value={editing.criteria.typologyCode ?? ""} onChange={(e) => setEditing({ ...editing, criteria: { ...editing.criteria, typologyCode: e.target.value || undefined } })}>
                  <option value="">Todas</option>
                  {project.typologies.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Torre">
                <Select value={editing.criteria.towerCode ?? ""} onChange={(e) => setEditing({ ...editing, criteria: { ...editing.criteria, towerCode: e.target.value || undefined } })}>
                  <option value="">Todas</option>
                  {project.towers.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="accent" loading={upsert.isPending}>
                Guardar y recalcular
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </Card>
  );
}

function describeCriteria(c: PriceRuleCriteria) {
  const parts: string[] = [];
  if (c.fromFloor !== undefined) parts.push(`desde piso ${c.fromFloor}`);
  if (c.toFloor !== undefined) parts.push(`hasta piso ${c.toFloor}`);
  if (c.viewTag) parts.push(`vista ${c.viewTag}`);
  if (c.positions?.length) parts.push(`posiciones ${c.positions.join(", ")}`);
  if (c.typologyCode) parts.push(`tipología ${c.typologyCode}`);
  if (c.towerCode) parts.push(`torre ${c.towerCode}`);
  return parts.length ? parts.join(" · ") : "Todas las unidades";
}

function ModelTab() {
  const project = useProject();
  const router = useRouter();
  const [url, setUrl] = useState(project.siteModelUrl ?? "");
  const setModel = trpc.project.setSiteModel.useMutation({
    onSuccess: () => {
      toast.success("Modelo actualizado", "Recarga el visor para ver los cambios.");
      router.refresh();
    },
    onError: (e) => toast.error("Error", e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="size-4" /> Modelo 3D del proyecto
          </CardTitle>
          <CardDescription>URL pública del archivo .glb optimizado. Si está vacío, el visor usa la torre paramétrica generada desde la matriz de pisos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="URL del modelo (.glb)" hint="Súbelo a un bucket (S3/R2/Cloudinary) o a /public/models y pega la URL.">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cdn.tuconstructora.com/nortiko/site.glb" />
          </Field>
          <div className="flex gap-2">
            <Button variant="accent" loading={setModel.isPending} onClick={() => setModel.mutate({ projectId: project.id, siteModelUrl: url || null })}>
              <Save /> Guardar
            </Button>
            {project.siteModelUrl && (
              <Button variant="ghost" onClick={() => setModel.mutate({ projectId: project.id, siteModelUrl: null })}>
                Quitar modelo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Convención de nombres</CardTitle>
          <CardDescription>Para que el visor pinte y seleccione apartamentos, cada malla del modelo debe nombrarse así:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-md bg-muted p-3 font-mono text-xs">{`<TORRE>_P<PISO 2 dígitos>_U<POSICIÓN 2 dígitos>\nEjemplos: T1_P12_U04, T2_P03_U08`}</pre>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Exporta desde Revit/SketchUp/Blender a glTF binario (.glb) con las mallas de apartamentos separadas.</li>
            <li>
              Optimiza con <code className="font-mono text-xs">npm run model:optimize -- entrada.glb salida.glb</code> (Draco + texturas WebP).
            </li>
            <li>
              Valida nombres con <code className="font-mono text-xs">npm run model:validate -- salida.glb {project.slug}</code>.
            </li>
            <li>Los nodos de las torres pueden llamarse por su código ({project.towers.map((t) => t.code).join(", ")}).</li>
          </ul>
          <p className="text-xs text-muted-foreground">Guía completa en docs/pipeline-3d.md.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MediaTab() {
  const project = useProject();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ kind: "RENDER", title: "", url: "", typologyId: "" });
  const add = trpc.project.addMedia.useMutation({
    onSuccess: () => {
      toast.success("Recurso agregado");
      setForm({ kind: "RENDER", title: "", url: "", typologyId: "" });
      void utils.project.invalidate();
      router.refresh();
    },
    onError: (e) => toast.error("Error", e.message),
  });
  const remove = trpc.project.removeMedia.useMutation({
    onSuccess: () => {
      void utils.project.invalidate();
      router.refresh();
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" /> Agregar recurso
          </CardTitle>
          <CardDescription>Renders, plantas por tipología, fotos, logos y PDFs. Se alojan en un bucket externo (el disco de Render es efímero).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate({ projectId: project.id, kind: form.kind, title: form.title, url: form.url, typologyId: form.typologyId || undefined });
            }}
          >
            <Field label="Tipo">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {MediaKind.options.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            <Field label="URL">
              <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required placeholder="https://…" />
            </Field>
            {form.kind === "PLANTA" && (
              <Field label="Tipología">
                <Select value={form.typologyId} onChange={(e) => setForm({ ...form, typologyId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {project.typologies.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button type="submit" variant="accent" loading={add.isPending} className="w-full">
              <Plus /> Agregar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recursos del proyecto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {project.mediaAssets.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay recursos.</p>}
          {project.mediaAssets.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-lg border">
              {["RENDER", "PLANTA", "FOTO", "LOGO"].includes(m.kind) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.title} className="h-32 w-full bg-muted object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">{m.kind}</div>
              )}
              <div className="flex items-center justify-between p-2 text-xs">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-muted-foreground">
                    {m.kind}
                    {m.typologyId ? ` · ${project.typologies.find((t) => t.id === m.typologyId)?.name ?? ""}` : ""}
                  </p>
                </div>
                <button onClick={() => remove.mutate({ id: m.id })} className="rounded p-1 text-rose-400 hover:bg-muted" aria-label="Eliminar">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const project = useProject();
  const { data = [] } = trpc.admin.auditLog.useQuery({ projectId: project.id, take: 100 });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Auditoría
        </CardTitle>
        <CardDescription>Últimos 100 movimientos registrados en el proyecto.</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Usuario</th>
              <th className="py-2">Entidad</th>
              <th className="py-2">Acción</th>
              <th className="py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-1.5 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                <td className="py-1.5">{a.user?.name ?? "Sistema"}</td>
                <td className="py-1.5">{a.entity}</td>
                <td className="py-1.5">{a.action}</td>
                <td className="max-w-md truncate py-1.5 font-mono text-[11px] text-muted-foreground">{a.diff ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

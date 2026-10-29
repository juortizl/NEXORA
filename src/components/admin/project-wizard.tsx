"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Rocket, Building2, LayoutGrid, Percent, ClipboardList } from "lucide-react";
import { trpc } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { Orientation, ProjectStage, type PriceRuleKind } from "@/lib/domain";
import { cn, formatCOP, slugify } from "@/lib/utils";

type Typology = {
  code: string;
  name: string;
  description: string;
  builtArea: string;
  privateArea: string;
  bedrooms: string;
  bathrooms: string;
  basePrice: string;
  color: string;
  features: string;
};

type MatrixRow = { position: number; typologyCode: string; orientation: string; viewTag: string };

type Tower = {
  code: string;
  name: string;
  floors: string;
  firstResidentialFloor: string;
  unitsPerFloor: string;
  positionX: string;
  positionZ: string;
  releaseStatus: string;
  matrix: MatrixRow[];
};

type Rule = { kind: PriceRuleKind; label: string; value: string; isPercent: boolean; fromFloor: string; viewTag: string; positions: string; typologyCode: string };

const PALETTE = ["#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#fb923c", "#facc15"];

const STEPS = [
  { id: "datos", label: "Proyecto", icon: Building2 },
  { id: "tipologias", label: "Tipologías", icon: LayoutGrid },
  { id: "torres", label: "Torres y pisos", icon: Building2 },
  { id: "precios", label: "Reglas de precio", icon: Percent },
  { id: "revision", label: "Revisión", icon: ClipboardList },
];

export function ProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [data, setData] = useState({
    name: "",
    tagline: "",
    description: "",
    city: "",
    address: "",
    stage: "PREVENTA",
    priceValidUntil: "",
    deliveryDate: "",
    primaryColor: "#0f172a",
    secondaryColor: "#1e3a5f",
    accentColor: "#c9a227",
    separationAmount: "2000000",
    downPaymentPct: "30",
    downPaymentMonths: "36",
    annualRate: "12",
    loanYears: "20",
    amenities: "Piscina\nGimnasio\nSalón social\nZona BBQ\nCoworking",
    pois: "Estación Metro · 5 · TRANSPORTE · SECTOR\nCentro comercial · 8 · COMERCIO · SECTOR\nHospital · 12 · SALUD · CIUDAD",
  });

  const [typologies, setTypologies] = useState<Typology[]>([
    { code: "A", name: "Tipo A", description: "", builtArea: "40", privateArea: "36", bedrooms: "1", bathrooms: "1", basePrice: "190000000", color: PALETTE[0], features: "Cocina abierta\nBalcón" },
    { code: "B", name: "Tipo B", description: "", builtArea: "52", privateArea: "46", bedrooms: "2", bathrooms: "2", basePrice: "240000000", color: PALETTE[1], features: "Dos alcobas\nEstudio" },
  ]);

  const [towers, setTowers] = useState<Tower[]>([
    { code: "T1", name: "Torre 1", floors: "20", firstResidentialFloor: "2", unitsPerFloor: "6", positionX: "0", positionZ: "0", releaseStatus: "EN_VENTA", matrix: buildMatrix(6, ["A", "B"]) },
  ]);

  const [rules, setRules] = useState<Rule[]>([
    { kind: "FLOOR_INCREMENT", label: "Incremento por altura", value: "0.5", isPercent: true, fromFloor: "2", viewTag: "", positions: "", typologyCode: "" },
  ]);

  const create = trpc.project.create.useMutation({
    onSuccess: (p) => {
      toast.success("Proyecto creado", "Inventario, precios y presentación generados.");
      router.push(`/proyectos/${p.slug}`);
    },
    onError: (e) => toast.error("No se pudo crear el proyecto", e.message),
  });

  const totalUnits = useMemo(
    () => towers.reduce((a, t) => a + Math.max(0, Number(t.floors) - Number(t.firstResidentialFloor) + 1) * t.matrix.length, 0),
    [towers]
  );

  const errors = useMemo(() => {
    const e: string[] = [];
    if (data.name.trim().length < 2) e.push("El proyecto necesita un nombre.");
    if (typologies.length === 0) e.push("Define al menos una tipología.");
    typologies.forEach((t) => {
      if (!t.code || !t.name) e.push("Toda tipología necesita código y nombre.");
      if (Number(t.basePrice) <= 0) e.push(`La tipología ${t.code} necesita precio base.`);
    });
    const codes = new Set(typologies.map((t) => t.code));
    towers.forEach((t) => {
      if (!t.code || !t.name) e.push("Toda torre necesita código y nombre.");
      t.matrix.forEach((m) => {
        if (!codes.has(m.typologyCode)) e.push(`${t.code} posición ${m.position}: tipología "${m.typologyCode}" no existe.`);
      });
    });
    return Array.from(new Set(e));
  }, [data.name, typologies, towers]);

  function submit() {
    create.mutate({
      name: data.name,
      slug: slugify(data.name),
      tagline: data.tagline || undefined,
      description: data.description || undefined,
      city: data.city || undefined,
      address: data.address || undefined,
      stage: data.stage as never,
      priceValidUntil: data.priceValidUntil ? new Date(data.priceValidUntil) : undefined,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      separationAmount: Number(data.separationAmount),
      downPaymentPct: Number(data.downPaymentPct) / 100,
      downPaymentMonths: Number(data.downPaymentMonths),
      annualRate: Number(data.annualRate) / 100,
      loanYears: Number(data.loanYears),
      typologies: typologies.map((t) => ({
        code: t.code,
        name: t.name,
        description: t.description || undefined,
        builtArea: Number(t.builtArea),
        privateArea: Number(t.privateArea),
        bedrooms: Number(t.bedrooms),
        bathrooms: Number(t.bathrooms),
        basePrice: Number(t.basePrice),
        color: t.color,
        features: t.features.split("\n").map((s) => s.trim()).filter(Boolean),
        variants: [],
      })),
      towers: towers.map((t, i) => ({
        code: t.code,
        name: t.name,
        floors: Number(t.floors),
        firstResidentialFloor: Number(t.firstResidentialFloor),
        positionX: Number(t.positionX) || i * 45,
        positionZ: Number(t.positionZ) || 0,
        releaseStatus: t.releaseStatus,
        matrix: t.matrix.map((m) => ({ position: m.position, typologyCode: m.typologyCode, orientation: m.orientation || undefined, viewTag: m.viewTag || undefined })),
      })),
      priceRules: rules
        .filter((r) => r.label && r.value !== "")
        .map((r, i) => ({
          kind: r.kind,
          label: r.label,
          value: r.isPercent ? Number(r.value) / 100 : Number(r.value),
          isPercent: r.isPercent,
          order: i,
          criteria: {
            ...(r.fromFloor ? { fromFloor: Number(r.fromFloor) } : {}),
            ...(r.viewTag ? { viewTag: r.viewTag } : {}),
            ...(r.positions ? { positions: r.positions.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)) } : {}),
            ...(r.typologyCode ? { typologyCode: r.typologyCode } : {}),
          },
        })),
      amenities: data.amenities.split("\n").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
      pois: data.pois
        .split("\n")
        .map((line) => line.split("·").map((s) => s.trim()))
        .filter((p) => p[0])
        .map((p) => ({ name: p[0], minutes: Number(p[1]) || 0, category: (p[2] as never) ?? "OTRO", group: (p[3] as never) ?? "SECTOR" })),
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo proyecto</h1>
        <p className="text-sm text-muted-foreground">Asistente para replicar la plataforma en otro proyecto: inventario, precios y presentación se generan automáticamente.</p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              onClick={() => setStep(i)}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs", i === step ? "border-accent bg-accent/10 text-accent" : i < step ? "text-foreground" : "text-muted-foreground")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px]", i < step ? "bg-accent text-accent-foreground" : "bg-muted")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos del proyecto</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Nombre" className="col-span-2">
                <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="Nórtiko" autoFocus />
                {data.name && <p className="text-[11px] text-muted-foreground">URL: /proyectos/{slugify(data.name)}</p>}
              </Field>
              <Field label="Eslogan" className="col-span-2">
                <Input value={data.tagline} onChange={(e) => setData({ ...data, tagline: e.target.value })} />
              </Field>
              <Field label="Descripción" className="col-span-2">
                <Textarea value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
              </Field>
              <Field label="Ciudad">
                <Input value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} />
              </Field>
              <Field label="Etapa">
                <Select value={data.stage} onChange={(e) => setData({ ...data, stage: e.target.value })}>
                  {ProjectStage.options.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dirección" className="col-span-2">
                <Input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} />
              </Field>
              <Field label="Precios vigentes hasta">
                <Input type="date" value={data.priceValidUntil} onChange={(e) => setData({ ...data, priceValidUntil: e.target.value })} />
              </Field>
              <Field label="Entrega estimada">
                <Input type="date" value={data.deliveryDate} onChange={(e) => setData({ ...data, deliveryDate: e.target.value })} />
              </Field>
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((k) => (
                <Field key={k} label={k === "primaryColor" ? "Color primario" : k === "secondaryColor" ? "Color secundario" : "Acento"}>
                  <div className="flex gap-2">
                    <input type="color" value={data[k]} onChange={(e) => setData({ ...data, [k]: e.target.value })} className="h-9 w-12 rounded border bg-transparent" />
                    <Input value={data[k]} onChange={(e) => setData({ ...data, [k]: e.target.value })} />
                  </div>
                </Field>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Condiciones comerciales</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Field label="Separación (COP)">
                  <Input type="number" value={data.separationAmount} onChange={(e) => setData({ ...data, separationAmount: e.target.value })} />
                </Field>
                <Field label="Cuota inicial (%)">
                  <Input type="number" value={data.downPaymentPct} onChange={(e) => setData({ ...data, downPaymentPct: e.target.value })} />
                </Field>
                <Field label="Plazo cuota inicial (meses)">
                  <Input type="number" value={data.downPaymentMonths} onChange={(e) => setData({ ...data, downPaymentMonths: e.target.value })} />
                </Field>
                <Field label="Tasa crédito E.A. (%)">
                  <Input type="number" step="0.1" value={data.annualRate} onChange={(e) => setData({ ...data, annualRate: e.target.value })} />
                </Field>
                <Field label="Plazo crédito (años)">
                  <Input type="number" value={data.loanYears} onChange={(e) => setData({ ...data, loanYears: e.target.value })} />
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Amenidades y entorno</CardTitle>
                <CardDescription>Una por línea. Para el entorno: Nombre · minutos · categoría · grupo.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field label="Amenidades">
                  <Textarea rows={6} value={data.amenities} onChange={(e) => setData({ ...data, amenities: e.target.value })} />
                </Field>
                <Field label="Puntos de interés">
                  <Textarea rows={6} value={data.pois} onChange={(e) => setData({ ...data, pois: e.target.value })} />
                </Field>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 1 && (
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Tipologías</CardTitle>
              <CardDescription>Áreas, alcobas y precio base. El precio de lista por unidad se calcula con las reglas del paso 4.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setTypologies((t) => [
                  ...t,
                  { code: String.fromCharCode(65 + t.length), name: `Tipo ${String.fromCharCode(65 + t.length)}`, description: "", builtArea: "", privateArea: "", bedrooms: "2", bathrooms: "2", basePrice: "", color: PALETTE[t.length % PALETTE.length], features: "" },
                ])
              }
            >
              <Plus /> Agregar tipología
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {typologies.map((t, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3" style={{ borderTop: `3px solid ${t.color}` }}>
                <div className="grid grid-cols-[64px_1fr_40px] gap-2">
                  <Field label="Código">
                    <Input value={t.code} onChange={(e) => updateAt(setTypologies, i, { code: e.target.value.toUpperCase() })} maxLength={4} />
                  </Field>
                  <Field label="Nombre">
                    <Input value={t.name} onChange={(e) => updateAt(setTypologies, i, { name: e.target.value })} />
                  </Field>
                  <Field label="Color">
                    <input type="color" value={t.color} onChange={(e) => updateAt(setTypologies, i, { color: e.target.value })} className="h-9 w-10 rounded border bg-transparent" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Área construida m²">
                    <Input type="number" step="0.01" value={t.builtArea} onChange={(e) => updateAt(setTypologies, i, { builtArea: e.target.value })} />
                  </Field>
                  <Field label="Área privada m²">
                    <Input type="number" step="0.01" value={t.privateArea} onChange={(e) => updateAt(setTypologies, i, { privateArea: e.target.value })} />
                  </Field>
                  <Field label="Alcobas">
                    <Input type="number" value={t.bedrooms} onChange={(e) => updateAt(setTypologies, i, { bedrooms: e.target.value })} />
                  </Field>
                  <Field label="Baños">
                    <Input type="number" value={t.bathrooms} onChange={(e) => updateAt(setTypologies, i, { bathrooms: e.target.value })} />
                  </Field>
                  <Field label="Precio base (COP)" className="col-span-2">
                    <Input type="number" step={1000000} value={t.basePrice} onChange={(e) => updateAt(setTypologies, i, { basePrice: e.target.value })} />
                  </Field>
                </div>
                <Field label="Descripción">
                  <Input value={t.description} onChange={(e) => updateAt(setTypologies, i, { description: e.target.value })} />
                </Field>
                <Field label="Características (una por línea)">
                  <Textarea rows={3} value={t.features} onChange={(e) => updateAt(setTypologies, i, { features: e.target.value })} />
                </Field>
                {typologies.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => setTypologies((x) => x.filter((_, j) => j !== i))}>
                    <Trash2 /> Quitar
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {towers.map((t, i) => (
            <Card key={i}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>
                    {t.name || `Torre ${i + 1}`} <span className="ml-2 text-xs font-normal text-muted-foreground">{Math.max(0, Number(t.floors) - Number(t.firstResidentialFloor) + 1) * t.matrix.length} unidades</span>
                  </CardTitle>
                  <CardDescription>La matriz define qué tipología ocupa cada posición del piso tipo; se repite en todos los pisos residenciales.</CardDescription>
                </div>
                {towers.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => setTowers((x) => x.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Código">
                    <Input value={t.code} onChange={(e) => updateAt(setTowers, i, { code: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Nombre">
                    <Input value={t.name} onChange={(e) => updateAt(setTowers, i, { name: e.target.value })} />
                  </Field>
                  <Field label="Pisos">
                    <Input type="number" value={t.floors} onChange={(e) => updateAt(setTowers, i, { floors: e.target.value })} />
                  </Field>
                  <Field label="Primer piso residencial">
                    <Input type="number" value={t.firstResidentialFloor} onChange={(e) => updateAt(setTowers, i, { firstResidentialFloor: e.target.value })} />
                  </Field>
                  <Field label="Aptos por piso" className="col-span-2">
                    <Input
                      type="number"
                      value={t.unitsPerFloor}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(16, Number(e.target.value) || 1));
                        updateAt(setTowers, i, { unitsPerFloor: String(n), matrix: resizeMatrix(t.matrix, n, typologies.map((x) => x.code)) });
                      }}
                    />
                  </Field>
                  <Field label="Estado">
                    <Select value={t.releaseStatus} onChange={(e) => updateAt(setTowers, i, { releaseStatus: e.target.value })}>
                      <option value="EN_VENTA">En venta</option>
                      <option value="PROXIMAMENTE">Próximamente</option>
                    </Select>
                  </Field>
                  <Field label="Posición X / Z (m)" hint="Ubicación relativa en el visor 3D.">
                    <div className="flex gap-1">
                      <Input type="number" value={t.positionX} onChange={(e) => updateAt(setTowers, i, { positionX: e.target.value })} />
                      <Input type="number" value={t.positionZ} onChange={(e) => updateAt(setTowers, i, { positionZ: e.target.value })} />
                    </div>
                  </Field>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-1.5">Posición</th>
                        <th className="py-1.5">Tipología</th>
                        <th className="py-1.5">Orientación</th>
                        <th className="py-1.5">Vista</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.matrix.map((m, j) => (
                        <tr key={j} className="border-t">
                          <td className="py-1.5 font-medium">{String(m.position).padStart(2, "0")}</td>
                          <td className="py-1.5">
                            <Select value={m.typologyCode} onChange={(e) => updateMatrix(setTowers, i, j, { typologyCode: e.target.value })} className="h-8">
                              {typologies.map((ty) => (
                                <option key={ty.code} value={ty.code}>
                                  {ty.code} · {ty.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="py-1.5">
                            <Select value={m.orientation} onChange={(e) => updateMatrix(setTowers, i, j, { orientation: e.target.value })} className="h-8">
                              <option value="">—</option>
                              {Orientation.options.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="py-1.5">
                            <Input value={m.viewTag} onChange={(e) => updateMatrix(setTowers, i, j, { viewTag: e.target.value.toUpperCase() })} className="h-8" placeholder="PANORAMICA" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setTowers((t) => [
                ...t,
                { code: `T${t.length + 1}`, name: `Torre ${t.length + 1}`, floors: t[0]?.floors ?? "20", firstResidentialFloor: t[0]?.firstResidentialFloor ?? "2", unitsPerFloor: t[0]?.unitsPerFloor ?? "6", positionX: String(t.length * 45), positionZ: "0", releaseStatus: "PROXIMAMENTE", matrix: t[0]?.matrix.map((m) => ({ ...m })) ?? buildMatrix(6, typologies.map((x) => x.code)) },
              ])
            }
          >
            <Plus /> Agregar torre
          </Button>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Reglas de precio</CardTitle>
              <CardDescription>Cómo varía el precio base por piso, vista, posición o tipología. Podrás ajustarlas luego en Configuración.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRules((r) => [...r, { kind: "VIEW_PREMIUM", label: "", value: "", isPercent: true, fromFloor: "", viewTag: "", positions: "", typologyCode: "" }])}>
              <Plus /> Agregar regla
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-8">
                <Field label="Tipo" className="md:col-span-2">
                  <Select value={r.kind} onChange={(e) => updateAt(setRules, i, { kind: e.target.value as PriceRuleKind })}>
                    <option value="FLOOR_INCREMENT">Incremento por piso</option>
                    <option value="VIEW_PREMIUM">Prima por vista</option>
                    <option value="POSITION_PREMIUM">Prima por posición</option>
                    <option value="TYPOLOGY_ADJUST">Ajuste por tipología</option>
                  </Select>
                </Field>
                <Field label="Nombre" className="md:col-span-2">
                  <Input value={r.label} onChange={(e) => updateAt(setRules, i, { label: e.target.value })} />
                </Field>
                <Field label={r.isPercent ? "Valor %" : "Valor COP"}>
                  <Input type="number" step="any" value={r.value} onChange={(e) => updateAt(setRules, i, { value: e.target.value })} />
                </Field>
                <Field label="Unidad">
                  <Select value={r.isPercent ? "pct" : "cop"} onChange={(e) => updateAt(setRules, i, { isPercent: e.target.value === "pct" })}>
                    <option value="pct">%</option>
                    <option value="cop">COP</option>
                  </Select>
                </Field>
                {r.kind === "FLOOR_INCREMENT" && (
                  <Field label="Desde piso">
                    <Input type="number" value={r.fromFloor} onChange={(e) => updateAt(setRules, i, { fromFloor: e.target.value })} />
                  </Field>
                )}
                {r.kind === "VIEW_PREMIUM" && (
                  <Field label="Vista">
                    <Input value={r.viewTag} onChange={(e) => updateAt(setRules, i, { viewTag: e.target.value.toUpperCase() })} />
                  </Field>
                )}
                {r.kind === "POSITION_PREMIUM" && (
                  <Field label="Posiciones">
                    <Input value={r.positions} onChange={(e) => updateAt(setRules, i, { positions: e.target.value })} placeholder="1,8" />
                  </Field>
                )}
                {r.kind === "TYPOLOGY_ADJUST" && (
                  <Field label="Tipología">
                    <Select value={r.typologyCode} onChange={(e) => updateAt(setRules, i, { typologyCode: e.target.value })}>
                      <option value="">—</option>
                      {typologies.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <div className="flex items-end justify-end">
                  <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => setRules((x) => x.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-muted-foreground">Sin reglas: todas las unidades de una tipología tendrán el mismo precio.</p>}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription>Se crearán estos registros al confirmar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Proyecto" v={`${data.name || "—"} · ${data.city || "sin ciudad"} · ${data.stage}`} />
              <Row k="Tipologías" v={typologies.map((t) => `${t.name} (${formatCOP(Number(t.basePrice) || 0)})`).join(", ")} />
              <Row k="Torres" v={towers.map((t) => `${t.name}: ${t.floors} pisos × ${t.matrix.length} aptos`).join(" · ")} />
              <Row k="Unidades a generar" v={String(totalUnits)} />
              <Row k="Reglas de precio" v={rules.filter((r) => r.label).map((r) => r.label).join(", ") || "Ninguna"} />
              <Row k="Presentación" v="Se crea una presentación comercial por defecto con 10 bloques" />
              {errors.length > 0 && (
                <ul className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {errors.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Después de crear</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Sube el modelo .glb optimizado en Configuración → Modelo 3D (o usa la torre paramétrica).</p>
              <p>2. Carga renders y plantas por tipología en Configuración → Medios.</p>
              <p>3. Importa estados y precios especiales desde tu Excel actual en Inventario → Importar.</p>
              <p>4. Ajusta los bloques del modo presentación y comparte el enlace público con QR.</p>
              <Button variant="accent" size="lg" className="mt-4 w-full" loading={create.isPending} disabled={errors.length > 0} onClick={submit}>
                <Rocket /> Crear proyecto y generar {totalUnits} unidades
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft /> Anterior
        </Button>
        {step < STEPS.length - 1 && (
          <Button variant="accent" onClick={() => setStep((s) => s + 1)}>
            Siguiente <ArrowRight />
          </Button>
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b pb-2 last:border-0">
      <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function buildMatrix(n: number, codes: string[]): MatrixRow[] {
  return Array.from({ length: n }, (_, i) => ({ position: i + 1, typologyCode: codes[i % codes.length] ?? codes[0] ?? "A", orientation: i < n / 2 ? "NORTE" : "SUR", viewTag: "" }));
}

function resizeMatrix(m: MatrixRow[], n: number, codes: string[]): MatrixRow[] {
  if (n <= m.length) return m.slice(0, n);
  return [...m, ...buildMatrix(n, codes).slice(m.length)];
}

function updateAt<T>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, patch: Partial<T>) {
  set((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
}

function updateMatrix(set: React.Dispatch<React.SetStateAction<Tower[]>>, i: number, j: number, patch: Partial<MatrixRow>) {
  set((arr) => arr.map((t, k) => (k === i ? { ...t, matrix: t.matrix.map((m, l) => (l === j ? { ...m, ...patch } : m)) } : t)));
}

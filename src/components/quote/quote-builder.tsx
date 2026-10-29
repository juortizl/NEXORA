"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileDown, Save, Share2, UserPlus, Mail } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { computeQuote, pricePerM2, suggestedMinIncome } from "@/lib/quote-engine";
import { TypologyVariant, parseJson } from "@/lib/domain";
import { z } from "zod";
import { formatCOP, formatPct, formatArea, cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Slider, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { BuyerQuickCreate } from "@/components/crm/buyer-quick-create";

export function QuoteBuilder() {
  const project = useProject();
  const params = useSearchParams();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: units = [] } = trpc.unit.list.useQuery({ projectId: project.id });
  const { data: buyers = [] } = trpc.crm.buyers.useQuery({ projectId: project.id });

  const [unitId, setUnitId] = useState(params.get("unit") ?? "");
  const [buyerId, setBuyerId] = useState(params.get("buyer") ?? "");
  const [discountPct, setDiscountPct] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [separation, setSeparation] = useState(project.separationAmount);
  const [downPaymentPct, setDownPaymentPct] = useState(project.downPaymentPct);
  const [downPaymentMonths, setDownPaymentMonths] = useState(project.downPaymentMonths);
  const [subsidy, setSubsidy] = useState(0);
  const [annualRate, setAnnualRate] = useState(project.annualRate);
  const [loanYears, setLoanYears] = useState(project.loanYears);
  const [notes, setNotes] = useState("");
  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  // Si cambia ?unit= en la URL (p. ej. "Cotizar" desde el visor), sincroniza la unidad seleccionada.
  const paramUnit = params.get("unit");
  const [syncedParamUnit, setSyncedParamUnit] = useState(paramUnit);
  if (paramUnit !== syncedParamUnit) {
    setSyncedParamUnit(paramUnit);
    if (paramUnit) setUnitId(paramUnit);
  }

  const available = useMemo(() => units.filter((u) => u.status === "DISPONIBLE" || u.id === unitId), [units, unitId]);
  const unit = units.find((u) => u.id === unitId) ?? null;
  const typology = unit ? project.typologies.find((t) => t.id === unit.typologyId) : null;
  const variants = useMemo(() => parseJson(typology?.variants, z.array(TypologyVariant), []), [typology]);
  const variantsTotal = variants.filter((v) => selectedVariants.includes(v.name)).reduce((a, v) => a + v.deltaPrice, 0);
  const listPrice = unit ? (unit.priceOverride ?? unit.listPrice) : 0;

  const result = useMemo(
    () =>
      unit
        ? computeQuote({
            listPrice,
            discount: Math.round(listPrice * discountPct),
            variantsTotal,
            separation,
            downPaymentPct,
            downPaymentMonths,
            subsidy,
            annualRate,
            loanYears,
          })
        : null,
    [unit, listPrice, discountPct, variantsTotal, separation, downPaymentPct, downPaymentMonths, subsidy, annualRate, loanYears]
  );

  const createQuote = trpc.quote.create.useMutation({
    onSuccess: (q) => {
      setSavedQuoteId(q.id);
      void utils.quote.invalidate();
      void utils.crm.invalidate();
      toast.success(`Cotización v${q.version} guardada`);
    },
    onError: (e) => toast.error("No se pudo guardar", e.message),
  });

  function save() {
    if (!unit) return;
    createQuote.mutate({
      unitId: unit.id,
      buyerId: buyerId || undefined,
      discountPct,
      selectedVariants,
      separation,
      downPaymentPct,
      downPaymentMonths,
      subsidy,
      annualRate,
      loanYears,
      notes: notes || undefined,
    });
  }

  const buyer = buyers.find((b) => b.id === buyerId);
  const shareText = unit && result
    ? encodeURIComponent(
        `Hola${buyer ? ` ${buyer.firstName}` : ""}, te comparto la cotización del apartamento ${unit.code} (${unit.typology.name}, ${formatArea(unit.typology.privateArea)}) en ${project.name}:\n` +
          `• Precio: ${formatCOP(result.finalPrice)}\n• Separación: ${formatCOP(result.separation)}\n• Cuota inicial ${formatPct(result.downPaymentPct)}: ${formatCOP(result.downPaymentTotal)} en ${result.downPaymentMonths} cuotas de ${formatCOP(result.downPaymentMonthly)}\n• Crédito estimado: ${formatCOP(result.loanAmount)} con cuota aprox. de ${formatCOP(result.loanMonthly)}/mes\n` +
          (savedQuoteId ? `PDF: ${typeof window !== "undefined" ? window.location.origin : ""}/api/quotes/${savedQuoteId}/pdf` : "")
      )
    : "";

  const composition = result
    ? [
        { name: "Separación", value: result.separation, color: "#e0b45a" },
        { name: "Cuota inicial", value: result.downPaymentRemaining, color: "#38bdf8" },
        { name: "Subsidio", value: result.subsidy, color: "#a78bfa" },
        { name: "Crédito", value: result.loanAmount, color: "#34d399" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[420px_1fr]">
      {/* Panel de parámetros */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Cotizador</h1>
          <p className="text-sm text-muted-foreground">Cálculo en vivo con las reglas del proyecto. Guarda versiones y genera el PDF.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Apartamento y comprador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Apartamento">
              <Select
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setSelectedVariants([]);
                  setSavedQuoteId(null);
                  router.replace(`?unit=${e.target.value}${buyerId ? `&buyer=${buyerId}` : ""}`);
                }}
              >
                <option value="">Selecciona una unidad disponible</option>
                {available.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} · {u.typology.name} · Piso {u.floor} · {formatCOP(u.priceOverride ?? u.listPrice)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Comprador (opcional)">
              <div className="flex gap-2">
                <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  <option value="">Sin asociar</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.firstName} {b.lastName} {b.documentNumber ? `· ${b.documentNumber}` : ""}
                    </option>
                  ))}
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowNewBuyer(true)} title="Nuevo comprador">
                  <UserPlus />
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condiciones comerciales</CardTitle>
            <CardDescription>Valores por defecto del proyecto; ajusta según la negociación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.length > 0 && (
              <Field label="Variantes de la tipología">
                <div className="space-y-1">
                  {variants.map((v) => (
                    <label key={v.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedVariants.includes(v.name)}
                          onChange={(e) => setSelectedVariants((s) => (e.target.checked ? [...s, v.name] : s.filter((x) => x !== v.name)))}
                        />
                        <span>
                          {v.name}
                          {v.description && <span className="block text-[11px] text-muted-foreground">{v.description}</span>}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">+{formatCOP(v.deltaPrice)}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field label={`Descuento comercial: ${formatPct(discountPct)}`}>
              <Slider min={0} max={0.1} step={0.005} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Separación (COP)">
                <Input type="number" value={separation} onChange={(e) => setSeparation(Number(e.target.value))} step={100000} />
              </Field>
              <Field label="Subsidio (COP)" hint="Mi Casa Ya, caja de compensación">
                <Input type="number" value={subsidy} onChange={(e) => setSubsidy(Number(e.target.value))} step={1000000} />
              </Field>
            </div>
            <Field label={`Cuota inicial: ${formatPct(downPaymentPct, 0)}`}>
              <Slider min={0.1} max={0.5} step={0.01} value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} />
            </Field>
            <Field label={`Plazo cuota inicial: ${downPaymentMonths} meses`}>
              <Slider min={6} max={60} step={1} value={downPaymentMonths} onChange={(e) => setDownPaymentMonths(Number(e.target.value))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tasa crédito (E.A.)">
                <Input type="number" value={Math.round(annualRate * 10000) / 100} onChange={(e) => setAnnualRate(Number(e.target.value) / 100)} step={0.1} />
              </Field>
              <Field label="Plazo crédito (años)">
                <Input type="number" value={loanYears} onChange={(e) => setLoanYears(Number(e.target.value))} min={1} max={30} />
              </Field>
            </div>
            <Field label="Notas para el cliente">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones especiales, fecha de entrega, etc." />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Resultado */}
      <div className="space-y-4">
        {!unit || !result ? (
          <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            Selecciona un apartamento para ver la cotización.
          </div>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5" style={{ background: `linear-gradient(120deg, ${project.primaryColor}, ${project.secondaryColor})` }}>
                <div className="text-white">
                  <p className="text-[11px] uppercase tracking-[0.25em] opacity-80">{project.name} · Cotización</p>
                  <h2 className="text-3xl font-semibold">{unit.code}</h2>
                  <p className="text-sm opacity-90">
                    Tipo {unit.typology.name} · Piso {unit.floor} · {formatArea(unit.typology.privateArea)} privados · {formatArea(unit.typology.builtArea)} construidos
                  </p>
                </div>
                <div className="text-right text-white">
                  <p className="text-[11px] uppercase tracking-wider opacity-80">Precio final</p>
                  <p className="text-3xl font-semibold tabular-nums">{formatCOP(result.finalPrice)}</p>
                  <p className="text-xs opacity-80">{formatCOP(pricePerM2(result.finalPrice, unit.typology.privateArea))} / m²</p>
                </div>
              </div>
              <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Line label="Precio de lista" value={formatCOP(result.listPrice)} />
                  {result.variantsTotal > 0 && <Line label="Variantes" value={`+${formatCOP(result.variantsTotal)}`} />}
                  {result.discount > 0 && <Line label="Descuento" value={`-${formatCOP(result.discount)}`} accent />}
                  <Line label="Separación" value={formatCOP(result.separation)} />
                  <Line label={`Cuota inicial (${formatPct(result.downPaymentPct, 0)})`} value={formatCOP(result.downPaymentTotal)} />
                  <Line label={`${result.downPaymentMonths} cuotas mensuales de`} value={formatCOP(result.downPaymentMonthly)} strong />
                  {result.subsidy > 0 && <Line label="Subsidio" value={`-${formatCOP(result.subsidy)}`} accent />}
                  <Line label="Saldo a financiar" value={formatCOP(result.loanAmount)} />
                  <Line label={`Cuota crédito estimada (${formatPct(result.annualRate)} E.A., ${result.loanYears} años)`} value={formatCOP(result.loanMonthly)} strong />
                  <Line label="Ingreso familiar sugerido" value={formatCOP(suggestedMinIncome(result.loanMonthly))} />
                </div>
                <div className="h-48">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={composition} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                        {composition.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCOP(Number(v))} contentStyle={{ background: "#0e1522", border: "1px solid #1d283a", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="-mt-2 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    {composition.map((d) => (
                      <span key={d.name} className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ background: d.color }} /> {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={save} loading={createQuote.isPending} disabled={unit.status !== "DISPONIBLE"}>
                <Save /> Guardar cotización
              </Button>
              {savedQuoteId && (
                <>
                  <a href={`/api/quotes/${savedQuoteId}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default" })}>
                    <FileDown /> Descargar PDF
                  </a>
                  <a href={`https://wa.me/${buyer?.phone?.replace(/\D/g, "") ?? ""}?text=${shareText}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                    <Share2 /> Enviar por WhatsApp
                  </a>
                  <a
                    href={`mailto:${buyer?.email ?? ""}?subject=${encodeURIComponent(`Cotización ${unit.code} · ${project.name}`)}&body=${shareText}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <Mail /> Enviar por correo
                  </a>
                </>
              )}
              {unit.status !== "DISPONIBLE" && <p className="self-center text-xs text-amber-400">La unidad no está disponible; sólo se puede simular.</p>}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Plan de pagos de la cuota inicial</CardTitle>
                <CardDescription>Separación hoy, {result.downPaymentMonths} cuotas y desembolso del crédito a la entrega.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-left uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Mes</th>
                        <th className="px-3 py-2">Concepto</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-right">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((r) => (
                        <tr key={`${r.month}-${r.concept}`} className={cn("border-t", r.concept !== "CUOTA_INICIAL" && "bg-accent/5 font-medium")}>
                          <td className="px-3 py-1.5 tabular-nums">{r.month}</td>
                          <td className="px-3 py-1.5">{r.concept === "SEPARACION" ? "Separación" : r.concept === "CUOTA_INICIAL" ? "Cuota inicial" : "Desembolso crédito + subsidio"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatCOP(r.amount)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatCOP(r.accumulated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <QuoteHistory projectId={project.id} unitId={unit.id} slug={project.slug} />
          </>
        )}
      </div>

      <BuyerQuickCreate
        open={showNewBuyer}
        onOpenChange={setShowNewBuyer}
        projectId={project.id}
        unitId={unitId || undefined}
        onCreated={(b) => {
          setBuyerId(b.id);
          void utils.crm.buyers.invalidate();
        }}
      />
    </div>
  );
}

function Line({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 rounded-md border px-3 py-2", strong && "border-accent/40 bg-accent/5")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-semibold" : "text-sm", accent && "text-emerald-400")}>{value}</span>
    </div>
  );
}

function QuoteHistory({ projectId, unitId, slug }: { projectId: string; unitId: string; slug: string }) {
  const { data = [] } = trpc.quote.list.useQuery({ projectId, unitId });
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de cotizaciones de esta unidad</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {data.map((q) => (
            <li key={q.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">
                  v{q.version} · {formatCOP(q.finalPrice)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {q.buyer ? `· ${q.buyer.firstName} ${q.buyer.lastName}` : ""} · {q.advisor.name}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(q.createdAt).toLocaleString("es-CO")} · Cuota inicial {formatCOP(q.downPaymentMonthly)}/mes · Crédito {formatCOP(q.loanMonthly)}/mes
                </p>
              </div>
              <div className="flex gap-2">
                <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FileDown /> PDF
                </a>
                {q.buyer && (
                  <Link href={`/proyectos/${slug}/crm/${q.buyer.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Ver comprador
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { z } from "zod";
import { useProject, type RouterOutputs } from "@/components/project/project-context";
import { computeQuote, pricePerM2, suggestedMinIncome } from "@/lib/quote-engine";
import { TypologyVariant, parseJson } from "@/lib/domain";
import { formatCOP, formatArea, formatPct } from "@/lib/utils";
import { Field, Input, Select, Slider } from "@/components/ui/input";

type PublicUnit = RouterOutputs["unit"]["publicList"][number];

/**
 * Cotizador simplificado para el modo presentación: cálculo en vivo sin
 * guardar ni exponer datos de compradores.
 */
export function PublicQuoteCalculator({ units, title }: { units: PublicUnit[]; title?: string }) {
  const project = useProject();
  const available = useMemo(() => units.filter((u) => u.status === "DISPONIBLE"), [units]);
  const [typologyId, setTypologyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [downPaymentPct, setDownPaymentPct] = useState(project.downPaymentPct);
  const [downPaymentMonths, setDownPaymentMonths] = useState(project.downPaymentMonths);
  const [subsidy, setSubsidy] = useState(0);
  const [annualRate, setAnnualRate] = useState(project.annualRate);
  const [loanYears, setLoanYears] = useState(project.loanYears);

  const filtered = typologyId ? available.filter((u) => u.typology.id === typologyId) : available;
  const unit = available.find((u) => u.id === unitId) ?? filtered[0] ?? null;
  const typology = unit ? project.typologies.find((t) => t.id === unit.typology.id) : null;
  const variants = useMemo(() => parseJson(typology?.variants, z.array(TypologyVariant), []), [typology]);
  const variantsTotal = variants.filter((v) => selectedVariants.includes(v.name)).reduce((a, v) => a + v.deltaPrice, 0);
  const listPrice = unit ? (unit.priceOverride ?? unit.listPrice) : 0;

  const result = useMemo(
    () =>
      unit
        ? computeQuote({
            listPrice,
            variantsTotal,
            separation: project.separationAmount,
            downPaymentPct,
            downPaymentMonths,
            subsidy,
            annualRate,
            loanYears,
          })
        : null,
    [unit, listPrice, variantsTotal, project.separationAmount, downPaymentPct, downPaymentMonths, subsidy, annualRate, loanYears]
  );

  const composition = result
    ? [
        { name: "Separación", value: result.separation, color: "#e0b45a" },
        { name: "Cuota inicial", value: result.downPaymentRemaining, color: "#38bdf8" },
        { name: "Subsidio", value: result.subsidy, color: "#a78bfa" },
        { name: "Crédito", value: result.loanAmount, color: "#34d399" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <section className="grid min-h-full gap-8 p-8 lg:grid-cols-[400px_1fr]">
      <div className="space-y-5">
        <div>
          <h2 className="text-3xl font-semibold">{title ?? "Cotiza tu apartamento"}</h2>
          <p className="text-sm text-muted-foreground">Simula tu plan de pagos. Un asesor te entregará la cotización formal en PDF.</p>
        </div>
        <div className="space-y-3 rounded-xl border bg-card/60 p-4">
          <Field label="Tipología">
            <Select
              value={typologyId}
              onChange={(e) => {
                setTypologyId(e.target.value);
                setUnitId("");
                setSelectedVariants([]);
              }}
            >
              <option value="">Todas</option>
              {project.typologies.map((t) => (
                <option key={t.id} value={t.id}>
                  Tipo {t.name} · {formatArea(t.privateArea)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Apartamento disponible">
            <Select
              value={unit?.id ?? ""}
              onChange={(e) => {
                setUnitId(e.target.value);
                setSelectedVariants([]);
              }}
            >
              {filtered.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} · Piso {u.floor} · {u.typology.name} · {formatCOP(u.priceOverride ?? u.listPrice)}
                </option>
              ))}
            </Select>
          </Field>
          {variants.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Opcionales</p>
              {variants.map((v) => (
                <label key={v.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedVariants.includes(v.name)}
                      onChange={(e) => setSelectedVariants((s) => (e.target.checked ? [...s, v.name] : s.filter((x) => x !== v.name)))}
                    />
                    {v.name}
                  </span>
                  <span className="text-xs text-muted-foreground">+{formatCOP(v.deltaPrice)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4 rounded-xl border bg-card/60 p-4">
          <Field label={`Cuota inicial: ${Math.round(downPaymentPct * 100)} %`}>
            <Slider min={0.1} max={0.6} step={0.01} value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} />
          </Field>
          <Field label={`Plazo cuota inicial: ${downPaymentMonths} meses`}>
            <Slider min={6} max={60} step={1} value={downPaymentMonths} onChange={(e) => setDownPaymentMonths(Number(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subsidio (COP)" hint="Mi Casa Ya, caja de compensación">
              <Input type="number" min={0} step={1000000} value={subsidy} onChange={(e) => setSubsidy(Number(e.target.value))} />
            </Field>
            <Field label="Tasa crédito (E.A.)">
              <Input type="number" min={0} max={30} step={0.1} value={Math.round(annualRate * 1000) / 10} onChange={(e) => setAnnualRate(Number(e.target.value) / 100)} />
            </Field>
            <Field label="Plazo crédito (años)" className="col-span-2">
              <Slider min={5} max={30} step={1} value={loanYears} onChange={(e) => setLoanYears(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">{loanYears} años</p>
            </Field>
          </div>
        </div>
      </div>

      {unit && result ? (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${project.primaryColor}, ${project.secondaryColor})` }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
                  {project.name} · Simulación
                </p>
                <h3 className="mt-1 text-4xl font-semibold">{unit.code}</h3>
                <p className="text-sm text-white/80">
                  Tipo {unit.typology.name} · Piso {unit.floor} · {formatArea(unit.typology.privateArea)} privados · {formatArea(unit.typology.builtArea)} construidos
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-white/60">Precio</p>
                <p className="text-4xl font-semibold tabular-nums">{formatCOP(result.finalPrice)}</p>
                <p className="text-xs text-white/60">{formatCOP(pricePerM2(result.finalPrice, unit.typology.privateArea))} / m²</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Line label="Separación" value={formatCOP(result.separation)} />
              <Line label={`Cuota inicial (${formatPct(result.downPaymentPct, 0)})`} value={formatCOP(result.downPaymentTotal)} />
              <Line label={`${result.downPaymentMonths} cuotas mensuales de`} value={formatCOP(result.downPaymentMonthly)} strong />
              {result.subsidy > 0 && <Line label="Subsidio" value={formatCOP(result.subsidy)} />}
              <Line label="Crédito hipotecario" value={formatCOP(result.loanAmount)} />
              <Line label={`Cuota crédito estimada (${formatPct(result.annualRate, 1)} E.A., ${result.loanYears} años)`} value={formatCOP(result.loanMonthly)} strong />
              <Line label="Ingreso familiar sugerido" value={formatCOP(suggestedMinIncome(result.loanMonthly))} />
            </div>
            <div className="rounded-xl border bg-card/60 p-3">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={composition} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {composition.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 space-y-1 text-xs">
                {composition.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: d.color }} /> {d.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatCOP(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Simulación informativa. La cuota del crédito depende de la aprobación y condiciones de la entidad financiera. Precios vigentes según lista del proyecto.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed text-muted-foreground">No hay apartamentos disponibles para cotizar.</div>
      )}
    </section>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/60 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-semibold tabular-nums text-accent" : "font-medium tabular-nums"}>{value}</span>
    </div>
  );
}

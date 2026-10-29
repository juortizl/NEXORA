"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, X, Trophy, Calculator } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useViewerStore } from "@/stores/viewer-store";
import { computeQuote, pricePerM2 } from "@/lib/quote-engine";
import { TypologyVariant, parseJson } from "@/lib/domain";
import { cn, formatArea, formatCOP } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";

type Metric = {
  key: string;
  label: string;
  value: (u: UnitForCompare) => number | string | null;
  format: (v: number | string | null) => string;
  /** "max" o "min" indica qué extremo se resalta como mejor */
  best?: "max" | "min";
};

type UnitForCompare = {
  id: string;
  code: string;
  floor: number;
  position: number;
  status: string;
  listPrice: number;
  priceOverride: number | null;
  orientation: string | null;
  viewTag: string | null;
  typology: { id: string; code: string; name: string; color: string; builtArea: number; privateArea: number; bedrooms: number; bathrooms: number };
};

export function CompareView({ readOnly = false, publicToken }: { readOnly?: boolean; publicToken?: string }) {
  const project = useProject();
  const params = useSearchParams();
  const router = useRouter();
  const { compareIds, toggleCompare, clearCompare } = useViewerStore();
  const privateUnits = trpc.unit.list.useQuery({ projectId: project.id }, { enabled: !publicToken });
  const publicUnits = trpc.unit.publicList.useQuery({ token: publicToken ?? "" }, { enabled: !!publicToken });
  const units = (publicToken ? publicUnits.data : privateUnits.data) ?? [];

  // Sincroniza ids de la URL con el store (permite compartir el enlace)
  useEffect(() => {
    const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
    if (ids.length && ids.join(",") !== compareIds.join(",")) {
      useViewerStore.setState({ compareIds: ids.slice(0, 4) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (readOnly) return;
    const q = compareIds.length ? `?ids=${compareIds.join(",")}` : "";
    router.replace(`/proyectos/${project.slug}/comparar${q}`);
  }, [compareIds, project.slug, router, readOnly]);

  const selected = compareIds.map((id) => units.find((u) => u.id === id)).filter(Boolean) as UnitForCompare[];

  const metrics: Metric[] = useMemo(() => {
    const quote = (u: UnitForCompare) =>
      computeQuote({
        listPrice: u.priceOverride ?? u.listPrice,
        separation: project.separationAmount,
        downPaymentPct: project.downPaymentPct,
        downPaymentMonths: project.downPaymentMonths,
        annualRate: project.annualRate,
        loanYears: project.loanYears,
      });
    return [
      { key: "floor", label: "Piso", value: (u) => u.floor, format: (v) => String(v) },
      { key: "privateArea", label: "Área privada", value: (u) => u.typology.privateArea, format: (v) => formatArea(Number(v)), best: "max" },
      { key: "builtArea", label: "Área construida", value: (u) => u.typology.builtArea, format: (v) => formatArea(Number(v)), best: "max" },
      { key: "bedrooms", label: "Alcobas", value: (u) => u.typology.bedrooms, format: (v) => String(v), best: "max" },
      { key: "bathrooms", label: "Baños", value: (u) => u.typology.bathrooms, format: (v) => String(v), best: "max" },
      { key: "orientation", label: "Orientación", value: (u) => u.orientation, format: (v) => (v ? String(v) : "—") },
      { key: "view", label: "Vista", value: (u) => u.viewTag, format: (v) => (v ? String(v) : "—") },
      { key: "price", label: "Precio", value: (u) => u.priceOverride ?? u.listPrice, format: (v) => formatCOP(Number(v)), best: "min" },
      { key: "ppm2", label: "Precio / m² privado", value: (u) => pricePerM2(u.priceOverride ?? u.listPrice, u.typology.privateArea), format: (v) => formatCOP(Number(v)), best: "min" },
      { key: "dp", label: `Cuota inicial (${Math.round(project.downPaymentPct * 100)} %)`, value: (u) => quote(u).downPaymentTotal, format: (v) => formatCOP(Number(v)), best: "min" },
      { key: "dpm", label: `Cuota mensual inicial (${project.downPaymentMonths} m)`, value: (u) => quote(u).downPaymentMonthly, format: (v) => formatCOP(Number(v)), best: "min" },
      { key: "loan", label: "Cuota crédito estimada", value: (u) => quote(u).loanMonthly, format: (v) => formatCOP(Number(v)), best: "min" },
    ];
  }, [project]);

  const bestFor = (m: Metric): string | null => {
    if (!m.best || selected.length < 2) return null;
    const vals = selected.map((u) => ({ id: u.id, v: m.value(u) })).filter((x): x is { id: string; v: number } => typeof x.v === "number");
    if (vals.length < 2) return null;
    const sorted = [...vals].sort((a, b) => (m.best === "max" ? b.v - a.v : a.v - b.v));
    if (sorted[0].v === sorted[1].v) return null;
    return sorted[0].id;
  };

  const maxArea = Math.max(1, ...selected.map((u) => u.typology.builtArea));
  const addable = units.filter((u) => !compareIds.includes(u.id));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Comparador</h1>
          <p className="text-sm text-muted-foreground">Hasta 4 apartamentos lado a lado. Se resalta el mejor valor de cada fila.</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.length < 4 && (
            <Select
              value=""
              onChange={(e) => e.target.value && toggleCompare(e.target.value)}
              className="w-72"
            >
              <option value="">+ Agregar apartamento…</option>
              {addable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} · {u.typology.name} · Piso {u.floor} · {formatCOP(u.priceOverride ?? u.listPrice)}
                </option>
              ))}
            </Select>
          )}
          {compareIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCompare}>
              <X /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
          <p className="text-sm text-muted-foreground">Agrega apartamentos desde el visor, el inventario o el selector superior.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {project.typologies.map((t) => {
              const sample = units.find((u) => u.typologyId === t.id && u.status === "DISPONIBLE");
              return (
                <Button key={t.id} variant="outline" size="sm" disabled={!sample} onClick={() => sample && toggleCompare(sample.id)}>
                  <Plus /> {t.name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className="w-48 p-4 text-left align-bottom text-xs uppercase tracking-wide text-muted-foreground">Característica</th>
                {selected.map((u) => (
                  <th key={u.id} className="p-4 text-left align-top">
                    <div className="rounded-lg p-3" style={{ background: `${u.typology.color}22`, borderTop: `3px solid ${u.typology.color}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo {u.typology.name}</p>
                          <p className="text-lg font-semibold">{u.code}</p>
                        </div>
                        <button onClick={() => toggleCompare(u.id)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Quitar">
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <StatusBadge status={u.status} />
                        {!readOnly && u.status === "DISPONIBLE" && (
                          <Link href={`/proyectos/${project.slug}/cotizador?unit=${u.id}`} className={buttonVariants({ variant: "accent", size: "sm" })}>
                            <Calculator /> Cotizar
                          </Link>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Huella a escala */}
              <tr className="border-t">
                <td className="p-4 text-xs text-muted-foreground">Huella a escala</td>
                {selected.map((u) => (
                  <td key={u.id} className="p-4">
                    <Footprint typology={u.typology} maxArea={maxArea} />
                  </td>
                ))}
              </tr>
              {metrics.map((m) => {
                const best = bestFor(m);
                return (
                  <tr key={m.key} className="border-t">
                    <td className="p-4 text-xs text-muted-foreground">{m.label}</td>
                    {selected.map((u) => {
                      const v = m.value(u);
                      const isBest = best === u.id;
                      return (
                        <td key={u.id} className={cn("p-4 tabular-nums", isBest && "bg-emerald-500/10 font-semibold text-emerald-300")}>
                          <span className="inline-flex items-center gap-1.5">
                            {m.format(v)}
                            {isBest && <Trophy className="size-3.5" />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t">
                <td className="p-4 text-xs text-muted-foreground">Características</td>
                {selected.map((u) => {
                  const t = project.typologies.find((x) => x.id === u.typology.id);
                  const features = parseJson(t?.features, z.array(z.string()), []);
                  const variants = parseJson(t?.variants, z.array(TypologyVariant), []);
                  return (
                    <td key={u.id} className="p-4 text-xs">
                      <ul className="space-y-1">
                        {features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full" style={{ background: u.typology.color }} /> {f}
                          </li>
                        ))}
                        {variants.map((v) => (
                          <li key={v.name} className="text-muted-foreground">
                            Opcional: {v.name} (+{formatCOP(v.deltaPrice)})
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Rectángulo proporcional al área construida (lado = sqrt(área)). */
function Footprint({ typology, maxArea }: { typology: UnitForCompare["typology"]; maxArea: number }) {
  const side = Math.sqrt(typology.builtArea / maxArea);
  const privateSide = Math.sqrt(typology.privateArea / maxArea);
  return (
    <div className="flex h-28 items-end">
      <div className="relative" style={{ width: `${side * 100}%`, height: `${side * 100}%`, minWidth: 40, minHeight: 40 }}>
        <div className="absolute inset-0 rounded-sm border-2" style={{ borderColor: typology.color, background: `${typology.color}22` }} />
        <div className="absolute bottom-0 left-0 rounded-sm" style={{ width: `${(privateSide / side) * 100}%`, height: `${(privateSide / side) * 100}%`, background: `${typology.color}66` }} />
        <span className="absolute -top-5 left-0 text-[10px] text-muted-foreground">{formatArea(typology.builtArea)}</span>
      </div>
    </div>
  );
}

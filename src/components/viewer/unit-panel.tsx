"use client";

import Link from "next/link";
import { Calculator, Columns3, FileText, X, BedDouble, Bath, Ruler, Compass, Mountain } from "lucide-react";
import { useViewerStore } from "@/stores/viewer-store";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatArea, formatCOP, cn } from "@/lib/utils";
import { pricePerM2 } from "@/lib/quote-engine";
import type { UnitListItem } from "@/components/project/project-context";

export function UnitPanel({
  unit,
  slug,
  readOnly = false,
  onClose,
}: {
  unit: UnitListItem;
  slug?: string;
  readOnly?: boolean;
  onClose?: () => void;
}) {
  const { compareIds, toggleCompare, select } = useViewerStore();
  const inCompare = compareIds.includes(unit.id);
  const price = unit.priceOverride ?? unit.listPrice;

  return (
    <div className="glass animate-fade-up rounded-lg border p-4 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {unit.tower.name} · Piso {unit.floor}
          </p>
          <h3 className="text-xl font-semibold">{unit.code}</h3>
          <p className="text-sm" style={{ color: unit.typology.color }}>
            Tipo {unit.typology.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={unit.status} />
          <button
            onClick={() => {
              select(null);
              onClose?.();
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Info icon={Ruler} label="Área construida" value={formatArea(unit.typology.builtArea)} />
        <Info icon={Ruler} label="Área privada" value={formatArea(unit.typology.privateArea)} />
        <Info icon={BedDouble} label="Alcobas" value={String(unit.typology.bedrooms)} />
        <Info icon={Bath} label="Baños" value={String(unit.typology.bathrooms)} />
        {unit.orientation && <Info icon={Compass} label="Orientación" value={unit.orientation} />}
        {unit.viewTag && <Info icon={Mountain} label="Vista" value={unit.viewTag} />}
      </div>

      <div className="mt-3 rounded-md bg-background/60 p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio {unit.priceOverride ? "especial" : "de lista"}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatCOP(price)}</p>
        <p className="text-xs text-muted-foreground">{formatCOP(pricePerM2(price, unit.typology.privateArea))} / m² privado</p>
      </div>

      {!readOnly && slug && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href={`/proyectos/${slug}/cotizador?unit=${unit.id}`}
            className={cn(buttonVariants({ variant: "accent", size: "sm" }), unit.status !== "DISPONIBLE" && "pointer-events-none opacity-50")}
          >
            <Calculator /> Cotizar
          </Link>
          <Button size="sm" variant={inCompare ? "default" : "secondary"} onClick={() => toggleCompare(unit.id)}>
            <Columns3 /> {inCompare ? "Quitar" : "Comparar"}
          </Button>
          <Link href={`/proyectos/${slug}/unidades/${unit.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <FileText /> Ficha
          </Link>
        </div>
      )}
      {readOnly && (
        <div className="mt-3">
          <Button size="sm" variant={inCompare ? "default" : "secondary"} className="w-full" onClick={() => toggleCompare(unit.id)}>
            <Columns3 /> {inCompare ? "Quitar de comparación" : "Agregar a comparación"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background/40 px-2 py-1.5">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="leading-tight">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{value}</p>
      </div>
    </div>
  );
}

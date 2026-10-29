"use client";

import { useMemo } from "react";
import { useViewerStore } from "@/stores/viewer-store";
import { cn } from "@/lib/utils";
import { priceRange, unitColor, type UnitGeom } from "./layout";

/**
 * Pila de pisos sincronizada con el 3D: cada fila es un piso y cada celda una
 * unidad. Clic en celda = seleccionar; clic en número de piso = corte.
 */
export function FloorStack({ units, towerCode, onSelect }: { units: UnitGeom[]; towerCode: string; onSelect?: (id: string) => void }) {
  const { selectedUnitId, hoveredUnitId, colorMode, floorCut, filterTypology, filterStatus, select, hover, setFloorCut } = useViewerStore();
  const range = useMemo(() => priceRange(units), [units]);

  const floors = useMemo(() => {
    const m = new Map<number, UnitGeom[]>();
    for (const u of units) {
      const arr = m.get(u.floor) ?? [];
      arr.push(u);
      m.set(u.floor, arr);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([floor, list]) => [floor, list.sort((a, b) => a.position - b.position)] as const);
  }, [units]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{towerCode} · Pisos</p>
        {floorCut && (
          <button onClick={() => setFloorCut(null)} className="text-[11px] text-accent hover:underline">
            Quitar corte
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {floors.map(([floor, list]) => (
          <div key={floor} className={cn("mb-1 flex items-center gap-1.5", floorCut !== null && floor > floorCut && "opacity-30")}>
            <button
              onClick={() => setFloorCut(floorCut === floor ? null : floor)}
              className={cn(
                "w-7 shrink-0 rounded text-right text-[11px] tabular-nums text-muted-foreground hover:text-foreground",
                floorCut === floor && "font-semibold text-accent"
              )}
              title="Cortar la torre en este piso"
            >
              {floor}
            </button>
            <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
              {list.map((u) => {
                const filteredOut = (filterTypology && u.typology.code !== filterTypology) || (filterStatus && u.status !== filterStatus);
                const active = selectedUnitId === u.id;
                return (
                  <button
                    key={u.id}
                    title={`${u.code} · ${u.typology.name}`}
                    onMouseEnter={() => hover(u.id)}
                    onMouseLeave={() => hover(null)}
                    onClick={() => {
                      select(u.id);
                      onSelect?.(u.id);
                    }}
                    className={cn(
                      "h-5 rounded-[3px] text-[9px] font-medium text-black/70 transition-all",
                      active && "ring-2 ring-accent ring-offset-1 ring-offset-background",
                      hoveredUnitId === u.id && !active && "ring-1 ring-white/70",
                      filteredOut && "opacity-20"
                    )}
                    style={{ background: unitColor(u, colorMode, range) }}
                  >
                    {String(u.position).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

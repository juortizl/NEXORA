"use client";

import { useEffect, useRef, useState } from "react";
import { useViewerStore } from "@/stores/viewer-store";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { formatCOPCompact } from "@/lib/utils";
import type { UnitGeom } from "./layout";

/** Tooltip HTML fuera del Canvas que sigue al cursor sobre la unidad en hover. */
export function HoverTooltip({ units, containerRef }: { units: UnitGeom[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const hoveredId = useViewerStore((s) => s.hoveredUnitId);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const r = el.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [containerRef]);

  const unit = hoveredId ? units.find((u) => u.id === hoveredId) : null;
  if (!unit || !pos) return null;
  const meta = UNIT_STATUS_META[unit.status as UnitStatus];

  return (
    <div
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md border bg-black/85 px-2.5 py-1.5 text-[11px] text-white shadow-lg"
      style={{ left: pos.x + 14, top: pos.y + 14 }}
    >
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${meta?.color ?? "bg-slate-500"}`} />
        <span className="font-semibold">{unit.code}</span>
        <span className="text-white/70">{unit.typology.name}</span>
      </div>
      <div className="mt-0.5 text-white/80">
        Piso {unit.floor} · {formatCOPCompact(unit.priceOverride ?? unit.listPrice)} · {meta?.label ?? unit.status}
      </div>
    </div>
  );
}

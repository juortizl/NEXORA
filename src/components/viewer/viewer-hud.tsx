"use client";

import { Eye, Orbit, RotateCw, Sun, Moon, Tag, Layers, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import { useViewerStore, type ColorMode } from "@/stores/viewer-store";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/input";

export function ViewerHud({
  typologies,
  maxFloor,
  connected,
  counts,
  compact = false,
}: {
  typologies: { code: string; name: string; color: string }[];
  maxFloor: number;
  connected?: boolean;
  counts: Record<string, number>;
  compact?: boolean;
}) {
  const s = useViewerStore();
  const isNight = s.timeOfDay < 5.5 || s.timeOfDay > 18.5;

  return (
    <>
      {/* Panel superior izquierdo: leyenda y filtros */}
      <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[280px] flex-col gap-2">
        <div className="glass rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colorear por</p>
            {connected !== undefined && (
              <span className={cn("inline-flex items-center gap-1 text-[10px]", connected ? "text-emerald-400" : "text-muted-foreground")}>
                {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                {connected ? "En vivo" : "Sin conexión"}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(
              [
                ["status", "Estado"],
                ["typology", "Tipología"],
                ["price", "Precio"],
              ] as [ColorMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => s.setColorMode(mode)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
                  s.colorMode === mode ? "bg-accent text-accent-foreground" : "bg-muted hover:bg-muted/70"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-1">
            {s.colorMode === "typology" ? (
              typologies.map((t) => (
                <button
                  key={t.code}
                  onClick={() => s.setFilterTypology(s.filterTypology === t.code ? null : t.code)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted",
                    s.filterTypology && s.filterTypology !== t.code && "opacity-40"
                  )}
                >
                  <span className="size-2.5 rounded-sm" style={{ background: t.color }} />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-muted-foreground">{t.code}</span>
                </button>
              ))
            ) : s.colorMode === "price" ? (
              <div className="px-1 text-[11px] text-muted-foreground">
                <div className="h-2 w-full rounded" style={{ background: "linear-gradient(90deg,#38bdf8,#f43f5e)" }} />
                <div className="mt-1 flex justify-between">
                  <span>Menor precio</span>
                  <span>Mayor precio</span>
                </div>
              </div>
            ) : (
              (Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => s.setFilterStatus(s.filterStatus === st ? null : st)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted",
                    s.filterStatus && s.filterStatus !== st && "opacity-40"
                  )}
                >
                  <span className={cn("size-2.5 rounded-sm", UNIT_STATUS_META[st].color)} />
                  <span className="flex-1">{UNIT_STATUS_META[st].label}</span>
                  <span className="tabular-nums text-muted-foreground">{counts[st] ?? 0}</span>
                </button>
              ))
            )}
          </div>
          {!compact && s.colorMode !== "price" && (
            <div className="mt-2 border-t pt-2">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Filtrar tipología</p>
              <div className="flex flex-wrap gap-1">
                {typologies.map((t) => (
                  <button
                    key={t.code}
                    onClick={() => s.setFilterTypology(s.filterTypology === t.code ? null : t.code)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      s.filterTypology === t.code ? "border-accent bg-accent/20 text-accent" : "hover:bg-muted"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior: controles de escena */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className="glass flex items-center gap-3 rounded-full border px-4 py-2">
          <div className="flex items-center gap-2" title="Hora del día">
            {isNight ? <Moon className="size-4 text-sky-300" /> : <Sun className="size-4 text-amber-400" />}
            <Slider min={0} max={24} step={0.25} value={s.timeOfDay} onChange={(e) => s.setTimeOfDay(Number(e.target.value))} className="w-28" />
            <span className="w-10 text-xs tabular-nums text-muted-foreground">{formatHour(s.timeOfDay)}</span>
          </div>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2" title="Corte por piso">
            <Layers className="size-4 text-muted-foreground" />
            <Slider
              min={1}
              max={maxFloor}
              step={1}
              value={s.floorCut ?? maxFloor}
              onChange={(e) => {
                const v = Number(e.target.value);
                s.setFloorCut(v >= maxFloor ? null : v);
              }}
              className="w-28"
            />
            <span className="w-14 text-xs tabular-nums text-muted-foreground">{s.floorCut ? `Piso ${s.floorCut}` : "Completo"}</span>
          </div>
          <span className="h-5 w-px bg-border" />
          <HudButton active={s.cameraMode === "orbit"} onClick={() => s.setCameraMode("orbit")} title="Órbita">
            <Orbit className="size-4" />
          </HudButton>
          <HudButton
            active={s.cameraMode === "floorView"}
            onClick={() => s.setCameraMode("floorView")}
            title="Vista desde el apartamento (requiere seleccionar uno)"
            disabled={!s.selectedUnitId}
          >
            <Eye className="size-4" />
          </HudButton>
          <HudButton active={s.autoRotate} onClick={() => s.setAutoRotate(!s.autoRotate)} title="Rotación automática">
            <RotateCw className="size-4" />
          </HudButton>
          <HudButton active={s.showLabels} onClick={() => s.setShowLabels(!s.showLabels)} title="Etiquetas">
            <Tag className="size-4" />
          </HudButton>
          <HudButton
            onClick={() => {
              s.select(null);
              s.setFloorCut(null);
              s.setFilterStatus(null);
              s.setFilterTypology(null);
              s.setCameraMode("orbit");
            }}
            title="Restablecer"
          >
            <RefreshCcw className="size-4" />
          </HudButton>
        </div>
      </div>
    </>
  );
}

function HudButton({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "rounded-full p-1.5 transition-colors disabled:opacity-40",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function formatHour(t: number) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

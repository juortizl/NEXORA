"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Columns3, Loader2 } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useViewerStore } from "@/stores/viewer-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useHydrated } from "@/hooks/use-hydrated";
import { ViewerHud } from "./viewer-hud";
import { HoverTooltip } from "./hover-tooltip";
import { FloorStack } from "./floor-stack";
import { UnitPanel } from "./unit-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ProjectScene = dynamic(() => import("./scene").then((m) => m.ProjectScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a1020]">
      <Loader2 className="size-6 animate-spin text-accent" />
    </div>
  ),
});

export function ProjectViewer() {
  const project = useProject();
  const { data: units = [], isLoading } = trpc.unit.list.useQuery({ projectId: project.id });
  const { connected } = useRealtime({ projectId: project.id });
  const selectedUnitId = useViewerStore((s) => s.selectedUnitId);
  const compareIds = useViewerStore((s) => s.compareIds);
  const [activeTower, setActiveTower] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const deepLinkUnit = searchParams.get("unit");

  // Enlace profundo desde la ficha o el CRM: /proyectos/[slug]?unit=<id>
  const deepUnit = deepLinkUnit ? units.find((x) => x.id === deepLinkUnit) : undefined;
  const deepUnitId = deepUnit?.id ?? null;
  // La torre activa se ajusta durante el render (estado derivado de la URL)…
  const [appliedDeepLink, setAppliedDeepLink] = useState<string | null>(null);
  if (deepUnit && appliedDeepLink !== deepUnit.id) {
    setAppliedDeepLink(deepUnit.id);
    setActiveTower(deepUnit.towerId);
  }
  // …y la selección se sincroniza con el store del visor (sistema externo) en un efecto.
  useEffect(() => {
    if (deepUnitId) useViewerStore.getState().select(deepUnitId);
  }, [deepUnitId]);

  const towersWithUnits = useMemo(() => project.towers.filter((t) => units.some((u) => u.towerId === t.id)), [project.towers, units]);
  const towerId = activeTower ?? towersWithUnits[0]?.id ?? null;
  const towerUnits = useMemo(() => units.filter((u) => u.towerId === towerId), [units, towerId]);
  const selected = units.find((u) => u.id === selectedUnitId) ?? null;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of units) c[u.status] = (c[u.status] ?? 0) + 1;
    return c;
  }, [units]);
  const maxFloor = Math.max(1, ...project.towers.map((t) => t.floors));

  if (!hydrated) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-[#0a1020]">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)]">
      <div className="relative flex-1" ref={containerRef}>
        <HoverTooltip units={units} containerRef={containerRef} />
        <ProjectScene
          className="h-full w-full"
          towers={project.towers}
          units={units}
          siteModelUrl={project.siteModelUrl}
          onSelect={(id) => {
            const u = units.find((x) => x.id === id);
            if (u) setActiveTower(u.towerId);
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-20">
          <ViewerHud typologies={project.typologies} maxFloor={maxFloor} connected={connected} counts={counts} />
          {selected && (
            <div className="pointer-events-auto absolute right-3 top-3 w-[340px]">
              <UnitPanel unit={selected} slug={project.slug} />
            </div>
          )}
          {compareIds.length > 0 && (
            <div className="pointer-events-auto absolute bottom-16 right-3">
              <Link href={`/proyectos/${project.slug}/comparar?ids=${compareIds.join(",")}`} className={cn(buttonVariants({ variant: "accent" }), "shadow-lg")}>
                <Columns3 /> Comparar {compareIds.length} unidad{compareIds.length > 1 ? "es" : ""}
              </Link>
            </div>
          )}
          {isLoading && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Cargando inventario…</div>
          )}
        </div>
      </div>

      <aside className="hidden w-64 shrink-0 border-l bg-card/40 lg:flex lg:flex-col">
        {towersWithUnits.length > 1 && (
          <div className="flex gap-1 border-b p-2">
            {towersWithUnits.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTower(t.id)}
                className={cn("flex-1 rounded-md px-2 py-1 text-xs", towerId === t.id ? "bg-accent text-accent-foreground" : "bg-muted")}
              >
                {t.code}
              </button>
            ))}
          </div>
        )}
        {towerId ? (
          <FloorStack units={towerUnits} towerCode={project.towers.find((t) => t.id === towerId)?.code ?? ""} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Sin inventario cargado.</p>
        )}
      </aside>
    </div>
  );
}

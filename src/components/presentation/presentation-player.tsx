"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, MapPin, Clock, Loader2, Wifi, WifiOff, LayoutGrid } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/trpc/react";
import { ProjectProvider, type RouterOutputs } from "@/components/project/project-context";
import { useRealtime } from "@/hooks/use-realtime";
import { useHydrated } from "@/hooks/use-hydrated";
import { useViewerStore } from "@/stores/viewer-store";
import { ViewerHud } from "@/components/viewer/viewer-hud";
import { UnitPanel } from "@/components/viewer/unit-panel";
import { FloorStack } from "@/components/viewer/floor-stack";
import { CompareView } from "@/components/compare/compare-view";
import { PublicQuoteCalculator } from "./public-quote-calculator";
import { PresentationBlock, TypologyVariant, UNIT_STATUS_META, parseJson, type UnitStatus } from "@/lib/domain";
import { cn, formatArea, formatCOP, formatDate } from "@/lib/utils";

const ProjectScene = dynamic(() => import("@/components/viewer/scene").then((m) => m.ProjectScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a1020]">
      <Loader2 className="size-6 animate-spin text-accent" />
    </div>
  ),
});

type PublicProject = RouterOutputs["project"]["byPublicToken"];
type PublicUnit = RouterOutputs["unit"]["publicList"][number];

export function PresentationPlayer({ token, initialProject }: { token: string; initialProject: PublicProject }) {
  const { data: project = initialProject } = trpc.project.byPublicToken.useQuery({ token }, { initialData: initialProject });
  const { data: units = [] } = trpc.unit.publicList.useQuery({ token });
  const { connected } = useRealtime({ token });
  const hydrated = useHydrated();

  const blocks = useMemo(
    () => parseJson(project.presentations[0]?.blocks, z.array(PresentationBlock), []),
    [project.presentations]
  );
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.max(0, Math.min(blocks.length - 1, i + delta))),
    [blocks.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(blocks.length - 1);
      if (e.key.toLowerCase() === "g") setShowGrid((v) => !v);
      if (e.key.toLowerCase() === "f") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, blocks.length]);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await rootRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  const block = blocks[index];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of units) c[u.status] = (c[u.status] ?? 0) + 1;
    return c;
  }, [units]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a1020]">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <ProjectProvider project={project}>
      <div
        ref={rootRef}
        className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        style={
          {
            "--project-primary": project.primaryColor,
            "--project-secondary": project.secondaryColor,
            "--project-accent": project.accentColor,
            "--accent": project.accentColor,
          } as React.CSSProperties
        }
      >
        {/* Barra superior */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            {project.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.logoUrl} alt={project.name} className="h-7 w-auto" />
            ) : (
              <span className="font-semibold tracking-wide">{project.name}</span>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline">by {project.company.name}</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {blocks.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors",
                  i === index ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                )}
              >
                {b.title ?? BLOCK_LABEL[b.type]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={connected ? "Inventario en vivo" : "Reconectando…"}>
              {connected ? <Wifi className="size-3.5 text-emerald-400" /> : <WifiOff className="size-3.5" />}
            </span>
            <button onClick={() => setShowGrid((v) => !v)} className="rounded p-1.5 hover:bg-white/10" title="Vista general (G)">
              <LayoutGrid className="size-4" />
            </button>
            <button onClick={() => void toggleFullscreen()} className="rounded p-1.5 hover:bg-white/10" title="Pantalla completa (F)">
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </header>

        {/* Contenido */}
        <main className="relative flex-1 overflow-hidden">
          {showGrid ? (
            <div className="grid h-full grid-cols-2 gap-4 overflow-y-auto p-6 md:grid-cols-3 lg:grid-cols-4">
              {blocks.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setIndex(i);
                    setShowGrid(false);
                  }}
                  className={cn("flex aspect-video flex-col justify-end rounded-lg border p-4 text-left transition-colors hover:border-accent", i === index && "border-accent")}
                  style={{ background: `linear-gradient(135deg, ${project.primaryColor}, ${project.secondaryColor})` }}
                >
                  <p className="text-[10px] uppercase tracking-widest text-white/60">
                    {i + 1} · {BLOCK_LABEL[b.type]}
                  </p>
                  <p className="font-semibold text-white">{b.title}</p>
                </button>
              ))}
            </div>
          ) : block ? (
            <Suspense fallback={null}>
              <BlockRenderer key={block.id} block={block} project={project} units={units} token={token} counts={counts} />
            </Suspense>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">Esta presentación no tiene bloques configurados.</div>
          )}
        </main>

        {/* Navegación */}
        {!showGrid && blocks.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70 disabled:opacity-20"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              disabled={index === blocks.length - 1}
              className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70 disabled:opacity-20"
              aria-label="Siguiente"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-1">
              {blocks.map((b, i) => (
                <span key={b.id} className={cn("h-1 rounded-full transition-all", i === index ? "w-6 bg-accent" : "w-2 bg-white/30")} />
              ))}
            </div>
          </>
        )}
      </div>
    </ProjectProvider>
  );
}

const BLOCK_LABEL: Record<PresentationBlock["type"], string> = {
  PORTADA: "Portada",
  UBICACION: "Ubicación",
  AMENIDADES: "Amenidades",
  TIPOLOGIAS: "Tipologías",
  VISOR_3D: "Visor 3D",
  INVENTARIO: "Inventario",
  COMPARADOR: "Comparador",
  COTIZADOR: "Cotizador",
  GALERIA: "Galería",
  CONSTRUCTORA: "Constructora",
  CIERRE: "Cierre",
};

function BlockRenderer({
  block,
  project,
  units,
  token,
  counts,
}: {
  block: PresentationBlock;
  project: PublicProject;
  units: PublicUnit[];
  token: string;
  counts: Record<string, number>;
}) {
  switch (block.type) {
    case "PORTADA":
      return <CoverBlock block={block} project={project} counts={counts} />;
    case "UBICACION":
      return <LocationBlock block={block} project={project} />;
    case "AMENIDADES":
      return <AmenitiesBlock block={block} project={project} />;
    case "TIPOLOGIAS":
      return <TypologiesBlock block={block} project={project} units={units} />;
    case "VISOR_3D":
      return <ViewerBlock project={project} units={units} counts={counts} />;
    case "INVENTARIO":
      return <InventoryBlock block={block} project={project} units={units} />;
    case "COMPARADOR":
      return (
        <div className="h-full overflow-y-auto">
          <CompareView readOnly publicToken={token} />
        </div>
      );
    case "COTIZADOR":
      return (
        <div className="h-full overflow-y-auto">
          <PublicQuoteCalculator units={units} title={block.title} />
        </div>
      );
    case "GALERIA":
      return <GalleryBlock block={block} project={project} />;
    case "CONSTRUCTORA":
      return <CompanyBlock block={block} project={project} />;
    case "CIERRE":
      return <ClosingBlock block={block} project={project} />;
  }
}

function Hero({ project, children, image }: { project: PublicProject; children: React.ReactNode; image?: string | null }) {
  return (
    <section
      className="relative flex h-full flex-col justify-end overflow-hidden p-10 md:p-16"
      style={{ background: `linear-gradient(160deg, ${project.primaryColor} 0%, ${project.secondaryColor} 100%)` }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="relative z-10 max-w-4xl animate-fade-up">{children}</div>
    </section>
  );
}

function CoverBlock({ block, project, counts }: { block: PresentationBlock; project: PublicProject; counts: Record<string, number> }) {
  const available = counts.DISPONIBLE ?? 0;
  return (
    <Hero project={project} image={block.mediaUrl ?? project.heroImageUrl}>
      <p className="text-xs uppercase tracking-[0.4em] text-white/70">{project.city ?? ""}</p>
      <h1 className="mt-3 text-6xl font-semibold tracking-tight text-white md:text-8xl">{block.title ?? project.name}</h1>
      {(block.subtitle ?? project.tagline) && <p className="mt-4 text-xl text-white/80 md:text-2xl">{block.subtitle ?? project.tagline}</p>}
      <div className="mt-8 flex flex-wrap gap-6 text-white">
        <Kpi label="Apartamentos disponibles" value={String(available)} />
        <Kpi label="Tipologías" value={String(project.typologies.length)} />
        <Kpi label="Torres" value={String(project.towers.length)} />
        {project.priceValidUntil && <Kpi label="Precios vigentes hasta" value={formatDate(project.priceValidUntil)} />}
      </div>
    </Hero>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wider text-white/60">{label}</p>
    </div>
  );
}

function LocationBlock({ block, project }: { block: PresentationBlock; project: PublicProject }) {
  const groups = ["SECTOR", "CIUDAD", "FUTURO"] as const;
  const groupLabel: Record<string, string> = { SECTOR: "En el sector", CIUDAD: "Ciudad", FUTURO: "Desarrollos futuros" };
  const mapsUrl =
    project.latitude && project.longitude
      ? `https://www.google.com/maps?q=${project.latitude},${project.longitude}&z=15&output=embed`
      : project.address
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${project.address} ${project.city ?? ""}`)}&z=15&output=embed`
        : null;
  return (
    <section className="grid h-full grid-cols-1 lg:grid-cols-[1fr_420px]">
      <div className="relative bg-muted">
        {block.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.mediaUrl} alt="Ubicación" className="h-full w-full object-cover" />
        ) : mapsUrl ? (
          <iframe title="Mapa" src={mapsUrl} className="h-full w-full border-0 grayscale-[30%]" loading="lazy" allowFullScreen />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Agrega coordenadas o una imagen de ubicación.</div>
        )}
      </div>
      <div className="flex flex-col overflow-y-auto p-8">
        <h2 className="text-3xl font-semibold">{block.title ?? "Ubicación"}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {project.address ?? ""} {project.city ? `· ${project.city}` : ""}
        </p>
        {block.body && <p className="mt-4 text-sm text-muted-foreground">{block.body}</p>}
        {groups.map((g) => {
          const items = project.pois.filter((p) => p.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mt-6">
              <p className="text-[11px] uppercase tracking-widest text-accent">{groupLabel[g]}</p>
              <ul className="mt-2 space-y-1.5">
                {items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {p.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AmenitiesBlock({ block, project }: { block: PresentationBlock; project: PublicProject }) {
  const zones = Array.from(new Set(project.amenities.map((a) => a.zone ?? "Zonas comunes")));
  return (
    <section className="h-full overflow-y-auto p-10">
      <h2 className="text-4xl font-semibold">{block.title ?? "Amenidades"}</h2>
      {block.subtitle && <p className="mt-2 text-muted-foreground">{block.subtitle}</p>}
      <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((zone) => (
          <div key={zone}>
            <p className="text-[11px] uppercase tracking-widest text-accent">{zone}</p>
            <ul className="mt-3 grid grid-cols-1 gap-2">
              {project.amenities
                .filter((a) => (a.zone ?? "Zonas comunes") === zone)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border bg-card/60 px-4 py-3">
                    <span className="size-2 rounded-full bg-accent" />
                    <span>{a.name}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {block.mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.mediaUrl} alt="" className="mt-8 w-full rounded-xl object-cover" />
      )}
    </section>
  );
}

function TypologiesBlock({ block, project, units }: { block: PresentationBlock; project: PublicProject; units: PublicUnit[] }) {
  const [active, setActive] = useState(project.typologies[0]?.id);
  const t = project.typologies.find((x) => x.id === active) ?? project.typologies[0];
  if (!t) return null;
  const features = parseJson(t.features, z.array(z.string()), []);
  const variants = parseJson(t.variants, z.array(TypologyVariant), []);
  const list = units.filter((u) => u.typology.id === t.id);
  const available = list.filter((u) => u.status === "DISPONIBLE");
  const minPrice = available.length ? Math.min(...available.map((u) => u.priceOverride ?? u.listPrice)) : null;
  const plan = project.mediaAssets.find((m) => m.typologyId === t.id && m.kind === "PLANTA");
  return (
    <section className="grid h-full grid-cols-1 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-3 overflow-y-auto border-r p-8">
        <h2 className="text-3xl font-semibold">{block.title ?? "Tipologías"}</h2>
        {block.subtitle && <p className="text-sm text-muted-foreground">{block.subtitle}</p>}
        <div className="mt-4 space-y-2">
          {project.typologies.map((x) => {
            const avail = units.filter((u) => u.typology.id === x.id && u.status === "DISPONIBLE").length;
            return (
              <button
                key={x.id}
                onClick={() => setActive(x.id)}
                className={cn("w-full rounded-lg border p-4 text-left transition-colors hover:border-accent", x.id === t.id && "border-accent bg-accent/10")}
                style={{ borderLeft: `4px solid ${x.color}` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">Tipo {x.name}</p>
                  <span className="text-xs text-muted-foreground">{avail} disp.</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatArea(x.builtArea)} construidos · {formatArea(x.privateArea)} privados · {x.bedrooms} alc · {x.bathrooms} baños
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col overflow-y-auto p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest" style={{ color: t.color }}>
              Tipología {t.code}
            </p>
            <h3 className="text-5xl font-semibold">{t.name}</h3>
            {t.description && <p className="mt-2 max-w-xl text-muted-foreground">{t.description}</p>}
          </div>
          {minPrice && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Desde</p>
              <p className="text-3xl font-semibold tabular-nums">{formatCOP(minPrice)}</p>
            </div>
          )}
        </div>
        <div className="mt-6 grid flex-1 gap-6 md:grid-cols-[1fr_300px]">
          <div className="flex items-center justify-center rounded-xl border bg-card/40 p-4">
            {plan ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan.url} alt={`Planta ${t.name}`} className="max-h-[60vh] w-auto object-contain" />
            ) : (
              <FootprintSketch color={t.color} builtArea={t.builtArea} privateArea={t.privateArea} bedrooms={t.bedrooms} />
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Área construida" value={formatArea(t.builtArea)} />
              <Metric label="Área privada" value={formatArea(t.privateArea)} />
              <Metric label="Alcobas" value={String(t.bedrooms)} />
              <Metric label="Baños" value={String(t.bathrooms)} />
            </div>
            {features.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full" style={{ background: t.color }} /> {f}
                  </li>
                ))}
              </ul>
            )}
            {variants.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Opcionales</p>
                {variants.map((v) => (
                  <p key={v.name} className="mt-1">
                    {v.name} <span className="text-muted-foreground">+{formatCOP(v.deltaPrice)}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Esquema de planta genérico cuando no hay imagen de planta cargada. */
function FootprintSketch({ color, builtArea, privateArea, bedrooms }: { color: string; builtArea: number; privateArea: number; bedrooms: number }) {
  const ratio = 1.4;
  const w = 320;
  const h = w / ratio;
  const rooms = Math.max(1, bedrooms);
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full max-w-md">
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} fill={`${color}18`} stroke={color} strokeWidth={2} />
      <rect x={w * 0.05} y={h * 0.08} width={w * 0.5} height={h * 0.5} fill={`${color}30`} stroke={color} strokeDasharray="4 3" />
      <text x={w * 0.3} y={h * 0.35} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.8}>
        Sala · comedor · cocina
      </text>
      {Array.from({ length: rooms }).map((_, i) => {
        const rw = (w * 0.38) / 1;
        const rh = (h * 0.84) / rooms - 6;
        return (
          <g key={i}>
            <rect x={w * 0.58} y={h * 0.08 + i * (rh + 6)} width={rw} height={rh} fill={`${color}24`} stroke={color} strokeDasharray="4 3" />
            <text x={w * 0.58 + rw / 2} y={h * 0.08 + i * (rh + 6) + rh / 2 + 4} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.8}>
              Alcoba {i + 1}
            </text>
          </g>
        );
      })}
      <rect x={w * 0.05} y={h * 0.64} width={w * 0.5} height={h * 0.28} fill={`${color}24`} stroke={color} strokeDasharray="4 3" />
      <text x={w * 0.3} y={h * 0.8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.8}>
        Baño · ropas · balcón
      </text>
      <text x={w / 2} y={h + 20} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
        Esquema ilustrativo · {formatArea(builtArea)} construidos · {formatArea(privateArea)} privados
      </text>
    </svg>
  );
}

function ViewerBlock({ project, units, counts }: { project: PublicProject; units: PublicUnit[]; counts: Record<string, number> }) {
  const selectedUnitId = useViewerStore((s) => s.selectedUnitId);
  const select = useViewerStore((s) => s.select);
  const [activeTower, setActiveTower] = useState<string | null>(null);
  const towersWithUnits = project.towers.filter((t) => units.some((u) => u.towerId === t.id));
  const towerId = activeTower ?? towersWithUnits[0]?.id ?? null;
  const towerUnits = units.filter((u) => u.towerId === towerId);
  const selected = units.find((u) => u.id === selectedUnitId) ?? null;
  const maxFloor = Math.max(1, ...project.towers.map((t) => t.floors));
  return (
    <div className="relative flex h-full">
      <div className="relative flex-1">
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
          <ViewerHud typologies={project.typologies} maxFloor={maxFloor} counts={counts} compact />
          {selected && (
            <div className="pointer-events-auto absolute right-3 top-3 w-[340px]">
              <UnitPanel unit={selected} readOnly onClose={() => select(null)} />
            </div>
          )}
        </div>
      </div>
      <aside className="hidden w-60 shrink-0 border-l bg-card/40 lg:flex lg:flex-col">
        {towersWithUnits.length > 1 && (
          <div className="flex gap-1 border-b p-2">
            {towersWithUnits.map((t) => (
              <button key={t.id} onClick={() => setActiveTower(t.id)} className={cn("flex-1 rounded-md px-2 py-1 text-xs", towerId === t.id ? "bg-accent text-accent-foreground" : "bg-muted")}>
                {t.code}
              </button>
            ))}
          </div>
        )}
        {towerId && <FloorStack units={towerUnits} towerCode={project.towers.find((t) => t.id === towerId)?.code ?? ""} />}
      </aside>
    </div>
  );
}

function InventoryBlock({ block, project, units }: { block: PresentationBlock; project: PublicProject; units: PublicUnit[] }) {
  const [towerId, setTowerId] = useState<string | null>(null);
  const towers = project.towers.filter((t) => units.some((u) => u.towerId === t.id));
  const tid = towerId ?? towers[0]?.id;
  const list = units.filter((u) => u.towerId === tid);
  const floors = Array.from(new Set(list.map((u) => u.floor))).sort((a, b) => b - a);
  const positions = Array.from(new Set(list.map((u) => u.position))).sort((a, b) => a - b);
  const select = useViewerStore((s) => s.select);
  const selectedId = useViewerStore((s) => s.selectedUnitId);
  const selected = units.find((u) => u.id === selectedId);
  return (
    <section className="flex h-full flex-col p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold">{block.title ?? "Disponibilidad"}</h2>
          <p className="text-sm text-muted-foreground">{block.subtitle ?? "Se actualiza en tiempo real desde la sala de ventas."}</p>
        </div>
        <div className="flex items-center gap-3">
          {towers.length > 1 && (
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {towers.map((t) => (
                <button key={t.id} onClick={() => setTowerId(t.id)} className={cn("rounded-md px-3 py-1 text-xs", tid === t.id ? "bg-card shadow" : "text-muted-foreground")}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-xs">
            {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", UNIT_STATUS_META[s].color)} /> {UNIT_STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid flex-1 gap-6 overflow-hidden lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto rounded-lg border bg-card/40 p-3">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-10 text-muted-foreground">Piso</th>
                {positions.map((p) => (
                  <th key={p} className="text-muted-foreground">
                    {String(p).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {floors.map((f) => (
                <tr key={f}>
                  <td className="text-right text-muted-foreground">{f}</td>
                  {positions.map((p) => {
                    const u = list.find((x) => x.floor === f && x.position === p);
                    if (!u) return <td key={p} />;
                    const meta = UNIT_STATUS_META[u.status as UnitStatus];
                    return (
                      <td key={p}>
                        <button
                          onClick={() => select(u.id)}
                          title={`${u.code} · ${u.typology.name} · ${formatCOP(u.priceOverride ?? u.listPrice)}`}
                          className={cn(
                            "h-8 w-16 rounded-sm text-[10px] font-medium text-white/90 transition-transform hover:scale-105",
                            meta.color,
                            u.status !== "DISPONIBLE" && "opacity-50",
                            selectedId === u.id && "ring-2 ring-white"
                          )}
                        >
                          {u.typology.code}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {selected ? (
            <UnitPanel unit={selected} readOnly onClose={() => select(null)} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Toca un apartamento para ver su detalle.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function GalleryBlock({ block, project }: { block: PresentationBlock; project: PublicProject }) {
  const media = project.mediaAssets.filter((m) => m.kind === "RENDER" || m.kind === "FOTO");
  const [i, setI] = useState(0);
  const current = media[i];
  return (
    <section className="flex h-full flex-col bg-black">
      <div className="relative flex-1">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={current.title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">Aún no hay renders cargados.</div>
        )}
        {current && <p className="absolute bottom-4 left-6 rounded bg-black/60 px-3 py-1 text-sm text-white">{current.title}</p>}
      </div>
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
          {media.map((m, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt={m.title} onClick={() => setI(idx)} className={cn("h-16 w-24 cursor-pointer rounded object-cover opacity-60 hover:opacity-100", idx === i && "opacity-100 ring-2 ring-accent")} />
          ))}
        </div>
      )}
      <h2 className="sr-only">{block.title}</h2>
    </section>
  );
}

function CompanyBlock({ block, project }: { block: PresentationBlock; project: PublicProject }) {
  return (
    <Hero project={project} image={block.mediaUrl}>
      <p className="text-xs uppercase tracking-[0.4em] text-white/70">{project.company.name}</p>
      <h2 className="mt-3 text-5xl font-semibold text-white">{block.title ?? "Respaldo y trayectoria"}</h2>
      <p className="mt-4 max-w-2xl text-lg text-white/80">
        {block.body ?? "Construimos proyectos pensados para quienes buscan calidad, cumplimiento y valorización."}
      </p>
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
        {project.company.website && <span>{project.company.website}</span>}
        {project.company.phone && <span>{project.company.phone}</span>}
      </div>
    </Hero>
  );
}

function ClosingBlock({ block, project }: { block: PresentationBlock; project: PublicProject }) {
  return (
    <Hero project={project} image={block.mediaUrl ?? project.heroImageUrl}>
      <h2 className="text-6xl font-semibold text-white">{block.title ?? "Hablemos"}</h2>
      <p className="mt-4 max-w-2xl text-xl text-white/80">{block.body ?? `Agenda tu visita a la sala de ventas de ${project.name} y separa tu apartamento hoy.`}</p>
      <div className="mt-8 flex flex-wrap gap-4 text-white">
        {project.company.phone && (
          <a href={`https://wa.me/${project.company.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-full bg-accent px-6 py-3 font-medium text-accent-foreground">
            Escríbenos por WhatsApp
          </a>
        )}
        {project.company.website && (
          <a href={project.company.website} target="_blank" rel="noreferrer" className="rounded-full border border-white/40 px-6 py-3">
            {project.company.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
      {project.priceValidUntil && <p className="mt-6 text-xs text-white/60">Precios vigentes hasta {formatDate(project.priceValidUntil)}. Imágenes de referencia.</p>}
    </Hero>
  );
}

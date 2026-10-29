"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Save, Trash2, QrCode, MonitorPlay } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRole } from "@/hooks/use-session-role";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { PresentationBlock, PresentationBlockType, parseJson } from "@/lib/domain";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

const TYPE_LABEL: Record<PresentationBlockType, string> = {
  PORTADA: "Portada",
  UBICACION: "Ubicación",
  AMENIDADES: "Amenidades",
  TIPOLOGIAS: "Tipologías",
  VISOR_3D: "Visor 3D",
  INVENTARIO: "Inventario en vivo",
  COMPARADOR: "Comparador",
  COTIZADOR: "Cotizador",
  GALERIA: "Galería de renders",
  CONSTRUCTORA: "Constructora",
  CIERRE: "Cierre / contacto",
};

export function PresentationEditor() {
  const project = useProject();
  const { isManager } = useRole();
  const utils = trpc.useUtils();
  const { data: presentations = [] } = trpc.admin.presentations.useQuery({ projectId: project.id });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = presentations.find((p) => p.id === activeId) ?? presentations.find((p) => p.isDefault) ?? presentations[0];

  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [blocks, setBlocks] = useState<PresentationBlock[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Carga el editor con la versión activa del servidor (patrón "ajustar estado cuando cambia una prop").
  const activeVersion = active ? `${active.id}:${new Date(active.updatedAt).toISOString()}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null>(null);
  if (active && activeVersion !== syncedVersion) {
    setSyncedVersion(activeVersion);
    setName(active.name);
    setIsDefault(active.isDefault);
    const parsed = parseJson(active.blocks, z.array(PresentationBlock), []);
    setBlocks(parsed);
    setSelected(parsed[0]?.id ?? null);
    setDirty(false);
  }

  const save = trpc.admin.savePresentation.useMutation({
    onSuccess: (p) => {
      toast.success("Presentación guardada");
      setActiveId(p.id);
      setDirty(false);
      void utils.admin.presentations.invalidate();
      void utils.project.invalidate();
    },
    onError: (e) => toast.error("No se pudo guardar", e.message),
  });

  // Origen del navegador sin desajuste de hidratación: "" en servidor, window.location.origin en cliente.
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
  const publicUrl = `${origin}/presentacion/${project.publicToken}`;

  const update = (id: string, patch: Partial<PresentationBlock>) => {
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const move = (id: string, dir: -1 | 1) => {
    setBlocks((b) => {
      const i = b.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  };
  const remove = (id: string) => {
    setBlocks((b) => b.filter((x) => x.id !== id));
    setSelected((s) => (s === id ? null : s));
    setDirty(true);
  };
  const add = (type: PresentationBlockType) => {
    const id = `b${Date.now().toString(36)}`;
    setBlocks((b) => [...b, { id, type, title: TYPE_LABEL[type] }]);
    setSelected(id);
    setDirty(true);
  };

  const sel = blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modo presentación</h1>
          <p className="text-sm text-muted-foreground">Reemplaza el PowerPoint: configura los bloques que verá el cliente en la sala de ventas o por enlace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={publicUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            <MonitorPlay /> Abrir presentación
          </a>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl);
              toast.success("Enlace copiado", "Compártelo con el cliente; no requiere inicio de sesión.");
            }}
          >
            <Copy /> Copiar enlace
          </Button>
          <a
            href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(publicUrl)}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <QrCode /> Código QR
          </a>
          {isManager && (
            <Button
              variant="accent"
              loading={save.isPending}
              disabled={!dirty && !!active}
              onClick={() => save.mutate({ id: active?.id, projectId: project.id, name: name || "Presentación comercial", isDefault, blocks })}
            >
              <Save /> Guardar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
        {/* Lista de bloques */}
        <Card>
          <CardHeader>
            <CardTitle>Bloques</CardTitle>
            <CardDescription>Orden en que se presentan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {blocks.map((b, i) => (
              <div
                key={b.id}
                className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm", selected === b.id ? "border-accent bg-accent/10" : "hover:bg-muted/50")}
              >
                <button className="flex-1 truncate text-left" onClick={() => setSelected(b.id)}>
                  <span className="mr-1.5 text-[10px] text-muted-foreground">{i + 1}</span>
                  {b.title || TYPE_LABEL[b.type]}
                  <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{TYPE_LABEL[b.type]}</span>
                </button>
                {isManager && (
                  <>
                    <button onClick={() => move(b.id, -1)} className="rounded p-0.5 hover:bg-muted" aria-label="Subir">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button onClick={() => move(b.id, 1)} className="rounded p-0.5 hover:bg-muted" aria-label="Bajar">
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button onClick={() => remove(b.id)} className="rounded p-0.5 text-rose-400 hover:bg-muted" aria-label="Eliminar">
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {isManager && (
              <Select value="" onChange={(e) => e.target.value && add(e.target.value as PresentationBlockType)} className="mt-3 h-8 text-xs">
                <option value="">+ Agregar bloque…</option>
                {(Object.keys(TYPE_LABEL) as PresentationBlockType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Vista previa */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Vista previa</CardTitle>
              <CardDescription>Así se ve en la sala de ventas.</CardDescription>
            </div>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Abrir en pestaña <ExternalLink className="size-3" />
            </a>
          </CardHeader>
          <CardContent className="p-0">
            <div className="aspect-video w-full bg-black">
              <iframe key={active?.updatedAt?.toString() ?? "preview"} title="Vista previa" src={publicUrl} className="h-full w-full border-0" />
            </div>
          </CardContent>
        </Card>

        {/* Propiedades */}
        <Card>
          <CardHeader>
            <CardTitle>Propiedades</CardTitle>
            <CardDescription>{sel ? TYPE_LABEL[sel.type] : "Selecciona un bloque"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Nombre de la presentación">
              <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} disabled={!isManager} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={isDefault} onChange={(e) => { setIsDefault(e.target.checked); setDirty(true); }} disabled={!isManager} />
              Presentación por defecto del enlace público
            </label>
            {presentations.length > 1 && (
              <Field label="Versión">
                <Select value={active?.id ?? ""} onChange={(e) => setActiveId(e.target.value)}>
                  {presentations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isDefault ? "(por defecto)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {isManager && (
              <Button variant="ghost" size="sm" onClick={() => { setActiveId(null); setName("Nueva presentación"); setIsDefault(false); setBlocks([]); setDirty(true); }}>
                <Plus /> Nueva versión
              </Button>
            )}
            {sel && (
              <div className="space-y-3 border-t pt-3">
                <Field label="Título">
                  <Input value={sel.title ?? ""} onChange={(e) => update(sel.id, { title: e.target.value })} disabled={!isManager} />
                </Field>
                <Field label="Subtítulo">
                  <Input value={sel.subtitle ?? ""} onChange={(e) => update(sel.id, { subtitle: e.target.value })} disabled={!isManager} />
                </Field>
                <Field label="Texto">
                  <Textarea value={sel.body ?? ""} onChange={(e) => update(sel.id, { body: e.target.value })} disabled={!isManager} />
                </Field>
                <Field label="Imagen de fondo (URL)" hint="Render, foto o mapa. Para ubicación puede dejarse vacío si el proyecto tiene coordenadas.">
                  <Input value={sel.mediaUrl ?? ""} onChange={(e) => update(sel.id, { mediaUrl: e.target.value })} placeholder="https://…" disabled={!isManager} />
                </Field>
              </div>
            )}
            <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground">
              Atajos en la presentación: ← → para navegar, <kbd>G</kbd> vista general, <kbd>F</kbd> pantalla completa.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

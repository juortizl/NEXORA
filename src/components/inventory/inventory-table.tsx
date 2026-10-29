"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Calculator, Columns3, Download, FileText, Upload, Search, X } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject, type UnitListItem } from "@/components/project/project-context";
import { useViewerStore } from "@/stores/viewer-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useRole } from "@/hooks/use-session-role";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { cn, formatArea, formatCOP } from "@/lib/utils";
import { Stat } from "@/components/ui/tabs";

type SortKey = "code" | "floor" | "typology" | "listPrice" | "status" | "privateArea";

export function InventoryTable() {
  const project = useProject();
  const { isManager } = useRole();
  const utils = trpc.useUtils();
  const { data: units = [], isLoading } = trpc.unit.list.useQuery({ projectId: project.id });
  useRealtime({ projectId: project.id });
  const { compareIds, toggleCompare } = useViewerStore();

  const [search, setSearch] = useState("");
  const [tower, setTower] = useState("");
  const [typology, setTypology] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("");
  const [floorMin, setFloorMin] = useState("");
  const [floorMax, setFloorMax] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "floor", dir: -1 });
  const fileRef = useRef<HTMLInputElement>(null);

  const updateStatus = trpc.unit.updateStatus.useMutation({
    onSuccess: () => {
      void utils.unit.invalidate();
      toast.success("Estado actualizado");
    },
    onError: (e) => toast.error("No se pudo actualizar", e.message),
  });
  const exportExcel = trpc.unit.exportExcel.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      a.download = data.filename;
      a.click();
      toast.success("Excel exportado");
    },
  });
  const importExcel = trpc.unit.importExcel.useMutation({
    onSuccess: (res) => {
      void utils.unit.invalidate();
      toast.success(`${res.updated} unidades actualizadas`, res.errors.length ? `${res.errors.length} filas con errores` : undefined);
      if (res.errors.length) console.warn(res.errors);
    },
    onError: (e) => toast.error("Error al importar", e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = units.filter((u) => {
      if (q && !u.code.toUpperCase().includes(q) && !u.typology.name.toUpperCase().includes(q)) return false;
      if (tower && u.towerId !== tower) return false;
      if (typology && u.typologyId !== typology) return false;
      if (status && u.status !== status) return false;
      if (view && u.viewTag !== view) return false;
      if (floorMin && u.floor < Number(floorMin)) return false;
      if (floorMax && u.floor > Number(floorMax)) return false;
      if (priceMax && (u.priceOverride ?? u.listPrice) > Number(priceMax) * 1_000_000) return false;
      return true;
    });
    const val = (u: UnitListItem): string | number => {
      switch (sort.key) {
        case "code":
          return u.code;
        case "floor":
          return u.floor * 100 + u.position;
        case "typology":
          return u.typology.name;
        case "listPrice":
          return u.priceOverride ?? u.listPrice;
        case "status":
          return u.status;
        case "privateArea":
          return u.typology.privateArea;
      }
    };
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [units, search, tower, typology, status, view, floorMin, floorMax, priceMax, sort]);

  const totals = useMemo(() => {
    const available = filtered.filter((u) => u.status === "DISPONIBLE");
    const value = available.reduce((a, u) => a + (u.priceOverride ?? u.listPrice), 0);
    return { count: filtered.length, available: available.length, value, avg: available.length ? value / available.length : 0 };
  }, [filtered]);

  const views = useMemo(() => Array.from(new Set(units.map((u) => u.viewTag).filter(Boolean))) as string[], [units]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    importExcel.mutate({ projectId: project.id, base64 });
    e.target.value = "";
  }

  const hasFilters = search || tower || typology || status || view || floorMin || floorMax || priceMax;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Estado en vivo de las unidades. Reemplaza la hoja de Excel.</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportFile} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={importExcel.isPending}>
                <Upload /> Importar Excel
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => exportExcel.mutate({ projectId: project.id })} loading={exportExcel.isPending}>
            <Download /> Exportar Excel
          </Button>
          {compareIds.length > 0 && (
            <Link href={`/proyectos/${project.slug}/comparar?ids=${compareIds.join(",")}`} className={buttonVariants({ variant: "accent", size: "sm" })}>
              <Columns3 /> Comparar ({compareIds.length})
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unidades filtradas" value={totals.count} hint={`de ${units.length} en total`} />
        <Stat label="Disponibles" value={totals.available} />
        <Stat label="Valor disponible" value={formatCOP(totals.value)} />
        <Stat label="Precio promedio" value={formatCOP(totals.avg)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Buscar código o tipología" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 pl-8" />
        </div>
        {project.towers.length > 1 && (
          <Select value={tower} onChange={(e) => setTower(e.target.value)} className="w-32">
            <option value="">Todas las torres</option>
            {project.towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={typology} onChange={(e) => setTypology(e.target.value)} className="w-40">
          <option value="">Todas las tipologías</option>
          {project.typologies.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">Todos los estados</option>
          {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
            <option key={s} value={s}>
              {UNIT_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        {views.length > 0 && (
          <Select value={view} onChange={(e) => setView(e.target.value)} className="w-36">
            <option value="">Todas las vistas</option>
            {views.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-1">
          <Input type="number" placeholder="Piso ≥" value={floorMin} onChange={(e) => setFloorMin(e.target.value)} className="w-20" />
          <Input type="number" placeholder="Piso ≤" value={floorMax} onChange={(e) => setFloorMax(e.target.value)} className="w-20" />
        </div>
        <Input type="number" placeholder="Precio máx (M)" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-32" />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setTower("");
              setTypology("");
              setStatus("");
              setView("");
              setFloorMin("");
              setFloorMax("");
              setPriceMax("");
            }}
          >
            <X /> Limpiar
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th onClick={() => toggleSort("code")} active={sort.key === "code"}>
                  Unidad
                </Th>
                <Th onClick={() => toggleSort("floor")} active={sort.key === "floor"}>
                  Piso
                </Th>
                <Th onClick={() => toggleSort("typology")} active={sort.key === "typology"}>
                  Tipología
                </Th>
                <Th onClick={() => toggleSort("privateArea")} active={sort.key === "privateArea"}>
                  Áreas
                </Th>
                <th className="px-3 py-2">Orientación / Vista</th>
                <Th onClick={() => toggleSort("listPrice")} active={sort.key === "listPrice"} className="text-right">
                  Precio
                </Th>
                <Th onClick={() => toggleSort("status")} active={sort.key === "status"}>
                  Estado
                </Th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Cargando inventario…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Ninguna unidad coincide con los filtros.
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const price = u.priceOverride ?? u.listPrice;
                return (
                  <tr key={u.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/proyectos/${project.slug}/unidades/${u.id}`} className="hover:text-accent">
                        {u.code}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">{u.tower.name}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {u.floor} <span className="text-muted-foreground">· {String(u.position).padStart(2, "0")}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: u.typology.color }} />
                        {u.typology.name}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {u.typology.bedrooms} alc · {u.typology.bathrooms} baños
                      </p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatArea(u.typology.privateArea)}
                      <p className="text-[11px] text-muted-foreground">{formatArea(u.typology.builtArea)} constr.</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {u.orientation ?? "—"} {u.viewTag ? `· ${u.viewTag}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCOP(price)}
                      {u.priceOverride && <p className="text-[11px] text-amber-400">especial</p>}
                    </td>
                    <td className="px-3 py-2">
                      {isManager ? (
                        <select
                          value={u.status}
                          onChange={(e) => updateStatus.mutate({ id: u.id, status: e.target.value as UnitStatus })}
                          className="rounded-md border bg-background px-2 py-1 text-xs"
                        >
                          {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {UNIT_STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={u.status} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/proyectos/${project.slug}/cotizador?unit=${u.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8", u.status !== "DISPONIBLE" && "pointer-events-none opacity-30")}
                          title="Cotizar"
                        >
                          <Calculator />
                        </Link>
                        <button
                          onClick={() => toggleCompare(u.id)}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8", compareIds.includes(u.id) && "bg-accent/20 text-accent")}
                          title="Comparar"
                        >
                          <Columns3 />
                        </button>
                        <Link href={`/proyectos/${project.slug}/unidades/${u.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8")} title="Ficha">
                          <FileText />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active, className }: { children: React.ReactNode; onClick: () => void; active: boolean; className?: string }) {
  return (
    <th className={cn("px-3 py-2", className)}>
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {children} <ArrowUpDown className="size-3" />
      </button>
    </th>
  );
}

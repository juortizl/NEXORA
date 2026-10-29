"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Box, Lock, Unlock, Handshake, FileSignature, Ban, History, UserPlus, Scale } from "lucide-react";
import { trpc } from "@/trpc/react";
import { useProject } from "@/components/project/project-context";
import { useRealtime } from "@/hooks/use-realtime";
import { useRole } from "@/hooks/use-session-role";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusBadge, StageBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { BuyerQuickCreate } from "@/components/crm/buyer-quick-create";
import { useViewerStore } from "@/stores/viewer-store";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { cn, formatArea, formatCOP, formatDate } from "@/lib/utils";

export function UnitDetail({ unitId }: { unitId: string }) {
  const project = useProject();
  const { isManager } = useRole();
  const utils = trpc.useUtils();
  useRealtime({ projectId: project.id });

  const { data: unit, isLoading } = trpc.unit.byId.useQuery({ id: unitId });
  const { data: history = [] } = trpc.unit.history.useQuery({ id: unitId });
  const toggleCompare = useViewerStore((s) => s.toggleCompare);
  const compareIds = useViewerStore((s) => s.compareIds);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [newBuyerOpen, setNewBuyerOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const invalidate = () => {
    void utils.unit.invalidate();
    void utils.crm.invalidate();
    void utils.dashboard.invalidate();
  };

  const convert = trpc.reservation.convertToSale.useMutation({
    onSuccess: () => {
      toast.success("Venta registrada", "La unidad pasó a VENDIDO (promesa).");
      invalidate();
    },
    onError: (e) => toast.error("No se pudo convertir", e.message),
  });
  const markDeeded = trpc.reservation.markDeeded.useMutation({
    onSuccess: () => {
      toast.success("Escrituración registrada");
      invalidate();
    },
    onError: (e) => toast.error("Error", e.message),
  });

  if (isLoading || !unit) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const price = unit.priceOverride ?? unit.listPrice;
  const reservation = unit.reservations[0];
  const sale = unit.sale;
  const buyer = sale?.buyer ?? reservation?.buyer;
  const inCompare = compareIds.includes(unit.id);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/proyectos/${project.slug}/inventario`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Inventario
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{unit.code}</h1>
            <StatusBadge status={unit.status} />
            <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${unit.typology.color}22`, color: unit.typology.color }}>
              Tipo {unit.typology.name}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {unit.tower.name} · Piso {unit.floor} · Posición {String(unit.position).padStart(2, "0")} · {unit.orientation ?? "—"} · Vista {unit.viewTag ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/proyectos/${project.slug}?unit=${unit.id}`} className={buttonVariants({ variant: "outline" })}>
            <Box /> Ver en 3D
          </Link>
          <Button variant="outline" onClick={() => toggleCompare(unit.id)}>
            <Scale /> {inCompare ? "Quitar de comparar" : "Comparar"}
          </Button>
          <Link href={`/proyectos/${project.slug}/cotizador?unit=${unit.id}`} className={buttonVariants({ variant: "accent" })}>
            <Calculator /> Cotizar
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ficha técnica</CardTitle>
            <CardDescription>{unit.typology.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Spec label="Precio de lista" value={formatCOP(unit.listPrice)} strong />
            <Spec label="Precio vigente" value={formatCOP(price)} strong hint={unit.priceOverride ? "Precio especial aplicado" : undefined} />
            <Spec label="Precio / m² privado" value={formatCOP(Math.round(price / unit.typology.privateArea))} />
            <Spec label="Área construida" value={formatArea(unit.typology.builtArea)} />
            <Spec label="Área privada" value={formatArea(unit.typology.privateArea)} />
            <Spec label="Alcobas / baños" value={`${unit.typology.bedrooms} / ${unit.typology.bathrooms}`} />
            <Spec label="Torre" value={`${unit.tower.name} (${unit.tower.code})`} />
            <Spec label="Piso" value={String(unit.floor)} />
            <Spec label="Nodo 3D" value={unit.modelNodeName ?? "—"} mono />
          </CardContent>
          {unit.notes && (
            <CardContent>
              <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{unit.notes}</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado comercial</CardTitle>
            <CardDescription>Acciones según el estado actual de la unidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {buyer && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{sale ? "Comprador" : "Separado por"}</p>
                <Link href={`/proyectos/${project.slug}/crm/${buyer.id}`} className="font-medium hover:text-accent">
                  {buyer.firstName} {buyer.lastName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {buyer.documentType} {buyer.documentNumber ?? ""} · {buyer.phone ?? ""}
                </p>
                {reservation && !sale && (
                  <p className="mt-2 text-xs">
                    Separación {formatCOP(reservation.amount)} · vence {formatDate(reservation.expiresAt)} · asesor {reservation.advisor.name}
                  </p>
                )}
                {sale && (
                  <p className="mt-2 text-xs">
                    Venta {formatCOP(sale.price)} · {sale.status === "ESCRITURADO" ? "Escriturado" : "Promesa firmada"} · {formatDate(sale.createdAt)}
                  </p>
                )}
              </div>
            )}

            {unit.status === "DISPONIBLE" && (
              <Button className="w-full" variant="accent" onClick={() => setReserveOpen(true)}>
                <Handshake /> Separar apartamento
              </Button>
            )}
            {unit.status === "SEPARADO" && reservation && isManager && (
              <>
                <Button className="w-full" variant="accent" loading={convert.isPending} onClick={() => convert.mutate({ reservationId: reservation.id })}>
                  <FileSignature /> Convertir en venta (promesa)
                </Button>
                <Button className="w-full" variant="outline" onClick={() => setCancelOpen(true)}>
                  <Ban /> Cancelar separación
                </Button>
              </>
            )}
            {unit.status === "SEPARADO" && !isManager && (
              <p className="text-xs text-muted-foreground">Sólo gerencia puede convertir o cancelar la separación.</p>
            )}
            {unit.status === "VENDIDO" && sale && sale.status !== "ESCRITURADO" && isManager && (
              <Button className="w-full" variant="outline" loading={markDeeded.isPending} onClick={() => markDeeded.mutate({ saleId: sale.id })}>
                <FileSignature /> Marcar como escriturado
              </Button>
            )}
            {isManager && (
              <Button className="w-full" variant="ghost" onClick={() => setStatusOpen(true)}>
                {unit.status === "BLOQUEADO" ? <Unlock /> : <Lock />} Cambiar estado manualmente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Interesados</CardTitle>
            <CardDescription>Leads asociados a este apartamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unit.leads.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay interesados.</p>}
            {unit.leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <div>
                  <Link href={`/proyectos/${project.slug}/crm/${l.buyer.id}`} className="font-medium hover:text-accent">
                    {l.buyer.firstName} {l.buyer.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {l.advisor.name} · {formatDate(l.updatedAt)}
                  </p>
                </div>
                <StageBadge stage={l.stage} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setNewBuyerOpen(true)}>
              <UserPlus /> Registrar interesado
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones</CardTitle>
            <CardDescription>Últimas versiones generadas para esta unidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unit.quotes.length === 0 && <p className="text-sm text-muted-foreground">Sin cotizaciones.</p>}
            {unit.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    v{q.version} · {formatCOP(q.finalPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {q.buyer ? `${q.buyer.firstName} ${q.buyer.lastName}` : "Sin comprador"} · {q.advisor.name} · {formatDate(q.createdAt)}
                  </p>
                </div>
                <a href={`/api/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  PDF
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" /> Historial
          </CardTitle>
          <CardDescription>Trazabilidad de cambios de estado, separaciones y ventas.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
          ) : (
            <ol className="relative ml-2 border-l pl-5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="mb-4">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-accent" />
                  <p className="font-medium">
                    {describeAudit(h.entity, h.action, h.diff)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.user?.name ?? "Sistema"} · {formatDate(h.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <ReserveDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        unitId={unit.id}
        projectId={project.id}
        defaultAmount={project.separationAmount}
        onDone={invalidate}
        onNewBuyer={() => {
          setReserveOpen(false);
          setNewBuyerOpen(true);
        }}
      />
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} reservationId={reservation?.id} onDone={invalidate} />
      <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} unitId={unit.id} current={unit.status as UnitStatus} onDone={invalidate} />
      <BuyerQuickCreate open={newBuyerOpen} onOpenChange={setNewBuyerOpen} projectId={project.id} unitId={unit.id} onCreated={invalidate} />
    </div>
  );
}

function Spec({ label, value, hint, strong, mono }: { label: string; value: string; hint?: string; strong?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular-nums", strong && "text-base font-semibold", mono && "font-mono text-xs")}>{value}</p>
      {hint && <p className="text-[11px] text-accent">{hint}</p>}
    </div>
  );
}

function describeAudit(entity: string, action: string, diff: string | null) {
  let parsed: Record<string, unknown> | null = null;
  if (diff) {
    try {
      parsed = JSON.parse(diff);
    } catch {
      parsed = null;
    }
  }
  if (entity === "Reservation" && action === "CREATE") return `Separación registrada${parsed?.amount ? ` por ${formatCOP(Number(parsed.amount))}` : ""}`;
  if (entity === "Reservation" && action === "CANCEL") return `Separación cancelada${diff && !parsed ? `: ${diff}` : ""}`;
  if (entity === "Sale" && action === "CREATE") return "Venta registrada (promesa de compraventa)";
  if (entity === "Unit" && action === "STATUS") {
    const s = parsed?.status as UnitStatus | undefined;
    return `Estado cambiado a ${s ? UNIT_STATUS_META[s]?.label ?? s : "—"}`;
  }
  return `${entity} · ${action}`;
}

function ReserveDialog({
  open,
  onOpenChange,
  unitId,
  projectId,
  defaultAmount,
  onDone,
  onNewBuyer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unitId: string;
  projectId: string;
  defaultAmount: number;
  onDone: () => void;
  onNewBuyer: () => void;
}) {
  const [buyerId, setBuyerId] = useState("");
  const [amount, setAmount] = useState(defaultAmount);
  const [days, setDays] = useState(8);
  const { data: buyers = [] } = trpc.crm.buyers.useQuery({ projectId }, { enabled: open });
  const reserve = trpc.reservation.reserve.useMutation({
    onSuccess: () => {
      toast.success("Apartamento separado", "El inventario se actualizó para todos los asesores.");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error("No se pudo separar", e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Separar apartamento" description="La unidad quedará bloqueada para otros asesores de inmediato.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!buyerId) return toast.error("Selecciona un comprador");
          reserve.mutate({ unitId, buyerId, amount, expiresInDays: days });
        }}
      >
        <Field label="Comprador">
          <div className="flex gap-2">
            <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.firstName} {b.lastName} · {b.documentNumber ?? "s/d"}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" onClick={onNewBuyer} title="Nuevo comprador">
              <UserPlus />
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor de separación (COP)">
            <Input type="number" value={amount} min={0} step={100000} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Vigencia (días)" hint="Plazo para firmar promesa o completar documentos.">
            <Input type="number" value={days} min={1} max={60} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" loading={reserve.isPending}>
            <Handshake /> Confirmar separación
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CancelDialog({ open, onOpenChange, reservationId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; reservationId?: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const cancel = trpc.reservation.cancel.useMutation({
    onSuccess: () => {
      toast.success("Separación cancelada", "La unidad vuelve a estar disponible.");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error("Error", e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Cancelar separación" description="El apartamento volverá a DISPONIBLE y el lead pasará a Perdido.">
      <div className="space-y-3">
        <Field label="Motivo">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Desistimiento, crédito negado, cambio de unidad…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="destructive" loading={cancel.isPending} onClick={() => reservationId && cancel.mutate({ reservationId, reason: reason || undefined })}>
            <Ban /> Cancelar separación
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function StatusDialog({ open, onOpenChange, unitId, current, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; unitId: string; current: UnitStatus; onDone: () => void }) {
  const [status, setStatus] = useState<UnitStatus>(current);
  const [notes, setNotes] = useState("");
  const update = trpc.unit.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error("Error", e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Cambiar estado" description="Uso administrativo: bloquear unidades (modelo, reserva de la constructora) o corregir el estado.">
      <div className="space-y-3">
        <Field label="Nuevo estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value as UnitStatus)}>
            {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => (
              <option key={s} value={s}>
                {UNIT_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Apartamento modelo, reserva gerencia, etc." />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="accent" loading={update.isPending} onClick={() => update.mutate({ id: unitId, status, notes: notes || undefined })}>
            Guardar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

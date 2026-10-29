import * as React from "react";
import { cn } from "@/lib/utils";
import { UNIT_STATUS_META, LEAD_STAGE_META, type UnitStatus, type LeadStage } from "@/lib/domain";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", className)}
      {...props}
    />
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = UNIT_STATUS_META[status as UnitStatus] ?? { label: status, color: "bg-slate-500" };
  return (
    <Badge className={cn("gap-1.5 border-transparent bg-muted", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.color)} />
      {meta.label}
    </Badge>
  );
}

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-slate-500/20 text-slate-300",
  VISITA: "bg-sky-500/20 text-sky-300",
  COTIZADO: "bg-indigo-500/20 text-indigo-300",
  SEPARADO: "bg-amber-500/20 text-amber-300",
  PROMESA: "bg-emerald-500/20 text-emerald-300",
  ESCRITURADO: "bg-emerald-600/30 text-emerald-200",
  PERDIDO: "bg-rose-500/20 text-rose-300",
};

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const meta = LEAD_STAGE_META[stage as LeadStage];
  return <Badge className={cn("border-transparent", STAGE_COLORS[stage] ?? "bg-muted", className)}>{meta?.label ?? stage}</Badge>;
}

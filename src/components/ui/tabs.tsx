"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  items: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onValueChange(item.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            value === item.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="rounded-full bg-background px-1.5 text-[10px] text-muted-foreground">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

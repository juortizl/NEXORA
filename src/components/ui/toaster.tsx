"use client";

import * as React from "react";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; description?: string; kind: "success" | "error" | "info" };

const useToastStore = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, kind: "success" }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, kind: "error" }),
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, kind: "info" }),
};

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 shadow-lg animate-fade-up",
              t.kind === "success" && "border-emerald-500/40",
              t.kind === "error" && "border-rose-500/40"
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", t.kind === "success" && "text-emerald-400", t.kind === "error" && "text-rose-400", t.kind === "info" && "text-sky-400")} />
            <div className="flex-1 text-sm">
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

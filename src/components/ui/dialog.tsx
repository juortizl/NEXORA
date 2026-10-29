"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className={cn("relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl animate-fade-up", className)}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className={cn(title && "mt-4")}>{children}</div>
      </div>
    </div>
  );
}

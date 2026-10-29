"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Table2,
  Calculator,
  Columns3,
  Users,
  BarChart3,
  Presentation,
  Settings2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "", label: "Visor 3D", icon: Box },
  { href: "/inventario", label: "Inventario", icon: Table2 },
  { href: "/cotizador", label: "Cotizador", icon: Calculator },
  { href: "/comparar", label: "Comparador", icon: Columns3 },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/presentacion", label: "Presentación", icon: Presentation },
  { href: "/configuracion", label: "Configuración", icon: Settings2 },
];

export function ProjectNav({
  project,
}: {
  project: { slug: string; name: string; stage: string; publicToken: string; accentColor: string };
}) {
  const pathname = usePathname();
  const base = `/proyectos/${project.slug}`;
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="border-b p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Proyecto</p>
        <h2 className="mt-1 truncate text-lg font-semibold">{project.name}</h2>
        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${project.accentColor}33`, color: project.accentColor }}>
          {project.stage}
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <a
          href={`/presentacion/${project.publicToken}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Modo sala de ventas <ExternalLink className="size-4" />
        </a>
      </div>
    </aside>
  );
}

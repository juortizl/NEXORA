import Link from "next/link";
import { Plus, Layers3, MapPin } from "lucide-react";
import { api } from "@/trpc/server";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/tabs";

export const metadata = { title: "Proyectos" };

export default async function ProjectsPage() {
  const [caller, session] = await Promise.all([api(), auth()]);
  const projects = await caller.project.list();

  return (
    <main className="flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">Selecciona un proyecto para abrir el visor, inventario, cotizador y CRM.</p>
        </div>
        {session?.user.role === "ADMIN" && (
          <Link href="/admin/proyectos/nuevo" className={buttonVariants({ variant: "accent" })}>
            <Plus className="size-4" /> Nuevo proyecto
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState title="Aún no hay proyectos" description="Crea el primer proyecto desde el asistente de administración." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const total = p._count.units;
            const sold = p.statusCounts.VENDIDO ?? 0;
            const reserved = p.statusCounts.SEPARADO ?? 0;
            const pct = total ? Math.round(((sold + reserved) / total) * 100) : 0;
            return (
              <Link key={p.id} href={`/proyectos/${p.slug}`} className="group">
                <Card className="overflow-hidden transition-colors hover:border-accent/60">
                  <div
                    className="h-28 w-full"
                    style={{
                      background: `linear-gradient(135deg, ${p.primaryColor}, ${p.secondaryColor} 60%, ${p.accentColor})`,
                    }}
                  />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold group-hover:text-accent">{p.name}</h2>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {p.city ?? "Sin ciudad"}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{p.stage}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Layers3 className="size-3" /> {p.towers.length} torres · {p.typologies.length} tipologías
                      </span>
                      <span>{total} unidades</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                        {(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => {
                          const n = p.statusCounts[s] ?? 0;
                          if (!n) return null;
                          return <div key={s} className={UNIT_STATUS_META[s].color} style={{ width: `${(n / total) * 100}%` }} title={`${UNIT_STATUS_META[s].label}: ${n}`} />;
                        })}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                        <span>Absorción {pct} %</span>
                        <span>Precios vigentes hasta {formatDate(p.priceValidUntil)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LogOut, Settings } from "lucide-react";
import { auth, signOut } from "@/auth";
import { ROLE_LABEL, type Role } from "@/lib/domain";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
          <Link href="/proyectos" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Building2 className="size-4" />
            </span>
            <span>Plataforma Inmobiliaria</span>
          </Link>
          <div className="flex items-center gap-3">
            {user.role === "ADMIN" && (
              <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                <Settings className="size-4" /> Administración
              </Link>
            )}
            <div className="flex items-center gap-2 border-l pl-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials(user.name ?? "U")}
              </span>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role as Role] ?? user.role}</p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Cerrar sesión">
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">{children}</div>
    </div>
  );
}

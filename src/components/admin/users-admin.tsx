"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, KeyRound, UserCheck, UserX, Building2 } from "lucide-react";
import { trpc } from "@/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ROLE_LABEL, Role } from "@/lib/domain";
import { cn, formatDate, initials } from "@/lib/utils";

export function UsersAdmin() {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.admin.users.useQuery();
  const { data: projects = [] } = trpc.project.list.useQuery();
  const [open, setOpen] = useState(false);
  const [pwdFor, setPwdFor] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ASESOR" as Role });
  const [pwd, setPwd] = useState("");

  const create = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuario creado");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "ASESOR" });
      void utils.admin.users.invalidate();
    },
    onError: (e) => toast.error("No se pudo crear", e.message),
  });
  const update = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("Usuario actualizado");
      setPwdFor(null);
      setPwd("");
      void utils.admin.users.invalidate();
    },
    onError: (e) => toast.error("Error", e.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Administración</h1>
          <p className="text-sm text-muted-foreground">Usuarios, roles y proyectos de la constructora.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/proyectos/nuevo" className={buttonVariants({ variant: "outline" })}>
            <Building2 /> Nuevo proyecto
          </Link>
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus /> Nuevo usuario
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios</CardTitle>
            <CardDescription>Administradores, gerencia comercial y asesores.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Creado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={cn("border-t", !u.active && "opacity-60")}>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">{initials(u.name)}</span>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <Select value={u.role} onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })} className="h-8 w-44 text-xs">
                        {Role.options.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 text-xs">{u.active ? "Activo" : "Inactivo"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setPwdFor({ id: u.id, name: u.name })} title="Cambiar contraseña">
                        <KeyRound />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: u.id, active: !u.active })} title={u.active ? "Desactivar" : "Activar"}>
                        {u.active ? <UserX /> : <UserCheck />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proyectos</CardTitle>
            <CardDescription>{projects.length} proyectos en la plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/proyectos/${p.slug}`} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.city ?? "—"} · {p._count.units} unidades · {p.stage}
                  </p>
                </div>
                <span className="size-3 rounded-full" style={{ background: p.accentColor }} />
              </Link>
            ))}
            <Link href="/admin/proyectos/nuevo" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
              <Plus /> Crear proyecto con el asistente
            </Link>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen} title="Nuevo usuario">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
        >
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Contraseña temporal" hint="Mínimo 8 caracteres.">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {Role.options.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={create.isPending}>
              Crear usuario
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!pwdFor} onOpenChange={(o) => !o && setPwdFor(null)} title={`Nueva contraseña para ${pwdFor?.name ?? ""}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwdFor) update.mutate({ id: pwdFor.id, password: pwd });
          }}
        >
          <Field label="Contraseña">
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={8} autoFocus />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPwdFor(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={update.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/proyectos");
  return (
    <main className="kiosk-gradient flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Plataforma comercial</p>
          <h1 className="mt-2 text-3xl font-semibold">Visualizador y ventas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Inventario, cotizador, CRM y presentaciones interactivas en un solo lugar.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

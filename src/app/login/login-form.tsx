"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Correo o contraseña incorrectos");
      return;
    }
    router.push(params.get("callbackUrl") ?? "/proyectos");
    router.refresh();
  }

  return (
    <Card className="glass">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Correo">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@constructora.co" required autoFocus />
          </Field>
          <Field label="Contraseña">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Entrar
          </Button>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo: admin@estructurar.co / Admin123*
        </p>
      </CardContent>
    </Card>
  );
}

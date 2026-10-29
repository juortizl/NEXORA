"use client";

import { useState } from "react";
import { trpc } from "@/trpc/react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

const SOURCES = [
  ["SALA_VENTAS", "Sala de ventas"],
  ["WEB", "Página web"],
  ["REFERIDO", "Referido"],
  ["REDES", "Redes sociales"],
  ["FERIA", "Feria"],
];

export function BuyerQuickCreate({
  open,
  onOpenChange,
  projectId,
  unitId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  unitId?: string;
  onCreated?: (buyer: { id: string }) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    phone: "",
    email: "",
    occupation: "",
    monthlyIncome: "",
    source: "SALA_VENTAS",
    consentAccepted: false,
  });
  const create = trpc.crm.createBuyer.useMutation({
    onSuccess: (b) => {
      toast.success("Comprador creado");
      onCreated?.(b);
      onOpenChange(false);
      setForm({ firstName: "", lastName: "", documentType: "CC", documentNumber: "", phone: "", email: "", occupation: "", monthlyIncome: "", source: "SALA_VENTAS", consentAccepted: false });
    },
    onError: (e) => toast.error("No se pudo crear", e.message),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Nuevo comprador" description="Datos básicos del interesado. Podrás completar la ficha en el CRM.">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            projectId,
            unitId,
            firstName: form.firstName,
            lastName: form.lastName,
            documentType: form.documentType,
            documentNumber: form.documentNumber || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            occupation: form.occupation || undefined,
            monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
            source: form.source,
            consentAccepted: form.consentAccepted,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombres">
            <Input value={form.firstName} onChange={set("firstName")} required autoFocus />
          </Field>
          <Field label="Apellidos">
            <Input value={form.lastName} onChange={set("lastName")} required />
          </Field>
          <Field label="Tipo documento">
            <Select value={form.documentType} onChange={set("documentType")}>
              <option value="CC">Cédula</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="PAS">Pasaporte</option>
              <option value="NIT">NIT</option>
            </Select>
          </Field>
          <Field label="Número">
            <Input value={form.documentNumber} onChange={set("documentNumber")} />
          </Field>
          <Field label="Celular">
            <Input value={form.phone} onChange={set("phone")} placeholder="3001234567" />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Ocupación">
            <Input value={form.occupation} onChange={set("occupation")} />
          </Field>
          <Field label="Ingreso mensual (COP)">
            <Input type="number" value={form.monthlyIncome} onChange={set("monthlyIncome")} step={100000} />
          </Field>
          <Field label="Fuente del lead" className="col-span-2">
            <Select value={form.source} onChange={set("source")}>
              {SOURCES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.consentAccepted} onChange={set("consentAccepted")} className="mt-0.5" />
          El cliente autoriza el tratamiento de sus datos personales conforme a la Ley 1581 de 2012 y la política de la constructora.
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" loading={create.isPending}>
            Crear comprador
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

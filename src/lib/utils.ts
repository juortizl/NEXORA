import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return copFormatter.format(Math.round(value));
}

/** Formato compacto en millones de pesos: $ 252 M, $ 51.786 M */
export function formatCOPCompact(value: number): string {
  if (value >= 1_000_000) return `$ ${Math.round(value / 1_000_000).toLocaleString("es-CO")} M`;
  return copFormatter.format(value);
}

export function formatArea(m2: number): string {
  return `${m2.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function formatPct(v: number, digits = 1): string {
  return `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: digits })} %`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "2-digit" });
}

/** Código de unidad T1-1204 => torre T1, piso 12, posición 04 */
export function unitCode(towerCode: string, floor: number, position: number): string {
  return `${towerCode}-${String(floor).padStart(2, "0")}${String(position).padStart(2, "0")}`;
}

/** Nombre de nodo 3D esperado: T1_P12_U04 */
export function unitNodeName(towerCode: string, floor: number, position: number): string {
  return `${towerCode}_P${String(floor).padStart(2, "0")}_U${String(position).padStart(2, "0")}`;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

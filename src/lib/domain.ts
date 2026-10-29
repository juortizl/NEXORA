import { z } from "zod";

// Valores "enum" almacenados como string en la base de datos.

export const Role = z.enum(["ADMIN", "GERENTE_COMERCIAL", "ASESOR"]);
export type Role = z.infer<typeof Role>;

export const UnitStatus = z.enum(["DISPONIBLE", "SEPARADO", "VENDIDO", "BLOQUEADO"]);
export type UnitStatus = z.infer<typeof UnitStatus>;

export const LeadStage = z.enum([
  "LEAD",
  "VISITA",
  "COTIZADO",
  "SEPARADO",
  "PROMESA",
  "ESCRITURADO",
  "PERDIDO",
]);
export type LeadStage = z.infer<typeof LeadStage>;

export const ReservationStatus = z.enum(["ACTIVA", "CANCELADA", "CONVERTIDA"]);
export const SaleStatus = z.enum(["PROMESA", "ESCRITURADO"]);
export const ProjectStage = z.enum(["PREVENTA", "LANZAMIENTO", "CONSTRUCCION", "ENTREGA"]);
export const PriceRuleKind = z.enum([
  "FLOOR_INCREMENT",
  "VIEW_PREMIUM",
  "POSITION_PREMIUM",
  "TYPOLOGY_ADJUST",
]);
export type PriceRuleKind = z.infer<typeof PriceRuleKind>;

export const Orientation = z.enum(["NORTE", "SUR", "ORIENTE", "OCCIDENTE"]);
export const PoiCategory = z.enum([
  "TRANSPORTE",
  "COMERCIO",
  "SALUD",
  "EDUCACION",
  "DEPORTE",
  "RECREACION",
  "OTRO",
]);
export const PoiGroup = z.enum(["SECTOR", "CIUDAD", "FUTURO"]);
export const MediaKind = z.enum(["RENDER", "PLANTA", "FOTO", "LOGO", "MODELO", "PDF", "VIDEO"]);

export const UNIT_STATUS_META: Record<
  UnitStatus,
  { label: string; color: string; hex: string }
> = {
  DISPONIBLE: { label: "Disponible", color: "bg-emerald-500", hex: "#10b981" },
  SEPARADO: { label: "Separado", color: "bg-amber-500", hex: "#f59e0b" },
  VENDIDO: { label: "Vendido", color: "bg-rose-500", hex: "#f43f5e" },
  BLOQUEADO: { label: "Bloqueado", color: "bg-slate-500", hex: "#64748b" },
};

export const LEAD_STAGE_META: Record<LeadStage, { label: string; order: number }> = {
  LEAD: { label: "Lead", order: 0 },
  VISITA: { label: "Visita", order: 1 },
  COTIZADO: { label: "Cotizado", order: 2 },
  SEPARADO: { label: "Separado", order: 3 },
  PROMESA: { label: "Promesa", order: 4 },
  ESCRITURADO: { label: "Escriturado", order: 5 },
  PERDIDO: { label: "Perdido", order: 6 },
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  GERENTE_COMERCIAL: "Gerente comercial",
  ASESOR: "Asesor comercial",
};

/** Bloques disponibles para el modo presentación. */
export const PresentationBlockType = z.enum([
  "PORTADA",
  "UBICACION",
  "AMENIDADES",
  "TIPOLOGIAS",
  "VISOR_3D",
  "INVENTARIO",
  "COMPARADOR",
  "COTIZADOR",
  "GALERIA",
  "CONSTRUCTORA",
  "CIERRE",
]);
export type PresentationBlockType = z.infer<typeof PresentationBlockType>;

export const PresentationBlock = z.object({
  id: z.string(),
  type: PresentationBlockType,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  mediaUrl: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type PresentationBlock = z.infer<typeof PresentationBlock>;

export const TypologyVariant = z.object({
  name: z.string(),
  description: z.string().optional(),
  deltaPrice: z.number().default(0),
});
export type TypologyVariant = z.infer<typeof TypologyVariant>;

export const PriceRuleCriteria = z.object({
  fromFloor: z.number().optional(),
  toFloor: z.number().optional(),
  viewTag: z.string().optional(),
  positions: z.array(z.number()).optional(),
  typologyCode: z.string().optional(),
  towerCode: z.string().optional(),
});
export type PriceRuleCriteria = z.infer<typeof PriceRuleCriteria>;

export function parseJson<T>(raw: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

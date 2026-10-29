import { PriceRuleCriteria, parseJson, type PriceRuleKind } from "./domain";

export type PriceRuleInput = {
  kind: string;
  label: string;
  value: number;
  isPercent: boolean;
  criteria: string | PriceRuleCriteria;
  active?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
  order?: number;
};

export type UnitPricingContext = {
  basePrice: number;
  floor: number;
  position: number;
  viewTag?: string | null;
  typologyCode: string;
  towerCode: string;
  firstResidentialFloor?: number;
};

export type AppliedRule = {
  kind: PriceRuleKind | string;
  label: string;
  amount: number;
};

export type PriceBreakdown = {
  basePrice: number;
  applied: AppliedRule[];
  listPrice: number;
};

function matches(criteria: PriceRuleCriteria, ctx: UnitPricingContext): boolean {
  if (criteria.fromFloor !== undefined && ctx.floor < criteria.fromFloor) return false;
  if (criteria.toFloor !== undefined && ctx.floor > criteria.toFloor) return false;
  if (criteria.viewTag && criteria.viewTag !== ctx.viewTag) return false;
  if (criteria.positions && !criteria.positions.includes(ctx.position)) return false;
  if (criteria.typologyCode && criteria.typologyCode !== ctx.typologyCode) return false;
  if (criteria.towerCode && criteria.towerCode !== ctx.towerCode) return false;
  return true;
}

function isValidNow(rule: PriceRuleInput, now: Date): boolean {
  if (rule.active === false) return false;
  if (rule.validFrom && now < rule.validFrom) return false;
  if (rule.validTo && now > rule.validTo) return false;
  return true;
}

/**
 * Calcula el precio de lista de una unidad a partir del precio base de la
 * tipología y las reglas de precio del proyecto.
 *
 * - FLOOR_INCREMENT: se aplica `value` por cada piso por encima de `fromFloor`
 *   (porcentual compuesto o monto fijo por piso).
 * - VIEW_PREMIUM / POSITION_PREMIUM / TYPOLOGY_ADJUST: se aplican una vez
 *   sobre el precio base si el criterio coincide.
 */
export function computeUnitPrice(
  ctx: UnitPricingContext,
  rules: PriceRuleInput[],
  now: Date = new Date()
): PriceBreakdown {
  const applied: AppliedRule[] = [];
  let price = ctx.basePrice;

  const ordered = [...rules]
    .filter((r) => isValidNow(r, now))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of ordered) {
    const criteria =
      typeof rule.criteria === "string"
        ? parseJson(rule.criteria, PriceRuleCriteria, {})
        : rule.criteria;
    if (!matches(criteria, ctx)) continue;

    let amount = 0;
    if (rule.kind === "FLOOR_INCREMENT") {
      const from = criteria.fromFloor ?? ctx.firstResidentialFloor ?? 1;
      const steps = Math.max(0, ctx.floor - from);
      if (steps === 0) continue;
      amount = rule.isPercent
        ? ctx.basePrice * (Math.pow(1 + rule.value, steps) - 1)
        : rule.value * steps;
    } else {
      amount = rule.isPercent ? ctx.basePrice * rule.value : rule.value;
    }
    amount = Math.round(amount);
    applied.push({ kind: rule.kind, label: rule.label, amount });
    price += amount;
  }

  // Redondeo comercial a múltiplos de 10.000 COP
  const listPrice = Math.round(price / 10_000) * 10_000;
  return { basePrice: ctx.basePrice, applied, listPrice };
}

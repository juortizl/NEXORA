import { describe, expect, it } from "vitest";
import { computeUnitPrice, type PriceRuleInput } from "./pricing";

const rules: PriceRuleInput[] = [
  { kind: "FLOOR_INCREMENT", label: "Altura", value: 0.0035, isPercent: true, criteria: { fromFloor: 2 }, order: 0 },
  { kind: "VIEW_PREMIUM", label: "Quitasol", value: 0.02, isPercent: true, criteria: { viewTag: "QUITASOL" }, order: 1 },
  { kind: "POSITION_PREMIUM", label: "Esquinero", value: 3_000_000, isPercent: false, criteria: { positions: [1, 8] }, order: 2 },
];

const base = { basePrice: 252_000_000, typologyCode: "C", towerCode: "T1", firstResidentialFloor: 1 };

describe("pricing", () => {
  it("piso 1 sin vista no recibe incrementos", () => {
    const r = computeUnitPrice({ ...base, floor: 1, position: 3, viewTag: "INTERIOR" }, rules);
    expect(r.applied).toHaveLength(0);
    expect(r.listPrice).toBe(252_000_000);
  });

  it("aplica incremento compuesto por piso desde fromFloor", () => {
    const r = computeUnitPrice({ ...base, floor: 12, position: 3, viewTag: "INTERIOR" }, rules);
    const expected = 252_000_000 * (Math.pow(1.0035, 10) - 1);
    expect(r.applied[0].amount).toBe(Math.round(expected));
    expect(r.listPrice % 10_000).toBe(0);
  });

  it("combina vista y posición", () => {
    const r = computeUnitPrice({ ...base, floor: 1, position: 1, viewTag: "QUITASOL" }, rules);
    expect(r.applied.map((a) => a.kind)).toEqual(["VIEW_PREMIUM", "POSITION_PREMIUM"]);
    expect(r.listPrice).toBe(Math.round((252_000_000 + 5_040_000 + 3_000_000) / 10_000) * 10_000);
  });

  it("ignora reglas inactivas o vencidas", () => {
    const expired: PriceRuleInput[] = [
      { ...rules[1], validTo: new Date("2020-01-01") },
      { ...rules[2], active: false },
    ];
    const r = computeUnitPrice({ ...base, floor: 1, position: 1, viewTag: "QUITASOL" }, expired);
    expect(r.applied).toHaveLength(0);
  });

  it("acepta criteria como JSON string", () => {
    const r = computeUnitPrice(
      { ...base, floor: 5, position: 2, viewTag: "INTERIOR", typologyCode: "A" },
      [{ kind: "TYPOLOGY_ADJUST", label: "Ajuste A", value: -0.05, isPercent: true, criteria: '{"typologyCode":"A"}' }]
    );
    expect(r.applied[0].amount).toBe(-12_600_000);
  });
});

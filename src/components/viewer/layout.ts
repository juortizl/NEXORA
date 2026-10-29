import { UNIT_STATUS_META, type UnitStatus } from "@/lib/domain";
import type { ColorMode } from "@/stores/viewer-store";

export type TowerGeom = {
  id: string;
  code: string;
  floors: number;
  firstResidentialFloor: number;
  floorHeight: number;
  footprintWidth: number;
  footprintDepth: number;
  positionX: number;
  positionZ: number;
  rotationY: number;
  unitsPerFloor: number;
  releaseStatus: string;
};

export type UnitGeom = {
  id: string;
  code: string;
  floor: number;
  position: number;
  status: string;
  listPrice: number;
  priceOverride: number | null;
  typology: { code: string; name: string; color: string };
  towerId: string;
};

export type Placement = { position: [number, number, number]; size: [number, number, number] };

/** Altura del zócalo/podio (planta de zonas comunes y parqueadero). */
export const PODIUM_HEIGHT = 4.5;
const CORRIDOR = 1.6;
const GAP = 0.08;

/**
 * Distribuye las posiciones de la planta típica en dos crujías (norte y sur)
 * alrededor de un corredor central. Posiciones 1..n/2 al norte, el resto al sur.
 */
export function placeUnit(tower: TowerGeom, floor: number, position: number): Placement {
  const n = tower.unitsPerFloor;
  const north = Math.ceil(n / 2);
  const isNorth = position <= north;
  const sideCount = isNorth ? north : n - north;
  const idx = isNorth ? position - 1 : position - north - 1;

  const w = tower.footprintWidth / sideCount;
  const d = tower.footprintDepth / 2 - CORRIDOR / 2;
  const h = tower.floorHeight;

  const x = -tower.footprintWidth / 2 + w * idx + w / 2;
  const z = isNorth ? -(CORRIDOR / 2 + d / 2) : CORRIDOR / 2 + d / 2;
  const y = PODIUM_HEIGHT + (floor - tower.firstResidentialFloor) * h + h / 2;

  return { position: [x, y, z], size: [w - GAP, h - GAP, d - GAP] };
}

export function towerHeight(tower: TowerGeom) {
  return PODIUM_HEIGHT + (tower.floors - tower.firstResidentialFloor + 1) * tower.floorHeight;
}

export function floorY(tower: TowerGeom, floor: number) {
  return PODIUM_HEIGHT + (floor - tower.firstResidentialFloor) * tower.floorHeight;
}

export function effectivePrice(u: { listPrice: number; priceOverride: number | null }) {
  return u.priceOverride ?? u.listPrice;
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function unitColor(unit: UnitGeom, mode: ColorMode, priceRange: [number, number]): string {
  if (mode === "typology") return unit.typology.color;
  if (mode === "price") {
    const [min, max] = priceRange;
    const t = max > min ? (effectivePrice(unit) - min) / (max - min) : 0.5;
    return lerpColor("#38bdf8", "#f43f5e", t);
  }
  return UNIT_STATUS_META[unit.status as UnitStatus]?.hex ?? "#64748b";
}

export function priceRange(units: UnitGeom[]): [number, number] {
  if (!units.length) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const u of units) {
    const p = effectivePrice(u);
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

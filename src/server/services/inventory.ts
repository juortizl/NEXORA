import type { Prisma, PrismaClient } from "@prisma/client";
import { computeUnitPrice } from "@/lib/pricing";
import { unitCode, unitNodeName } from "@/lib/utils";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Matriz de posiciones de la planta típica: posición (1..n) => código de
 * tipología y metadatos opcionales (orientación, vista).
 */
export type FloorMatrixEntry = {
  position: number;
  typologyCode: string;
  orientation?: string;
  viewTag?: string;
};

/**
 * Genera (o completa) las unidades de una torre a partir de la matriz de la
 * planta típica. No toca unidades existentes (idempotente).
 */
export async function generateUnitsForTower(
  tx: Tx,
  params: {
    projectId: string;
    towerId: string;
    towerCode: string;
    floors: number;
    firstResidentialFloor: number;
    matrix: FloorMatrixEntry[];
  }
) {
  const typologies = await tx.typology.findMany({ where: { projectId: params.projectId } });
  const byCode = new Map(typologies.map((t) => [t.code, t]));
  const existing = await tx.unit.findMany({
    where: { towerId: params.towerId },
    select: { floor: true, position: true },
  });
  const existingKeys = new Set(existing.map((u) => `${u.floor}-${u.position}`));

  const data: Prisma.UnitCreateManyInput[] = [];
  for (let floor = params.firstResidentialFloor; floor <= params.floors; floor++) {
    for (const entry of params.matrix) {
      if (existingKeys.has(`${floor}-${entry.position}`)) continue;
      const typology = byCode.get(entry.typologyCode);
      if (!typology) throw new Error(`Tipología ${entry.typologyCode} no existe en el proyecto`);
      data.push({
        projectId: params.projectId,
        towerId: params.towerId,
        typologyId: typology.id,
        floor,
        position: entry.position,
        code: unitCode(params.towerCode, floor, entry.position),
        modelNodeName: unitNodeName(params.towerCode, floor, entry.position),
        orientation: entry.orientation,
        viewTag: entry.viewTag,
        listPrice: typology.basePrice,
      });
    }
  }
  if (data.length) await tx.unit.createMany({ data });
  return data.length;
}

/** Recalcula listPrice de todas las unidades del proyecto según reglas vigentes. */
export async function recomputeProjectPrices(tx: Tx, projectId: string) {
  const [rules, units] = await Promise.all([
    tx.priceRule.findMany({ where: { projectId, active: true } }),
    tx.unit.findMany({
      where: { projectId },
      include: { typology: true, tower: true },
    }),
  ]);
  let updated = 0;
  for (const u of units) {
    const { listPrice } = computeUnitPrice(
      {
        basePrice: u.typology.basePrice,
        floor: u.floor,
        position: u.position,
        viewTag: u.viewTag,
        typologyCode: u.typology.code,
        towerCode: u.tower.code,
        firstResidentialFloor: u.tower.firstResidentialFloor,
      },
      rules
    );
    if (listPrice !== u.listPrice) {
      await tx.unit.update({ where: { id: u.id }, data: { listPrice } });
      updated++;
    }
  }
  return updated;
}

export function effectivePrice(u: { listPrice: number; priceOverride: number | null }) {
  return u.priceOverride ?? u.listPrice;
}

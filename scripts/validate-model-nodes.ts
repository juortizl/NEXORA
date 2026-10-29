/**
 * Valida que los nodos del GLB coincidan con las unidades del proyecto.
 *
 * Uso: npm run model:validate -- <modelo.glb> <slug-proyecto>
 *
 * Lee el chunk JSON del GLB (sin dependencias externas), extrae los nombres de
 * nodos que siguen el patrón T{torre}_P{piso}_U{posición} y los cruza con
 * Unit.modelNodeName en la base de datos. Reporta faltantes y sobrantes.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const [, , file, slug] = process.argv;
if (!file || !slug) {
  console.error("Uso: npm run model:validate -- <modelo.glb> <slug-proyecto>");
  process.exit(1);
}

function readGlbNodeNames(path: string): string[] {
  const buf = readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) {
    // No es GLB binario: intentar como glTF JSON
    const json = JSON.parse(buf.toString("utf8"));
    return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
  }
  const chunkLength = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) throw new Error("Primer chunk no es JSON");
  const json = JSON.parse(buf.subarray(20, 20 + chunkLength).toString("utf8"));
  return (json.nodes ?? []).map((n: { name?: string }) => n.name ?? "");
}

const UNIT_RE = /^T\w+_P\d{2}_U\d{2}$/;

async function main() {
  const db = new PrismaClient();
  const project = await db.project.findUnique({ where: { slug }, include: { units: { select: { code: true, modelNodeName: true } }, towers: true } });
  if (!project) {
    console.error(`Proyecto ${slug} no existe`);
    process.exit(1);
  }
  const names = readGlbNodeNames(file);
  const unitNodes = new Set(names.filter((n) => UNIT_RE.test(n)));
  const expected = new Map(project.units.filter((u) => u.modelNodeName).map((u) => [u.modelNodeName!, u.code]));

  const missing = [...expected.keys()].filter((n) => !unitNodes.has(n));
  const extra = [...unitNodes].filter((n) => !expected.has(n));
  const towerNodes = project.towers.map((t) => t.modelNodeName).filter(Boolean) as string[];
  const missingTowers = towerNodes.filter((n) => !names.includes(n));

  console.log(`Modelo: ${file}`);
  console.log(`Nodos totales: ${names.length} · nodos de unidad: ${unitNodes.size}`);
  console.log(`Unidades en BD con nodo: ${expected.size}`);
  console.log(`Coinciden: ${expected.size - missing.length}`);
  if (missingTowers.length) console.log(`Torres sin nodo en el modelo: ${missingTowers.join(", ")}`);
  if (missing.length) {
    console.log(`\nFALTAN en el modelo (${missing.length}):`);
    console.log(missing.slice(0, 50).join(", ") + (missing.length > 50 ? " …" : ""));
  }
  if (extra.length) {
    console.log(`\nSOBRAN en el modelo (${extra.length}, no existen en BD):`);
    console.log(extra.slice(0, 50).join(", ") + (extra.length > 50 ? " …" : ""));
  }
  await db.$disconnect();
  process.exit(missing.length ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

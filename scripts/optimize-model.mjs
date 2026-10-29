#!/usr/bin/env node
/**
 * Optimiza un modelo GLB/GLTF exportado desde Blender/Revit/SketchUp para la web.
 *
 * Uso:
 *   node scripts/optimize-model.mjs <entrada.glb> <salida.glb> [--lod]
 *
 * Pasos (vía @gltf-transform/cli, se descarga con npx la primera vez):
 *   1. dedup + prune + flatten + join (reduce draw calls, conserva nombres de nodos de unidades)
 *   2. weld + simplify (reduce triángulos manteniendo silueta)
 *   3. resize de texturas a 2048 y compresión WebP
 *   4. compresión de geometría con meshopt (rápida de decodificar en el navegador)
 *   5. (opcional --lod) genera variantes _lod1 y _lod2 más simplificadas
 *
 * Los nodos que sigan la convención T{torre}_P{piso}_U{posición} se preservan
 * (no se fusionan) para poder colorearlos y seleccionarlos de forma individual.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const [, , input, output, ...flags] = process.argv;
if (!input || !output) {
  console.error("Uso: node scripts/optimize-model.mjs <entrada.glb> <salida.glb> [--lod]");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`No existe ${input}`);
  process.exit(1);
}

const UNIT_PATTERN = "^T\\w+_P\\d{2}_U\\d{2}$";

function run(args) {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  console.log(`\n> gltf-transform ${args.join(" ")}`);
  const res = spawnSync(cmd, ["-y", "@gltf-transform/cli", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) {
    console.error("Falló gltf-transform");
    process.exit(res.status ?? 1);
  }
}

const tmp1 = output.replace(/\.glb$/i, ".tmp1.glb");
const tmp2 = output.replace(/\.glb$/i, ".tmp2.glb");

// 1. Limpieza estructural. `join` fusiona mallas con el mismo material pero
//    respetamos las unidades con --keep-named para no perder los nodos.
run(["dedup", input, tmp1]);
run(["prune", tmp1, tmp1]);
run(["flatten", tmp1, tmp1]);
run(["join", tmp1, tmp1, "--keep-named"]);

// 2. Geometría
run(["weld", tmp1, tmp2]);
run(["simplify", tmp2, tmp2, "--ratio", "0.75", "--error", "0.001"]);

// 3. Texturas
run(["resize", tmp2, tmp2, "--width", "2048", "--height", "2048"]);
run(["webp", tmp2, tmp2]);

// 4. Compresión de geometría
run(["meshopt", tmp2, output, "--level", "medium"]);

// 5. LODs
if (flags.includes("--lod")) {
  const dir = dirname(output);
  const base = basename(output, extname(output));
  run(["simplify", output, join(dir, `${base}_lod1.glb`), "--ratio", "0.4", "--error", "0.01"]);
  run(["simplify", output, join(dir, `${base}_lod2.glb`), "--ratio", "0.15", "--error", "0.05"]);
}

run(["inspect", output]);
console.log(`\nListo: ${output}`);
console.log(`Recuerda validar los nodos con: npm run model:validate -- ${output} <slug-proyecto>`);
console.log(`Patrón esperado de nodos de unidad: ${UNIT_PATTERN}`);

// Genera prisma/schema.sqlite.prisma a partir de schema.prisma cambiando el
// provider. Permite desarrollar sin PostgreSQL local con el mismo modelo.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("prisma/schema.prisma");
const dst = resolve("prisma/schema.sqlite.prisma");
const schema = readFileSync(src, "utf8");
const out = schema.replace(
  /provider\s*=\s*"postgresql"/,
  'provider = "sqlite"'
);
writeFileSync(
  dst,
  "// ARCHIVO GENERADO por scripts/make-sqlite-schema.mjs. No editar.\n" + out
);
console.log("schema.sqlite.prisma generado");

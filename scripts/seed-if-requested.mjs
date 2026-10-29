/**
 * Siembra la base de datos en el despliegue SÓLO si:
 *   1. SEED_ON_DEPLOY=1, y
 *   2. no existe ninguna compañía todavía (base vacía).
 *
 * El seed completo (`prisma/seed.ts`) borra todos los datos, por eso nunca se
 * ejecuta automáticamente sobre una base con información. Para re-sembrar a
 * propósito usa `npm run db:seed` desde la Shell del servicio.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

if (process.env.SEED_ON_DEPLOY !== "1") {
  console.log("[seed] SEED_ON_DEPLOY distinto de 1: se omite el seed.");
  process.exit(0);
}

const db = new PrismaClient();
try {
  const companies = await db.company.count();
  if (companies > 0) {
    console.log(`[seed] La base ya tiene ${companies} compañía(s): se omite el seed para no borrar datos.`);
    process.exit(0);
  }
  console.log("[seed] Base vacía y SEED_ON_DEPLOY=1: sembrando datos de demostración...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
} finally {
  await db.$disconnect();
}

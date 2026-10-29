import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas E2E (smoke) de la plataforma.
 *
 * - Local:  `npm run test:e2e` levanta `next dev` automáticamente sobre la BD SQLite
 *           sembrada (`npm run db:local:reset`).
 * - CI:     se construye antes (`npm run build`) y se ejecuta `npm start`.
 *
 * Variables:
 *   E2E_BASE_URL   URL base (por defecto http://localhost:5000)
 *   E2E_SKIP_SERVER=1  no levantar servidor (ya está corriendo)
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "es-CO",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: isCI ? "npm start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        env: { PORT: "5000" },
      },
});

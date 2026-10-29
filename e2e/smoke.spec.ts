import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke test del flujo comercial principal sobre la BD sembrada (Nórtiko).
 * Credenciales: las del seed (`prisma/seed.ts`).
 */
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "admin@estructurar.co", password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123*" };
const SLUG = "nortiko";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("tu@constructora.co").fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/proyectos/);
}

test.describe.serial("Flujo comercial", () => {
  test("rechaza credenciales inválidas y protege rutas privadas", async ({ page }) => {
    await page.goto(`/proyectos/${SLUG}/inventario`);
    await expect(page).toHaveURL(/\/login/);

    await page.getByPlaceholder("tu@constructora.co").fill(ADMIN.email);
    await page.locator('input[type="password"]').fill("incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  });

  test("login y listado de proyectos", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nórtiko" }).first()).toBeVisible();
  });

  test("visor 3D carga el canvas y la pila de pisos", async ({ page }) => {
    await login(page);
    await page.goto(`/proyectos/${SLUG}`);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    // HUD de leyenda + pila de pisos por torre
    await expect(page.getByText("Disponible").first()).toBeVisible();
    await expect(page.getByText(/T1 · Pisos/i)).toBeVisible();
  });

  test("inventario filtra por búsqueda", async ({ page }) => {
    await login(page);
    await page.goto(`/proyectos/${SLUG}/inventario`);
    await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
    // Espera a que la tabla termine de cargar (más de una fila real).
    await expect.poll(async () => page.locator("tbody tr").count(), { timeout: 20_000 }).toBeGreaterThan(10);
    const rowsBefore = await page.locator("tbody tr").count();

    await page.getByPlaceholder("Buscar código o tipología").fill("T1-12");
    await expect.poll(async () => page.locator("tbody tr").count()).toBeLessThan(rowsBefore);
    await expect(page.locator("tbody tr").first()).toContainText("T1-12");
  });

  test("cotizador calcula en vivo al elegir un apartamento", async ({ page }) => {
    await login(page);
    await page.goto(`/proyectos/${SLUG}/cotizador`);
    await expect(page.getByRole("heading", { name: "Cotizador" })).toBeVisible();
    await expect(page.getByText("Selecciona un apartamento para ver la cotización.")).toBeVisible();

    const unitSelect = page.locator("select").first();
    await expect(unitSelect.locator("option")).not.toHaveCount(1);
    await unitSelect.selectOption({ index: 1 });

    await expect(page.getByText("Precio final")).toBeVisible();
    await expect(page.getByText("Saldo a financiar")).toBeVisible();
    await expect(page.getByText(/cuotas mensuales de/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cotización" })).toBeEnabled();
  });

  test("presentación pública abre sin sesión", async ({ page, request }) => {
    // Obtiene el token público del proyecto a través de la sesión y luego lo abre en un contexto limpio.
    await login(page);
    await page.goto(`/proyectos/${SLUG}`);
    const href = await page.getByRole("link", { name: "Modo sala de ventas" }).getAttribute("href");
    expect(href).toMatch(/\/presentacion\//);

    const res = await request.get(href!);
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toContain("Nórtiko");
  });
});

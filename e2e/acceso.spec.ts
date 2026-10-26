import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("pantalla de acceso", () => {
  test("se muestra con las cabeceras de seguridad y sin errores", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    const response = await page.goto("/");
    // La primera respuesta (index.html) lleva la CSP estricta.
    expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");

    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByLabel("Tu correo electrónico")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviarme un código" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("letra y botones grandes; sin zoom al escribir", async ({ page }) => {
    await page.goto("/acceso");
    const button = page.getByRole("button", { name: "Enviarme un código" });
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    const fontSize = await page
      .getByLabel("Tu correo electrónico")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
    const bodySize = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(bodySize).toBeGreaterThanOrEqual(17);
  });

  test("accesibilidad (axe, WCAG 2.2 AA) en acceso y privacidad", async ({ page }) => {
    for (const path of ["/acceso", "/privacidad"]) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      // Los tipos de @axe-core/playwright van una versión por detrás de @playwright/test.
      const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<
        typeof AxeBuilder
      >[0])
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((v) => `${path}: ${v.id}`)).toEqual([]);
    }
  });

  test("modo oscuro automático", async ({ page }) => {
    // Fecha fija fuera de cualquier tema de temporada (src/lib/season.ts).
    await page.clock.setFixedTime(new Date("2026-06-15T12:00:00"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/acceso");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(15, 17, 21)");
  });

  test("tema de Halloween solo en sus fechas, también en oscuro", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/acceso");
    expect(await page.evaluate(() => document.documentElement.dataset.season)).toBe("halloween");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(18, 13, 22)");
  });
});

import { expect, test } from "@playwright/test";

test("mobile : navigation entre cours et atelier", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/autonome");
  await expect(page.getByRole("heading", { name: "Exercice autonome", level: 1 })).toBeVisible();
  await expect(page.locator(".atelier")).toBeHidden();
  await page.getByRole("tab", { name: /Atelier/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires net");
  await page.getByRole("tab", { name: "Cours" }).click();
  await expect(page.getByRole("heading", { name: "Exercice autonome", level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

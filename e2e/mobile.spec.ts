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

test("mobile : requête SQL, tableau de résultats sans débordement de page, étapes du projet", async ({ page }) => {
  await page.goto("/#/lecon/sql-requetes-jointures/demonstration");
  await page.getByRole("button", { name: "▶ Exécuter la requête" }).click();
  await expect(page.getByTestId("result-table")).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  await page.goto("/#/projet/sql-pme");
  await page.getByRole("combobox", { name: "Étape du projet" }).selectOption("p3");
  await expect(page.getByRole("heading", { name: "Produits les plus rentables", level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: /Atelier/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Les 5 produits les plus rentables");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("mobile : carte des compétences et activités sans débordement horizontal", async ({ page }) => {
  for (const url of ["/#/carte", "/#/carte/sql.b/sql.b.agregations", "/#/lecon/sql-requetes-jointures/intuition"]) {
    await page.goto(url);
    await page.locator("h1").first().waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), url).toBe(false);
  }
});

test("mobile : visualisations ML, RAG et BI sans débordement horizontal", async ({ page }) => {
  for (const [url, id] of [
    ["/#/lecon/ml-evaluer-classifieur/schema", "threshold-viz"],
    ["/#/lecon/llm-rag-citations/schema", "rag-viz"],
    ["/#/lecon/bi-mesures-contexte/schema", "filter-context-viz"],
  ]) {
    await page.goto(url);
    await page.getByTestId(id).waitFor();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), url).toBe(false);
  }
  await page.getByRole("button", { name: /^Café, particulier : \d/ }).waitFor({ timeout: 60_000 });
  await page.getByTestId("filter-context-viz").screenshot({ path: "test-results/mobile-bi.png" });
});

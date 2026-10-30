import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding } from "./helpers";

/**
 * Audit automatique (axe-core, règles WCAG 2.1 A et AA) des pages principales, en thème clair et sombre.
 * Un audit automatique ne couvre qu'une partie des critères : la navigation clavier est testée à part,
 * et les limites restantes sont listées dans docs/LIMITES.md.
 */
const PAGES = [
  "/#/tableau",
  "/#/lecons",
  "/#/lecon/py-boucles-accumulateurs/intuition",
  "/#/lecon/py-boucles-accumulateurs/autonome",
  "/#/lecon/sql-requetes-jointures/schema",
  "/#/lecon/ml-evaluer-classifieur/schema",
  "/#/carte",
  "/#/carnet",
  "/#/entretien",
  "/#/portfolio",
  "/#/projet/copilote-pme",
  "/#/programme",
  "/#/parametres",
  "/#/admin",
];

async function audit(page: Page, url: string) {
  await page.goto(url);
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".cm-editor").analyze();
  return r.violations.map((v) => `${url} — ${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("accessibilité : aucune violation WCAG 2.1 AA détectée par axe, thème clair puis sombre", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/#/");
  expect(await audit(page, "/#/")).toEqual([]);
  await completeOnboarding(page);
  const found: string[] = [];
  for (const url of PAGES) found.push(...(await audit(page, url)));
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  for (const url of ["/#/tableau", "/#/lecon/py-boucles-accumulateurs/autonome", "/#/carte", "/#/parametres"]) {
    await page.goto(url);
    await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
    found.push(...(await audit(page, url)).map((v) => `[sombre] ${v}`));
  }
  expect(found).toEqual([]);
});

test("accessibilité : navigation au clavier — lien d'évitement, dialogue modal", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/#/lecon/py-boucles-accumulateurs/autonome");
  await page.reload();
  await page.locator("h1").first().waitFor();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  // Un dialogue modal : le focus y entre, Échap le referme.
  await page.goto("/#/parametres");
  await page.getByRole("button", { name: "Supprimer toutes mes données" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Supprimer toutes tes données ?" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

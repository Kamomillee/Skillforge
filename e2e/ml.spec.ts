import { expect, test } from "@playwright/test";
import { completeOnboarding, setEditorCode } from "./helpers";
import { exerciseById } from "../src/content";

const ref = (id: string) => exerciseById.get(id)!.referenceSolution;

test("leçon ML : seuil, matrice de confusion et coût recalculés", async ({ page }) => {
  await page.goto("/#/lecon/ml-evaluer-classifieur/schema");
  const viz = page.getByTestId("threshold-viz");
  const slider = viz.getByRole("slider", { name: "Seuil" });
  await slider.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 13; i++) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "Seuil 0.30");
  await expect(viz.locator(".metrics")).toContainText("= 1900 CHF");
  await expect(viz.getByText(/Seuil le moins coûteux avec ces coûts : 0\.05 \(870 CHF, 29 appels\)/)).toBeVisible();
  // Une offre beaucoup plus chère déplace le meilleur seuil vers le haut.
  await viz.getByLabel("Coût d'une offre (CHF)").fill("300");
  await expect(viz.getByText(/Seuil le moins coûteux avec ces coûts : 0\.55 \(4000 CHF, 4 appels\)/)).toBeVisible();
  await viz.getByRole("button", { name: "Version texte" }).click();
  await expect(viz.getByRole("table")).toContainText("(minimum)");
});

test("démonstration scikit-learn exécutée dans le navigateur", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/#/lecon/ml-evaluer-classifieur/demonstration");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  const out = page.getByTestId("demo-output").first();
  await expect(out).toContainText(/VP 4 FP 1 FN 7 VN 28/, { timeout: 150_000 });
  await expect(out).toContainText("précision 0.8");
});

test("projet churn : étape de rapport vérifiée et export Python", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/#/projet/ml-churn");
  await expect(page.locator(".lesson-nav .eyebrow").first()).toContainText("Projet ML");
  await page.locator(".lesson-nav").getByRole("link", { name: /Seuil et coût/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Recommander un seuil chiffré");
  await expect(page.getByTestId("engine")).toContainText("Python", { timeout: 60_000 });
  await setEditorCode(page, ref("ml-churn-p3-rapport"));
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent", { timeout: 60_000 });
  await page.getByTestId("journal-p3").fill("Seuil 0,2 : coût estimé le plus bas sur 40 abonnés, à confirmer sur plus de données.");
  await expect(page.locator("label.field").getByText(/✓ Enregistré/)).toBeVisible();
  await expect(page.locator(".lesson-nav").getByText("1/3 étapes vérifiées")).toBeVisible();

  await page.goto("/#/projet/ml-churn/bilan");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-md").click()]);
  const md = (await import("node:fs")).readFileSync((await download.path())!, "utf8");
  expect(md).toContain("# Prédiction du départ de clients");
  expect(md).toContain("```python");
  expect(md).toContain("def rapport_seuil");
  expect(md).toContain("à confirmer sur plus de données");
});

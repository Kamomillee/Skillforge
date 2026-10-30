import { expect, test } from "@playwright/test";
import { completeOnboarding, setEditorCode } from "./helpers";
import { exerciseById, type SqlExercise } from "../src/content";

const ref = (id: string) => (exerciseById.get(id) as SqlExercise).referenceSolution;

test("leçon BI : matrice calculée par PostgreSQL, contexte pas à pas, requête de cellule identique", async ({ page }) => {
  await page.goto("/#/lecon/bi-mesures-contexte/schema");
  const viz = page.getByTestId("filter-context-viz");
  await expect(viz.getByRole("button", { name: "Café, particulier : 5 209,01" })).toBeVisible({ timeout: 60_000 });
  await viz.getByLabel("Mesure").selectOption("part_ca");
  await viz.getByRole("button", { name: /^Total catégories, particulier/ }).click();
  await viz.getByRole("slider", { name: "Construction du contexte" }).focus();
  await page.keyboard.press("End");
  await expect(viz.getByTestId("fc-result")).toContainText("100 %");
  await viz.getByRole("button", { name: /^Café, total segments/ }).click();
  await page.keyboard.press("End");
  await viz.getByRole("button", { name: "Exécuter cette requête" }).click();
  await expect(viz.getByTestId("fc-verif")).toContainText("PostgreSQL renvoie 23.9 ; la matrice affiche 23,9 %");
  await viz.getByRole("button", { name: "Version texte" }).click();
  await expect(viz.getByText(/le dénominateur ignore le filtre de catégorie/)).toBeVisible();
});

test("projet BI : étape SQL vérifiée, auto-évaluation Power BI exportée comme telle", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/#/projet/bi-rapport");
  await expect(page.getByRole("heading", { name: "Parcours Power BI Desktop" })).toBeVisible();
  await expect(page.getByTestId("relations")).toContainText("retours");
  await page.locator(".lesson-nav").getByRole("link", { name: /Taux de retour/ }).click();
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });
  await setEditorCode(page, ref("bi-rapport-p2-retours").replace("LEFT JOIN retourne", "JOIN retourne"));
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✗", { timeout: 60_000 });
  await setEditorCode(page, ref("bi-rapport-p2-retours"));
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Toutes les vérifications passent");

  await page.goto("/#/projet/bi-rapport/bilan");
  const sc = page.getByTestId("selfcheck");
  await sc.getByLabel(/schéma en étoile/).check();
  await expect(sc.locator("legend")).toContainText("(1/7)");
  await page.reload();
  await expect(page.getByTestId("selfcheck").getByLabel(/schéma en étoile/)).toBeChecked();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-md").click()]);
  const md = (await import("node:fs")).readFileSync((await download.path())!, "utf8");
  expect(md).toContain("## Parcours Power BI Desktop (auto-évaluation, non vérifiée par SkillForge)");
  expect(md).toContain("- [x] Les relations forment un schéma en étoile");
  expect(md).toContain("- [ ] Les cinq tables sont importées");
  expect(md).toMatch(/\| categorie \| unites_vendues \| unites_retournees \| taux_retour_pct \|/);
});

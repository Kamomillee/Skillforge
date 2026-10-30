import { expect, test } from "@playwright/test";
import { completeOnboarding, editorText, setEditorCode } from "./helpers";
import { exerciseById, type SqlExercise } from "../src/content";

const ref = (id: string) => (exerciseById.get(id) as SqlExercise).referenceSolution;

test("leçon SQL : ordre logique calculé par PostgreSQL, version texte", async ({ page }) => {
  await page.goto("/#/lecons");
  await page.getByTestId("lesson-card-sql-requetes-select").click();
  await expect(page.locator(".lesson-nav .eyebrow").first()).toHaveText("SQL · Module B");
  await page.locator(".lesson-nav").getByRole("link", { name: /Voir chaque étape/ }).click();
  const viz = page.getByTestId("sql-steps");
  await expect(viz.getByTestId("result-table")).toBeVisible({ timeout: 60_000 });
  await expect(viz.locator(".clause-pipeline li").first()).toContainText("FROM · 44");
  await viz.getByRole("button", { name: "Étape suivante" }).click();
  await expect(viz.locator(".tracer-note")).toContainText(/44 → \d+ lignes/);
  await viz.getByRole("button", { name: "Version texte" }).click();
  await expect(viz.getByText(/On coupe après 5 lignes/)).toBeVisible();
});

test("exercice SQL : exécution, erreur localisée, mauvaise réponse puis bonne réponse", async ({ page }) => {
  await page.goto("/#/lecon/sql-requetes-select/guide");
  await expect(page.locator(".wb-head h2")).toHaveText("Produits de plus de 40 CHF");
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });

  // Erreur de syntaxe : explication + position.
  await setEditorCode(page, "SELECT nom\nFROM produits\nWHER prix_unitaire > 40");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByText("Erreur de syntaxe")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Aller à la ligne 3" })).toBeVisible();

  // Exécution : tableau de résultats réel.
  await setEditorCode(page, "SELECT produit_id, nom, prix_unitaire FROM produits WHERE prix_unitaire >= 40 ORDER BY prix_unitaire DESC");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByTestId("result-table")).toBeVisible();

  // Mauvaise réponse : vérification cachée échouée.
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText(/✗ \d\/\d vérifications réussies/);

  // Requête différente de la référence mais correcte : acceptée.
  await setEditorCode(page, "SELECT p.produit_id, p.nom, p.prix_unitaire\nFROM produits AS p\nWHERE NOT (p.prix_unitaire <= 40)\nORDER BY 3 DESC;");
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Toutes les vérifications passent");
  await expect(page.locator(".wb-head .badge.success")).toBeVisible();

  // Reprise après rechargement : brouillon conservé.
  await page.waitForTimeout(1200);
  await page.reload();
  await expect.poll(() => editorText(page)).toContain("NOT (p.prix_unitaire <= 40)");
});

test("requête sans fin arrêtée par la limite de temps, puis moteur SQL réutilisable", async ({ page }) => {
  await page.goto("/#/lecon/sql-requetes-select/guide");
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });
  await setEditorCode(page, "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT count(*) FROM n;");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByText(/Requête arrêtée : limite de 8 s dépassée/)).toBeVisible({ timeout: 30_000 });
  await setEditorCode(page, "SELECT count(*) AS n FROM produits;");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByTestId("result-table")).toContainText("24", { timeout: 60_000 });
});

test("visualisation de jointure : INNER puis LEFT JOIN", async ({ page }) => {
  await page.goto("/#/lecon/sql-requetes-jointures/schema");
  const viz = page.getByTestId("join-viz");
  await viz.getByRole("slider").focus();
  await page.keyboard.press("End");
  await expect(viz.getByText("Résultat (4 lignes pour l'instant)")).toBeVisible();
  await viz.getByRole("radio", { name: "LEFT JOIN" }).click();
  await viz.getByRole("slider").focus();
  await page.keyboard.press("End");
  await expect(viz.getByText("Résultat (5 lignes pour l'instant)")).toBeVisible();
  await expect(viz.locator(".tracer-note")).toContainText("LEFT JOIN garde la ligne une fois");
});

test("projet PME : étape vérifiée, journal sauvegardé, reprise et export Markdown", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/#/projet/sql-pme");
  await expect(page.getByTestId("relations")).toContainText("clients");
  await page.locator(".lesson-nav").getByRole("link", { name: /Chiffre d'affaires mensuel/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires mensuel 2026");
  await setEditorCode(page, ref("pme-p2-ca-mensuel"));
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Toutes les vérifications passent", { timeout: 60_000 });
  await page.getByTestId("journal-p2").fill("CA = quantité × prix facturé, commandes livrées ou expédiées ; retours non déduits.");
  await expect(page.locator("label.field").getByText(/✓ Enregistré/)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("journal-p2")).toHaveValue(/retours non déduits/);
  await expect(page.locator(".lesson-nav").getByText("1/5 étapes vérifiées")).toBeVisible();

  await page.goto("/#/tableau");
  await expect(page.getByTestId("dash-projects")).toContainText("en cours, 1/5 étapes vérifiées");
  await page.getByTestId("dash-projects").getByRole("link", { name: "Reprendre" }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires mensuel 2026");

  await page.goto("/#/projet/sql-pme/bilan");
  await page.getByTestId("journal-bilan").fill("Limite : données synthétiques, coûts logistiques absents.");
  await expect(page.locator("label.field").getByText(/✓ Enregistré/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-md").click()]);
  const path = await download.path();
  const md = (await import("node:fs")).readFileSync(path!, "utf8");
  expect(md).toContain("# Base de données d'une PME");
  expect(md).toContain("**Statut :** vérifiée");
  expect(md).toContain("to_char(");
  expect(md).toMatch(/\| mois \| ca \|/);
  expect(md).toContain("retours non déduits");
  expect(md).toContain("coûts logistiques absents");
  expect(md).toContain("non commencée");
});

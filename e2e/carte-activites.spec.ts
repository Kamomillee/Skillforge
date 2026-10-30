import { expect, test } from "@playwright/test";
import { setEditorCode } from "./helpers";
import { exerciseById, type SqlExercise } from "../src/content";

test("carte des compétences : zoom, vue locale, filtre, version liste, maîtrise mise à jour", async ({ page }) => {
  await page.goto("/#/carte");
  await expect(page.getByTestId("map-node-sql.b")).toBeVisible();
  await page.getByTestId("map-node-sql.b").click();
  await expect(page.getByRole("link", { name: "SQL · B. Requêtes" })).toHaveAttribute("aria-current", "page");
  await page.getByTestId("notion-sql.b.inner-join-et-left-join").click();
  const local = page.getByTestId("local-view");
  await expect(local.getByRole("heading", { name: "INNER JOIN et LEFT JOIN" })).toBeVisible();
  await expect(local.getByText("GROUP BY et HAVING")).toBeVisible(); // prérequis
  await expect(local.getByText("Doublons créés par les jointures")).toBeVisible(); // prépare à
  await expect(local.getByText("Pas commencé").first()).toBeVisible();

  // Une réussite autonome fait passer la notion à « Démontré » sur la carte.
  await page.goto("/#/lecon/sql-requetes-jointures/autonome");
  await setEditorCode(page, (exerciseById.get("sql-join-ex2-commandes-par-client") as SqlExercise).referenceSolution);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Toutes les vérifications passent", { timeout: 60_000 });
  await page.goto("/#/carte/sql.b/sql.b.inner-join-et-left-join");
  await expect(page.getByTestId("local-view").locator(".local-center")).toContainText("Démontré");

  // Filtre et version liste (équivalent textuel).
  await page.goto("/#/carte/sql.b");
  await page.getByRole("combobox", { name: /^Maîtrise/ }).selectOption("demo");
  await expect(page.locator(".notion-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Version liste" }).click();
  await expect(page.getByTestId("map-list")).toContainText("INNER JOIN et LEFT JOIN — Disponible · Démontré");

  // Dézoomer revient à la vue d'ensemble.
  await page.getByRole("button", { name: "Vue carte" }).click();
  await page.getByRole("link", { name: "Dézoomer" }).click();
  await expect(page.getByTestId("map-node-python.a")).toBeVisible();
});

test("activités : classement au clavier, association, graphique calculé, code à compléter", async ({ page }) => {
  await page.goto("/#/lecon/sql-requetes-select/intuition");
  const ord = page.getByTestId("activity-ordre-logique-clauses");
  await ord.getByRole("button", { name: "Vérifier l'ordre" }).click();
  await expect(ord.getByText(/bien placés\. Réessaie/)).toBeVisible();
  // Remettre dans l'ordre FROM, WHERE, SELECT, ORDER BY, LIMIT avec les boutons.
  const target = ["FROM", "WHERE", "SELECT", "ORDER BY", "LIMIT"];
  for (let k = 0; k < target.length; k++) {
    for (;;) {
      const labels = await ord.locator(".ord-label").allTextContents();
      const at = labels.indexOf(target[k]);
      if (at === k) break;
      await ord.getByRole("button", { name: `Monter ${target[k]}` }).click();
    }
  }
  await ord.getByRole("button", { name: "Vérifier l'ordre" }).click();
  await expect(ord.getByText("✓ Correct")).toBeVisible();
  await expect(ord.getByText("✓ réussie")).toBeVisible();

  await page.goto("/#/lecon/sql-requetes-jointures/intuition");
  const m = page.getByTestId("activity-choisir-jointure");
  const answers = { "Toutes les commandes": "INNER JOIN", "Tous les clients": "LEFT JOIN", "Les produits qui n'ont": "LEFT JOIN … WHERE droite.id IS NULL", "Le nombre de commandes": "LEFT JOIN + COUNT(droite.id)" };
  for (const [left, opt] of Object.entries(answers)) await m.getByLabel(new RegExp(left)).selectOption({ label: opt });
  await m.getByRole("button", { name: "Vérifier les associations" }).click();
  await expect(m.getByText("✓ Correct")).toBeVisible();

  await page.goto("/#/lecon/sql-requetes-agregations/demonstration");
  const c = page.getByTestId("activity-graphique-ca-categorie");
  await expect(c.locator(".bar-row").first()).toContainText("Accessoires", { timeout: 60_000 });
  await c.getByText("Les coffrets sont la deuxième catégorie la plus rentable.").click();
  await c.getByRole("button", { name: "Vérifier" }).click();
  await expect(c.getByText(/Pas tout à fait/)).toBeVisible();
  await c.getByText(/leur rentabilité ne se lit pas/).click();
  await c.getByRole("button", { name: "Vérifier" }).click();
  await expect(c.getByText("✓ Correct")).toBeVisible();

  await page.goto("/#/lecon/sql-requetes-agregations/intuition");
  const f = page.getByTestId("activity-trous-group-by");
  await f.getByLabel(/Trou 1/).fill("count");
  await f.getByLabel(/Trou 2/).fill("produit_id");
  await f.getByLabel(/Trou 3/).fill("WHERE");
  await f.getByRole("button", { name: "Vérifier" }).click();
  await expect(f.getByText(/Trou 3 : le filtre qui s'applique aux piles/)).toBeVisible();
  await f.getByLabel(/Trou 3/).fill("having");
  await f.getByRole("button", { name: "Vérifier" }).click();
  await expect(f.getByText("✓ Correct")).toBeVisible();

  // La preuve apparaît dans la maîtrise de la leçon.
  await page.locator(".lesson-nav").getByRole("button", { name: "Pourquoi ce statut ?" }).click();
  await expect(page.getByRole("dialog")).toContainText("Code à compléter réussie au 2e essai");
});

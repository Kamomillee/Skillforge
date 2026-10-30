import { expect, test, type Page } from "@playwright/test";
import { setEditorCode } from "./helpers";
import { exerciseById } from "../src/content";
import { questionById } from "../src/content/entretien";

async function setInterviewCode(page: Page, code: string) {
  await page.locator(".interview .editor-wrap .cm-content").waitFor();
  await page.evaluate((c) => {
    const el = document.querySelector(".interview .editor-wrap") as HTMLElement & { cmView?: { dispatch: Function; state: { doc: { length: number } } } };
    el.cmView!.dispatch({ changes: { from: 0, to: el.cmView!.state.doc.length, insert: c } });
  }, code);
}

test("projet transversal : étape Python vérifiée, table d'import en SQL, évaluation et rédaction, puis portfolio", async ({ page }) => {
  await page.goto("/#/projet/copilote-pme");
  await expect(page.locator(".lesson-nav .eyebrow")).toContainText("Projet transversal");
  await expect(page.locator(".lesson-nav")).toContainText("0/7 étapes vérifiées · 0/3 rédigées");

  await page.goto("/#/projet/copilote-pme/s1");
  await expect(page.getByTestId("engine")).toContainText("Python", { timeout: 60_000 });
  await setEditorCode(page, exerciseById.get("cp-1-import")!.referenceSolution);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent", { timeout: 60_000 });
  await expect(page.locator(".lesson-nav")).toContainText("1/7 étapes vérifiées");

  // La table temporaire d'import existe pendant « Exécuter » (préparation de l'exercice).
  await page.goto("/#/projet/copilote-pme/s3");
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByTestId("result-table")).toContainText("client_id");
  await expect(page.getByTestId("result-table")).toContainText("999");

  // Évaluation : seule la valeur de l'étape vérifiée apparaît.
  await page.goto("/#/projet/copilote-pme/s8");
  const ev = page.getByTestId("evaluation");
  await expect(ev.getByRole("row", { name: /Import/ })).toContainText("11");
  await expect(ev.getByRole("row", { name: /Modèle/ })).toContainText("non mesurée");

  // Rédaction : enregistrée, puis comptée comme « rédigée » (pas « vérifiée »).
  await page.goto("/#/projet/copilote-pme/s9");
  await page.getByTestId("journal-s9.donnees").fill("Onze lignes synthétiques, une semaine d'octobre.");
  await page.getByTestId("journal-s9.methodes").fill("Recherche lexicale, règle à un seuil.");
  await page.getByTestId("journal-s9.usage").fill("Pas de décision sur un client individuel.");
  await expect(page.locator(".lesson-nav")).toContainText("1/3 rédigées");

  await page.goto("/#/portfolio");
  const entry = page.getByTestId("portfolio-copilote-pme");
  await expect(entry).toContainText("Étapes vérifiées (1/7)");
  await expect(entry).toContainText("Recherche lexicale, règle à un seuil.");
  await expect(entry.getByTestId("cv-line")).toContainText("Projet de formation « Copilote data pour une PME »");
  await expect(entry.getByTestId("cv-line")).toContainText("1/7 étapes vérifiées par des tests automatisés");
});

test("mode entretien : session sans indices, code exécuté, correction après la session, reprise", async ({ page }) => {
  await page.goto("/#/entretien");
  await page.locator(".panel").filter({ hasText: "Stage automatisation" }).getByRole("button", { name: /Commencer/ }).click();
  await expect(page.getByTestId("entretien-question")).toContainText("Présente-moi ton projet");
  await expect(page.getByRole("button", { name: /indice/i })).toHaveCount(0);
  await page.getByTestId("entretien-reponse").fill("La PME voulait intégrer son export CSV. J'ai rejeté 4 lignes sur 11. Limite : données synthétiques.");
  await page.getByRole("button", { name: "Question suivante →" }).click();

  // Reprise après rechargement : la session et la réponse sont conservées.
  await page.reload();
  await expect(page.getByTestId("entretien-question")).toContainText("Cette fonction plante");
  await page.getByRole("button", { name: "← Question précédente" }).click();
  await expect(page.getByTestId("entretien-reponse")).toHaveValue(/rejeté 4 lignes/);
  await page.getByRole("button", { name: "Question suivante →" }).click();

  const q = questionById.get("q-panier")!;
  await setInterviewCode(page, q.reponseModele);
  await page.getByRole("button", { name: "▶ Exécuter" }).click();
  await expect(page.getByTestId("entretien-sortie")).toContainText("15.0", { timeout: 60_000 });
  await page.getByRole("button", { name: "Question suivante →" }).click();
  await page.getByRole("button", { name: "Question suivante →" }).click();
  await page.getByRole("button", { name: "Terminer et voir la correction" }).click();

  await expect(page.getByTestId("entretien-synthese")).toContainText("1/1 question(s) de code entièrement réussie(s)", { timeout: 60_000 });
  await expect(page.getByTestId("fb-q-panier")).toContainText("Mesurée : tous les tests passent (5/5, dont 4/4 cachés)");
  const projet = page.getByTestId("fb-q-projet");
  await expect(projet).toContainText("Repérée : « Limite : données synthétiques. »");
  await expect(projet).toContainText("Non mesurable automatiquement");
  await page.goto("/#/entretien");
  await expect(page.getByTestId("entretien-historique")).toContainText("Stage automatisation");
});

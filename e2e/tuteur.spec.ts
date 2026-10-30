import { expect, test, type Page } from "@playwright/test";
import { setEditorCode } from "./helpers";
import { exerciseById, lessonById } from "../src/content";
import { misconceptionGuides } from "../src/content/guides";
import { exerciseHref } from "../src/domain/tutor";

const VALIDATION = "sql-select-validation";
const STATUT_OUBLIE = "SELECT commande_id, client_id, date_commande FROM commandes ORDER BY date_commande DESC, commande_id DESC LIMIT 5";

async function openValidation(page: Page) {
  await page.goto("/" + exerciseHref(VALIDATION)!);
  await expect(page.locator(".wb-head h2")).toHaveText(exerciseById.get(VALIDATION)!.title);
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });
}

async function failOnce(page: Page) {
  await setEditorCode(page, STATUT_OUBLIE);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText(/✗/);
}

test("tuteur local : s'appuie sur les tests réels, guide sans donner la solution, se signale", async ({ page }) => {
  await openValidation(page);
  const tutor = page.getByTestId("tutor");

  // Avant toute vérification : il demande des résultats réels.
  await tutor.getByRole("button", { name: "Aide-moi à déboguer" }).click();
  await expect(tutor.getByTestId("tutor-reply")).toContainText("Vérifier");

  await failOnce(page);
  await tutor.getByRole("button", { name: "Aide-moi à déboguer" }).click();
  const reply = tutor.getByTestId("tutor-reply");
  await expect(reply).toContainText("Avis du tuteur local · non testé");
  await expect(reply).toContainText(misconceptionGuides["statut-annule"].question);
  await expect(reply).not.toContainText(misconceptionGuides["statut-annule"].explication);
  await expect(reply).not.toContainText("WHERE statut = 'livree'");

  await tutor.getByText("Ce que le tuteur sait").click();
  await expect(tutor.getByTestId("tutor-context")).toContainText("Tentatives sur cet exercice : 1");

  // « Donne un indice » suit l'aide progressive (niveau 1), sans aller au-delà.
  await tutor.getByRole("button", { name: "Donne un indice" }).click();
  await expect(page.getByText("Aide progressive · 1/4")).toBeVisible();

  // Le tuteur peut se tromper : on peut le signaler et consulter les preuves.
  await tutor.getByRole("button", { name: "Signaler une erreur du tuteur" }).click();
  await expect(page.getByRole("dialog").locator("textarea")).toHaveValue(/Réponse du tuteur \(local, mode « Donne un indice »\)/);
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await tutor.getByRole("button", { name: "Voir les preuves d'exécution" }).click();
  await expect(page.getByRole("tab", { name: "Tests" })).toHaveAttribute("aria-selected", "true");

  // Carnet : l'erreur observée, avec un exercice proposé et sa raison.
  await page.goto("/#/carnet");
  const entry = page.getByTestId("carnet-erreurs").locator("li.carnet-entry").filter({ hasText: "Inclure les commandes annulées" });
  await expect(entry).toContainText("À travailler");
  await expect(entry).toContainText("proposé car « Inclure les commandes annulées » est apparu dans 1 exercice");
});

test("tuteur IA (serveur simulé) : étiqueté « peut se tromper », sans solution ni clé dans la requête", async ({ page }) => {
  let sent = "";
  await page.route("**/api/sante", (r) => r.fulfill({ json: { ok: true, tuteurIA: true, modele: "claude-opus-5-5", comptes: true } }));
  // Le tuteur IA est réservé aux comptes connectés (budget par compte) : session simulée.
  await page.route("**/api/moi", (r) => r.fulfill({ json: { utilisateur: { id: 1, email: "kamo@example.ch", name: "Kamo", role: "etudiant", createdAt: "2026-10-30" } } }));
  await page.route("**/api/tuteur", async (r) => {
    sent = r.request().postData() ?? "";
    await r.fulfill({ json: { texte: "Regarde quelles **commandes** ton filtre garde.", modele: "claude-opus-5-5" } });
  });
  await openValidation(page);
  await failOnce(page);
  const tutor = page.getByTestId("tutor");
  await tutor.getByLabel(/Utiliser le tuteur IA/).check();
  await tutor.getByLabel("Ta question (facultative)").fill("Pourquoi ça échoue ?");
  await tutor.getByRole("button", { name: "Explique simplement" }).click();
  await expect(tutor.getByTestId("tutor-reply")).toContainText("Avis du tuteur IA · non vérifié, peut se tromper");
  await expect(tutor.getByTestId("tutor-reply")).toContainText("Regarde quelles commandes");
  const body = JSON.parse(sent);
  expect(body.mode).toBe("expliquer");
  expect(body.question).toBe("Pourquoi ça échoue ?");
  expect(body.solutionDeReference).toBeUndefined();
  expect(sent).not.toContain("WHERE statut = 'livree'");
  expect(sent.toLowerCase()).not.toContain("api_key");

  // Panne du serveur : retour au tuteur local, annoncé.
  await page.unroute("**/api/tuteur");
  await page.route("**/api/tuteur", (r) => r.fulfill({ status: 429, json: { erreur: "trop de demandes, réessaie dans une minute" } }));
  await tutor.getByRole("button", { name: "Pose-moi une question" }).click();
  await expect(tutor.getByText(/n'a pas pu répondre \(trop de demandes/)).toBeVisible();
  await expect(tutor.getByTestId("tutor-reply")).toContainText("Avis du tuteur local");
});

test("carnet : fiche avec mini-test de rappel, favoris et notes conservées", async ({ page }) => {
  const lesson = lessonById.get("sql-requetes-agregations")!;
  await page.goto(`/#/carnet/fiches/${lesson.id}`);
  const recall = page.getByTestId("recall");
  await recall.getByRole("button", { name: "Afficher la réponse" }).click();
  await recall.getByRole("button", { name: "✓ Je savais" }).click();
  await expect(recall).toContainText("1/1 « je savais »");
  await expect(recall).toContainText("ne compte pas comme preuve");

  await page.getByRole("button", { name: /Favori/ }).click();
  await page.goto("/#/carnet/favoris");
  await expect(page.getByTestId("favoris")).toContainText(`Fiche : ${lesson.title}`);

  await page.goto(`/#/lecon/${lesson.id}`);
  await page.locator(".lesson-nav").getByText("Mes notes", { exact: true }).click();
  await page.locator(".lesson-nav textarea").fill("HAVING filtre après le regroupement.");
  await expect(page.locator(".lesson-nav").getByText("✓ Note enregistrée")).toBeVisible();
  await page.goto("/#/carnet/notes");
  await expect(page.locator(".notes-grid textarea")).toHaveValue("HAVING filtre après le regroupement.");
});

test("révision : après une première révision, une variante paramétrée remplace l'exercice d'origine", async ({ page }) => {
  await openValidation(page);
  await setEditorCode(page, exerciseById.get(VALIDATION)!.referenceSolution);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Toutes les vérifications passent");

  const concept = exerciseById.get(VALIDATION)!.conceptIds[0];
  await page.goto(`/#/revision/${concept}`);
  await expect(page.getByTestId("variante")).toHaveCount(0);
  await page.getByRole("button", { name: "Je n'y arrive pas pour l'instant" }).click();
  await expect(page).toHaveURL(/#\/tableau$/);
  await page.goto(`/#/revision/${concept}`);
  await expect(page.getByTestId("variante")).toContainText("Variante 1");
  await expect(page.locator(".wb-prompt")).toContainText("expédiées");
  await expect(page.getByTestId("engine")).toContainText("PostgreSQL", { timeout: 60_000 });
  // La solution de l'original ne suffit pas.
  await setEditorCode(page, exerciseById.get(VALIDATION)!.referenceSolution);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText(/✗/);
});

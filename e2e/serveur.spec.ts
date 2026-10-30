import { expect, test, type Browser, type Page } from "@playwright/test";
import { setEditorCode } from "./helpers";

/**
 * Parcours contre le VRAI serveur SkillForge (server/main.ts) : base SQLite neuve, tuteur IA simulé
 * (aucune clé, aucun appel externe), budget IA de 2 demandes par compte et par jour, CSP stricte.
 * Configuration : projet « serveur » de playwright.config.ts.
 */

const MDP = "mot-de-passe-solide";

async function nouvelleSession(browser: Browser, baseURL: string) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  const csp: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && csp.push(m.text()));
  return { ctx, page, csp };
}

async function inscrire(page: Page, email: string) {
  await page.goto("/#/parametres");
  const compte = page.getByTestId("compte");
  await compte.getByRole("button", { name: "Créer un compte" }).click();
  await compte.getByLabel("E-mail").fill(email);
  await compte.getByLabel(/Mot de passe/).fill(MDP);
  await compte.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(compte.getByTestId("compte-email")).toHaveText(email);
}

async function connecter(page: Page, email: string) {
  await page.goto("/#/parametres");
  const compte = page.getByTestId("compte");
  await compte.getByLabel("E-mail").fill(email);
  await compte.getByLabel(/Mot de passe/).fill(MDP);
  await compte.getByRole("button", { name: "Se connecter" }).last().click();
  await expect(compte.getByTestId("compte-email")).toHaveText(email);
}

async function favori(page: Page, lessonId: string) {
  await page.goto(`/#/lecon/${lessonId}`);
  await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Favori", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "En favori" }).first()).toBeVisible();
}

async function synchroniser(page: Page) {
  await page.goto("/#/parametres");
  await page.getByRole("button", { name: "Synchroniser maintenant" }).click();
}

test("comptes : synchronisation entre deux appareils, conflit présenté sans rien écraser", async ({ browser }, info) => {
  const baseURL = info.project.use.baseURL!;
  const ordi = await nouvelleSession(browser, baseURL);
  const tel = await nouvelleSession(browser, baseURL);

  // Sans compte, tout reste local ; le serveur est détecté.
  await ordi.page.goto("/#/parametres");
  await expect(ordi.page.getByTestId("compte")).toContainText("rien ne quitte ce navigateur");
  await favori(ordi.page, "py-boucles-accumulateurs");
  await inscrire(ordi.page, "kamo@example.ch");
  await synchroniser(ordi.page);
  await expect(ordi.page.getByTestId("sync-resultat")).toHaveText("Progression de ce navigateur enregistrée sur ton compte (version 1).");

  // Deuxième appareil, vide : il récupère la progression du compte.
  await connecter(tel.page, "kamo@example.ch");
  await synchroniser(tel.page);
  await expect(tel.page.getByTestId("sync-resultat")).toHaveText("Progression de ton compte chargée dans ce navigateur (version 1).");
  await tel.page.goto("/#/carnet/favoris");
  await expect(tel.page.getByTestId("favoris")).toContainText("Boucles");

  // Modifications des deux côtés : le premier envoie, le second voit un conflit et choisit.
  await favori(ordi.page, "sql-requetes-select");
  await synchroniser(ordi.page);
  await expect(ordi.page.getByTestId("sync-resultat")).toContainText("version 2");
  await favori(tel.page, "sql-requetes-jointures");
  await synchroniser(tel.page);
  await expect(tel.page.getByTestId("sync-conflit")).toContainText("rien n'a été écrasé");
  await expect(tel.page.getByTestId("sync-conflit")).toContainText("Version du compte : 2");
  const download = tel.page.waitForEvent("download");
  await tel.page.getByRole("button", { name: /Prendre le compte/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^skillforge-copie-avant-synchronisation-.*\.json$/);
  await expect(tel.page.getByTestId("sync-resultat")).toContainText("chargée dans ce navigateur (version 2)");
  await tel.page.goto("/#/carnet/favoris");
  await expect(tel.page.getByTestId("favoris")).toContainText("SELECT");

  expect([...ordi.csp, ...tel.csp]).toEqual([]);
  await ordi.ctx.close();
  await tel.ctx.close();
});

test("signalement, administration, isolation et budget IA dépassé", async ({ browser }, info) => {
  const baseURL = info.project.use.baseURL!;
  const etu = await nouvelleSession(browser, baseURL);
  await inscrire(etu.page, "etudiant@example.ch");

  // Signalement depuis un exercice : envoyé à l'équipe (et gardé localement).
  await etu.page.goto("/#/lecon/py-boucles-accumulateurs/autonome");
  await etu.page.getByRole("button", { name: "Signaler un problème dans cet exercice" }).click();
  await etu.page.getByRole("dialog").locator("textarea").fill("Le deuxième exemple de l'énoncé ne correspond pas au test visible.");
  await etu.page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(etu.page.getByText("Signalement envoyé à l'équipe pédagogique")).toBeVisible();

  // Tuteur IA (simulé côté serveur) : 2 demandes autorisées par jour, la 3e est refusée avant l'appel.
  await setEditorCode(etu.page, "def chiffre_affaires_net(transactions):\n    return 0\n");
  const tutor = etu.page.getByTestId("tutor");
  await tutor.getByLabel(/Utiliser le tuteur IA/).check();
  for (const mode of ["Explique simplement", "Pose-moi une question"]) {
    await tutor.getByRole("button", { name: mode }).click();
    await expect(tutor.getByTestId("tutor-reply")).toContainText("Réponse simulée");
  }
  await tutor.getByRole("button", { name: "Montre un exemple" }).click();
  await expect(tutor.getByText(/n'a pas pu répondre \(budget IA du jour atteint \(2 demandes\)/)).toBeVisible();
  await expect(tutor.getByTestId("tutor-reply")).toContainText("Avis du tuteur local");

  // Consommation visible, estimation signalée (tuteur simulé), aucune facturation.
  await etu.page.goto("/#/parametres");
  const conso = etu.page.getByTestId("consommation");
  await expect(conso).toContainText("2 / 2 demandes");
  await expect(conso).toContainText("estimation (tuteur simulé)");
  await expect(conso).toContainText("aucune facturation");

  // Un autre étudiant : ni le signalement, ni la consommation du premier.
  const autre = await nouvelleSession(browser, baseURL);
  await inscrire(autre.page, "autre@example.ch");
  const r = await autre.page.request.get("/api/signalements/1");
  expect(r.status()).toBe(404);
  expect(await (await autre.page.request.get("/api/signalements")).json()).toEqual([]);
  await autre.page.goto("/#/admin");
  await expect(autre.page.getByTestId("admin-refus")).toContainText("Réservé aux comptes d'administration");
  expect((await autre.page.request.get("/api/admin/signalements")).status()).toBe(403);

  // Administration : compte désigné par SKILLFORGE_ADMINS.
  const prof = await nouvelleSession(browser, baseURL);
  await inscrire(prof.page, "prof@example.ch");
  await prof.page.getByRole("link", { name: "Administration" }).click();
  await expect(prof.page.getByTestId("admin-stats")).toContainText(/\d+ comptes/);
  await expect(prof.page.getByTestId("admin-inventaire")).toContainText("aucun problème détecté");
  const item = prof.page.getByTestId("signalement-1");
  await expect(item).toContainText("Le deuxième exemple de l'énoncé");
  await expect(item).not.toContainText("etudiant@example.ch");
  await item.getByLabel("Statut").selectOption("corrige");
  await item.getByLabel("Réponse visible par l'étudiant").fill("Exemple corrigé dans la version 2 de l'exercice.");
  await item.getByRole("button", { name: "Enregistrer" }).click();
  await expect(prof.page.getByText("Signalement n° 1 : corrigé.")).toBeVisible();
  await expect(prof.page.getByTestId("admin-metriques")).toContainText("POST /api/tuteur");

  // L'étudiant voit la réponse.
  await etu.page.reload();
  await expect(etu.page.getByTestId("mes-signalements")).toContainText("Corrigé");
  await expect(etu.page.getByTestId("mes-signalements")).toContainText("Exemple corrigé dans la version 2");

  expect([...etu.csp, ...autre.csp, ...prof.csp]).toEqual([]);
});

test("sous la CSP stricte du serveur, Python et PostgreSQL s'exécutent ; suppression du compte", async ({ browser }, info) => {
  const { ctx, page, csp } = await nouvelleSession(browser, info.project.use.baseURL!);
  const headers = (await page.request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("script-src 'self' 'wasm-unsafe-eval'");

  await page.goto("/#/lecon/py-boucles-accumulateurs/autonome");
  await setEditorCode(page, 'def chiffre_affaires_net(transactions):\n    total = 0\n    for t in transactions:\n        if t["type"] == "vente":\n            total += t["montant"]\n        elif t["type"] == "remboursement":\n            total -= t["montant"]\n    return round(total, 2)\n');
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent", { timeout: 60_000 });

  await page.goto("/#/lecon/sql-requetes-jointures/demonstration");
  await page.getByRole("button", { name: "▶ Exécuter la requête" }).click();
  await expect(page.getByTestId("result-table")).toBeVisible({ timeout: 60_000 });

  // Suppression du compte : mot de passe exigé ; la progression locale reste.
  await inscrire(page, "depart@example.ch");
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  const dlg = page.getByRole("dialog", { name: "Supprimer ton compte ?" });
  await dlg.getByLabel("Mot de passe").fill(MDP);
  await dlg.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Compte supprimé sur le serveur")).toBeVisible();
  await expect(page.getByTestId("compte")).toContainText("Créer un compte");
  expect((await page.request.post("/api/session", { headers: { "x-skillforge": "1" }, data: { email: "depart@example.ch", password: MDP } })).status()).toBe(401);
  expect(csp).toEqual([]);
  await ctx.close();
});

import { expect, test } from "@playwright/test";
import { completeOnboarding, editorText, setEditorCode } from "./helpers";

const CA_CORRECT = `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] == "vente":
            total += t["montant"]
        elif t["type"] == "remboursement":
            total -= t["montant"]
    return round(total, 2)
`;

const CA_ALTERNATIVE = `def chiffre_affaires_net(transactions):
    v = sum(t["montant"] for t in transactions if t["type"] == "vente")
    r = sum(t["montant"] for t in transactions if t["type"] == "remboursement")
    return round(v - r, 2)
`;

const CA_WRONG = `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] != "annulation":
            total += t["montant"]
    return round(total, 2)
`;

test("tranche verticale : onboarding → leçon → visualisation → exercice → correction → reprise", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Comprendre le code");
  await completeOnboarding(page);

  // Tableau de bord : recommandation justifiée.
  await expect(page.getByText("Prochaine activité recommandée")).toBeVisible();
  await expect(page.getByText(/Pourquoi :/)).toBeVisible();
  await page.getByTestId("next-activity").click();

  // Leçon : visualisation pas à pas.
  await expect(page.getByRole("heading", { name: "Le problème : le CA du jour" })).toBeVisible();
  await page.locator(".lesson-nav").getByRole("link", { name: /Visualiser la boucle/ }).click();
  const tracer = page.locator(".tracer");
  for (let i = 0; i < 4; i++) await tracer.getByRole("button", { name: "Étape suivante" }).click();
  await expect(tracer.locator(".tracer-note")).toContainText("total devient 0 + 120 = 120");
  await tracer.getByRole("button", { name: "Étape précédente" }).click();
  await expect(tracer.locator(".tracer-note")).toContainText("120 > 0 est vrai");
  await tracer.getByRole("button", { name: "Version texte" }).click();
  await expect(tracer.getByText("Fin du programme. Sortie : 245.")).toBeVisible();

  // Démonstration exécutée réellement.
  await page.locator(".lesson-nav").getByRole("link", { name: /Démonstration/ }).click();
  await page.getByRole("button", { name: "▶ Exécuter l'exemple" }).click();
  await expect(page.getByTestId("demo-output")).toContainText("CA brut : 245 CHF", { timeout: 60_000 });
  await expect(page.getByTestId("demo-output")).toContainText("Remboursements : 1");

  // Prédiction.
  await page.locator(".lesson-nav").getByRole("link", { name: /À toi de prédire/ }).click();
  await page.locator(".prediction").first().getByText("215").click();
  await page.locator(".prediction").first().getByRole("button", { name: "Valider ma prédiction" }).click();
  await expect(page.getByText("✓ Bonne prédiction")).toBeVisible();

  // Exercice autonome : exécution, erreur, mauvaise solution, bonne solution.
  await page.locator(".lesson-nav").getByRole("link", { name: /Exercice autonome/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires net");
  await setEditorCode(page, "def chiffre_affaires_net(transactions)\n    return 0\n");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.locator(".atelier .error-card")).toContainText("Erreur de syntaxe");
  await expect(page.locator(".atelier .error-card")).toContainText("Ligne 1");

  await setEditorCode(page, CA_WRONG);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✗ 3/6 tests réussis");
  await expect(page.locator(".atelier .tests")).toContainText("Additionner un remboursement au lieu de le soustraire");

  // Aide progressive : niveau 1 seulement, pas de solution.
  await page.getByRole("button", { name: "Obtenir une première piste" }).click();
  await expect(page.locator(".hint-box")).toHaveCount(1);

  await setEditorCode(page, CA_ALTERNATIVE);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent");
  await expect(page.getByText("Correction expliquée")).toBeVisible();

  // Brouillon modifié (non soumis) puis rechargement : tout est restauré.
  await setEditorCode(page, CA_CORRECT + "\n# brouillon après réussite\n");
  await expect(page.getByTestId("save-state")).toContainText("Enregistré", { timeout: 10_000 });
  await page.reload();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires net");
  await expect.poll(() => editorText(page)).toContain("# brouillon après réussite");
  await expect(page.locator(".wb-head .badge.success")).toContainText("Réussi");

  // Tableau de bord : reprise exacte, preuve, révision planifiée, erreur fréquente.
  await page.goto("/#/tableau");
  await expect(page.getByText(/Chiffre d'affaires net.*réussi : 6\/6 tests/)).toBeVisible();
  await expect(page.getByText("Additionner un remboursement au lieu de le soustraire")).toBeVisible();
  await expect(page.getByText(/Planifiée après la réussite/)).toBeVisible();
  await page.getByTestId("resume").click();
  await expect(page.locator(".wb-head h2")).toHaveText("Chiffre d'affaires net");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Exercice autonome");
});

test("boucle infinie interrompue par la limite de temps, puis Python réutilisable", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await expect(page.locator(".wb-head h2")).toHaveText("Compter les remboursements");
  await setEditorCode(page, "n = 0\nwhile True:\n    n += 1\n");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByText("Programme arrêté : limite de temps dépassée")).toBeVisible({ timeout: 60_000 });
  // Le moteur répond de nouveau.
  await setEditorCode(page, "print('encore vivant')\n");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await expect(page.getByTestId("console")).toContainText("encore vivant", { timeout: 60_000 });
});

test("arrêt manuel d'un programme long avec le bouton Arrêter", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await setEditorCode(page, "print('début')\nwhile True:\n    pass\n");
  await page.getByRole("button", { name: /Exécuter/ }).first().click();
  await page.getByRole("button", { name: "■ Arrêter" }).click({ timeout: 60_000 });
  await expect(page.getByText("■ Exécution interrompue.")).toBeVisible();
});

test("réinitialisation avec confirmation", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await expect(page.locator(".wb-head h2")).toHaveText("Compter les remboursements");
  await setEditorCode(page, "# mon code\n");
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  expect(await editorText(page)).toBe("# mon code\n");
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Réinitialiser" }).click();
  await expect.poll(() => editorText(page)).toContain("nombre = ___");
});

test("conflit entre deux onglets : pas d'écrasement silencieux", async ({ page, context }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await expect(page.locator(".wb-head h2")).toHaveText("Compter les remboursements");
  const other = await context.newPage();
  await other.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await expect(other.locator(".wb-head h2")).toHaveText("Compter les remboursements");

  await setEditorCode(other, "# version de l'onglet B\n");
  await expect(other.getByTestId("save-state")).toContainText("Enregistré", { timeout: 10_000 });
  // L'onglet A n'avait rien modifié : il se met à jour.
  await expect.poll(() => editorText(page)).toBe("# version de l'onglet B\n");

  // Modifications concurrentes : A et B éditent presque en même temps.
  await setEditorCode(page, "# A modifie\n");
  await setEditorCode(other, "# B modifie\n");
  // A enregistre en premier ; B ne doit pas écraser A sans le dire.
  await expect(other.getByText("Une version plus récente de ce brouillon existe")).toBeVisible({ timeout: 10_000 });
  await other.getByRole("button", { name: "Garder la mienne" }).click();
  await expect(other.getByTestId("save-state")).toContainText("Enregistré", { timeout: 10_000 });
  // Choix explicite de B : A (sans modification en cours) se met à jour.
  await expect.poll(() => editorText(page)).toBe("# B modifie\n");
});

test("passer une notion par le test de validation", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs");
  await page.getByRole("link", { name: "Je connais déjà : passer le test" }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Test de validation : somme au-dessus d'un seuil");
  await setEditorCode(page, "def somme_au_dessus(montants, seuil):\n    return sum(m for m in montants if m > seuil)\n");
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent");
  await page.getByRole("button", { name: "Pourquoi ce statut ?" }).click();
  await expect(page.getByRole("dialog")).toContainText("Maîtrise : Démontré");
});

test("échec d'enregistrement : avertissement visible puis nouvel essai automatique", async ({ page }) => {
  await page.goto("/#/lecon/py-boucles-accumulateurs/guide");
  await expect(page.locator(".wb-head h2")).toHaveText("Compter les remboursements");
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put;
    let failures = 1;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "drafts" && failures-- > 0) throw new DOMException("Quota simulé", "QuotaExceededError");
      return orig.apply(this, args);
    } as IDBObjectStore["put"];
  });
  await setEditorCode(page, "# test de résilience\n");
  await expect(page.getByText(/Non enregistré/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("save-state")).toContainText("Enregistré", { timeout: 10_000 });
  await page.reload();
  await expect.poll(() => editorText(page)).toBe("# test de résilience\n");
});

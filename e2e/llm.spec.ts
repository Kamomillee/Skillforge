import { expect, test } from "@playwright/test";
import { completeOnboarding, setEditorCode } from "./helpers";
import { exerciseById } from "../src/content";

test("leçon RAG : recherche, abstention, seuil et évaluation sur 13 questions", async ({ page }) => {
  await page.goto("/#/lecon/llm-rag-citations/schema");
  const viz = page.getByTestId("rag-viz");
  await viz.getByLabel("Question").fill("La livraison est-elle gratuite ?");
  await viz.getByRole("slider", { name: "Étape du pipeline" }).focus();
  await page.keyboard.press("End");
  await expect(viz.getByTestId("rag-answer")).toContainText("Abstention");
  await expect(viz.getByTestId("rag-answer")).toContainText("modèle simulé", { ignoreCase: true });
  await expect(viz.locator("summary")).toContainText("5 bonnes sources, 3 abstentions justifiées, 4 silences à tort");

  // Seuil 1 : la bonne source est citée, mais le tableau change aussi pour les autres questions.
  await viz.getByLabel("Seuil de citation").fill("1");
  await expect(viz.getByTestId("rag-answer")).toContainText("Sources : Livraison [livraison#0]");
  await expect(viz.locator("summary")).not.toContainText("4 silences à tort");

  await viz.getByRole("button", { name: "Version texte" }).click();
  await expect(viz.getByText(/Réponse citant livraison#0/)).toBeVisible();
});

test("projet assistant : tableau d'évaluation vérifié, erreur détectée", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/#/projet/llm-assistant");
  await expect(page.locator(".lesson-nav .eyebrow").first()).toContainText("Projet LLM");
  await page.locator(".lesson-nav").getByRole("link", { name: /Évaluation/ }).click();
  await expect(page.locator(".wb-head h2")).toHaveText("Tableau d'évaluation sur les questions de référence");
  await expect(page.getByTestId("engine")).toContainText("Python", { timeout: 60_000 });
  // Version fautive : un cas sans source attendue est compté comme une bonne réponse.
  await setEditorCode(page, exerciseById.get("llm-assist-p3-evaluation")!.referenceSolution.replace('if c["cites"]:\n                t["reponse_inventee"] += 1\n            else:\n                t["abstention_correcte"] += 1', 't["abstention_correcte"] += 1'));
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✗", { timeout: 60_000 });
  await setEditorCode(page, exerciseById.get("llm-assist-p3-evaluation")!.referenceSolution);
  await page.getByRole("button", { name: "✓ Vérifier" }).click();
  await expect(page.getByTestId("grade-summary")).toContainText("✓ Tous les tests passent");
  await expect(page.locator(".lesson-nav").getByText("1/3 étapes vérifiées")).toBeVisible();
});

import type { Page } from "@playwright/test";

/** Remplace le contenu de l'éditeur CodeMirror par `code` (sans auto-indentation parasite). */
export async function setEditorCode(page: Page, code: string) {
  await page.locator(".atelier .editor-wrap .cm-content").first().waitFor();
  await page.evaluate((c) => {
    const el = document.querySelector(".atelier .editor-wrap") as HTMLElement & { cmView?: { dispatch: Function; state: { doc: { length: number } } } };
    const view = el.cmView!;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } });
  }, code);
}

export async function editorText(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".atelier .editor-wrap") as HTMLElement & { cmView?: { state: { doc: { toString(): string } } } };
    return el.cmView!.state.doc.toString();
  });
}

export async function completeOnboarding(page: Page) {
  await page.goto("/#/onboarding");
  await page.getByLabel("Prénom ou pseudo").fill("Kamo");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: /Voir mon parcours/ }).click();
  await page.getByRole("button", { name: "Enregistrer et commencer" }).click();
}

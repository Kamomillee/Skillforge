import { describe, expect, it } from "vitest";
import { allNotions, exercises, lessons, projects } from "../../src/content";

/** Cohérence entre le contenu et la matrice de couverture : aucun statut « disponible » sans contenu réel. */
describe("matrice de couverture", () => {
  const notions = new Map(allNotions().map((r) => [r.notion.id, r.notion]));

  it("chaque notion citée par un exercice ou une leçon existe dans le programme", () => {
    for (const e of exercises) for (const c of e.conceptIds) expect(notions.has(c), `${e.id} → ${c}`).toBe(true);
    for (const l of lessons) for (const c of l.conceptIds) expect(notions.has(c), `${l.id} → ${c}`).toBe(true);
  });

  it("une notion « disponible » a une leçon existante qui la couvre et au moins un exercice", () => {
    for (const n of notions.values()) {
      if (n.status !== "disponible") continue;
      expect(n.lessonIds?.length, n.id).toBeTruthy();
      for (const id of n.lessonIds!) expect(lessons.find((l) => l.id === id)?.conceptIds, `${n.id} → ${id}`).toContain(n.id);
      expect(exercises.some((e) => e.conceptIds.includes(n.id)), n.id).toBe(true);
    }
  });

  it("chaque leçon couvre uniquement des notions marquées disponibles", () => {
    for (const l of lessons) for (const c of l.conceptIds) expect(notions.get(c)?.status, `${l.id} → ${c}`).toBe("disponible");
  });

  it("chaque étape de projet pointe vers un exercice de type projet", () => {
    for (const p of projects) for (const s of p.steps) expect(exercises.find((e) => e.id === s.exerciseId)?.kind, `${p.id}/${s.id}`).toBe("project");
  });
});

import { sqlMisconceptionHint } from "../../src/grading/evaluate";

describe("pistes SQL lues dans la requête", () => {
  it("détecte = NULL et COUNT(*) après LEFT JOIN", () => {
    expect(sqlMisconceptionHint("SELECT * FROM clients WHERE ville = NULL")).toBe("null-egalite");
    expect(sqlMisconceptionHint("SELECT c.nom, COUNT(*) FROM clients c LEFT JOIN commandes o ON o.client_id = c.client_id GROUP BY 1", "inner-au-lieu-de-left")).toBe("count-etoile-left");
  });
  it("ne propose pas « INNER JOIN » à qui utilise déjà LEFT JOIN", () => {
    expect(sqlMisconceptionHint("SELECT p.nom FROM produits p LEFT JOIN lignes_commande l USING (produit_id)", "inner-au-lieu-de-left")).toBeUndefined();
    expect(sqlMisconceptionHint("SELECT p.nom FROM produits p JOIN lignes_commande l USING (produit_id)", "inner-au-lieu-de-left")).toBe("inner-au-lieu-de-left");
  });
  it("ignore les commentaires et IS NULL", () => {
    expect(sqlMisconceptionHint("-- pas = NULL ici\nSELECT * FROM clients WHERE ville IS NULL", "ordre-tri")).toBe("ordre-tri");
  });
});

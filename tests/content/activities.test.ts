import { describe, expect, it } from "vitest";
import { lessons, type ActivityBlock } from "../../src/content";
import { blankIsCorrect, normalizeAnswer } from "../../src/domain/answers";
import { q } from "./pglite";

const activities = lessons.flatMap((l) =>
  l.sections.flatMap((s) => s.blocks.filter((b): b is ActivityBlock => ["ordering", "matching", "chart-question", "fill-code"].includes(b.type)).map((b) => ({ lesson: l, block: b }))),
);

describe("activités réutilisables : cohérence du contenu", () => {
  it("il y a au moins une activité de chaque type", () => {
    expect(new Set(activities.map((a) => a.block.type))).toEqual(new Set(["ordering", "matching", "chart-question", "fill-code"]));
  });

  it("identifiants uniques", () => {
    const ids = activities.map((a) => a.block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const { block } of activities) {
    it(`${block.type} ${block.id}`, async () => {
      if (block.type === "ordering") {
        expect([...block.answer].sort()).toEqual(block.items.map((i) => i.id).sort());
      } else if (block.type === "matching") {
        const opts = new Set(block.options.map((o) => o.id));
        for (const p of block.pairs) expect(opts.has(p.answer), p.id).toBe(true);
        expect(new Set(block.pairs.map((p) => p.answer)).size).toBeGreaterThan(1);
      } else if (block.type === "chart-question") {
        expect(block.choices.map((c) => c.id)).toContain(block.answer);
        expect(block.sql || block.data).toBeTruthy();
        if (block.sql) {
          const r = await q(block.sql);
          expect(r.columns).toHaveLength(2);
          expect(r.rows.length).toBeGreaterThanOrEqual(2);
          for (const row of r.rows) expect(Number.isFinite(Number(row[1]))).toBe(true);
        }
      } else {
        const holes = [...block.template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
        expect(holes.sort()).toEqual(block.blanks.map((b) => b.id).sort());
        // Chaque réponse acceptée, substituée dans le gabarit, donne une requête qui s'exécute.
        if (block.language === "sql")
          for (const b of block.blanks)
            for (const a of b.accept) {
              const sql = block.template.replace(/\{\{(\w+)\}\}/g, (_, id) => (id === b.id ? a : block.blanks.find((x) => x.id === id)!.accept[0]));
              await expect(q(sql), sql).resolves.toBeTruthy();
            }
      }
    });
  }
});

describe("faits affirmés par les activités", () => {
  it("graphique CA par catégorie : coffrets 2e en CA, mais marge du café supérieure (explication)", async () => {
    const r = await q(
      "SELECT p.categorie, SUM(l.quantite * l.prix_unitaire) AS ca, SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire)) AS marge FROM lignes_commande l JOIN produits p USING (produit_id) JOIN commandes o USING (commande_id) WHERE o.statut <> 'annulee' GROUP BY 1 ORDER BY 2 DESC",
    );
    const byCat = Object.fromEntries(r.rows.map((x) => [x[0], { ca: Number(x[1]), marge: Number(x[2]) }]));
    expect(r.rows[1][0]).toBe("Coffrets");
    expect(byCat["Café"].marge).toBeGreaterThan(byCat["Coffrets"].marge);
  });
});

describe("normalisation des réponses courtes", () => {
  it("ignore casse et espaces, pas le contenu", () => {
    expect(normalizeAnswer("  count ")).toBe("count");
    expect(blankIsCorrect(["COUNT"], "count")).toBe(true);
    expect(blankIsCorrect(["produit_id"], "produit _id")).toBe(false);
    expect(blankIsCorrect(["lignes_commande.produit_id"], "lignes_commande . produit_id")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { exerciseById, type SqlExercise } from "../../src/content";
import { CATEGORIES, celluleSql, lireMatrice, matriceSql, MESURES, SEGMENTS, valeur, type Annee, type MesureId } from "../../src/ui/viz/filterContext";
import { gradeSql, q } from "./pglite";

const ex = (id: string) => exerciseById.get(id) as SqlExercise;

describe("BI — contexte de filtre", () => {
  it("chaque cellule de la matrice = la requête SQL de cette cellule seule (3 mesures × 3 années × 18 cellules)", async () => {
    for (const annee of ["2025", "2026", "toutes"] as Annee[]) {
      const m = lireMatrice((await q(matriceSql(annee))).rows);
      for (const mesure of Object.keys(MESURES) as MesureId[])
        for (const categorie of [...CATEGORIES, null])
          for (const segment of [...SEGMENTS, null]) {
            const c = { categorie, segment };
            const r = (await q(celluleSql(mesure, annee, c))).rows[0][0];
            const attendu = valeur(m, mesure, c);
            if (attendu === null) expect(r).toBeNull();
            else expect(Number(r), `${mesure} ${annee} ${categorie} × ${segment}`).toBeCloseTo(attendu, 1);
          }
    }
  });

  it("la matrice couvre bien les 5 catégories et les 2 segments de la base", async () => {
    const cats = (await q("SELECT DISTINCT categorie FROM produits ORDER BY 1")).rows.map((r) => r[0]);
    const segs = (await q("SELECT DISTINCT segment FROM clients ORDER BY 1")).rows.map((r) => r[0]);
    expect(cats).toEqual([...CATEGORIES].sort());
    expect(segs).toEqual([...SEGMENTS].sort());
  });

  it("la part sur la ligne Total vaut 100 % (prédiction de la leçon)", async () => {
    const m = lireMatrice((await q(matriceSql("2026"))).rows);
    for (const segment of [...SEGMENTS, null]) expect(valeur(m, "part_ca", { categorie: null, segment })).toBe(100);
  });

  it("les trois « parts du café » citées dans la leçon sont celles de la base", async () => {
    const part = async (annee: Annee, segment: string | null) => valeur(lireMatrice((await q(matriceSql(annee))).rows), "part_ca", { categorie: "Café", segment });
    expect(await part("toutes", null)).toBe(24.7);
    expect(await part("2026", null)).toBe(23.9);
    expect(await part("2026", "entreprise")).toBe(18.3);
  });

  it("les dates citées dans le projet sont celles de la base", async () => {
    const [min, max] = (await q("SELECT min(date_commande)::text, max(date_commande)::text FROM commandes")).rows[0];
    expect([min, max]).toEqual(["2025-05-01", "2026-10-22"]);
  });
});

describe("BI — erreurs typiques", () => {
  const cas: { id: string; label: string; sql: string; misconception?: string }[] = [
    { id: "bi-ex2-debug-divide", label: "division sans NULLIF (code de départ)", sql: ex("bi-ex2-debug-divide").starterCode, misconception: "division-zero" },
    {
      id: "bi-ex3-part-ca",
      label: "dénominateur sans filtre d'année",
      sql: `SELECT p.categorie, SUM(l.quantite * l.prix_unitaire) AS ca,
  ROUND(100 * SUM(l.quantite * l.prix_unitaire) / (SELECT SUM(l2.quantite * l2.prix_unitaire) FROM lignes_commande l2 JOIN commandes c2 ON c2.commande_id = l2.commande_id WHERE c2.statut <> 'annulee'), 1) AS part_pct
FROM lignes_commande l JOIN commandes c ON c.commande_id = l.commande_id JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee' AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'
GROUP BY p.categorie`,
      misconception: "contexte-denominateur",
    },
    {
      id: "bi-validation-part-segment",
      label: "OVER () au lieu de PARTITION BY catégorie",
      sql: ex("bi-validation-part-segment").referenceSolution.replace("OVER (PARTITION BY p.categorie)", "OVER ()"),
      misconception: "contexte-denominateur",
    },
    {
      id: "bi-rapport-p1-mensuel",
      label: "COUNT(*) compte des lignes, pas des commandes",
      sql: ex("bi-rapport-p1-mensuel").referenceSolution.replace("COUNT(DISTINCT c.commande_id)", "COUNT(*)"),
      misconception: "jointure-doublons",
    },
    {
      id: "bi-rapport-p2-retours",
      label: "INNER JOIN : une catégorie sans retour disparaît",
      sql: ex("bi-rapport-p2-retours").referenceSolution.replace("LEFT JOIN retourne", "JOIN retourne"),
      misconception: "inner-au-lieu-de-left",
    },
    {
      id: "bi-rapport-p2-retours",
      label: "jointure ventes × retours sur la commande seule (doublons)",
      sql: `SELECT p.categorie, SUM(l.quantite) AS unites_vendues, COALESCE(SUM(r.quantite), 0) AS unites_retournees,
  ROUND(100.0 * COALESCE(SUM(r.quantite), 0) / NULLIF(SUM(l.quantite), 0), 1) AS taux_retour_pct
FROM lignes_commande l JOIN commandes c ON c.commande_id = l.commande_id JOIN produits p ON p.produit_id = l.produit_id
LEFT JOIN retours r ON r.commande_id = l.commande_id
WHERE c.statut <> 'annulee' GROUP BY p.categorie`,
      misconception: "jointure-doublons",
    },
    {
      id: "bi-rapport-p3-comparaison",
      label: "années entières au lieu de la période comparable",
      sql: ex("bi-rapport-p3-comparaison")
        .referenceSolution.replaceAll("BETWEEN DATE '2025-05-01' AND DATE '2025-10-22'", "BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'")
        .replaceAll("BETWEEN DATE '2026-05-01' AND DATE '2026-10-22'", "BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'"),
    },
  ];
  for (const c of cas)
    it(`${c.id} : ${c.label}`, async () => {
      const r = await gradeSql(ex(c.id), c.sql);
      expect(r.status).toBe("failed");
      if (c.misconception) expect(r.misconceptions).toContain(c.misconception);
    });
});

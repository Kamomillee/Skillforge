import { describe, expect, it } from "vitest";
import { lessons, sqlExercises, exerciseById } from "../../src/content";
import { checkSpecs, type SqlExercise } from "../../src/content/types";
import { joinVizData } from "../../src/content/sql/jointures";
import { compareResults } from "../../src/grading/sql-compare";
import { joinSteps } from "../../src/ui/viz/joinSteps";
import { generatePme } from "../../src/content/datasets/pme";
import { getDb, gradeSql, q } from "./pglite";

const ex = (id: string) => exerciseById.get(id) as SqlExercise;
const ref = (id: string) => ex(id).referenceSolution;

/** Erreurs typiques : chacune doit échouer, idéalement avec la bonne étiquette d'erreur. */
const WRONG: Record<string, { sql: string; misconception?: string; label: string }[]> = {
  // Projet transversal (erreurs typiques sur les étapes SQL du copilote).
  "cp-3-base": [
    { label: "LEFT JOIN : le client inconnu passe", sql: ref("cp-3-base").replace("JOIN clients", "LEFT JOIN clients"), misconception: "ligne-orpheline" },
    { label: "sans NOT EXISTS : réimport en double", sql: ref("cp-3-base").replace(/WHERE NOT EXISTS \(.*\)\n/, ""), misconception: "reimport" },
  ],
  "cp-4-questions": [
    { label: "COUNT sans DISTINCT", sql: ref("cp-4-questions").replace("COUNT(DISTINCT c.client_id)", "COUNT(c.client_id)"), misconception: "jointure-doublons" },
    { label: "statut oublié", sql: ref("cp-4-questions").replace("c.statut <> 'annulee' AND ", ""), misconception: "statut-annule" },
  ],
  "cp-5-tableau": [{ label: "panier divisé par COUNT(*)", sql: ref("cp-5-tableau").replaceAll("COUNT(DISTINCT c.commande_id)", "COUNT(*)"), misconception: "jointure-doublons" }],
  "sql-select-ex1-produits-chers": [
    { label: ">= au lieu de >", sql: "SELECT produit_id, nom, prix_unitaire FROM produits WHERE prix_unitaire >= 40 ORDER BY prix_unitaire DESC", misconception: "condition-inversee" },
    { label: "tri croissant", sql: "SELECT produit_id, nom, prix_unitaire FROM produits WHERE prix_unitaire > 40 ORDER BY prix_unitaire", misconception: "ordre-tri" },
    { label: "valeurs codées en dur", sql: "SELECT produit_id, nom, prix_unitaire FROM produits WHERE produit_id IN (16, 11, 20, 17, 12, 18) ORDER BY prix_unitaire DESC", misconception: "valeur-codee-en-dur" },
  ],
  "sql-select-ex2-fiches-incompletes": [
    { label: "= NULL", sql: "SELECT client_id, nom, ville, email, date_inscription FROM clients WHERE ville = NULL OR email = NULL ORDER BY date_inscription", misconception: "null-egalite" },
    { label: "UNION ALL (doublon)", sql: "SELECT client_id, nom, ville, email, date_inscription FROM clients WHERE ville IS NULL UNION ALL SELECT client_id, nom, ville, email, date_inscription FROM clients WHERE email IS NULL ORDER BY date_inscription" },
  ],
  "sql-select-ex3-debug-priorite": [{ label: "code de départ", sql: "SELECT client_id, nom, ville FROM clients WHERE segment = 'entreprise' AND ville = 'Genève' OR ville = 'Carouge'" }],
  "sql-select-validation": [
    { label: "sans départage", sql: "SELECT commande_id, client_id, date_commande FROM commandes WHERE statut = 'livree' ORDER BY date_commande DESC, commande_id ASC LIMIT 5" },
    { label: "statut oublié", sql: "SELECT commande_id, client_id, date_commande FROM commandes ORDER BY date_commande DESC, commande_id DESC LIMIT 5", misconception: "statut-annule" },
  ],
  "sql-agg-ex1-statuts": [{ label: "alias absent", sql: "SELECT statut, COUNT(*) FROM commandes GROUP BY statut", misconception: "colonnes" }],
  "sql-agg-ex2-produits-ca": [
    { label: "> au lieu de >=", sql: "SELECT produit_id, SUM(quantite) AS unites, SUM(quantite * prix_unitaire) AS ca FROM lignes_commande GROUP BY produit_id HAVING SUM(quantite * prix_unitaire) > 1000 ORDER BY ca DESC", misconception: "condition-inversee" },
    { label: "filtre par ligne", sql: "SELECT produit_id, SUM(quantite) AS unites, SUM(quantite * prix_unitaire) AS ca FROM lignes_commande WHERE quantite * prix_unitaire >= 30 GROUP BY produit_id ORDER BY ca DESC" },
  ],
  "sql-agg-ex3-debug-having": [
    { label: "WHERE statut oublié", sql: "SELECT client_id, COUNT(*) AS nb_commandes FROM commandes GROUP BY client_id HAVING COUNT(*) >= 10", misconception: "statut-annule" },
  ],
  "sql-agg-validation": [{ label: "tri croissant", sql: "SELECT moyen, COUNT(*) AS nb_paiements, SUM(montant) AS total FROM paiements GROUP BY moyen ORDER BY total", misconception: "ordre-tri" }],
  "sql-join-ex1-commandes-clients": [
    { label: "mauvaise colonne de jointure", sql: "SELECT o.commande_id, o.date_commande, c.nom FROM commandes o JOIN clients c ON c.client_id = o.commande_id WHERE o.date_commande >= '2026-10-01' AND o.date_commande < '2026-11-01'" },
  ],
  "sql-join-ex2-commandes-par-client": [
    { label: "INNER JOIN", sql: "SELECT c.client_id, c.nom, COUNT(o.commande_id) AS nb_commandes FROM clients c JOIN commandes o ON o.client_id = c.client_id GROUP BY c.client_id, c.nom", misconception: "inner-au-lieu-de-left" },
    { label: "COUNT(*)", sql: "SELECT c.client_id, c.nom, COUNT(*) AS nb_commandes FROM clients c LEFT JOIN commandes o ON o.client_id = c.client_id GROUP BY c.client_id, c.nom", misconception: "count-etoile-left" },
    { label: "GROUP BY nom seul (homonymes)", sql: "SELECT MIN(c.client_id) AS client_id, c.nom, COUNT(o.commande_id) AS nb_commandes FROM clients c LEFT JOIN commandes o ON o.client_id = c.client_id GROUP BY c.nom", misconception: "group-by-granularite" },
  ],
  "sql-join-ex3-debug-doublons": [{ label: "code de départ", sql: "", misconception: "jointure-doublons" }],
  "sql-join-validation": [{ label: "INNER JOIN", sql: "SELECT p.produit_id, p.nom FROM produits p JOIN lignes_commande l ON l.produit_id = p.produit_id WHERE l.produit_id IS NULL", misconception: "inner-au-lieu-de-left" }],
  "pme-p1-impayes": [
    { label: "annulées incluses", sql: "SELECT o.commande_id, o.client_id, o.date_commande, SUM(l.quantite * l.prix_unitaire) AS montant_du FROM commandes o JOIN lignes_commande l ON l.commande_id = o.commande_id WHERE NOT EXISTS (SELECT 1 FROM paiements p WHERE p.commande_id = o.commande_id) GROUP BY 1,2,3 ORDER BY 3, 1", misconception: "statut-annule" },
  ],
  "pme-p2-ca-mensuel": [
    { label: "annulées incluses", sql: "SELECT to_char(o.date_commande, 'YYYY-MM') AS mois, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca FROM commandes o JOIN lignes_commande l USING (commande_id) WHERE o.date_commande >= '2026-01-01' GROUP BY 1 ORDER BY 1" },
  ],
  "pme-p3-marge-produits": [
    { label: "prix catalogue", sql: "SELECT p.produit_id, p.nom, ROUND(SUM(l.quantite * (p.prix_unitaire - p.cout_unitaire)), 2) AS marge FROM lignes_commande l JOIN produits p USING (produit_id) JOIN commandes o USING (commande_id) WHERE o.statut <> 'annulee' GROUP BY 1, 2 ORDER BY marge DESC, p.nom LIMIT 5" },
  ],
  "pme-p4-panier-segment": [
    { label: "moyenne des lignes", sql: "SELECT c.segment, ROUND(AVG(l.quantite * l.prix_unitaire), 2) AS panier_moyen FROM commandes o JOIN lignes_commande l USING (commande_id) JOIN clients c USING (client_id) WHERE o.statut <> 'annulee' GROUP BY c.segment", misconception: "group-by-granularite" },
  ],
  "pme-p5-retours-categorie": [
    {
      label: "jointure directe ventes × retours",
      sql: `SELECT p.categorie, SUM(l.quantite) AS unites_vendues, COALESCE(SUM(r.quantite), 0) AS unites_retournees,
            ROUND(COALESCE(SUM(r.quantite), 0)::numeric / SUM(l.quantite), 3) AS taux_retour
            FROM lignes_commande l JOIN commandes o USING (commande_id) JOIN produits p ON p.produit_id = l.produit_id
            LEFT JOIN retours r ON r.produit_id = l.produit_id WHERE o.statut = 'livree' GROUP BY p.categorie`,
      misconception: "jointure-doublons",
    },
    {
      label: "division entière",
      sql: `WITH v AS (SELECT p.categorie, SUM(l.quantite) AS u FROM lignes_commande l JOIN commandes o USING (commande_id) JOIN produits p USING (produit_id) WHERE o.statut = 'livree' GROUP BY 1),
            r AS (SELECT p.categorie, SUM(r.quantite) AS u FROM retours r JOIN produits p USING (produit_id) GROUP BY 1)
            SELECT v.categorie, v.u AS unites_vendues, COALESCE(r.u, 0) AS unites_retournees, COALESCE(r.u, 0) / v.u AS taux_retour FROM v LEFT JOIN r USING (categorie)`,
    },
  ],
};

/** Solutions alternatives correctes : la correction juge le résultat, pas le texte. */
const ALTERNATIVES: Record<string, string[]> = {
  "sql-select-ex2-fiches-incompletes": [
    "SELECT date_inscription, email, ville, nom, client_id FROM clients WHERE NOT (ville IS NOT NULL AND email IS NOT NULL) ORDER BY date_inscription ASC, client_id",
  ],
  "sql-select-ex3-debug-priorite": ["SELECT client_id, nom, ville FROM clients WHERE segment = 'entreprise' AND ville IN ('Genève', 'Carouge') ORDER BY nom"],
  "sql-join-ex2-commandes-par-client": [
    "SELECT c.client_id, c.nom, (SELECT COUNT(*) FROM commandes o WHERE o.client_id = c.client_id) AS nb_commandes FROM clients c",
  ],
  "sql-join-validation": [
    "SELECT produit_id, nom FROM produits p WHERE NOT EXISTS (SELECT 1 FROM lignes_commande l WHERE l.produit_id = p.produit_id)",
    "SELECT produit_id, nom FROM produits EXCEPT SELECT p.produit_id, p.nom FROM produits p JOIN lignes_commande l USING (produit_id)",
  ],
  "pme-p4-panier-segment": [
    "SELECT segment, ROUND(SUM(montant) / COUNT(*), 2) AS panier_moyen FROM (SELECT c.segment, o.commande_id, SUM(l.quantite * l.prix_unitaire) AS montant FROM commandes o JOIN clients c USING (client_id) JOIN lignes_commande l USING (commande_id) WHERE o.statut IN ('livree', 'expediee') GROUP BY 1, 2) t GROUP BY segment",
  ],
};

describe("jeu de données PME", () => {
  it("est déterministe et cohérent", async () => {
    expect(generatePme().sql).toBe(generatePme().sql);
    const counts = await q("SELECT (SELECT count(*) FROM clients)::int AS c, (SELECT count(*) FROM commandes)::int AS o, (SELECT count(*) FROM lignes_commande)::int AS l");
    expect(counts.rows[0]).toEqual([44, 280, 683]);
    // Particularités pédagogiques annoncées.
    expect((await q("SELECT count(*)::int FROM clients c WHERE NOT EXISTS (SELECT 1 FROM commandes o WHERE o.client_id = c.client_id)")).rows[0][0]).toBe(2);
    expect((await q("SELECT count(*)::int FROM produits p WHERE NOT EXISTS (SELECT 1 FROM lignes_commande l WHERE l.produit_id = p.produit_id)")).rows[0][0]).toBe(1);
    expect((await q("SELECT count(*)::int FROM clients WHERE ville IS NULL")).rows[0][0]).toBe(7);
  });
});

describe("exercices SQL", () => {
  for (const e of sqlExercises) {
    it(`${e.id} : la référence s'exécute sur chaque cas et réussit`, async () => {
      const r = await gradeSql(e, e.referenceSolution);
      expect(r.tests.filter((t) => !t.passed)).toEqual([]);
    });
    it(`${e.id} : le code de départ ne réussit pas`, async () => {
      expect((await gradeSql(e, e.starterCode)).status).not.toBe("passed");
    });
    it(`${e.id} : chaque cas caché a un rôle (une erreur typique y échoue, ou le résultat attendu change)`, async () => {
      const base = await q(e.referenceSolution, e.setup);
      const wrongs = (WRONG[e.id] ?? []).map((w) => (w.sql === "" ? e.starterCode : w.sql));
      for (const c of checkSpecs(e).filter((c) => e.checks.find((x) => x.id === c.id)!.hidden)) {
        const withSetup = await q(e.referenceSolution, c.setup);
        const changes = compareResults(base, withSetup, { columnMode: "names", tolerance: e.tolerance }).kind !== "ok";
        let caught = false;
        for (const w of wrongs) {
          const r = await gradeSql(e, w);
          if (r.tests.find((t) => t.id === c.id && !t.passed)) caught = true;
        }
        expect(changes || caught, `cas caché inutile : ${c.id}`).toBe(true);
      }
    });
  }

  for (const [id, wrongs] of Object.entries(WRONG))
    for (const w of wrongs)
      it(`${id} : erreur typique détectée (${w.label})`, async () => {
        const e = ex(id);
        const r = await gradeSql(e, w.sql === "" ? e.starterCode : w.sql);
        expect(r.status).not.toBe("passed");
        if (w.misconception) expect(r.misconceptions).toContain(w.misconception);
      });

  for (const [id, alts] of Object.entries(ALTERNATIVES))
    for (const [i, sql] of alts.entries())
      it(`${id} : solution alternative ${i + 1} acceptée`, async () => {
        const r = await gradeSql(ex(id), sql);
        expect(r.tests.filter((t) => !t.passed)).toEqual([]);
      });

  it("une requête qui modifie les données n'altère pas la base de formation", async () => {
    const e = ex("sql-select-ex1-produits-chers");
    await gradeSql(e, "DELETE FROM produits");
    expect((await q("SELECT count(*)::int FROM produits")).rows[0][0]).toBe(24);
  });

  it("COMMIT est refusé (impossible de sortir de la transaction annulée)", async () => {
    const r = await gradeSql(ex("sql-select-ex1-produits-chers"), "COMMIT");
    expect(r.sqlError?.code).toBe("SF001");
    expect((await q("SELECT count(*)::int FROM produits")).rows[0][0]).toBe(24);
  });

  it("erreur de syntaxe : code SQLSTATE et position remontés", async () => {
    const r = await gradeSql(ex("sql-select-ex1-produits-chers"), "SELECT nom FROM produits WHER prix_unitaire > 40");
    expect(r.status).toBe("error");
    expect(r.sqlError?.code).toBe("42601");
    expect(r.sqlError?.position).toBeGreaterThan(0);
  });

  it("les détails des cas cachés ne révèlent pas les lignes attendues", async () => {
    const r = await gradeSql(ex("sql-join-ex2-commandes-par-client"), WRONG["sql-join-ex2-commandes-par-client"][1].sql);
    for (const t of r.tests.filter((t) => t.hidden && !t.passed)) expect(t.detail).not.toMatch(/Manquante|En trop/);
  });
});

describe("leçons SQL : prédictions et visualisations vérifiées dans PostgreSQL", () => {
  const sqlLessons = lessons.filter((l) => l.domain === "sql");
  const blocks = sqlLessons.flatMap((l) => l.sections.flatMap((s) => s.blocks));

  it("chaque prédiction a la bonne réponse", async () => {
    const answers: Record<string, string> = {};
    for (const b of blocks) {
      if (b.type !== "prediction" || !b.code) continue;
      const r = await q(b.code);
      const got = r.rows[0].map((v) => String(v)).join(" · ");
      answers[b.id] = got;
      expect(b.choices.find((c) => c.id === b.answer)?.label, b.id).toBe(got);
    }
    expect(Object.keys(answers).length).toBe(3);
  });

  it("chaque étape des visualisations « ordre logique » s'exécute, et la dernière est la requête complète", async () => {
    for (const b of blocks) {
      if (b.type !== "sql-steps") continue;
      for (const s of b.stages) await q(s.sql);
      const last = b.stages[b.stages.length - 1];
      expect(last.sql).toMatch(new RegExp(`${last.clause.split(" ")[0]}`, "i"));
    }
  });

  it("chaque bloc de code exécutable s'exécute sans erreur", async () => {
    for (const b of blocks) if (b.type === "code" && b.runnable && b.language === "sql") await q(b.code);
  });

  it("la visualisation de jointure produit exactement le résultat de PostgreSQL (INNER et LEFT)", async () => {
    const d = await getDb();
    const { clients, commandes } = joinVizData;
    const lit = (rows: (number | string)[][]) => rows.map((r) => `(${r.map((v) => (typeof v === "number" ? v : `'${v}'`)).join(", ")})`).join(", ");
    const setup = `CREATE TEMP TABLE vc (client_id int, nom text); INSERT INTO vc VALUES ${lit(clients.rows)};
                   CREATE TEMP TABLE vo (commande_id int, client_id int, montant int); INSERT INTO vo VALUES ${lit(commandes.rows)};`;
    for (const kind of ["inner", "left"] as const) {
      const steps = joinSteps(clients, commandes, "client_id", "client_id", kind);
      const viz = steps[steps.length - 1].resultSoFar;
      const r = await q(`SELECT vc.*, vo.* FROM vc ${kind === "inner" ? "JOIN" : "LEFT JOIN"} vo ON vo.client_id = vc.client_id`, setup);
      const norm = (rows: unknown[][]) => rows.map((x) => JSON.stringify(x)).sort();
      expect(norm(viz)).toEqual(norm(r.rows));
    }
    void d;
  });
});

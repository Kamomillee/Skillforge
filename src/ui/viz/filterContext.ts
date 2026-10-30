/**
 * Contexte de filtre d'un visuel « matrice » (Power BI) reproduit en SQL sur les données PME.
 * Chaque cellule = la mesure évaluée avec les filtres de sa ligne, de sa colonne et du segment « année ».
 * Le DAX est affiché à titre d'équivalent (non exécuté) ; les nombres viennent de PostgreSQL.
 * tests/content/bi.test.ts vérifie que la requête d'une cellule redonne la valeur de la matrice.
 */

export type MesureId = "ca" | "marge_pct" | "part_ca";
export type Annee = "2025" | "2026" | "toutes";

export const CATEGORIES = ["Café", "Thé", "Coffrets", "Épicerie", "Accessoires"] as const;
export const SEGMENTS = ["particulier", "entreprise"] as const;

export const MESURES: Record<MesureId, { label: string; dax: string; unite: "CHF" | "%" }> = {
  ca: {
    label: "CA",
    unite: "CHF",
    dax: "CA =\nSUMX ( Ventes, Ventes[Quantité] * Ventes[Prix unitaire] )",
  },
  marge_pct: {
    label: "Marge %",
    unite: "%",
    dax: "Marge % =\nDIVIDE ( [CA] - [Coût], [CA] )",
  },
  part_ca: {
    label: "Part du CA de la colonne",
    unite: "%",
    dax: "Part du CA =\nDIVIDE (\n    [CA],\n    CALCULATE ( [CA], ALL ( Produits[Catégorie] ) )\n)",
  },
};

const FROM = `FROM lignes_commande l
JOIN commandes c ON c.commande_id = l.commande_id
JOIN produits p ON p.produit_id = l.produit_id
JOIN clients cl ON cl.client_id = c.client_id`;

const CA = "l.quantite * l.prix_unitaire";
const COUT = "l.quantite * p.cout_unitaire";
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function filtreAnnee(annee: Annee): string[] {
  if (annee === "toutes") return [];
  const a = Number(annee);
  return [`c.date_commande >= DATE '${a}-01-01' AND c.date_commande < DATE '${a + 1}-01-01'`];
}

/** Une requête pour toute la matrice : CA et coût par (catégorie, segment) avec sous-totaux. */
export function matriceSql(annee: Annee): string {
  const where = ["c.statut <> 'annulee'", ...filtreAnnee(annee)].join("\n  AND ");
  return `SELECT p.categorie, cl.segment, SUM(${CA}) AS ca, SUM(${COUT}) AS cout
${FROM}
WHERE ${where}
GROUP BY GROUPING SETS ((p.categorie, cl.segment), (p.categorie), (cl.segment), ())`;
}

export interface Cellule {
  categorie: string | null;
  segment: string | null;
}

type Agg = { ca: number; cout: number };
export type Matrice = Map<string, Agg>;
const cle = (c: Cellule) => `${c.categorie ?? "*"}|${c.segment ?? "*"}`;

export function lireMatrice(rows: unknown[][]): Matrice {
  const m: Matrice = new Map();
  for (const [categorie, segment, ca, cout] of rows) m.set(cle({ categorie: categorie as string | null, segment: segment as string | null }), { ca: Number(ca ?? 0), cout: Number(cout ?? 0) });
  return m;
}

const arrondi = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Valeur de la mesure dans le contexte de la cellule ; null = BLANK (DIVIDE par zéro, aucune vente). */
export function valeur(m: Matrice, mesure: MesureId, c: Cellule): number | null {
  const a = m.get(cle(c)) ?? { ca: 0, cout: 0 };
  if (mesure === "ca") return a.ca ? arrondi(a.ca, 2) : null;
  if (mesure === "marge_pct") return a.ca ? arrondi((100 * (a.ca - a.cout)) / a.ca, 1) : null;
  // ALL(Produits[Catégorie]) : même segment et même année, filtre de catégorie retiré.
  const tout = m.get(cle({ categorie: null, segment: c.segment }))?.ca ?? 0;
  return tout ? arrondi((100 * a.ca) / tout, 1) : null;
}

/** Filtres actifs d'une cellule, dans l'ordre où Power BI les applique (segment de page, ligne, colonne). */
export function filtres(annee: Annee, c: Cellule): { source: string; texte: string; sql: string }[] {
  const out: { source: string; texte: string; sql: string }[] = [];
  if (annee !== "toutes") out.push({ source: "Segment (slicer)", texte: `Année = ${annee}`, sql: filtreAnnee(annee)[0] });
  if (c.categorie) out.push({ source: "En-tête de ligne", texte: `Catégorie = ${c.categorie}`, sql: `p.categorie = ${q(c.categorie)}` });
  if (c.segment) out.push({ source: "En-tête de colonne", texte: `Segment client = ${c.segment}`, sql: `cl.segment = ${q(c.segment)}` });
  return out;
}

/** Requête SQL équivalente à la mesure dans le contexte d'une seule cellule. */
export function celluleSql(mesure: MesureId, annee: Annee, c: Cellule): string {
  const f = filtres(annee, c);
  const base = ["c.statut <> 'annulee'"];
  if (mesure === "part_ca") {
    // Le filtre de catégorie quitte le WHERE (ALL) et ne sert plus qu'au numérateur.
    const where = [...base, ...f.filter((x) => !x.sql.startsWith("p.categorie")).map((x) => x.sql)].join("\n  AND ");
    const num = c.categorie ? `SUM(${CA}) FILTER (WHERE p.categorie = ${q(c.categorie)})` : `SUM(${CA})`;
    return `SELECT ROUND(100 * ${num}\n       / NULLIF(SUM(${CA}), 0), 1) AS part_ca_pct\n${FROM}\nWHERE ${where};  -- filtre de catégorie retiré du dénominateur : ALL`;
  }
  const where = [...base, ...f.map((x) => x.sql)].join("\n  AND ");
  if (mesure === "ca") return `SELECT ROUND(SUM(${CA}), 2) AS ca\n${FROM}\nWHERE ${where};`;
  return `SELECT ROUND(100 * (SUM(${CA}) - SUM(${COUT}))\n       / NULLIF(SUM(${CA}), 0), 1) AS marge_pct\n${FROM}\nWHERE ${where};`;
}

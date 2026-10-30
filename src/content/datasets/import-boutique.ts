/**
 * Export de la boutique en ligne de la Torréfaction du Léman (24–27 octobre 2026) — SYNTHÉTIQUE, écrit à la main.
 * Format d'un export de tableur suisse : séparateur « ; », décimales à virgule. Les anomalies sont volontaires
 * et toutes listées ici (le projet transversal demande de les trouver) :
 *  - commande 5002 : la même ligne exportée deux fois (doublon exact) ;
 *  - commande 5003 : date au format suisse « 24.10.2026 » au lieu de AAAA-MM-JJ ;
 *  - commande 5004 : quantité 0 ; commande 5005 : quantité −1 (retour saisi comme une vente) ;
 *  - commande 5006 : espaces autour de la quantité ;
 *  - commande 5009 : client 999, inconnu de la base (intégrité référentielle, étape 3).
 * Les identifiants de clients et de produits, et les prix, sont ceux de la base PME (src/content/datasets/pme.ts).
 */
export const EXPORT_BOUTIQUE = `commande;date;client;produit;quantite;prix_unitaire
5001;2026-10-24;3;7;2;11,00
5001;2026-10-24;3;12;1;45,00
5002;2026-10-24;8;1;1;12,90
5002;2026-10-24;8;1;1;12,90
5003;24.10.2026;11;3;3;13,90
5004;2026-10-25;5;15;0;6,00
5005;2026-10-25;14;2;-1;15,50
5006;2026-10-26;2;9; 4 ;10,50
5007;2026-10-26;6;12;1;45,00
5008;2026-10-27;9;4;2;24,00
5009;2026-10-27;999;6;3;9,50
`;

export interface LigneImport {
  commande: number;
  date: string;
  client: number;
  produit: number;
  quantite: number;
  prix_unitaire: number;
}

/** Miroir TypeScript de la solution de référence de l'étape 1 (vérifié contre Pyodide par les tests de contenu). */
export function chargerVentes(texte: string): LigneImport[] {
  const lignes = texte.split("\n").map((l) => l.trim()).filter(Boolean);
  return lignes.slice(1).map((l) => {
    const [commande, date, client, produit, quantite, prix] = l.split(";").map((c) => c.trim());
    return { commande: Number(commande), date, client: Number(client), produit: Number(produit), quantite: Number(quantite), prix_unitaire: Number(prix.replace(",", ".")) };
  });
}

const dateValide = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
};

/** Miroir TypeScript de la solution de référence de l'étape 2. */
export function nettoyerVentes(lignes: LigneImport[]) {
  const rejets = { date_invalide: 0, quantite_invalide: 0, doublon: 0 };
  const vues = new Set<string>();
  const propres: LigneImport[] = [];
  for (const l of lignes) {
    const cle = JSON.stringify([l.commande, l.date, l.client, l.produit, l.quantite, l.prix_unitaire]);
    if (!dateValide(l.date)) rejets.date_invalide++;
    else if (l.quantite <= 0) rejets.quantite_invalide++;
    else if (vues.has(cle)) rejets.doublon++;
    else {
      vues.add(cle);
      propres.push(l);
    }
  }
  return { lignes: propres, rejets };
}

/** Table d'import pour l'étape 3 : les lignes propres, chargées dans PostgreSQL. */
export function importSql(lignes: LigneImport[]): string {
  const values = lignes.map((l) => `(${l.commande}, DATE '${l.date}', ${l.client}, ${l.produit}, ${l.quantite}, ${l.prix_unitaire.toFixed(2)})`).join(",\n  ");
  return `CREATE TEMP TABLE import_ventes (commande integer, date_commande date, client_id integer, produit_id integer, quantite integer, prix_unitaire numeric(10,2));
INSERT INTO import_ventes VALUES
  ${values}`;
}

export const importBoutiqueInfo = {
  id: "import-boutique",
  title: "Export de la boutique en ligne (synthétique, 11 lignes)",
  provenance: "Écrit à la main pour le projet transversal ; anomalies volontaires listées dans src/content/datasets/import-boutique.ts. Clients et produits de la base PME.",
};

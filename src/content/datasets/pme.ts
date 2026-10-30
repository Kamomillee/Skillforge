/**
 * Jeu de données « Torréfaction du Léman » : PME fictive de Genève qui vend café, thé et accessoires en ligne.
 *
 * Provenance : données 100 % synthétiques, générées de façon déterministe (générateur pseudo-aléatoire
 * mulberry32, graine fixe). Aucune personne ni entreprise réelle. Libre d'usage dans le cadre de la formation.
 *
 * Particularités volontaires (pédagogiques) :
 * - des clients sans e-mail ou sans ville (NULL) ;
 * - deux clients sans aucune commande (LEFT JOIN) ;
 * - un produit jamais vendu ;
 * - des commandes annulées, des commandes sans paiement (facture en attente) ;
 * - le prix de vente d'une ligne peut différer du prix catalogue (promotions).
 */

export const PME_DATASET_ID = "pme";
export const PME_VERSION = 1;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PME_SCHEMA = `
CREATE TABLE clients (
  client_id        integer PRIMARY KEY,
  nom              text NOT NULL,
  email            text UNIQUE,
  ville            text,
  segment          text NOT NULL CHECK (segment IN ('particulier', 'entreprise')),
  date_inscription date NOT NULL
);
CREATE TABLE produits (
  produit_id    integer PRIMARY KEY,
  nom           text NOT NULL,
  categorie     text NOT NULL,
  prix_unitaire numeric(10,2) NOT NULL CHECK (prix_unitaire >= 0),
  cout_unitaire numeric(10,2) NOT NULL CHECK (cout_unitaire >= 0)
);
CREATE TABLE commandes (
  commande_id   integer PRIMARY KEY,
  client_id     integer NOT NULL REFERENCES clients(client_id),
  date_commande date NOT NULL,
  statut        text NOT NULL CHECK (statut IN ('livree', 'expediee', 'annulee'))
);
CREATE TABLE lignes_commande (
  commande_id   integer NOT NULL REFERENCES commandes(commande_id),
  ligne         integer NOT NULL,
  produit_id    integer NOT NULL REFERENCES produits(produit_id),
  quantite      integer NOT NULL CHECK (quantite > 0),
  prix_unitaire numeric(10,2) NOT NULL,
  PRIMARY KEY (commande_id, ligne)
);
CREATE TABLE paiements (
  paiement_id   integer PRIMARY KEY,
  commande_id   integer NOT NULL REFERENCES commandes(commande_id),
  date_paiement date NOT NULL,
  montant       numeric(10,2) NOT NULL,
  moyen         text NOT NULL CHECK (moyen IN ('carte', 'twint', 'facture'))
);
CREATE TABLE retours (
  retour_id   integer PRIMARY KEY,
  commande_id integer NOT NULL REFERENCES commandes(commande_id),
  produit_id  integer NOT NULL REFERENCES produits(produit_id),
  quantite    integer NOT NULL CHECK (quantite > 0),
  motif       text,
  date_retour date NOT NULL
);
`;

const PRENOMS = ["Léa", "Noah", "Emma", "Luca", "Chloé", "Gabriel", "Zoé", "Liam", "Inès", "Nathan", "Sara", "Elias", "Mia", "Arthur", "Lina", "Samuel", "Alice", "Yanis", "Nora", "Timéo"];
const NOMS = ["Rochat", "Favre", "Bonvin", "Pittet", "Monnier", "Perrin", "Jaquet", "Berset", "Rey", "Dubois", "Mercier", "Cuendet", "Gilliéron", "Sauthier", "Blanc"];
const ENTREPRISES = ["Café du Molard", "Hôtel des Bergues SA", "Atelier Plainpalais", "Bureau Carouge Sàrl", "Coworking Eaux-Vives", "Boulangerie Rive", "Épicerie Jonction", "Restaurant Pâquis"];
const VILLES = ["Genève", "Genève", "Genève", "Lausanne", "Carouge", "Nyon", "Fribourg", "Neuchâtel"];

const PRODUITS: [string, string, number, number][] = [
  ["Espresso Léman 250 g", "Café", 12.9, 5.1],
  ["Moka d'Éthiopie 250 g", "Café", 15.5, 6.8],
  ["Décaféiné doux 250 g", "Café", 13.9, 5.9],
  ["Colombie Huila 500 g", "Café", 24.0, 10.5],
  ["Brésil Santos 1 kg", "Café", 39.0, 18.0],
  ["Capsules espresso x20", "Café", 9.5, 3.2],
  ["Thé vert sencha 100 g", "Thé", 11.0, 4.0],
  ["Earl Grey 100 g", "Thé", 9.9, 3.5],
  ["Rooibos vanille 100 g", "Thé", 10.5, 3.9],
  ["Infusion verveine 50 g", "Thé", 7.5, 2.4],
  ["Moulin manuel", "Accessoires", 59.0, 31.0],
  ["Cafetière à piston 1 L", "Accessoires", 45.0, 22.0],
  ["Tasse en grès", "Accessoires", 18.0, 7.0],
  ["Balance de précision", "Accessoires", 35.0, 17.5],
  ["Filtres papier x100", "Accessoires", 6.0, 1.8],
  ["Bouilloire col de cygne", "Accessoires", 79.0, 41.0],
  ["Coffret découverte", "Coffrets", 49.0, 21.0],
  ["Coffret thés du monde", "Coffrets", 42.0, 18.0],
  ["Abonnement mensuel", "Coffrets", 29.0, 14.0],
  ["Carte cadeau 50 CHF", "Coffrets", 50.0, 50.0],
  ["Chocolat noir 70 %", "Épicerie", 6.5, 2.6],
  ["Biscuits amande", "Épicerie", 5.9, 2.1],
  ["Sirop d'érable", "Épicerie", 14.0, 7.2],
  ["Sucre de canne 500 g", "Épicerie", 4.5, 1.6],
];

const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const pad = (n: number) => String(n).padStart(2, "0");
const day = (start: Date, offset: number) => {
  const d = new Date(start.getTime() + offset * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

export interface PmeData {
  sql: string;
  counts: Record<string, number>;
}

/** Génère le SQL d'insertion. Déterministe : même graine → mêmes données. */
export function generatePme(seed = 42): PmeData {
  const r = mulberry32(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: string[] = [];
  const start = new Date(Date.UTC(2025, 0, 1));

  // Clients : 36 particuliers + 8 entreprises.
  const clients: { id: number; inscription: number }[] = [];
  const rows: string[] = [];
  let id = 1;
  const usedEmails = new Set<string>();
  for (let i = 0; i < 44; i++, id++) {
    const entreprise = i >= 36;
    const nom = entreprise ? ENTREPRISES[i - 36] : `${pick(PRENOMS)} ${pick(NOMS)}`;
    let email: string | null = `${slugify(nom)}@exemple.ch`;
    if (usedEmails.has(email)) email = `${slugify(nom)}${id}@exemple.ch`;
    usedEmails.add(email);
    if (r() < 0.12) email = null;
    const ville = r() < 0.1 ? null : pick(VILLES);
    const inscription = Math.floor(r() * 420);
    clients.push({ id, inscription });
    rows.push(`(${id}, ${q(nom)}, ${q(email)}, ${q(ville)}, ${q(entreprise ? "entreprise" : "particulier")}, ${q(day(start, inscription))})`);
  }
  out.push(`INSERT INTO clients VALUES\n${rows.join(",\n")};`);

  out.push(
    `INSERT INTO produits VALUES\n${PRODUITS.map((p, i) => `(${i + 1}, ${q(p[0])}, ${q(p[1])}, ${p[2].toFixed(2)}, ${p[3].toFixed(2)})`).join(",\n")};`,
  );
  const neverSold = PRODUITS.length; // le dernier produit n'est jamais vendu

  // Commandes : les clients 43 et 44 n'en ont aucune.
  const buyers = clients.filter((c) => c.id <= 42);
  const commandes: string[] = [];
  const lignes: string[] = [];
  const paiements: string[] = [];
  const retours: string[] = [];
  let cid = 1;
  let pid = 1;
  let rid = 1;
  for (let n = 0; n < 280; n++, cid++) {
    const c = pick(buyers);
    const offset = c.inscription + Math.floor(r() * (660 - c.inscription));
    const date = day(start, Math.min(offset, 660));
    const u = r();
    const statut = u < 0.07 ? "annulee" : u < 0.18 ? "expediee" : "livree";
    commandes.push(`(${cid}, ${c.id}, ${q(date)}, ${q(statut)})`);
    const nbLignes = 1 + Math.floor(r() * 4);
    const chosen = new Set<number>();
    let total = 0;
    for (let l = 1; l <= nbLignes; l++) {
      let p = 1 + Math.floor(r() * (PRODUITS.length - 1));
      while (chosen.has(p)) p = 1 + (p % (PRODUITS.length - 1));
      chosen.add(p);
      const qte = 1 + Math.floor(r() * (PRODUITS[p - 1][1] === "Accessoires" ? 2 : 4));
      const promo = r() < 0.15 ? 0.9 : 1;
      const prix = Math.round(PRODUITS[p - 1][2] * promo * 100) / 100;
      total += qte * prix;
      lignes.push(`(${cid}, ${l}, ${p}, ${qte}, ${prix.toFixed(2)})`);
      if (statut === "livree" && r() < 0.06)
        retours.push(
          `(${rid++}, ${cid}, ${p}, 1, ${q(pick(["Produit abîmé", "Erreur de commande", "Ne convient pas", null] as (string | null)[]))}, ${q(day(new Date(date + "T00:00:00Z"), 3 + Math.floor(r() * 20)))})`,
        );
    }
    if (statut !== "annulee") {
      const moyen = pick(["carte", "carte", "twint", "twint", "facture"]);
      // Une partie des factures n'est pas encore payée.
      if (!(moyen === "facture" && r() < 0.4)) paiements.push(`(${pid++}, ${cid}, ${q(day(new Date(date + "T00:00:00Z"), moyen === "facture" ? 10 + Math.floor(r() * 20) : 0))}, ${(Math.round(total * 100) / 100).toFixed(2)}, ${q(moyen)})`);
    }
  }
  void neverSold;
  out.push(`INSERT INTO commandes VALUES\n${commandes.join(",\n")};`);
  out.push(`INSERT INTO lignes_commande VALUES\n${lignes.join(",\n")};`);
  out.push(`INSERT INTO paiements VALUES\n${paiements.join(",\n")};`);
  out.push(`INSERT INTO retours VALUES\n${retours.join(",\n")};`);
  return {
    sql: out.join("\n\n"),
    counts: { clients: 44, produits: PRODUITS.length, commandes: commandes.length, lignes_commande: lignes.length, paiements: paiements.length, retours: retours.length },
  };
}

export const datasetInfo = {
  id: PME_DATASET_ID,
  title: "Torréfaction du Léman (PME fictive)",
  provenance: "Données synthétiques générées de façon déterministe (graine 42). Aucune personne ou entreprise réelle.",
  tables: {
    clients: "Clients particuliers et entreprises. email et ville peuvent être NULL.",
    produits: "Catalogue : prix de vente et coût unitaire (pour la marge).",
    commandes: "Une ligne par commande. statut : livree, expediee ou annulee.",
    lignes_commande: "Détail des commandes : produit, quantité, prix réellement facturé (promotions possibles).",
    paiements: "Paiements reçus. Certaines commandes payées sur facture n'ont pas encore de paiement.",
    retours: "Produits retournés après livraison, avec motif (parfois NULL).",
  } as Record<string, string>,
};

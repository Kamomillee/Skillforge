import { exerciseById } from "./index";
import type { Exercise, PythonExercise, SqlExercise, TestCase } from "./types";

/**
 * Variantes des tests de validation pour la révision espacée : même compétence, autres paramètres.
 * Chaque variante vient d'un MODÈLE relu, avec des paramètres contrôlés (jamais générée par IA) :
 *  - Python : les valeurs attendues sont calculées par une fonction TypeScript, dont tests/content/variants.test.ts
 *    vérifie qu'elle donne exactement le résultat de la solution de référence exécutée par Pyodide ;
 *  - SQL : la requête de référence est paramétrée ; la correction compare toujours au résultat réel de PostgreSQL.
 * La variante 0 est l'exercice d'origine. Les cas limites (liste vide, égalités, données modifiées) sont conservés.
 */

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même variante. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

interface Template<P> {
  exerciseId: string;
  /** Paramètres de la variante `seed` (≥ 1). */
  params: (seed: number) => P;
  /** Résumé lisible des paramètres, affiché à l'étudiant. */
  describe: (p: P) => string;
  apply: (ex: Exercise, p: P) => Exercise;
}

// ---------- Python : somme au-dessus d'un seuil ----------

export interface SeuilParams {
  strict: boolean;
  seuil: number;
  montants: number[];
}

/** Miroir TypeScript de la solution de référence (vérifié contre Pyodide). */
export function sommeAuDessus(montants: number[], seuil: number, strict: boolean) {
  return montants.filter((m) => (strict ? m > seuil : m >= seuil)).reduce((a, b) => a + b, 0);
}

const seuilTemplate: Template<SeuilParams> = {
  exerciseId: "py-boucles-validation",
  params(seed) {
    const r = rng(seed);
    const seuil = pick(r, [20, 25, 40, 60, 75, 100]);
    const montants = Array.from({ length: int(r, 5, 7) }, () => int(r, -50, 150));
    montants[int(r, 0, montants.length - 1)] = seuil; // toujours une valeur égale au seuil : la borne compte
    return { strict: seed % 2 === 0, seuil, montants };
  },
  describe: (p) => `seuil ${p.seuil}, montants ${p.strict ? "strictement supérieurs" : "supérieurs ou égaux"}`,
  apply(base, p) {
    const ex = base as PythonExercise;
    const cmp = p.strict ? ">" : ">=";
    const mot = p.strict ? "**strictement supérieurs**" : "**supérieurs ou égaux**";
    const t = (id: string, label: string, montants: number[], seuil: number, hidden: boolean, misconception?: string): TestCase => {
      const expected = sommeAuDessus(montants, seuil, p.strict);
      return { id, label, args: [montants, seuil], expected, compare: "exact", hidden, ...(misconception ? { misconception } : {}) };
    };
    const egal = [p.seuil, p.seuil, p.seuil + 10];
    const solution = `def somme_au_dessus(montants, seuil):\n    total = 0\n    for m in montants:\n        if m ${cmp} seuil:\n            total += m\n    return total`;
    return {
      ...ex,
      prompt: `Écris \`somme_au_dessus(montants, seuil)\` qui retourne la somme des montants ${mot} à \`seuil\`. Si aucun montant ne remplit la condition, la fonction retourne 0.\n\nExemple de données pour cette variante : \`somme_au_dessus(${JSON.stringify(p.montants)}, ${p.seuil})\`.`,
      referenceSolution: `${solution}\n`,
      tests: [
        t("t1", `Seuil à ${p.seuil}`, p.montants, p.seuil, false),
        t("t2", "Liste vide", [], p.seuil, true, "liste-vide"),
        t("t3", p.strict ? "Valeurs égales au seuil exclues" : "Valeurs égales au seuil incluses", egal, p.seuil, true, "condition-inversee"),
        t("t4", "Seuil négatif", [-5, -3, -1], -3, true),
        { id: "t5", label: "Nombres à virgule", args: [[1.5, 2.5, -0.5], 0], expected: 4.0, compare: "approx", tolerance: 1e-9, hidden: true },
      ],
      hints: [
        ex.hints[0],
        { level: 2, text: `Ajoute un montant seulement si la condition « ${p.strict ? "strictement supérieur" : "supérieur ou égal"} au seuil » est vraie.` },
        { level: 3, text: `\`total = 0\`, une boucle \`for m in montants:\`, un \`if m ${cmp} seuil:\` puis \`return total\` après la boucle.` },
        { level: 4, text: solution },
      ],
    };
  },
};

// ---------- SQL : paiements par moyen ----------

export interface PaiementsParams {
  annee: 2025 | 2026;
  ordre: "DESC" | "ASC";
}

const paiementsTemplate: Template<PaiementsParams> = {
  exerciseId: "sql-agg-validation",
  params: (seed) => ({ annee: seed % 2 ? 2026 : 2025, ordre: Math.floor(seed / 2) % 2 ? "ASC" : "DESC" }),
  describe: (p) => `paiements de ${p.annee}, tri ${p.ordre === "DESC" ? "décroissant" : "croissant"}`,
  apply(base, p) {
    const ex = base as SqlExercise;
    return {
      ...ex,
      prompt: `Pour chaque moyen de paiement, donne le nombre de paiements **effectués en ${p.annee}** et leur montant total, du ${p.ordre === "DESC" ? "plus gros total au plus petit" : "plus petit total au plus gros"}.\n\nColonnes attendues : \`moyen\`, \`nb_paiements\`, \`total\`.`,
      referenceSolution: `SELECT moyen, COUNT(*) AS nb_paiements, SUM(montant) AS total
FROM paiements
WHERE date_paiement >= DATE '${p.annee}-01-01' AND date_paiement < DATE '${p.annee + 1}-01-01'
GROUP BY moyen
ORDER BY total ${p.ordre};`,
      checks: [
        { id: "base", label: "Paiements actuels", hidden: false, misconception: "ordre-tri" },
        {
          id: "inversion",
          label: "Le classement suit les données",
          hidden: true,
          setup: `INSERT INTO paiements VALUES (900, 1, '${p.annee}-06-15', ${p.ordre === "DESC" ? "20000.00" : "-1.00"}, 'facture');`,
          misconception: "valeur-codee-en-dur",
        },
        {
          id: "hors-annee",
          label: `Un paiement hors de ${p.annee} ne compte pas`,
          hidden: true,
          setup: `INSERT INTO paiements VALUES (901, 1, '${p.annee === 2025 ? 2026 : 2025}-06-15', 50000.00, 'twint');`,
        },
      ],
      hints: [
        ex.hints[0],
        { level: 2, text: `Filtre les lignes **avant** de regrouper (WHERE sur \`date_paiement\`), puis regroupe par moyen.` },
        { level: 3, text: `\`WHERE date_paiement >= DATE '${p.annee}-01-01' AND date_paiement < DATE '${p.annee + 1}-01-01'\`, \`GROUP BY moyen\`, \`ORDER BY total ${p.ordre}\`.` },
        { level: 4, text: "" },
      ] as Exercise["hints"],
    };
  },
};

// ---------- SQL : dernières commandes d'un statut ----------

export interface DernieresParams {
  statut: "livree" | "expediee";
  n: number;
}

const dernieresTemplate: Template<DernieresParams> = {
  exerciseId: "sql-select-validation",
  params: (seed) => ({ statut: seed % 2 ? "expediee" : "livree", n: 3 + (seed % 5) }),
  describe: (p) => `${p.n} commandes au statut « ${p.statut} »`,
  apply(base, p) {
    const ex = base as SqlExercise;
    const nom = p.statut === "livree" ? "livrées" : "expédiées (pas encore livrées)";
    return {
      ...ex,
      prompt: `Affiche les **${p.n} commandes ${nom}** les plus récentes (statut \`'${p.statut}'\`). En cas d'égalité de date, la commande au plus grand numéro passe en premier.\n\nColonnes attendues : \`commande_id\`, \`client_id\`, \`date_commande\`.`,
      referenceSolution: `SELECT commande_id, client_id, date_commande
FROM commandes
WHERE statut = '${p.statut}'
ORDER BY date_commande DESC, commande_id DESC
LIMIT ${p.n};`,
      checks: [
        { id: "base", label: "Commandes actuelles", hidden: false, misconception: "ordre-tri" },
        {
          id: "egalite",
          label: "Départage des égalités de date",
          hidden: true,
          setup: `INSERT INTO commandes VALUES (900, 1, '2026-10-30', '${p.statut}'), (901, 2, '2026-10-30', '${p.statut}'), (902, 3, '2026-10-30', 'annulee');`,
          misconception: "statut-annule",
        },
      ],
      hints: [
        ex.hints[0],
        { level: 2, text: "Filtre sur le statut, trie par date décroissante puis par numéro décroissant, et limite le nombre de lignes." },
        { level: 3, text: `\`WHERE statut = '${p.statut}'\`, \`ORDER BY date_commande DESC, commande_id DESC\`, \`LIMIT ${p.n}\`.` },
        { level: 4, text: "" },
      ] as Exercise["hints"],
    };
  },
};

// ---------- BI : part de chaque segment dans sa catégorie ----------

export interface PartParams {
  annee: 2025 | 2026;
}

const partTemplate: Template<PartParams> = {
  exerciseId: "bi-validation-part-segment",
  params: (seed) => ({ annee: seed % 2 ? 2025 : 2026 }),
  describe: (p) => `année ${p.annee}`,
  apply(base, p) {
    const ex = base as SqlExercise;
    const sub = (s: string) => s.replaceAll("2026", String(p.annee)).replaceAll("2027", String(p.annee + 1));
    return { ...ex, prompt: sub(ex.prompt), referenceSolution: sub(ex.referenceSolution), checks: ex.checks.map((c) => ({ ...c, setup: c.setup && sub(c.setup) })), hints: ex.hints.map((h) => ({ ...h, text: sub(h.text) })) as Exercise["hints"] };
  },
};

const templates: Template<never>[] = [seuilTemplate, paiementsTemplate, dernieresTemplate, partTemplate] as unknown as Template<never>[];
const templateById = new Map(templates.map((t) => [t.exerciseId, t]));

export const hasVariants = (exerciseId: string) => templateById.has(exerciseId);
export const variantExerciseIds = () => [...templateById.keys()];

export interface Variant {
  exercise: Exercise;
  seed: number;
  /** Description des paramètres ; vide pour l'exercice d'origine. */
  description: string;
}

/** Variante `seed` d'un test de validation (0 = l'original). Le niveau 4 d'aide est la solution de la variante. */
export function variantFor(exerciseId: string, seed: number): Variant {
  const ex = exerciseById.get(exerciseId)!;
  const t = templateById.get(exerciseId);
  if (!t || seed === 0) return { exercise: ex, seed: 0, description: "" };
  const p = t.params(seed);
  const v = t.apply(ex, p);
  const hints = v.hints.map((h) => (h.level === 4 && !h.text ? { ...h, text: v.referenceSolution.trim() } : h)) as Exercise["hints"];
  return { exercise: { ...v, hints, title: `${ex.title} (variante ${seed})` }, seed, description: t.describe(p) };
}

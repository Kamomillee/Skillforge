/**
 * Pipeline RAG de référence (TypeScript) : découpage, recherche lexicale, contexte, citations, abstention.
 * Chaque fonction a son équivalent Python dans les exercices ; tests/content/llm.test.ts vérifie que les
 * deux donnent les mêmes résultats sur toute la base documentaire. La visualisation utilise ces fonctions.
 *
 * Aucune IA ici : la « réponse » est un extrait recopié (modèle simulé), jamais un texte généré.
 */
import type { DocumentSource } from "../datasets/documents";

export interface Morceau {
  id: string;
  doc: string;
  texte: string;
}

export interface Resultat {
  id: string;
  score: number;
}

/** Réglages communs à la leçon, au projet et à la visualisation. */
export const REGLAGES = { taille: 25, chevauchement: 5, k: 3, seuil: 2, budget: 60 } as const;

/** Découpe en morceaux de `taille` mots, chacun reprenant les `chevauchement` derniers mots du précédent. */
export function decouper(texte: string, taille: number, chevauchement: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [];
  const pas = taille - chevauchement;
  const morceaux: string[] = [];
  for (let i = 0; ; i += pas) {
    morceaux.push(mots.slice(i, i + taille).join(" "));
    if (i + taille >= mots.length) break;
  }
  return morceaux;
}

/** Python : re.findall(r"\w+", texte.lower()), sans mots vides, pluriel simple retiré (s/x final, mots de plus de 3 lettres). */
export function termes(texte: string, motsVides: readonly string[]): string[] {
  const vides = new Set(motsVides);
  return (texte.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])
    .filter((m) => !vides.has(m))
    .map((m) => (m.length > 3 && (m.endsWith("s") || m.endsWith("x")) ? m.slice(0, -1) : m));
}

/** Nombre de termes distincts de la question présents dans le passage. */
export function scoreLexical(question: string, passage: string, motsVides: readonly string[]): number {
  const p = new Set(termes(passage, motsVides));
  return new Set(termes(question, motsVides).filter((t) => p.has(t))).size;
}

/** Termes communs (pour surligner dans la visualisation). */
export function termesCommuns(question: string, passage: string, motsVides: readonly string[]): string[] {
  const p = new Set(termes(passage, motsVides));
  return [...new Set(termes(question, motsVides).filter((t) => p.has(t)))];
}

export function indexer(documents: DocumentSource[], taille: number, chevauchement: number): Morceau[] {
  return documents.flatMap((d) => decouper(d.texte, taille, chevauchement).map((texte, k) => ({ id: `${d.id}#${k}`, doc: d.id, texte })));
}

const parPertinence = (a: Resultat, b: Resultat) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Les k morceaux de score > 0, du plus pertinent au moins pertinent (égalité : id croissant). */
export function rechercher(question: string, index: Morceau[], motsVides: readonly string[], k: number): Resultat[] {
  return index
    .map((m) => ({ id: m.id, score: scoreLexical(question, m.texte, motsVides) }))
    .filter((r) => r.score > 0)
    .sort(parPertinence)
    .slice(0, k);
}

/** Ids des passages placés dans le contexte : par pertinence, score > 0, arrêt au premier qui dépasse le budget de mots. */
export function construireContexte(passages: { id: string; texte: string; score: number }[], budgetMots: number): string[] {
  const tries = passages.filter((p) => p.score > 0).sort(parPertinence);
  const ids: string[] = [];
  let total = 0;
  for (const p of tries) {
    const n = p.texte.split(/\s+/).filter(Boolean).length;
    if (total + n > budgetMots) break;
    ids.push(p.id);
    total += n;
  }
  return ids;
}

/** Citations = passages de score ≥ seuil (2 au plus, par pertinence) ; aucune → abstention. */
export function repondreOuAbstenir(resultats: Resultat[], seuil: number): { abstention: boolean; citations: string[] } {
  const citations = resultats
    .filter((r) => r.score >= seuil)
    .sort(parPertinence)
    .slice(0, 2)
    .map((r) => r.id);
  return { abstention: citations.length === 0, citations };
}

export interface CasEvaluation {
  attendu: string | null;
  cites: string[];
}

/** Tableau d'évaluation : chaque question tombe dans exactement une case. */
export function tableauEvaluation(cas: CasEvaluation[]) {
  const t = { questions: cas.length, citation_correcte: 0, mauvaise_source: 0, silence_a_tort: 0, abstention_correcte: 0, reponse_inventee: 0 };
  for (const c of cas) {
    if (c.attendu === null) {
      if (c.cites.length === 0) t.abstention_correcte++;
      else t.reponse_inventee++;
    } else if (c.cites.length === 0) t.silence_a_tort++;
    else if (c.cites.includes(c.attendu)) t.citation_correcte++;
    else t.mauvaise_source++;
  }
  return t;
}

/** Pipeline complet sur une question (utilisé par la visualisation, le projet et les tests). */
export function pipeline(question: string, documents: DocumentSource[], motsVides: readonly string[], r: { taille: number; chevauchement: number; k: number; seuil: number; budget: number } = REGLAGES) {
  const index = indexer(documents, r.taille, r.chevauchement);
  const resultats = rechercher(question, index, motsVides, r.k);
  const parId = new Map(index.map((m) => [m.id, m]));
  const contexte = construireContexte(
    resultats.map((x) => ({ ...x, texte: parId.get(x.id)!.texte })),
    r.budget,
  );
  const decision = repondreOuAbstenir(
    resultats.filter((x) => contexte.includes(x.id)),
    r.seuil,
  );
  return { index, resultats, contexte, ...decision };
}

/** Documents cités (sans doublon) à partir des ids de morceaux « doc#k ». */
export const docsCites = (citations: string[]) => [...new Set(citations.map((c) => c.split("#")[0]))];

/**
 * MODÈLE SIMULÉ : recopie la phrase du document cité qui partage le plus de termes avec la question.
 * Ne génère rien ; sert seulement à montrer où se placerait la réponse d'un vrai modèle.
 */
export function reponseSimulee(question: string, texteDocument: string, motsVides: readonly string[]): string {
  const phrases = texteDocument.split(/(?<=[.!?])\s+/).filter(Boolean);
  let meilleure = phrases[0] ?? "";
  let max = -1;
  for (const p of phrases) {
    const s = scoreLexical(question, p, motsVides);
    if (s > max) {
      max = s;
      meilleure = p;
    }
  }
  return meilleure;
}

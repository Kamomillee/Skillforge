import { questionById, type Attendu, type InterviewProfile, type InterviewQuestion } from "../content/entretien";
import type { GradeReport } from "../grading/evaluate";

/**
 * Correction d'une session d'entretien, APRÈS la session. Cinq critères, chacun avec ses preuves :
 * - exactitude : mesurée par les tests pour les questions de code ; non mesurable automatiquement pour l'écrit ;
 * - raisonnement : éléments attendus repérés dans la réponse (repères textuels, approximatif) ;
 * - communication : longueur, présence d'un chiffre, phrases (indicateurs simples, pas un jugement) ;
 * - autonomie observée : aucune aide disponible, nombre d'exécutions, temps passé, question laissée vide ;
 * - limites reconnues : formulation d'une limite ou d'une incertitude repérée.
 * Aucun score global n'est calculé.
 */

export interface InterviewAnswer {
  questionId: string;
  text: string;
  runs: number;
  /** Temps passé sur la question (ms). */
  ms: number;
}

export interface CodeGrade {
  status: GradeReport["status"];
  passed: number;
  total: number;
  hiddenPassed: number;
  hiddenTotal: number;
  misconceptions: string[];
}

export interface InterviewSession {
  id: string;
  profile: InterviewProfile;
  startedAt: string;
  finishedAt?: string;
  answers: InterviewAnswer[];
  /** Résultats des tests des questions de code, calculés à la fin. */
  grades?: Record<string, CodeGrade>;
}

/** Minuscules, sans accents, espaces normalisés : « Désequilibré » et « desequilibre » se rejoignent. */
export const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");

/** Phrase de la réponse qui contient le repère (pour citer la réponse dans le retour). */
function extrait(text: string, repere: string): string {
  const phrases = text.split(/(?<=[.!?\n])\s+/);
  const p = phrases.find((x) => normaliser(x).includes(repere)) ?? "";
  return p.length > 160 ? `${p.slice(0, 157)}…` : p.trim();
}

export interface AttenduResult {
  attendu: Attendu;
  trouve: boolean;
  /** La phrase de l'étudiant où le repère a été vu. */
  citation?: string;
}

export function reperer(text: string, attendus: Attendu[]): AttenduResult[] {
  const t = normaliser(text);
  return attendus.map((a) => {
    const r = a.reperes.find((x) => t.includes(normaliser(x)));
    return r ? { attendu: a, trouve: true, citation: extrait(text, normaliser(r)) } : { attendu: a, trouve: false };
  });
}

export const compterMots = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export interface QuestionFeedback {
  question: InterviewQuestion;
  answer: InterviewAnswer;
  exactitude: string;
  raisonnement: AttenduResult[];
  communication: string[];
  autonomie: string[];
  limites: string;
}

const LIMITE_ID = "limite";

export function feedbackFor(q: InterviewQuestion, a: InterviewAnswer, grade?: CodeGrade): QuestionFeedback {
  const vide = !a.text.trim() || (q.kind === "code" && a.text.trim() === q.exercise.starterCode.trim());
  const raisonnement = reperer(a.text, q.attendus.filter((x) => x.id !== LIMITE_ID));
  const limite = q.attendus.find((x) => x.id === LIMITE_ID);
  const lim = limite ? reperer(a.text, [limite])[0] : undefined;

  let exactitude: string;
  if (vide) exactitude = "Pas de réponse.";
  else if (q.kind === "code")
    exactitude = grade
      ? grade.status === "passed"
        ? `Mesurée : tous les tests passent (${grade.passed}/${grade.total}, dont ${grade.hiddenPassed}/${grade.hiddenTotal} cachés).`
        : grade.status === "error"
          ? "Mesurée : le code ne s'exécute pas (erreur)."
          : `Mesurée : ${grade.passed}/${grade.total} tests réussis (dont ${grade.hiddenPassed}/${grade.hiddenTotal} cachés).`
      : "Non mesurée (correction interrompue).";
  else exactitude = "Non mesurable automatiquement pour une réponse écrite : compare avec la réponse modèle et les éléments attendus.";

  const communication: string[] = [];
  if (q.kind === "texte" && !vide) {
    const n = compterMots(a.text);
    const [min, max] = q.mots;
    communication.push(n < min ? `${n} mots : plus court que les ${min} à ${max} visés, l'idée risque de manquer d'appui.` : n > max ? `${n} mots : plus long que les ${min} à ${max} visés, à resserrer.` : `${n} mots : dans la longueur visée (${min} à ${max}).`);
    communication.push(/\d/.test(a.text) ? "Contient au moins un chiffre : la réponse s'appuie sur une mesure." : "Aucun chiffre : un résultat chiffré rend la réponse plus convaincante.");
    const phrases = a.text.split(/[.!?]+/).filter((p) => p.trim()).length;
    if (phrases <= 1 && n > 40) communication.push("Une seule longue phrase : découpe-la pour être suivi à l'oral.");
  }

  const autonomie = ["Session sans indice ni tuteur."];
  if (q.kind === "code") autonomie.push(a.runs ? `${a.runs} exécution${a.runs > 1 ? "s" : ""} pour tester ton code avant de rendre.` : "Aucune exécution avant de rendre : tester soi-même fait partie de ce que l'on observe.");
  autonomie.push(`Temps passé : ${Math.max(1, Math.round(a.ms / 60000))} min.`);

  const limites = !limite
    ? "Pas attendu sur cette question."
    : vide
      ? "Pas de réponse."
      : lim?.trouve
        ? `Repérée : « ${lim.citation} »`
        : "Aucune limite ni incertitude repérée : dire ce qu'on ne sait pas, ou ce qui reste à vérifier, est attendu en entretien.";

  return { question: q, answer: a, exactitude, raisonnement, communication, autonomie, limites };
}

export function sessionFeedback(s: InterviewSession): QuestionFeedback[] {
  return s.answers.map((a) => feedbackFor(questionById.get(a.questionId)!, a, s.grades?.[a.questionId]));
}

/** Résumé par critère, sans note : des comptes et des faits. */
export function sessionSummary(s: InterviewSession) {
  const fb = sessionFeedback(s);
  const code = fb.filter((f) => f.question.kind === "code");
  const texte = fb.filter((f) => f.question.kind === "texte");
  const attendus = fb.flatMap((f) => f.raisonnement);
  const limAttendue = fb.filter((f) => f.question.attendus.some((x) => x.id === LIMITE_ID));
  return {
    exactitude: code.length ? `${code.filter((f) => s.grades?.[f.question.id]?.status === "passed").length}/${code.length} question(s) de code entièrement réussie(s) ; ${texte.length} réponse(s) écrite(s) à relire.` : `${texte.length} réponse(s) écrite(s) à relire avec les réponses modèles.`,
    raisonnement: `${attendus.filter((x) => x.trouve).length}/${attendus.length} éléments attendus repérés dans tes réponses.`,
    communication: `${texte.filter((f) => f.communication.some((c) => c.includes("dans la longueur visée"))).length}/${texte.length} réponse(s) écrite(s) dans la longueur visée.`,
    autonomie: `Sans indice ; ${fb.filter((f) => f.exactitude === "Pas de réponse.").length} question(s) laissée(s) sans réponse.`,
    limites: limAttendue.length ? `${limAttendue.filter((f) => f.limites.startsWith("Repérée")).length}/${limAttendue.length} réponse(s) où une limite était attendue en mentionnent une.` : "Pas attendu dans cette session.",
  };
}

/** Export Markdown de la session et de sa correction. */
export function sessionMarkdown(s: InterviewSession, profileLabel: string): string {
  const out = [`# Entretien blanc — ${profileLabel}`, "", `_Session du ${new Date(s.startedAt).toLocaleString("fr-CH")}, sans indices. Correction générée par SkillForge après la session : repères textuels approximatifs pour l'écrit, tests exécutés pour le code. Aucune note globale._`, ""];
  const sum = sessionSummary(s);
  out.push("## Synthèse", "", `- Exactitude : ${sum.exactitude}`, `- Raisonnement : ${sum.raisonnement}`, `- Communication : ${sum.communication}`, `- Autonomie observée : ${sum.autonomie}`, `- Limites reconnues : ${sum.limites}`, "");
  for (const f of sessionFeedback(s)) {
    out.push(`## ${f.question.question}`, "", f.question.kind === "code" ? `\`\`\`${f.question.exercise.language}\n${f.answer.text.trim()}\n\`\`\`` : f.answer.text.trim() || "_(pas de réponse)_", "");
    out.push(`- Exactitude : ${f.exactitude}`);
    for (const r of f.raisonnement) out.push(`- ${r.trouve ? "✓" : "✗"} ${r.attendu.label}${r.citation ? ` — « ${r.citation} »` : ""}`);
    for (const c of f.communication) out.push(`- Communication : ${c}`);
    out.push(`- Limites : ${f.limites}`, "", "**Réponse modèle**", "", f.question.kind === "code" ? `\`\`\`${f.question.exercise.language}\n${f.question.reponseModele.trim()}\n\`\`\`` : f.question.reponseModele, "");
  }
  return out.join("\n");
}

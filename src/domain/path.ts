import type { DomainId } from "../content/types";
import type { Goal, LearningPath, Level, Profile } from "../storage/store";

const ORDER_BY_GOAL: Record<Goal, DomainId[]> = {
  data: ["python", "sql", "bi", "ml", "llm"],
  ia: ["python", "llm", "sql", "ml", "bi"],
  bi: ["sql", "bi", "python", "ml", "llm"],
  automatisation: ["python", "sql", "llm", "bi", "ml"],
  exploration: ["python", "sql", "bi", "ml", "llm"],
};

export const goalLabel: Record<Goal, string> = {
  data: "Stage data analyst",
  ia: "Stage développement IA",
  bi: "Stage BI",
  automatisation: "Stage automatisation",
  exploration: "Exploration",
};

export const levelLabel: Record<Level, string> = {
  aucun: "Aucune pratique",
  debutant: "Débutant",
  intermediaire: "À l'aise sur les bases",
  avance: "Avancé",
};

/** Parcours recommandé : déterministe, justifié, et modifiable par l'étudiant ensuite. */
export function recommendPath(p: Profile, now = new Date()): LearningPath {
  const domainOrder = [...ORDER_BY_GOAL[p.goal]];
  const reasons = [`Ordre des domaines adapté à l'objectif « ${goalLabel[p.goal]} ».`];
  if (domainOrder[0] !== "python" && (p.levels.python === "aucun" || p.programmingLevel === "aucun")) {
    domainOrder.splice(domainOrder.indexOf("python"), 1);
    domainOrder.splice(1, 0, "python");
    reasons.push("Python est avancé en 2ᵉ position : il sert aux projets de tous les domaines.");
  }
  const hiddenModules: string[] = [];
  if (p.levels.python === "intermediaire" || p.levels.python === "avance")
    reasons.push("Tu te dis à l'aise en Python : chaque leçon des fondations propose un test de validation pour la passer si tu réussis.");
  if (p.levels.sql === "aucun" && domainOrder[0] === "sql") reasons.push("SQL commence par le modèle relationnel, sans prérequis.");
  if (p.hoursPerWeek <= 2) reasons.push("Avec peu de temps par semaine, privilégie des séances courtes : une section de leçon par séance.");
  if (p.targetDate) {
    const weeks = Math.max(0, Math.round((new Date(p.targetDate).getTime() - now.getTime()) / (7 * 86_400_000)));
    reasons.push(`Date cible dans environ ${weeks} semaine(s) : à ${p.hoursPerWeek} h/semaine, cela représente environ ${weeks * p.hoursPerWeek} h de pratique au total.`);
  }
  return { domainOrder, hiddenModules, reasons, updatedAt: now.toISOString() };
}

import type { Exercise, Lesson } from "../content/types";
import type { Attempt, LearningEvent, Review } from "../storage/store";

/**
 * Estimation de maîtrise EXPLICABLE. « Leçon consultée » ≠ « compétence maîtrisée » :
 * seuls des exercices réussis (tests déterministes) font passer au niveau « démontré ».
 */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export const masteryLabel: Record<MasteryLevel, string> = {
  0: "Pas commencé",
  1: "Découvert",
  2: "En pratique",
  3: "Démontré",
  4: "Consolidé",
};

export interface Evidence {
  kind: "exercice-autonome" | "exercice-guide" | "debogage" | "validation" | "prediction" | "explication" | "revision" | "activite";
  label: string;
  at: string;
  /** Preuve vérifiée par tests ou auto-déclarée. */
  verified: boolean;
}

export interface MasteryEstimate {
  level: MasteryLevel;
  reasons: string[];
  evidence: Evidence[];
}

/** Réussite « propre » : tous les tests passent ET la solution n'avait pas été affichée. */
export const isCleanPass = (a: Attempt) => a.status === "passed" && !a.solutionViewed;

export function estimateMastery(
  conceptId: string,
  ctx: { lessons: Lesson[]; exercises: Exercise[]; attempts: Attempt[]; events: LearningEvent[]; review?: Review },
): MasteryEstimate {
  const exs = ctx.exercises.filter((e) => e.conceptIds.includes(conceptId));
  const exIds = new Set(exs.map((e) => e.id));
  const kindOf = new Map(exs.map((e) => [e.id, e.kind]));
  const lessonIds = new Set(ctx.lessons.filter((l) => l.conceptIds.includes(conceptId)).map((l) => l.id));
  const attempts = ctx.attempts.filter((a) => exIds.has(a.exerciseId));
  const opened = ctx.events.some((e) => e.type === "lesson-open" && e.lessonId && lessonIds.has(e.lessonId));

  const evidence: Evidence[] = [];
  const firstClean = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => x.at.localeCompare(y.at))) if (isCleanPass(a) && !firstClean.has(a.exerciseId)) firstClean.set(a.exerciseId, a);
  for (const [id, a] of firstClean) {
    const kind = kindOf.get(id);
    const title = exs.find((e) => e.id === id)?.title ?? id;
    const withHint = a.hintLevel >= 3 ? " (avec aide ciblée)" : "";
    evidence.push({
      kind: kind === "autonomous" || kind === "project" ? "exercice-autonome" : kind === "debug" ? "debogage" : kind === "validation" ? "validation" : "exercice-guide",
      label: `« ${title} » réussi : ${a.passedCount}/${a.total} tests, dont ${a.hiddenPassed}/${a.hiddenTotal} cachés${withHint}`,
      at: a.at,
      verified: true,
    });
  }
  for (const e of ctx.events) {
    if (e.type === "prediction" && e.lessonId && lessonIds.has(e.lessonId) && e.data?.correct)
      evidence.push({ kind: "prediction", label: "Prédiction correcte du résultat d'un programme", at: e.at, verified: true });
    if (e.type === "activity" && e.lessonId && lessonIds.has(e.lessonId) && e.data?.correct && e.data?.first)
      evidence.push({ kind: "activite", label: `${e.data?.label ?? "Activité"} réussie${Number(e.data?.attempt) > 1 ? ` au ${e.data?.attempt}e essai` : " du premier coup"}`, at: e.at, verified: true });
    if (e.type === "explain" && e.lessonId && lessonIds.has(e.lessonId))
      evidence.push({ kind: "explication", label: `Explication rédigée (auto-évaluée : ${e.data?.checked ?? 0} critères)`, at: e.at, verified: false });
  }
  for (const h of ctx.review?.history ?? []) if (h.ok) evidence.push({ kind: "revision", label: "Révision réussie après un délai", at: h.at, verified: true });

  const reasons: string[] = [];
  // Preuve autonome : exercice autonome, test de validation ou étape de projet. Si la notion n'a aucun de ces
  // exercices (par exemple une notion travaillée uniquement par un débogage), le débogage réussi en tient lieu.
  const autonomousKinds = new Set<string>(["autonomous", "validation", "project"]);
  const hasAutonomous = exs.some((e) => autonomousKinds.has(e.kind));
  if (!hasAutonomous) autonomousKinds.add("debug");
  const autonomous = [...firstClean.values()].filter((a) => autonomousKinds.has(kindOf.get(a.exerciseId) ?? "") && a.hintLevel < 3);
  const debugOk = [...firstClean.keys()].some((id) => kindOf.get(id) === "debug");
  const reviewOk = (ctx.review?.history ?? []).some((h) => h.ok);

  let level: MasteryLevel = 0;
  if (opened) {
    level = 1;
    reasons.push("Leçon ouverte — cela ne prouve pas encore la maîtrise.");
  }
  if (attempts.length) {
    level = 2;
    reasons.push(`${attempts.length} tentative(s) sur les exercices de cette notion.`);
  }
  if (autonomous.length) {
    level = 3;
    reasons.push(
      hasAutonomous
        ? "Exercice autonome, test de validation ou étape de projet réussi (tests cachés compris), sans solution affichée ni aide ciblée."
        : "Débogage réussi (seul exercice de cette notion), cas cachés compris, sans solution affichée ni aide ciblée.",
    );
  } else if (attempts.length) {
    reasons.push(`Pour atteindre « Démontré » : réussir ${hasAutonomous ? "l'exercice autonome" : "le débogage"} sans afficher la solution ni l'aide ciblée.`);
  }
  if (level === 3) {
    if (!hasAutonomous && reviewOk) {
      level = 4;
      reasons.push("Révision réussie après un délai.");
    } else if (!hasAutonomous) {
      reasons.push("Pour atteindre « Consolidé » : réussir une révision espacée.");
    } else if (debugOk && reviewOk) {
      level = 4;
      reasons.push("Débogage réussi et révision réussie après un délai.");
    } else {
      const missing = [!debugOk && "réussir le débogage", !reviewOk && "réussir une révision espacée"].filter(Boolean).join(" et ");
      reasons.push(`Pour atteindre « Consolidé » : ${missing}.`);
    }
  }
  evidence.sort((a, b) => b.at.localeCompare(a.at));
  return { level, reasons, evidence };
}

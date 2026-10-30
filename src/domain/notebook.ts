import { exerciseById, misconceptionLabels } from "../content";
import { misconceptionGuides, type MisconceptionGuide } from "../content/guides";
import type { Attempt } from "../storage/store";
import { practiceFor, type PracticeLink } from "./tutor";

export interface NotebookOccurrence {
  exerciseId: string;
  title: string;
  at: string;
  version: number;
  /** Une tentative réussie a suivi sur le même exercice. */
  resolved: boolean;
}

export interface NotebookEntry {
  id: string;
  label: string;
  guide?: MisconceptionGuide;
  count: number;
  lastAt: string;
  occurrences: NotebookOccurrence[];
  /** Tous les exercices concernés ont été réussis après l'erreur. */
  resolved: boolean;
  practice: PracticeLink[];
}

/**
 * Carnet d'erreurs : uniquement des erreurs observées dans les tentatives (étiquettes posées par les tests
 * échoués). Une erreur est « surmontée » quand chaque exercice où elle est apparue a été réussi ensuite.
 */
export function errorNotebook(attempts: Attempt[]): NotebookEntry[] {
  const byId = new Map<string, Attempt[]>();
  for (const a of attempts) for (const m of a.misconceptions) byId.set(m, [...(byId.get(m) ?? []), a]);
  const entries: NotebookEntry[] = [];
  for (const [id, list] of byId) {
    const lastPerExercise = new Map<string, Attempt>();
    for (const a of list) {
      const prev = lastPerExercise.get(a.exerciseId);
      if (!prev || a.at > prev.at) lastPerExercise.set(a.exerciseId, a);
    }
    const occurrences = [...lastPerExercise.values()].map((a) => {
      const baseId = a.exerciseId.replace(/#revision$/, "");
      return {
        exerciseId: baseId,
        title: exerciseById.get(baseId)?.title ?? baseId,
        at: a.at,
        version: a.exerciseVersion,
        resolved: attempts.some((b) => b.exerciseId === a.exerciseId && b.status === "passed" && b.at > a.at),
      };
    });
    entries.push({
      id,
      label: misconceptionLabels[id] ?? id,
      guide: misconceptionGuides[id],
      count: list.length,
      lastAt: list.map((a) => a.at).sort().at(-1)!,
      occurrences: occurrences.sort((a, b) => b.at.localeCompare(a.at)),
      resolved: occurrences.every((o) => o.resolved),
      practice: practiceFor(id, attempts),
    });
  }
  // Non surmontées d'abord, puis les plus fréquentes.
  return entries.sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

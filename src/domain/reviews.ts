import type { Review } from "../storage/store";

/** Intervalles de révision espacée, en jours. Simples et explicables plutôt qu'optimaux. */
export const INTERVALS = [1, 3, 7, 16, 35];

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Planifie la première révision après une réussite démontrée (ne replanifie pas si déjà prévue). */
export function scheduleAfterSuccess(conceptId: string, existing: Review | undefined, now = new Date(), reason: string): Review {
  if (existing) return existing;
  return { conceptId, step: 0, dueAt: addDays(now, INTERVALS[0]).toISOString(), reason, history: [] };
}

/** Enregistre le résultat d'une révision : réussite → intervalle suivant ; échec → retour à 1 jour. */
export function recordReview(r: Review, ok: boolean, now = new Date()): Review {
  const step = ok ? Math.min(r.step + 1, INTERVALS.length - 1) : 0;
  return {
    ...r,
    step,
    dueAt: addDays(now, INTERVALS[step]).toISOString(),
    reason: ok ? `Révision réussie : prochaine dans ${INTERVALS[step]} jours.` : "Révision manquée : on revoit la notion demain.",
    history: [...r.history, { at: now.toISOString(), ok }],
  };
}

export const isDue = (r: Review, now = new Date()) => new Date(r.dueAt) <= now;

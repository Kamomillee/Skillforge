/** Calculs purs de la visualisation du seuil ; comparés à scikit-learn dans tests/content/ml.test.ts. */
/** `cout` = départs ratés × coutFn + offres envoyées (VP + FP) × coutFp, comme `rapport_seuil` dans le projet. */
export function confusionAt(y: number[], scores: number[], seuil: number, coutFn = 0, coutFp = 0) {
  let vp = 0,
    fp = 0,
    fn = 0,
    vn = 0;
  y.forEach((v, i) => {
    const pred = scores[i] >= seuil ? 1 : 0;
    if (pred && v) vp++;
    else if (pred) fp++;
    else if (v) fn++;
    else vn++;
  });
  const precision = vp + fp ? vp / (vp + fp) : 0;
  const rappel = vp + fn ? vp / (vp + fn) : 0;
  const f1 = precision + rappel ? (2 * precision * rappel) / (precision + rappel) : 0;
  return { vp, fp, fn, vn, precision, rappel, f1, exactitude: y.length ? (vp + vn) / y.length : 0, cout: fn * coutFn + (vp + fp) * coutFp, contactes: vp + fp };
}

/** Seuils parcourus par l'animation : de 0,95 à 0,05 par pas de 0,05. */
export const SWEEP = Array.from({ length: 19 }, (_, k) => Math.round((0.95 - k * 0.05) * 100) / 100);

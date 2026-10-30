/** Normalisation des réponses courtes (code à compléter) : casse, espaces et espaces autour de la ponctuation. */
export const normalizeAnswer = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([(),*.])\s*/g, "$1")
    .toLowerCase();

export function blankIsCorrect(accept: string[], given: string) {
  return accept.some((a) => normalizeAnswer(a) === normalizeAnswer(given));
}

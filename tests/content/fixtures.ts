import { exerciseById as map, exercises as all, lessonById } from "../../src/content";
import type { PythonExercise } from "../../src/content/types";

export const exercises = all.filter((e): e is PythonExercise => e.language === "python");
export const lessonBoucles = lessonById.get("py-boucles-accumulateurs")!;
export function exerciseById(id: string): PythonExercise {
  const e = map.get(id);
  if (!e || e.language !== "python") throw new Error(`exercice Python inconnu : ${id}`);
  return e;
}

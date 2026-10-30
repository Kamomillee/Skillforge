import { exerciseSchema, type Exercise, type Lesson } from "./types";
import { exercisesBoucles, lessonBoucles } from "./python/boucles";

export * from "./types";
export { curriculum, domainById, allNotions, moduleById, coverageStats } from "./curriculum";

export const lessons: Lesson[] = [lessonBoucles];
export const exercises: Exercise[] = [...exercisesBoucles].map((e) => exerciseSchema.parse(e));

export const lessonById = new Map(lessons.map((l) => [l.id, l]));
export const exerciseById = new Map(exercises.map((e) => [e.id, e]));

export function lessonForExercise(exerciseId: string): Lesson | undefined {
  return lessons.find((l) =>
    l.validationExerciseId === exerciseId ||
    l.sections.some((s) => s.blocks.some((b) => b.type === "exercise" && b.exerciseId === exerciseId)),
  );
}

export function sectionForExercise(lesson: Lesson, exerciseId: string) {
  return lesson.sections.find((s) => s.blocks.some((b) => b.type === "exercise" && b.exerciseId === exerciseId));
}

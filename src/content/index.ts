import { pythonExerciseSchema, sqlExerciseSchema, type Exercise, type Lesson, type Project, type SqlExercise } from "./types";
import { exercisesBoucles, lessonBoucles } from "./python/boucles";
import { exercisesSelect, lessonSelect } from "./sql/requetes";
import { exercisesAgregations, lessonAgregations } from "./sql/agregations";
import { exercisesJointures, lessonJointures } from "./sql/jointures";
import { exercisesProjetPme, projetPme } from "./sql/projet-pme";

export * from "./types";
export { curriculum, domainById, allNotions, moduleById, coverageStats } from "./curriculum";

export const lessons: Lesson[] = [lessonBoucles, lessonSelect, lessonAgregations, lessonJointures];
export const projects: Project[] = [projetPme];
export const exercises: Exercise[] = [
  ...exercisesBoucles.map((e) => pythonExerciseSchema.parse(e)),
  ...[...exercisesSelect, ...exercisesAgregations, ...exercisesJointures, ...exercisesProjetPme].map((e) => sqlExerciseSchema.parse(e)),
];

export const lessonById = new Map(lessons.map((l) => [l.id, l]));
export const projectById = new Map(projects.map((p) => [p.id, p]));
export const exerciseById = new Map(exercises.map((e) => [e.id, e]));
export const sqlExercises = exercises.filter((e): e is SqlExercise => e.language === "sql");

export function lessonForExercise(exerciseId: string): Lesson | undefined {
  return lessons.find(
    (l) => l.validationExerciseId === exerciseId || l.sections.some((s) => s.blocks.some((b) => b.type === "exercise" && b.exerciseId === exerciseId)),
  );
}

export function sectionForExercise(lesson: Lesson, exerciseId: string) {
  return lesson.sections.find((s) => s.blocks.some((b) => b.type === "exercise" && b.exerciseId === exerciseId));
}

export function projectForExercise(exerciseId: string) {
  return projects.find((p) => p.steps.some((s) => s.exerciseId === exerciseId));
}

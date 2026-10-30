import { misconceptionLabels, type Exercise, type Lesson } from "../content/types";
import type { Attempt, Draft, LearningPath, Review, ResumePoint } from "../storage/store";
import { isCleanPass } from "./mastery";
import { isDue } from "./reviews";

export interface Recommendation {
  kind: "review" | "resume-exercise" | "lesson" | "next-exercise" | "none";
  title: string;
  /** Raison affichée à l'étudiant : une recommandation n'est jamais sans justification. */
  reason: string;
  href: string;
}

export interface FrequentError {
  id: string;
  label: string;
  count: number;
  exercises: string[];
}

/** Erreurs fréquentes, issues des tests échoués (pas d'invention). */
export function frequentErrors(attempts: Attempt[], exercises: Exercise[]): FrequentError[] {
  const map = new Map<string, FrequentError>();
  for (const a of attempts) {
    for (const m of a.misconceptions) {
      const e = map.get(m) ?? { id: m, label: misconceptionLabels[m] ?? m, count: 0, exercises: [] };
      e.count++;
      const title = exercises.find((x) => x.id === a.exerciseId)?.title ?? a.exerciseId;
      if (!e.exercises.includes(title)) e.exercises.push(title);
      map.set(m, e);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const lessonHref = (lessonId: string, sectionId?: string, exerciseId?: string) =>
  `#/lecon/${lessonId}${sectionId ? `/${sectionId}` : ""}${exerciseId ? `?ex=${exerciseId}` : ""}`;

export function recommendNext(ctx: {
  path?: LearningPath;
  lessons: Lesson[];
  exercises: Exercise[];
  attempts: Attempt[];
  drafts: Draft[];
  reviews: Review[];
  resume?: ResumePoint;
  now?: Date;
}): Recommendation {
  const now = ctx.now ?? new Date();
  const due = ctx.reviews.filter((r) => isDue(r, now)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (due) {
    const lesson = ctx.lessons.find((l) => l.conceptIds.includes(due.conceptId));
    if (lesson?.validationExerciseId)
      return {
        kind: "review",
        title: `Révision : ${lesson.title}`,
        reason: `Révision espacée prévue depuis le ${new Date(due.dueAt).toLocaleDateString("fr-CH")}. ${due.reason}`,
        href: `#/revision/${encodeURIComponent(due.conceptId)}`,
      };
  }

  const passed = new Set(ctx.attempts.filter(isCleanPass).map((a) => a.exerciseId));
  const ordered = orderedLessons(ctx.lessons, ctx.path);

  // Un exercice commencé, échoué récemment : y revenir, avec la raison précise.
  for (const lesson of ordered) {
    for (const s of lesson.sections)
      for (const b of s.blocks) {
        if (b.type !== "exercise" || passed.has(b.exerciseId)) continue;
        const atts = ctx.attempts.filter((a) => a.exerciseId === b.exerciseId);
        const ex = ctx.exercises.find((e) => e.id === b.exerciseId);
        if (!ex) continue;
        if (atts.length) {
          const counts = new Map<string, number>();
          atts.forEach((a) => a.misconceptions.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1)));
          const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
          const why = top
            ? `proposé car « ${misconceptionLabels[top[0]] ?? top[0]} » est apparu dans ${top[1]} tentative(s).`
            : `${atts.length} tentative(s) sans réussite complète pour l'instant.`;
          return { kind: "resume-exercise", title: `Reprendre : ${ex.title}`, reason: `Exercice en cours — ${why}`, href: lessonHref(lesson.id, s.id, ex.id) };
        }
        if (ctx.drafts.some((d) => d.exerciseId === b.exerciseId))
          return { kind: "resume-exercise", title: `Reprendre : ${ex.title}`, reason: "Tu as un brouillon enregistré sur cet exercice.", href: lessonHref(lesson.id, s.id, ex.id) };
        if (passed.size > 0 || ctx.attempts.length > 0)
          return { kind: "next-exercise", title: ex.title, reason: "Prochain exercice non réussi de ta leçon en cours.", href: lessonHref(lesson.id, s.id, ex.id) };
      }
  }

  const next = ordered.find((l) => l.sections.some((s) => s.blocks.some((b) => b.type === "exercise" && !passed.has(b.exerciseId))));
  if (next) {
    const started = ctx.resume?.lessonId === next.id;
    return {
      kind: "lesson",
      title: next.title,
      reason: started ? "Leçon commencée, pas encore terminée." : "Première leçon disponible de ton parcours.",
      href: lessonHref(next.id, started ? ctx.resume?.sectionId : undefined),
    };
  }
  return { kind: "none", title: "Tout le contenu disponible est réussi", reason: "De nouveaux modules arrivent dans les prochaines étapes.", href: "#/programme" };
}

export function orderedLessons(lessons: Lesson[], path?: LearningPath) {
  const order = path?.domainOrder ?? ["python", "sql", "llm", "bi", "ml"];
  return [...lessons].filter((l) => !path?.hiddenModules.includes(l.moduleId)).sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain));
}

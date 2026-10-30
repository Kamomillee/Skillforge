/**
 * Inventaire des contenus pour l'administration : ce qui existe, en quelle version, avec quels tests,
 * et les contrôles de qualité automatiques. Les contenus eux-mêmes se modifient dans le code
 * (src/content), relus et validés par les tests de contenu : l'inventaire dit quoi corriger, pas comment.
 */
import { exercises, lessons, misconceptionLabels, projects, type Exercise } from "../content";
import { exerciseHref } from "./tutor";

export interface InventoryRow {
  id: string;
  title: string;
  language: Exercise["language"];
  kind: Exercise["kind"];
  version: number;
  visibleTests: number;
  hiddenTests: number;
  where: string;
  href?: string;
  issues: string[];
}

export function contentInventory(): InventoryRow[] {
  return exercises.map((e) => {
    const tests = e.language === "python" ? e.tests.map((t) => ({ hidden: t.hidden, misconception: t.misconception })) : e.checks.map((c) => ({ hidden: c.hidden, misconception: c.misconception }));
    const lesson = lessons.find((l) => l.sections.some((s) => s.blocks.some((b) => "exerciseId" in b && b.exerciseId === e.id)) || l.validationExerciseId === e.id);
    const project = projects.find((p) => p.steps.some((s) => s.exerciseId === e.id));
    const href = exerciseHref(e.id);
    const issues: string[] = [];
    if (!e.referenceSolution.trim()) issues.push("solution de référence vide");
    if (!tests.some((t) => !t.hidden)) issues.push("aucun test visible");
    if (!tests.some((t) => t.hidden)) issues.push("aucun test caché");
    for (const t of tests) if (t.misconception && !(t.misconception in misconceptionLabels)) issues.push(`erreur fréquente inconnue : ${t.misconception}`);
    if (e.hints.length !== 4) issues.push("aide progressive incomplète");
    if (!href) issues.push("exercice inaccessible (ni leçon ni projet)");
    return {
      id: e.id,
      title: e.title,
      language: e.language,
      kind: e.kind,
      version: e.version,
      visibleTests: tests.filter((t) => !t.hidden).length,
      hiddenTests: tests.filter((t) => t.hidden).length,
      where: lesson ? `Leçon « ${lesson.title} » (v${lesson.version})` : project ? `Projet « ${project.title} » (v${project.version})` : "—",
      href,
      issues,
    };
  });
}

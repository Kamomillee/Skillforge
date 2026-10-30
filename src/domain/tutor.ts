import { exercises as allExercises, lessonForExercise, misconceptionLabels, projectForExercise, sectionForExercise, type Exercise, type Lesson } from "../content";
import { fiches, misconceptionGuides } from "../content/guides";
import { hasVariants } from "../content/variants";
import type { GradeReport } from "../grading/evaluate";
import { explainError, type PyErrorInfo } from "../grading/errors";
import type { Attempt } from "../storage/store";
import { isCleanPass } from "./mastery";
import { lessonHref } from "./recommend";

/**
 * Tuteur LOCAL : n'invente rien. Il assemble du contenu rédigé (fiches, guides d'erreurs, indices)
 * avec le contexte réel (code, résultats des tests, tentatives, indices vus, erreurs récurrentes).
 * Il ne révèle jamais la solution : seul le niveau d'aide 4, demandé et confirmé, l'affiche.
 */

export type TutorMode = "expliquer" | "exemple" | "indice" | "deboguer" | "question" | "pratiquer" | "entretien";

export const tutorModes: { id: TutorMode; label: string }[] = [
  { id: "expliquer", label: "Explique simplement" },
  { id: "exemple", label: "Montre un exemple" },
  { id: "indice", label: "Donne un indice" },
  { id: "deboguer", label: "Aide-moi à déboguer" },
  { id: "question", label: "Pose-moi une question" },
  { id: "pratiquer", label: "Fais-moi pratiquer à nouveau" },
  { id: "entretien", label: "Prépare-moi à l'entretien" },
];

export type RunError = { kind: "python"; error: PyErrorInfo } | { kind: "sql"; message: string; code?: string; line?: number };

export interface TutorContext {
  exercise: Exercise;
  lesson?: Lesson;
  code: string;
  /** Dernière vérification de cette session (résultats testés). */
  report?: GradeReport;
  /** Dernière exécution en erreur. */
  runError?: RunError;
  /** Tentatives sur cet exercice. */
  attempts: Attempt[];
  /** Toutes les tentatives (erreurs récurrentes, exercices à pratiquer). */
  allAttempts: Attempt[];
  hintLevel: number;
  /** Compteur pour faire tourner les questions d'une demande à l'autre. */
  turn: number;
}

export interface PracticeLink {
  title: string;
  href: string;
  reason: string;
}

export interface TutorReply {
  mode: TutorMode;
  title: string;
  md: string;
  code?: { language: "python" | "sql"; text: string; caption?: string }[];
  quiz?: { question: string; reponse: string };
  checklist?: string[];
  links?: PracticeLink[];
  /** Ce sur quoi la réponse s'appuie (transparence). */
  basis: string[];
}

export function contextSummary(ctx: TutorContext): string[] {
  const out: string[] = [];
  if (ctx.lesson) out.push(`Leçon : ${ctx.lesson.title}`);
  out.push(`Exercice : ${ctx.exercise.title} (v${ctx.exercise.version})`);
  const lines = ctx.code.trim() ? ctx.code.trim().split("\n").length : 0;
  out.push(`Ton code : ${lines} ligne(s)`);
  if (ctx.report) out.push(`Dernière vérification : ${ctx.report.passedCount}/${ctx.report.total} (dont ${ctx.report.hiddenPassed}/${ctx.report.hiddenTotal} cachées)`);
  else if (ctx.runError) out.push("Dernière exécution : erreur");
  else out.push("Pas encore de vérification dans cette session");
  out.push(`Tentatives sur cet exercice : ${ctx.attempts.length}`);
  out.push(`Aide déjà vue : ${ctx.hintLevel === 0 ? "aucune" : `niveau ${ctx.hintLevel}/4`}`);
  const rec = recurringErrors(ctx.allAttempts).slice(0, 2);
  out.push(rec.length ? `Erreurs récurrentes : ${rec.map((r) => `${r.label} (${r.count}×)`).join(", ")}` : "Aucune erreur récurrente");
  return out;
}

/** Erreurs vues dans au moins deux tentatives, de la plus fréquente à la moins fréquente. */
export function recurringErrors(attempts: Attempt[]) {
  const counts = new Map<string, number>();
  for (const a of attempts) for (const m of a.misconceptions) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count, label: misconceptionLabels[id] ?? id }));
}

/** Étiquettes d'erreur qu'un exercice sait détecter (tests Python ou vérifications SQL). */
export function exerciseMisconceptions(ex: Exercise): string[] {
  const tags = ex.language === "sql" ? ex.checks.map((c) => c.misconception) : ex.tests.map((t) => t.misconception);
  return [...new Set(tags.filter((t): t is string => !!t))];
}

export function exerciseHref(exerciseId: string): string | undefined {
  const lesson = lessonForExercise(exerciseId);
  if (lesson) return lessonHref(lesson.id, sectionForExercise(lesson, exerciseId)?.id ?? (lesson.validationExerciseId === exerciseId ? "revision" : undefined), exerciseId);
  const project = projectForExercise(exerciseId);
  const step = project?.steps.find((s) => s.exerciseId === exerciseId);
  return project && step ? `#/projet/${project.id}/${step.id}` : undefined;
}

/**
 * Exercices qui travaillent une erreur donnée, non encore réussis proprement, hors exercice courant.
 * La raison cite les faits observés (« proposé car … dans 2 exercices »).
 */
export function practiceFor(misconception: string, attempts: Attempt[], excludeId?: string): PracticeLink[] {
  const label = misconceptionLabels[misconception] ?? misconception;
  const seenIn = new Set(attempts.filter((a) => a.misconceptions.includes(misconception)).map((a) => a.exerciseId.replace(/#revision$/, "")));
  const clean = new Set(attempts.filter(isCleanPass).map((a) => a.exerciseId));
  const why = `proposé car « ${label} » est apparu dans ${seenIn.size} exercice${seenIn.size > 1 ? "s" : ""}`;
  return allExercises
    .filter((e) => e.id !== excludeId && exerciseMisconceptions(e).includes(misconception) && !clean.has(e.id))
    .map((e) => ({ e, href: exerciseHref(e.id) }))
    .filter((x): x is { e: Exercise; href: string } => !!x.href)
    .sort((a, b) => Number(seenIn.has(a.e.id)) - Number(seenIn.has(b.e.id)))
    .slice(0, 3)
    .map(({ e, href }) => ({ title: e.title, href, reason: seenIn.has(e.id) ? `${why} ; tu l'avais rencontrée ici.` : `${why} ; cet exercice la vérifie.` }));
}

/** Erreur la plus pertinente : celle du dernier rapport, sinon la plus fréquente sur cet exercice, sinon globalement. */
function focusMisconception(ctx: TutorContext): string | undefined {
  const fromReport = ctx.report?.misconceptions[0];
  if (fromReport) return fromReport;
  const counts = new Map<string, number>();
  for (const a of ctx.attempts) for (const m of a.misconceptions) counts.set(m, (counts.get(m) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ?? recurringErrors(ctx.allAttempts)[0]?.id;
}

const ficheOf = (ctx: TutorContext) => (ctx.lesson ? fiches[ctx.lesson.id] : undefined) ?? fiches[lessonForExercise(ctx.exercise.id)?.id ?? ""];

export function localTutor(mode: TutorMode, ctx: TutorContext): TutorReply {
  const fiche = ficheOf(ctx);
  const focus = focusMisconception(ctx);
  const guide = focus ? misconceptionGuides[focus] : undefined;
  const basis = contextSummary(ctx);

  switch (mode) {
    case "expliquer": {
      const parts = [fiche?.resume ?? "Cette notion n'a pas encore de fiche."];
      if (fiche) parts.push("", "À retenir :", ...fiche.pointsCles.map((p) => `- ${p}`));
      if (guide && focus) parts.push("", `**Ce qui coince peut-être ici — ${misconceptionLabels[focus] ?? focus}.** ${guide.explication}`);
      return { mode, title: "Explication simple", md: parts.join("\n"), basis };
    }
    case "exemple": {
      const code: TutorReply["code"] = [];
      if (fiche) code.push({ language: fiche.exemple.language, text: fiche.exemple.code, caption: fiche.exemple.explication });
      if (guide?.exemple) {
        code.push({ language: guide.exemple.language, text: guide.exemple.faux, caption: `À éviter (${misconceptionLabels[focus!] ?? focus})` });
        code.push({ language: guide.exemple.language, text: guide.exemple.juste, caption: "Version correcte" });
      }
      return {
        mode,
        title: "Un exemple, hors de l'exercice",
        md: code.length ? "Un exemple sur d'autres données : à toi de transposer, rien ici n'est la solution de l'exercice." : "Pas d'exemple rédigé pour cette notion.",
        code,
        basis,
      };
    }
    case "indice": {
      const next = Math.min(ctx.hintLevel + 1, 4);
      const h = ctx.exercise.hints.find((x) => x.level === Math.min(next, 3));
      return {
        mode,
        title: `Indice de niveau ${Math.min(next, 3)}`,
        md:
          next >= 4
            ? `${h?.text ?? ""}\n\nTu as vu les trois indices. Le niveau 4 (solution expliquée) reste disponible sur demande, dans « Aide progressive » : une réussite après l'avoir vue ne compte pas comme preuve.`
            : (h?.text ?? ""),
        basis,
      };
    }
    case "deboguer":
      return { mode, title: "Déboguer à partir de tes résultats", md: debugText(ctx, focus), basis };
    case "question": {
      const pool = [
        ...(fiche?.questions ?? []),
        ...(ctx.lesson?.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "prediction" ? [{ question: b.question, reponse: `${b.choices.find((c) => c.id === b.answer)?.label ?? ""} — ${b.explanation}` }] : []))) ?? []),
      ];
      if (guide) pool.unshift({ question: guide.question, reponse: guide.explication });
      const q = pool.length ? pool[ctx.turn % pool.length] : undefined;
      return q
        ? { mode, title: "Une question pour vérifier", md: "Réponds dans ta tête (ou à voix haute), puis affiche la réponse.", quiz: q, basis }
        : { mode, title: "Une question pour vérifier", md: "Pas de question rédigée pour cette notion.", basis };
    }
    case "pratiquer": {
      const links = focus ? practiceFor(focus, ctx.allAttempts, ctx.exercise.id) : [];
      const md = focus
        ? links.length
          ? `Pour travailler « ${misconceptionLabels[focus] ?? focus} » :`
          : `Aucun autre exercice disponible ne vérifie encore « ${misconceptionLabels[focus] ?? focus} ».${ctx.lesson?.validationExerciseId && hasVariants(ctx.lesson.validationExerciseId) ? " Après une réussite, la révision espacée te proposera une **variante** du test de validation (autres paramètres)." : " Refais cet exercice demain sans regarder ton code : c'est le rappel actif."}`
        : "Aucune erreur observée pour l'instant : continue la leçon, ou passe le test de validation pour prouver la notion.";
      return { mode, title: "Pratiquer à nouveau", md, links, basis };
    }
    case "entretien": {
      const items = fiche?.entretien ?? [];
      const q = items.length ? items[ctx.turn % items.length] : undefined;
      return q
        ? {
            mode,
            title: "Question d'entretien",
            md: `**« ${q.question} »**\n\nRéponds en deux minutes, à voix haute ou par écrit, puis compare avec les éléments attendus. Ensuite : explique ton propre code ligne par ligne, comme à un recruteur.`,
            checklist: q.attendus,
            basis,
          }
        : { mode, title: "Question d'entretien", md: "Pas de question d'entretien rédigée pour cette notion.", basis };
    }
  }
}

function debugText(ctx: TutorContext, focus: string | undefined): string {
  const r = ctx.report;
  const lines: string[] = [];
  const level = ctx.hintLevel;

  if (!r && !ctx.runError) return "Lance d'abord **▶ Exécuter** ou **✓ Vérifier** : je m'appuie sur les résultats réels de ton code, pas sur des suppositions.";
  if (r?.status === "passed") return "Tous les tests passent : il n'y a rien à déboguer. Tu peux m'expliquer ton code (mode entretien) ou chercher une version plus simple.";
  if (r?.placeholder) return "Ton code contient encore des `___` à remplacer. Commence par le premier : que doit-il contenir d'après l'énoncé ?";
  if (r?.missingFunction && ctx.exercise.language === "python") return `Les tests appellent \`${ctx.exercise.functionName}\`, introuvable dans ton code. Vérifie le nom exact et que la fonction est définie au premier niveau (pas dans un if).`;

  const pyErr = r?.loadError ?? (ctx.runError?.kind === "python" ? ctx.runError.error : undefined);
  if (pyErr) {
    const e = explainError(pyErr);
    lines.push(`**${e.title}**${pyErr.line ? ` (ligne ${pyErr.line})` : ""}. ${e.hint}`);
    return lines.join("\n");
  }
  const sqlErr = r?.sqlError ?? (ctx.runError?.kind === "sql" ? { message: ctx.runError.message } : undefined);
  if (sqlErr) {
    lines.push(`PostgreSQL refuse la requête : « ${sqlErr.message} ». Lis le message mot à mot : il nomme souvent la colonne ou le mot en cause.`);
    if (ctx.runError?.kind === "sql" && ctx.runError.line) lines.push(`Regarde autour de la ligne ${ctx.runError.line}.`);
    return lines.join("\n");
  }
  if (r) {
    const visible = r.tests.find((t) => !t.passed && !t.hidden);
    const hidden = r.tests.filter((t) => !t.passed && t.hidden);
    if (visible) {
      lines.push(`Commence par le cas visible **« ${visible.label} »**.`);
      if (visible.expected !== undefined && visible.got !== undefined) lines.push(`Attendu : \`${visible.expected}\` — obtenu : \`${visible.got}\`. D'où peut venir l'écart ?`);
      else if (visible.detail) lines.push(visible.detail);
      if (visible.error) lines.push(`Ton code lève ${visible.error.type} sur ce cas.`);
    } else if (hidden.length) {
      lines.push(`Les cas visibles passent, mais ${hidden.length} cas caché${hidden.length > 1 ? "s" : ""} échoue${hidden.length > 1 ? "nt" : ""} : ${hidden.map((t) => `« ${t.label} »`).join(", ")}. Leur intitulé dit quelle situation tester toi-même.`);
    }
  }
  // Plusieurs vérifications peuvent pointer des erreurs différentes : on les cite toutes (deux au plus), sans trancher à la place des tests.
  const tags = [...new Set([...(r?.misconceptions ?? []), ...(focus ? [focus] : [])])].filter((m) => misconceptionGuides[m]).slice(0, 2);
  if (tags.length) {
    if (tags.length > 1) lines.push("", "Les vérifications échouées signalent deux pistes possibles.");
    for (const m of tags) lines.push("", `**Question d'orientation :** ${misconceptionGuides[m].question}`);
    if (level >= 2) for (const m of tags) lines.push("", `**Piste (${misconceptionLabels[m] ?? m}) :** ${misconceptionGuides[m].explication}`);
    else lines.push("", "Si tu veux une piste plus précise, demande un indice : le niveau 2 explique la notion en jeu.");
  }
  return lines.join("\n") || "Je n'ai pas assez d'informations : vérifie ton code pour obtenir des résultats de tests.";
}

/** Contexte compact envoyé au tuteur IA (serveur). La solution de référence n'est jointe qu'au niveau 4, déjà débloqué. */
export function tutorPayload(mode: TutorMode, ctx: TutorContext, question?: string) {
  const fiche = ficheOf(ctx);
  return {
    mode,
    question: question?.slice(0, 1000),
    lecon: ctx.lesson ? { titre: ctx.lesson.title, objectifs: ctx.lesson.objectives } : undefined,
    exercice: { titre: ctx.exercise.title, enonce: ctx.exercise.prompt, langage: ctx.exercise.language, version: ctx.exercise.version },
    code: ctx.code.slice(0, 8000),
    resultats: ctx.report
      ? {
          statut: ctx.report.status,
          reussis: `${ctx.report.passedCount}/${ctx.report.total}`,
          tests: ctx.report.tests.map((t) => ({ intitule: t.label, cache: t.hidden, reussi: t.passed, attendu: t.hidden ? undefined : t.expected, obtenu: t.hidden ? undefined : t.got, detail: t.detail })),
          erreur: ctx.report.loadError?.summary ?? ctx.report.sqlError?.message,
        }
      : undefined,
    erreurExecution: ctx.runError ? (ctx.runError.kind === "python" ? ctx.runError.error.summary : ctx.runError.message) : undefined,
    tentatives: ctx.attempts.length,
    niveauAide: ctx.hintLevel,
    erreursRecurrentes: recurringErrors(ctx.allAttempts).map((r) => r.label),
    fiche: fiche ? { resume: fiche.resume, pointsCles: fiche.pointsCles } : undefined,
    solutionDeReference: ctx.hintLevel >= 4 ? ctx.exercise.referenceSolution : undefined,
  };
}
export type TutorPayload = ReturnType<typeof tutorPayload>;


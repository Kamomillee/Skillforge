import { describe, expect, it } from "vitest";
import { exerciseById, exercises, lessonById, lessons, misconceptionLabels } from "../../src/content";
import { fiches, misconceptionGuides } from "../../src/content/guides";
import { errorNotebook } from "../../src/domain/notebook";
import { contextSummary, exerciseHref, exerciseMisconceptions, localTutor, practiceFor, recurringErrors, tutorModes, tutorPayload, type TutorContext } from "../../src/domain/tutor";
import type { GradeReport } from "../../src/grading/evaluate";
import type { Attempt } from "../../src/storage/store";

let n = 0;
const att = (exerciseId: string, status: Attempt["status"], misconceptions: string[] = [], extra: Partial<Attempt> = {}): Attempt => ({
  exerciseId,
  exerciseVersion: 1,
  at: new Date(Date.UTC(2026, 9, 1, 10, n++)).toISOString(),
  code: "",
  status,
  passedCount: 0,
  total: 3,
  hiddenPassed: 0,
  hiddenTotal: 2,
  misconceptions,
  hintLevel: 0,
  solutionViewed: false,
  durationMs: 10,
  ...extra,
});

const ctxFor = (exId: string, over: Partial<TutorContext> = {}): TutorContext => {
  const exercise = exerciseById.get(exId)!;
  const lesson = lessons.find((l) => l.sections.some((s) => s.blocks.some((b) => b.type === "exercise" && b.exerciseId === exId)) || l.validationExerciseId === exId);
  return { exercise, lesson, code: exercise.starterCode, attempts: [], allAttempts: [], hintLevel: 0, turn: 0, ...over };
};

describe("contenu du tuteur", () => {
  it("chaque leçon a une fiche, chaque étiquette d'erreur a un guide", () => {
    for (const l of lessons) expect(fiches[l.id], l.id).toBeDefined();
    for (const id of Object.keys(misconceptionLabels)) expect(misconceptionGuides[id], id).toBeDefined();
  });
  it("chaque étiquette posée par un exercice existe dans les libellés", () => {
    for (const e of exercises) for (const m of exerciseMisconceptions(e)) expect(misconceptionLabels[m], `${e.id} : ${m}`).toBeDefined();
  });
  it("chaque exercice a un lien atteignable", () => {
    for (const e of exercises) expect(exerciseHref(e.id), e.id).toMatch(/^#\/(lecon|projet)\//);
  });
});

describe("tuteur local", () => {
  it("répond dans les 7 modes, sans jamais contenir la solution de référence", () => {
    for (const e of exercises) {
      const ctx = ctxFor(e.id, { hintLevel: 3 });
      for (const m of tutorModes) {
        const r = localTutor(m.id, ctx);
        const all = [r.md, ...(r.code ?? []).map((c) => c.text), r.quiz?.reponse ?? ""].join("\n");
        expect(all.includes(e.referenceSolution.trim()), `${e.id} / ${m.id}`).toBe(false);
        expect(r.basis.length).toBeGreaterThan(3);
      }
    }
  });

  it("déboguer : demande d'abord des résultats réels", () => {
    expect(localTutor("deboguer", ctxFor("py-boucles-validation")).md).toMatch(/Exécuter|Vérifier/);
  });

  it("déboguer : cite le cas visible échoué, puis une question d'orientation ; la piste n'arrive qu'au niveau 2", () => {
    const report: GradeReport = {
      exerciseId: "sql-agg-ex3-debug-having",
      exerciseVersion: 1,
      status: "failed",
      passedCount: 1,
      total: 2,
      hiddenPassed: 0,
      hiddenTotal: 1,
      tests: [
        { id: "base", label: "Données actuelles", hidden: false, passed: true },
        { id: "x", label: "Commandes annulées ajoutées", hidden: true, passed: false, misconception: "statut-annule" },
      ],
      misconceptions: ["statut-annule"],
      stdout: "",
      durationMs: 5,
    };
    const lvl0 = localTutor("deboguer", ctxFor("sql-agg-ex3-debug-having", { report }));
    expect(lvl0.md).toContain("« Commandes annulées ajoutées »");
    expect(lvl0.md).toContain(misconceptionGuides["statut-annule"].question);
    expect(lvl0.md).not.toContain(misconceptionGuides["statut-annule"].explication);
    const lvl2 = localTutor("deboguer", ctxFor("sql-agg-ex3-debug-having", { report, hintLevel: 2 }));
    expect(lvl2.md).toContain(misconceptionGuides["statut-annule"].explication);
  });

  it("indice : suit les niveaux de l'exercice et ne donne pas le niveau 4 automatiquement", () => {
    const ex = exerciseById.get("py-boucles-validation")!;
    expect(localTutor("indice", ctxFor(ex.id)).md).toBe(ex.hints[0].text);
    const r = localTutor("indice", ctxFor(ex.id, { hintLevel: 3 }));
    expect(r.md).not.toContain(ex.hints[3].text);
  });

  it("question et entretien : tournent d'une demande à l'autre", () => {
    const a = localTutor("question", ctxFor("ml-eval-validation", { turn: 0 })).quiz?.question;
    const b = localTutor("question", ctxFor("ml-eval-validation", { turn: 1 })).quiz?.question;
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    expect(localTutor("entretien", ctxFor("ml-eval-validation")).checklist?.length).toBeGreaterThan(1);
  });

  it("le résumé de contexte nomme les erreurs récurrentes réelles", () => {
    const all = [att("sql-agg-ex3-debug-having", "failed", ["where-having"]), att("sql-agg-validation", "failed", ["where-having"])];
    expect(recurringErrors(all)[0]).toMatchObject({ id: "where-having", count: 2 });
    expect(contextSummary(ctxFor("sql-agg-validation", { allAttempts: all })).join("\n")).toContain("Confondre WHERE et HAVING (2×)");
  });

  it("le contexte envoyé à l'IA ne contient la solution qu'au niveau 4, et jamais les valeurs des tests cachés", () => {
    const ex = exerciseById.get("py-boucles-validation")!;
    expect(JSON.stringify(tutorPayload("deboguer", ctxFor(ex.id, { hintLevel: 3 })))).not.toContain(ex.referenceSolution.slice(0, 40));
    expect(tutorPayload("deboguer", ctxFor(ex.id, { hintLevel: 4 })).solutionDeReference).toBe(ex.referenceSolution);
    const report = { status: "failed", passedCount: 0, total: 1, hiddenPassed: 0, hiddenTotal: 1, tests: [{ id: "h", label: "caché", hidden: true, passed: false, expected: "SECRET", got: "x" }], misconceptions: [] } as unknown as GradeReport;
    expect(JSON.stringify(tutorPayload("deboguer", ctxFor(ex.id, { report })))).not.toContain("SECRET");
  });
});

describe("pratique ciblée et carnet d'erreurs", () => {
  it("propose des exercices qui vérifient l'erreur, avec la raison observée", () => {
    const all = [att("sql-agg-ex3-debug-having", "failed", ["statut-annule"]), att("sql-select-validation", "failed", ["statut-annule"])];
    const links = practiceFor("statut-annule", all);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].reason).toContain("proposé car « Inclure les commandes annulées » est apparu dans 2 exercices");
    for (const l of links) expect(exerciseMisconceptions(exercises.find((e) => e.title === l.title)!)).toContain("statut-annule");
  });

  it("n'en propose pas un déjà réussi proprement", () => {
    const all = [att("sql-agg-ex3-debug-having", "failed", ["statut-annule"]), att("sql-select-validation", "passed")];
    expect(practiceFor("statut-annule", all).map((l) => l.title)).not.toContain(exerciseById.get("sql-select-validation")!.title);
  });

  it("le carnet marque une erreur surmontée quand l'exercice a été réussi ensuite", () => {
    const all = [att("py-boucles-ex2-ca-net", "failed", ["signe-remboursement"]), att("py-boucles-ex2-ca-net", "passed"), att("sql-agg-validation", "failed", ["ordre-tri"])];
    const nb = errorNotebook(all);
    expect(nb.map((e) => e.id)).toEqual(["ordre-tri", "signe-remboursement"]);
    expect(nb[1].resolved).toBe(true);
    expect(nb[0].resolved).toBe(false);
    expect(nb[0].occurrences[0].title).toBe(exerciseById.get("sql-agg-validation")!.title);
  });

  it("les tentatives de révision sont rattachées à leur exercice", () => {
    const nb = errorNotebook([att("sql-agg-validation#revision", "failed", ["ordre-tri"])]);
    expect(nb[0].occurrences[0].exerciseId).toBe("sql-agg-validation");
    expect(lessonById.size).toBeGreaterThan(0);
  });
});

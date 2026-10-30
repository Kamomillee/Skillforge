import { describe, expect, it } from "vitest";
import { exercises, lessons } from "../../src/content";
import { estimateMastery } from "../../src/domain/mastery";
import { recommendPath } from "../../src/domain/path";
import { frequentErrors, recommendNext } from "../../src/domain/recommend";
import { INTERVALS, isDue, recordReview, scheduleAfterSuccess } from "../../src/domain/reviews";
import type { Attempt, LearningEvent, Profile } from "../../src/storage/store";

const C = "python.a.boucles";
const at = (d: string) => new Date(d).toISOString();
const att = (exerciseId: string, over: Partial<Attempt> = {}): Attempt => ({
  exerciseId,
  exerciseVersion: 1,
  at: at("2026-10-01"),
  code: "",
  status: "failed",
  passedCount: 0,
  total: 6,
  hiddenPassed: 0,
  hiddenTotal: 5,
  misconceptions: [],
  hintLevel: 0,
  solutionViewed: false,
  durationMs: 1,
  ...over,
});
const ctx = (attempts: Attempt[], events: LearningEvent[] = [], review?: Parameters<typeof estimateMastery>[1]["review"]) => ({ lessons, exercises, attempts, events, review });

describe("maîtrise explicable", () => {
  it("leçon ouverte ≠ compétence maîtrisée", () => {
    const m = estimateMastery(C, ctx([], [{ type: "lesson-open", lessonId: "py-boucles-accumulateurs", at: at("2026-10-01") }]));
    expect(m.level).toBe(1);
    expect(m.reasons[0]).toMatch(/ne prouve pas/);
  });

  it("un exercice guidé réussi ne suffit pas pour « Démontré »", () => {
    const m = estimateMastery(C, ctx([att("py-boucles-ex1-remboursements", { status: "passed" })]));
    expect(m.level).toBe(2);
  });

  it("l'exercice autonome réussi sans solution donne « Démontré », avec preuve vérifiée", () => {
    const m = estimateMastery(C, ctx([att("py-boucles-ex2-ca-net", { status: "passed", passedCount: 6, hiddenPassed: 5 })]));
    expect(m.level).toBe(3);
    expect(m.evidence[0]).toMatchObject({ kind: "exercice-autonome", verified: true });
  });

  it("une réussite après avoir vu la solution ne compte pas", () => {
    const m = estimateMastery(C, ctx([att("py-boucles-ex2-ca-net", { status: "passed", solutionViewed: true, hintLevel: 4 })]));
    expect(m.level).toBe(2);
  });

  it("une réussite avec aide ciblée (niveau 3) ne compte pas comme autonome", () => {
    const m = estimateMastery(C, ctx([att("py-boucles-ex2-ca-net", { status: "passed", hintLevel: 3 })]));
    expect(m.level).toBe(2);
  });

  it("« Consolidé » exige débogage + révision réussie", () => {
    const attempts = [att("py-boucles-ex2-ca-net", { status: "passed" }), att("py-boucles-ex3-debug-panier", { status: "passed" })];
    expect(estimateMastery(C, ctx(attempts)).level).toBe(3);
    const review = { conceptId: C, dueAt: at("2026-10-05"), step: 1, reason: "", history: [{ at: at("2026-10-04"), ok: true }] };
    expect(estimateMastery(C, ctx(attempts, [], review)).level).toBe(4);
  });
});

describe("maîtrise : notions SQL", () => {
  it("une notion travaillée uniquement par un débogage devient « Démontré » après ce débogage réussi sans aide ciblée", () => {
    const D = "sql.b.doublons-crees-par-les-jointures";
    expect(estimateMastery(D, ctx([att("sql-join-ex3-debug-doublons", { status: "passed" })])).level).toBe(3);
    expect(estimateMastery(D, ctx([att("sql-join-ex3-debug-doublons", { status: "passed", hintLevel: 3 })])).level).toBe(2);
  });
  it("le débogage ne suffit pas quand la notion a un exercice autonome", () => {
    expect(estimateMastery("sql.b.inner-join-et-left-join", ctx([att("sql-join-ex3-debug-doublons", { status: "passed" })])).level).toBe(2);
  });
  it("une étape de projet réussie compte comme preuve autonome", () => {
    expect(estimateMastery("sql.d.marge", ctx([att("pme-p3-marge-produits", { status: "passed" })])).level).toBe(3);
  });
});

describe("révisions espacées", () => {
  it("planifie à J+1 puis espace en cas de réussite, revient à J+1 en cas d'échec", () => {
    const now = new Date("2026-10-30T10:00:00Z");
    const r = scheduleAfterSuccess(C, undefined, now, "raison");
    expect(r.dueAt).toBe(new Date("2026-10-31T10:00:00Z").toISOString());
    const ok = recordReview(r, true, now);
    expect(ok.step).toBe(1);
    expect(ok.dueAt).toBe(new Date(now.getTime() + INTERVALS[1] * 86_400_000).toISOString());
    const ko = recordReview(ok, false, now);
    expect(ko.step).toBe(0);
    expect(isDue(ko, new Date("2026-11-01T10:00:01Z"))).toBe(true);
  });
});

describe("recommandations justifiées", () => {
  it("cite l'erreur la plus fréquente", () => {
    const attempts = [
      att("py-boucles-ex1-remboursements", { status: "passed" }),
      att("py-boucles-ex2-ca-net", { misconceptions: ["liste-vide", "signe-remboursement"] }),
      att("py-boucles-ex2-ca-net", { misconceptions: ["liste-vide"] }),
    ];
    const r = recommendNext({ lessons, exercises, attempts, drafts: [], reviews: [] });
    expect(r.kind).toBe("resume-exercise");
    expect(r.reason).toContain("Oublier le cas de la liste vide");
    expect(r.reason).toContain("2 tentative");
    expect(frequentErrors(attempts, exercises)[0]).toMatchObject({ id: "liste-vide", count: 2 });
  });

  it("une révision due passe en priorité", () => {
    const r = recommendNext({
      lessons,
      exercises,
      attempts: [],
      drafts: [],
      reviews: [{ conceptId: C, dueAt: at("2026-10-01"), step: 0, reason: "Planifiée", history: [] }],
      now: new Date("2026-10-30"),
    });
    expect(r.kind).toBe("review");
  });

  it("sans activité : première leçon du parcours", () => {
    const r = recommendNext({ lessons, exercises, attempts: [], drafts: [], reviews: [] });
    expect(r.kind).toBe("lesson");
    expect(r.reason).toMatch(/Première leçon/);
  });
});

describe("parcours recommandé", () => {
  const base: Profile = {
    name: "",
    programmingLevel: "debutant",
    levels: { python: "aucun", sql: "aucun", stats: "aucun", bi: "aucun" },
    goal: "bi",
    hoursPerWeek: 2,
    preferences: { concreteExamples: true, visualFirst: true, shortSessions: true },
    apiKey: "non",
    createdAt: "",
  };
  it("objectif BI : SQL d'abord, Python avancé si débutant", () => {
    const p = recommendPath(base);
    expect(p.domainOrder.slice(0, 2)).toEqual(["sql", "python"]);
    expect(p.reasons.length).toBeGreaterThan(1);
  });
  it("calcule l'horizon sans inventer de promesse de niveau", () => {
    const p = recommendPath({ ...base, goal: "data", targetDate: "2026-12-25" }, new Date("2026-10-30"));
    expect(p.reasons.join(" ")).toMatch(/environ 8 semaine\(s\).*environ 16 h/);
  });
});

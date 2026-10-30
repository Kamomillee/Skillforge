import { describe, expect, it } from "vitest";
import { formatLabels, interviewProfiles, interviewQuestions, questionById } from "../../src/content/entretien";
import { feedbackFor, normaliser, reperer, sessionMarkdown, sessionSummary, type InterviewSession } from "../../src/domain/interview";
import { ATTESTATION, buildPortfolio, portfolioReadme } from "../../src/domain/portfolio";
import { fieldKey, journalKey } from "../../src/domain/projects";
import type { Attempt } from "../../src/storage/store";

describe("mode entretien — contenu", () => {
  it("quatre profils, les huit formats couverts, chaque question existe", () => {
    expect(interviewProfiles.map((p) => p.id)).toEqual(["data-analyst", "bi", "ia", "automatisation"]);
    for (const p of interviewProfiles) for (const id of p.questions) expect(questionById.get(id), `${p.id} → ${id}`).toBeDefined();
    expect(new Set(interviewQuestions.map((q) => q.format))).toEqual(new Set(Object.keys(formatLabels)));
  });
  it("chaque réponse modèle écrite contient ses propres éléments attendus (les repères sont cohérents)", () => {
    for (const q of interviewQuestions) if (q.kind === "texte") for (const r of reperer(q.reponseModele, q.attendus)) expect(r.trouve, `${q.id} / ${r.attendu.id}`).toBe(true);
  });
});

describe("mode entretien — correction", () => {
  it("normalise accents et casse", () => {
    expect(normaliser("Déséquilibré  ÉTÉ")).toBe("desequilibre ete");
  });
  it("cite la phrase de l'étudiant où l'élément attendu est repéré", () => {
    const q = questionById.get("q-metrique")!;
    const f = feedbackFor(q, { questionId: q.id, text: "C'est trompeur. Prédire que personne ne part donne déjà 90 %. Je regarderais le rappel.", runs: 0, ms: 120_000 });
    const base = f.raisonnement.find((r) => r.attendu.id === "base")!;
    expect(base.trouve).toBe(true);
    expect(base.citation).toBe("Prédire que personne ne part donne déjà 90 %.");
    expect(f.raisonnement.find((r) => r.attendu.id === "metier")!.trouve).toBe(false);
    expect(f.limites).toMatch(/Aucune limite/);
    expect(f.communication[0]).toMatch(/plus court/);
    expect(f.exactitude).toMatch(/Non mesurable automatiquement/);
  });
  it("le code non modifié compte comme « pas de réponse » ; l'exactitude du code vient des tests", () => {
    const q = questionById.get("q-panier")!;
    if (q.kind !== "code") throw new Error();
    expect(feedbackFor(q, { questionId: q.id, text: q.exercise.starterCode, runs: 0, ms: 1 }).exactitude).toBe("Pas de réponse.");
    const f = feedbackFor(q, { questionId: q.id, text: "def panier_moyen(m):\n    return 0", runs: 2, ms: 1 }, { status: "failed", passed: 2, total: 5, hiddenPassed: 1, hiddenTotal: 4, misconceptions: [] });
    expect(f.exactitude).toBe("Mesurée : 2/5 tests réussis (dont 1/4 cachés).");
    expect(f.autonomie.join(" ")).toContain("2 exécutions");
  });
  it("synthèse sans note et export Markdown", () => {
    const s: InterviewSession = {
      id: "x",
      profile: "automatisation",
      startedAt: "2026-10-30T10:00:00Z",
      answers: [
        { questionId: "q-projet", text: "", runs: 0, ms: 1000 },
        { questionId: "q-panier", text: "x", runs: 1, ms: 1000 },
        { questionId: "q-architecture-import", text: "J'ai rendu l'import rejouable avec NOT EXISTS.", runs: 0, ms: 1000 },
        { questionId: "q-metrique", text: "", runs: 0, ms: 1000 },
      ],
      grades: { "q-panier": { status: "passed", passed: 5, total: 5, hiddenPassed: 4, hiddenTotal: 4, misconceptions: [] } },
    };
    const sum = sessionSummary(s);
    expect(sum.exactitude).toContain("1/1 question(s) de code entièrement réussie(s)");
    expect(sum.autonomie).toContain("2 question(s) laissée(s) sans réponse");
    const md = sessionMarkdown(s, "Stage automatisation");
    expect(md).toContain("Aucune note globale");
    expect(md).toContain("✓ Import rejouable");
    expect(md).not.toMatch(/\d+\s*\/\s*20|score/i);
  });
});

describe("portfolio", () => {
  const pass = (exerciseId: string, extra: Partial<Attempt> = {}): Attempt => ({ exerciseId, exerciseVersion: 1, at: "2026-10-30T10:00:00Z", code: "", status: "passed", passedCount: 4, total: 4, hiddenPassed: 3, hiddenTotal: 3, misconceptions: [], hintLevel: 0, solutionViewed: false, durationMs: 1, ...extra });

  it("vide sans preuve : aucun projet, aucune notion", () => {
    const d = buildPortfolio({ attempts: [], events: [], reviews: [], kv: {}, interviews: 0 });
    expect(d.projects).toEqual([]);
    expect(d.notions).toEqual([]);
    expect(portfolioReadme(d)).toContain(ATTESTATION);
  });

  it("ne contient que des faits enregistrés : étapes vérifiées, textes rédigés, ligne de CV factuelle", () => {
    const kv = {
      [journalKey("copilote-pme", "s3")]: { text: "J'écarte la commande du client 999 et je la signale." },
      [fieldKey("copilote-pme", "s9", "donnees")]: { text: "Onze lignes synthétiques seulement." },
    };
    const d = buildPortfolio({ attempts: [pass("cp-1-import"), pass("cp-3-base", { solutionViewed: true })], events: [], reviews: [], kv, interviews: 2 });
    const p = d.projects.find((x) => x.project.id === "copilote-pme")!;
    expect(p.verified.map((v) => v.title)).toEqual(["Importer les données (Python)", "Organiser dans la base (SQL)"]);
    expect(p.verified[1].clean).toBe(false);
    expect(p.decisions).toEqual([{ step: "Organiser dans la base (SQL)", text: "J'écarte la commande du client 999 et je la signale." }]);
    expect(p.limits).toEqual(["Onze lignes synthétiques seulement."]);
    expect(p.evaluation!.map((r) => r.composant)).toEqual(["Import", "Base"]);
    expect(p.cvLine).toMatch(/^Projet de formation « Copilote data pour une PME » \(SkillForge AI, données synthétiques\)/);
    expect(p.cvLine).toContain("2/7 étapes vérifiées par des tests automatisés");
    const md = portfolioReadme(d, "Kamo");
    expect(md).toContain("(après consultation de la solution)");
    expect(md).toContain("Entretiens blancs réalisés : 2.");
    // Rien d'inventé : aucun pourcentage de gain, aucune « expérience », aucune « certification » revendiquée.
    expect(md).not.toMatch(/gain|productivit|expérience professionnelle chez|certifi[ée]+ par/i);
  });
});

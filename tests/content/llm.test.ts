import { describe, expect, it } from "vitest";
import { documentsPme, motsVides, questionsReference } from "../../src/content/datasets/documents";
import { casReference, lessonRag } from "../../src/content/llm/rag";
import { construireContexte, decouper, indexer, pipeline, rechercher, repondreOuAbstenir, REGLAGES, tableauEvaluation } from "../../src/content/llm/rag-core";
import { exerciseById } from "./fixtures";
import { getPyodide, grade } from "./pyodide";

/** Charge les solutions de référence Python dans un espace de noms et retourne un appel JSON → JSON. */
async function python() {
  const p = await getPyodide();
  const ns = p.globals.get("dict")();
  for (const id of ["llm-rag-ex3-debug-contexte", "llm-rag-validation", "llm-assist-p1-index", "llm-assist-p2-recherche", "llm-assist-p3-evaluation"]) {
    p.runPython(exerciseById(id).referenceSolution, { globals: ns });
  }
  p.runPython("import json\ndef appel(nom, args_json):\n    return json.dumps(globals()[nom](*json.loads(args_json)))", { globals: ns });
  const appel = ns.get("appel");
  return (nom: string, ...args: unknown[]) => JSON.parse(appel(nom, JSON.stringify(args)) as string);
}

describe("LLM — RAG avec citations", () => {
  it("la base documentaire : ids uniques, chaque question de référence pointe vers un document existant", () => {
    const ids = new Set(documentsPme.map((d) => d.id));
    expect(ids.size).toBe(documentsPme.length);
    for (const q of questionsReference) if (q.attendu) expect(ids.has(q.attendu), q.question).toBe(true);
    expect(questionsReference.filter((q) => q.attendu === null).length).toBe(4);
  });

  it("le pipeline Python des exercices donne exactement les résultats de la visualisation (3 tailles × 13 questions)", async () => {
    const py = await python();
    for (const taille of [10, 25, 50]) {
      const index = indexer(documentsPme, taille, REGLAGES.chevauchement);
      expect(py("indexer", documentsPme, taille, REGLAGES.chevauchement), `index ${taille}`).toEqual(index);
      for (const q of questionsReference) {
        const res = rechercher(q.question, index, motsVides, REGLAGES.k);
        expect(py("rechercher", q.question, index, motsVides, REGLAGES.k), `${taille} : ${q.question}`).toEqual(res);
        const passages = res.map((r) => ({ ...r, texte: index.find((m) => m.id === r.id)!.texte }));
        expect(py("construire_contexte", passages, REGLAGES.budget)).toEqual(construireContexte(passages, REGLAGES.budget));
        for (const seuil of [1, 2, 3]) expect(py("repondre_ou_abstenir", res, seuil)).toEqual(repondreOuAbstenir(res, seuil));
      }
    }
    expect(py("tableau_evaluation", casReference)).toEqual(tableauEvaluation(casReference));
  });

  it("les chiffres annoncés dans le texte du projet sont ceux que calcule le pipeline", () => {
    expect(tableauEvaluation(casReference)).toEqual({ questions: 13, citation_correcte: 5, mauvaise_source: 0, silence_a_tort: 4, abstention_correcte: 3, reponse_inventee: 1 });
    // La leçon affirme : « gratuite » ne trouve qu'un terme commun → abstention ; seuil 1 → la bonne source est citée.
    const gratuite = "La livraison est-elle gratuite ?";
    expect(pipeline(gratuite, documentsPme, motsVides).abstention).toBe(true);
    expect(pipeline(gratuite, documentsPme, motsVides, { ...REGLAGES, seuil: 1 }).citations[0]).toMatch(/^livraison#/);
    // Prédiction « prix d'une machine » : la garantie est citée alors qu'elle ne contient aucun prix.
    const prix = pipeline("Quel est le prix d'une machine à espresso ?", documentsPme, motsVides);
    expect(prix.abstention).toBe(false);
    expect(prix.citations[0]).toMatch(/^garantie#/);
    expect(documentsPme.find((d) => d.id === "garantie")!.texte).not.toMatch(/CHF|prix/);
  });

  it("découpage : cas limites de la référence TypeScript", () => {
    expect(decouper("a b c d e f g h i", 4, 1)).toEqual(["a b c d", "d e f g", "g h i"]);
    expect(decouper("   ", 4, 1)).toEqual([]);
  });

  it("la démonstration Python s'exécute et trouve le document des retours", async () => {
    const block = lessonRag.sections.flatMap((s) => s.blocks).find((b) => b.type === "code" && b.runnable);
    if (!block || block.type !== "code") throw new Error("démonstration absente");
    const p = await getPyodide();
    p.globals.set("SF_CODE", `${block.prelude}\n${block.code}`);
    const [res, stdout] = JSON.parse(
      p.runPython("import io, contextlib, json\n_b = io.StringIO()\nwith contextlib.redirect_stdout(_b):\n    _r = sf_run(SF_CODE)\njson.dumps([json.loads(_r), _b.getvalue()])") as string,
    );
    expect(res.error).toBeNull();
    expect(stdout).toMatch(/^2 retours/m);
  });

  it("découpage : oublier le dernier morceau est diagnostiqué", async () => {
    const ex = exerciseById("llm-rag-ex1-decouper");
    const code = ex.referenceSolution.replace('morceaux.append(" ".join(mots[i:i + taille]))\n        if i + taille >= len(mots):', 'if i + taille > len(mots):\n            break\n        morceaux.append(" ".join(mots[i:i + taille]))\n        if i + taille >= len(mots):');
    const r = await grade(ex, code);
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("dernier-morceau");
  });

  it("score : oublier les minuscules est diagnostiqué", async () => {
    const ex = exerciseById("llm-rag-ex2-score");
    const r = await grade(ex, ex.referenceSolution.replace("texte.lower()", "texte"));
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("casse-ponctuation");
  });

  it("score : solution alternative (split + strip de la ponctuation) acceptée si elle respecte les règles", async () => {
    const ex = exerciseById("llm-rag-ex2-score");
    const code = `import re
def score_lexical(question, passage, mots_vides):
    def norm(t):
        out = set()
        for m in re.findall(r"\\w+", t.lower()):
            if m not in mots_vides:
                out.add(m[:-1] if len(m) > 3 and m.endswith(("s", "x")) else m)
        return out
    return len(norm(question) & norm(passage))`;
    expect((await grade(ex, code)).status).toBe("passed");
  });

  it("contexte : le code de départ est diagnostiqué (ordre et budget)", async () => {
    const r = await grade(exerciseById("llm-rag-ex3-debug-contexte"), exerciseById("llm-rag-ex3-debug-contexte").starterCode);
    expect(r.misconceptions).toEqual(expect.arrayContaining(["ordre-pertinence", "budget-depasse"]));
  });

  it("validation : répondre toujours (sans abstention) est diagnostiqué", async () => {
    const ex = exerciseById("llm-rag-validation");
    const code = `def repondre_ou_abstenir(resultats, seuil):
    tries = sorted(resultats, key=lambda r: (-r["score"], r["id"]))
    return {"abstention": False, "citations": [r["id"] for r in tries[:2]]}`;
    const r = await grade(ex, code);
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("abstention-absente");
  });
});

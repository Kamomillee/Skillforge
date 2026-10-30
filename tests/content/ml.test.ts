import { describe, expect, it } from "vitest";
import { churn, churnTestProbas, lessonMlEvaluation } from "../../src/content/ml/evaluation";
import { confusionAt, SWEEP } from "../../src/ui/viz/threshold";
import { exerciseById } from "./fixtures";
import { getPyodide, grade } from "./pyodide";

async function sklearn() {
  const p = await getPyodide();
  await p.loadPackage(["scikit-learn"], { messageCallback: () => {} });
  return p;
}

describe("ML — évaluation d'un classifieur", () => {
  it("jeu de données : déterministe, ~25 % de départs, séparation entraînement/test", () => {
    expect(churn.X_train).toHaveLength(120);
    expect(churn.X_test).toHaveLength(40);
    expect(churn.y_train.reduce((a, b) => a + b, 0)).toBe(30);
    expect(churn.y_test.reduce((a, b) => a + b, 0)).toBe(11);
  });

  it("la visualisation du seuil calcule la même matrice que scikit-learn, pour chaque seuil", async () => {
    const p = await sklearn();
    p.globals.set("Y", p.toPy(churn.y_test));
    p.globals.set("S", p.toPy(churnTestProbas));
    p.globals.set("T", p.toPy(SWEEP));
    const ref = JSON.parse(
      p.runPython(`
import json
from sklearn.metrics import confusion_matrix, precision_score, recall_score
out = []
for t in T:
    pred = [1 if s >= t else 0 for s in S]
    vn, fp, fn, vp = confusion_matrix(Y, pred, labels=[0, 1]).ravel()
    out.append([int(vp), int(fp), int(fn), int(vn), float(precision_score(Y, pred, zero_division=0)), float(recall_score(Y, pred, zero_division=0))])
json.dumps(out)`) as string,
    );
    SWEEP.forEach((t, k) => {
      const c = confusionAt(churn.y_test, churnTestProbas, t);
      expect([c.vp, c.fp, c.fn, c.vn], `seuil ${t}`).toEqual(ref[k].slice(0, 4));
      expect(c.precision).toBeCloseTo(ref[k][4], 10);
      expect(c.rappel).toBeCloseTo(ref[k][5], 10);
    });
  });

  it("le coût affiché par la visualisation est celui du projet (rapport_seuil), pour chaque seuil", async () => {
    const p = await getPyodide();
    p.runPython(exerciseById("ml-churn-p3-rapport").referenceSolution);
    const rapport = p.globals.get("rapport_seuil");
    for (const t of SWEEP) {
      const r = rapport(p.toPy(churn.y_test), p.toPy(churnTestProbas), t, 400, 30).toJs({ dict_converter: Object.fromEntries });
      const c = confusionAt(churn.y_test, churnTestProbas, t, 400, 30);
      expect([c.contactes, c.cout], `seuil ${t}`).toEqual([r.contactes, r.cout_total]);
    }
    rapport.destroy();
  });

  it("la démonstration scikit-learn s'exécute (avec ses données préchargées)", async () => {
    const block = lessonMlEvaluation.sections.flatMap((s) => s.blocks).find((b) => b.type === "code" && b.runnable);
    if (!block || block.type !== "code") throw new Error("démonstration absente");
    const p = await sklearn();
    const run = p.globals.get("sf_run");
    const out = JSON.parse(run(`${block.prelude}\n${block.code}`));
    run.destroy();
    expect(out.error).toBeNull();
  });

  it("précision/rappel : solution alternative avec scikit-learn acceptée", async () => {
    const ex = { ...exerciseById("ml-eval-ex2-precision-rappel"), packages: ["scikit-learn"] };
    const code = `from sklearn.metrics import precision_score, recall_score
def precision_rappel(y_vrai, scores, seuil):
    pred = [int(s >= seuil) for s in scores]
    return {"precision": round(float(precision_score(y_vrai, pred, zero_division=0)), 3),
            "rappel": round(float(recall_score(y_vrai, pred, zero_division=0)), 3)}`;
    expect((await grade(ex, code)).status).toBe("passed");
  });

  it("précision/rappel : seuil strict (>) détecté", async () => {
    const ex = exerciseById("ml-eval-ex2-precision-rappel");
    const code = exerciseById("ml-eval-ex2-precision-rappel").referenceSolution.replace("score >= seuil", "score > seuil");
    const r = await grade(ex, code);
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("seuil-strict");
  });

  it("matrice : FP et FN inversés détectés", async () => {
    const ex = exerciseById("ml-eval-ex1-matrice");
    const r = await grade(ex, ex.starterCode.replace("m[___] += 1", 'm["FN"] += 1').replace("m[___] += 1", 'm["FP"] += 1'));
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("vp-fp-inverses");
  });

  it("F1 : le code de départ (moyenne arithmétique) est diagnostiqué", async () => {
    const r = await grade(exerciseById("ml-eval-ex3-debug-f1"), exerciseById("ml-eval-ex3-debug-f1").starterCode);
    expect(r.misconceptions).toContain("moyenne-arithmetique");
  });

  it("seuil le moins coûteux : égalité mal départagée détectée", async () => {
    const ex = exerciseById("ml-eval-validation");
    const r = await grade(ex, ex.referenceSolution.replace(" or (cout == cout_min and s > meilleur)", ""));
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("egalite-de-cout");
  });

  it("modèle du projet : un pipeline avec mise à l'échelle donne d'autres probabilités et est refusé (consigne explicite)", async () => {
    const ex = exerciseById("ml-churn-p2-modele");
    const code = `from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
def probas_depart(X_train, y_train, X_test):
    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, C=0.01)).fit(X_train, y_train)
    return [round(float(p), 3) for p in m.predict_proba(X_test)[:, 1]]`;
    expect((await grade(ex, code)).status).toBe("failed");
  });

  it("modèle du projet : un tableau NumPy non converti est accepté (tolérance par élément)", async () => {
    const ex = exerciseById("ml-churn-p2-modele");
    const code = `from sklearn.linear_model import LogisticRegression
def probas_depart(X_train, y_train, X_test):
    return LogisticRegression(max_iter=1000).fit(X_train, y_train).predict_proba(X_test)[:, 1]`;
    expect((await grade(ex, code)).status).toBe("passed");
  });
});

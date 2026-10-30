import { describe, expect, it } from "vitest";
import { exerciseById, type PythonExercise, type SqlExercise } from "../../src/content";
import { chargerVentes, EXPORT_BOUTIQUE, nettoyerVentes } from "../../src/content/datasets/import-boutique";
import { evaluationCopilote } from "../../src/domain/projects";
import type { Attempt } from "../../src/storage/store";
import { grade } from "./pyodide";
import { gradeSql, q } from "./pglite";
import { IMPORT_SQL } from "../../src/content/transversal/copilote";

const py = (id: string) => exerciseById.get(id) as PythonExercise;
const sql = (id: string) => exerciseById.get(id) as SqlExercise;
const IDS_PY = ["cp-1-import", "cp-2-nettoyage", "cp-6-modele", "cp-7-assistant"];
const IDS_SQL = ["cp-3-base", "cp-4-questions", "cp-5-tableau"];

describe("projet transversal — solutions de référence et codes de départ", () => {
  for (const id of IDS_PY)
    it(`${id} : la référence passe (valeurs attendues = Pyodide), le départ échoue`, async () => {
      expect((await grade(py(id), py(id).referenceSolution)).status).toBe("passed");
      expect((await grade(py(id), py(id).starterCode)).status).not.toBe("passed");
    });
  for (const id of IDS_SQL)
    it(`${id} : la référence passe et renvoie des lignes, le départ échoue`, async () => {
      expect((await gradeSql(sql(id), sql(id).referenceSolution)).status).toBe("passed");
      expect((await q(sql(id).referenceSolution, sql(id).setup)).rows.length).toBeGreaterThan(0);
      expect((await gradeSql(sql(id), sql(id).starterCode)).status).not.toBe("passed");
    });
});

describe("projet transversal — erreurs typiques", () => {
  const casPy: { id: string; label: string; code: string; misconception?: string }[] = [
    { id: "cp-1-import", label: "valeurs laissées en texte", code: py("cp-1-import").referenceSolution.replace('"quantite": int(quantite)', '"quantite": quantite').replace('float(prix.replace(",", "."))', "prix"), misconception: "type-non-converti" },
    { id: "cp-1-import", label: "espaces non retirés", code: py("cp-1-import").referenceSolution.replace("[v.strip() for v in ligne.split(\";\")]", "ligne.split(\";\")") },
    { id: "cp-2-nettoyage", label: "doublons gardés", code: py("cp-2-nettoyage").referenceSolution.replace("elif cle in vues:", "elif False:"), misconception: "doublon-garde" },
    { id: "cp-2-nettoyage", label: "date contrôlée par sa seule forme", code: py("cp-2-nettoyage").referenceSolution.replace('datetime.strptime(d, "%Y-%m-%d")\n        return len(d) == 10', 'return len(d) == 10 and d[4] == "-" and d[7] == "-"'), misconception: "date-non-validee" },
    { id: "cp-2-nettoyage", label: "liste reçue modifiée", code: py("cp-2-nettoyage").referenceSolution.replace("    return {\"lignes\": propres", "    lignes.clear()\n    return {\"lignes\": propres"), misconception: "mutation-argument" },
    { id: "cp-6-modele", label: "> au lieu de >=", code: py("cp-6-modele").referenceSolution.replace("if v >= s", "if v > s"), misconception: "seuil-strict" },
    { id: "cp-6-modele", label: "égalité : garde le plus grand seuil", code: py("cp-6-modele").referenceSolution.replace("if justes / n > meilleure:", "if justes / n >= meilleure:"), misconception: "egalite-de-cout" },
    { id: "cp-7-assistant", label: "jamais d'abstention", code: py("cp-7-assistant").referenceSolution.replace('if p["score"] >= seuil', "if True"), misconception: "abstention-absente" },
    { id: "cp-7-assistant", label: "passages non triés", code: py("cp-7-assistant").referenceSolution.replace(', key=lambda p: p["score"], reverse=True', ""), misconception: "ordre-pertinence" },
  ];
  for (const c of casPy)
    it(`${c.id} : ${c.label}`, async () => {
      expect(c.code).not.toBe(py(c.id).referenceSolution);
      const r = await grade(py(c.id), c.code);
      expect(r.status).not.toBe("passed");
      if (c.misconception) expect(r.misconceptions).toContain(c.misconception);
    });

  // Les erreurs typiques des étapes SQL sont dans tests/content/sql.test.ts (même mécanique que les autres exercices SQL).
});

describe("projet transversal — données et évaluation", () => {
  it("l'export contient exactement les anomalies annoncées", () => {
    const n = nettoyerVentes(chargerVentes(EXPORT_BOUTIQUE));
    expect(n.rejets).toEqual({ date_invalide: 1, quantite_invalide: 2, doublon: 1 });
    expect(n.lignes).toHaveLength(7);
  });
  it("la table d'import se charge dans PostgreSQL et le client 999 est inconnu", async () => {
    expect((await q("SELECT count(*) FROM import_ventes", IMPORT_SQL)).rows[0][0]).toBe(7);
    expect((await q("SELECT count(*) FROM clients WHERE client_id = 999")).rows[0][0]).toBe(0);
  });
  it("le tableau d'évaluation n'affiche rien tant que les étapes ne sont pas vérifiées, puis les valeurs mesurées", () => {
    expect(evaluationCopilote([]).every((r) => r.valeur === null)).toBe(true);
    const pass = (exerciseId: string): Attempt => ({ exerciseId, exerciseVersion: 1, at: "2026-10-30T10:00:00Z", code: "", status: "passed", passedCount: 4, total: 4, hiddenPassed: 3, hiddenTotal: 3, misconceptions: [], hintLevel: 0, solutionViewed: false, durationMs: 1 });
    const rows = evaluationCopilote(["cp-1-import", "cp-2-nettoyage", "cp-3-base", "cp-4-questions", "cp-5-tableau", "cp-6-modele", "cp-7-assistant"].map(pass));
    expect(rows.every((r) => r.valeur !== null)).toBe(true);
    expect(rows.find((r) => r.composant === "Nettoyage")!.valeur).toBe("4 sur 11 (1 / 2 / 1)");
    // Chiffres cités dans la documentation et le bilan : le modèle bat à peine la base, l'assistant invente une réponse sur 13.
    expect(rows.find((r) => r.composant === "Modèle")!.valeur).toBe("76,7 % (base 75,0 %) / 75,0 % (base 72,5 %)");
    expect(rows.find((r) => r.composant === "Assistant")!.valeur).toBe("5 / 0 / 4 / 3 / 1");
  });
});

import { interviewQuestions } from "../../src/content/entretien";

describe("mode entretien — questions de code exécutées", () => {
  for (const q of interviewQuestions)
    if (q.kind === "code")
      it(`${q.id} : la réponse modèle passe, le code de départ échoue`, async () => {
        const ex = q.exercise;
        const r = ex.language === "sql" ? await gradeSql(ex, q.reponseModele) : await grade(ex, q.reponseModele);
        expect(r.status).toBe("passed");
        const s = ex.language === "sql" ? await gradeSql(ex, ex.starterCode) : await grade(ex, ex.starterCode);
        expect(s.status).not.toBe("passed");
      });
});

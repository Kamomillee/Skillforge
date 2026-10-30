import { describe, expect, it } from "vitest";
import { exerciseById, type PythonExercise, type SqlExercise } from "../../src/content";
import { variantExerciseIds, variantFor } from "../../src/content/variants";
import { grade } from "./pyodide";
import { gradeSql, q } from "./pglite";

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

describe("variantes des tests de validation", () => {
  it("chaque modèle est déterministe et la variante 0 est l'original", () => {
    for (const id of variantExerciseIds()) {
      expect(variantFor(id, 0).exercise).toBe(exerciseById.get(id));
      expect(variantFor(id, 3)).toEqual(variantFor(id, 3));
      expect(variantFor(id, 3).description).not.toBe("");
    }
  });

  it("Python : la solution de la variante passe ses tests (valeurs attendues = Pyodide), une boucle fausse échoue", async () => {
    for (const seed of SEEDS) {
      const v = variantFor("py-boucles-validation", seed).exercise as PythonExercise;
      const ok = await grade(v, v.referenceSolution);
      expect(ok.status, `graine ${seed}`).toBe("passed");
      const reset = v.referenceSolution.replace("    total = 0\n    for m in montants:\n", "    for m in montants:\n        total = 0\n");
      expect((await grade(v, `${reset}`)).status, `graine ${seed} (accumulateur réinitialisé)`).not.toBe("passed");
      // Les variantes « supérieur ou égal » refusent la solution de l'original (> strict) : elles demandent vraiment autre chose.
      const orig = exerciseById.get("py-boucles-validation")!.referenceSolution;
      if (v.referenceSolution.includes(">=")) {
        const r = await grade(v, orig);
        expect(r.status, `graine ${seed}`).toBe("failed");
        expect(r.misconceptions).toContain("condition-inversee");
      }
    }
  });

  it("SQL et BI : la référence de la variante passe, renvoie des lignes, et la requête de l'original échoue", async () => {
    for (const id of variantExerciseIds().filter((x) => exerciseById.get(x)!.language === "sql")) {
      const orig = exerciseById.get(id) as SqlExercise;
      for (const seed of SEEDS) {
        const v = variantFor(id, seed).exercise as SqlExercise;
        expect((await gradeSql(v, v.referenceSolution)).status, `${id} graine ${seed}`).toBe("passed");
        expect((await q(v.referenceSolution)).rows.length, `${id} graine ${seed}`).toBeGreaterThan(0);
        if (v.referenceSolution !== orig.referenceSolution) expect((await gradeSql(v, orig.referenceSolution)).status, `${id} graine ${seed}`).toBe("failed");
        // L'aide de niveau 4 est la solution de la variante, pas celle de l'original.
        expect(v.hints[3].text.trim()).toBe(v.referenceSolution.trim());
      }
    }
  });
});

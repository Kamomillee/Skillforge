import { describe, expect, it } from "vitest";
import { fiches } from "../../src/content/guides";
import { getPyodide } from "./pyodide";
import { q } from "./pglite";

describe("fiches de notions", () => {
  for (const [lessonId, f] of Object.entries(fiches))
    it(`l'exemple de « ${lessonId} » s'exécute réellement (${f.exemple.language})`, async () => {
      if (f.exemple.language === "sql") {
        expect((await q(f.exemple.code)).rows.length).toBeGreaterThan(0);
        return;
      }
      const py = await getPyodide();
      await py.loadPackagesFromImports(f.exemple.code, { messageCallback: () => {} });
      let out = "";
      py.setStdout({ batched: (s) => (out += s + "\n") });
      try {
        await py.runPythonAsync(f.exemple.code);
      } finally {
        py.setStdout();
      }
      expect(out.trim().length).toBeGreaterThan(0);
    });
});

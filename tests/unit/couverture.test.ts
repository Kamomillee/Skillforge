import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCoverage } from "../../scripts/couverture";

describe("docs/COUVERTURE.md", () => {
  it("est à jour par rapport à src/content/curriculum.ts", () => {
    const path = new URL("../../docs/COUVERTURE.md", import.meta.url);
    const expected = renderCoverage();
    if (process.env.UPDATE_DOCS) writeFileSync(path, expected);
    expect(readFileSync(path, "utf8"), "Lancer pnpm docs:couverture").toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { contentInventory } from "../../src/domain/admin";
import { decideSync, fingerprint, type ExportLike, type SyncState } from "../../src/domain/sync";

const data = (attempts: number, extra: Record<string, unknown> = {}): ExportLike => ({
  kv: { profile: { name: "Kamo" }, ...extra },
  drafts: [],
  attempts: Array.from({ length: attempts }, (_, i) => ({ id: i + 1, exerciseId: "x" })),
  events: [],
  reviews: [],
});
const state = (d: ExportLike, revision: number, userId = 1): SyncState => ({ revision, fingerprint: fingerprint(d), at: "2026-10-30T10:00:00Z", userId });

describe("synchronisation : jamais d'écrasement silencieux", () => {
  it("empreinte stable, insensible à l'ordre des clés, au temps actif et à l'état de synchronisation", () => {
    expect(fingerprint(data(2, { a: 1, b: 2 }))).toBe(fingerprint(data(2, { b: 2, a: 1 })));
    expect(fingerprint(data(2, { activity: { "2026-10-30": 600 } }))).toBe(fingerprint(data(2)));
    expect(fingerprint(data(2, { "sync:etat": { revision: 9 } }))).toBe(fingerprint(data(2)));
    expect(fingerprint(data(2))).not.toBe(fingerprint(data(3)));
  });

  it("table de décision", () => {
    const base = data(2);
    // Compte vide : on envoie.
    expect(decideSync(base, undefined, { revision: 0, hasData: false }, 1)).toEqual({ action: "envoyer", baseRevision: 0 });
    // Rien n'a changé.
    expect(decideSync(base, state(base, 3), { revision: 3, hasData: true }, 1)).toEqual({ action: "a-jour" });
    // Changé ici seulement : on envoie à partir de la révision connue.
    expect(decideSync(data(3), state(base, 3), { revision: 3, hasData: true }, 1)).toEqual({ action: "envoyer", baseRevision: 3 });
    // Changé ailleurs seulement : on récupère.
    expect(decideSync(base, state(base, 3), { revision: 4, hasData: true }, 1)).toEqual({ action: "recuperer" });
    // Changé des deux côtés : conflit, c'est l'étudiant qui choisit.
    expect(decideSync(data(3), state(base, 3), { revision: 4, hasData: true }, 1).action).toBe("conflit");
    // Premier rattachement : navigateur vide → récupérer ; navigateur avec progression → conflit.
    expect(decideSync({ kv: {}, drafts: [], attempts: [], events: [], reviews: [] }, undefined, { revision: 2, hasData: true }, 1)).toEqual({ action: "recuperer" });
    expect(decideSync(base, undefined, { revision: 2, hasData: true }, 1).action).toBe("conflit");
    // L'état de synchronisation d'un AUTRE compte n'est pas réutilisé.
    expect(decideSync(base, state(base, 3, 2), { revision: 3, hasData: true }, 1).action).toBe("conflit");
  });
});

describe("administration : inventaire des contenus", () => {
  it("chaque exercice a une solution, des tests visibles et cachés, 4 niveaux d'aide, et est accessible", () => {
    const rows = contentInventory();
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.filter((r) => r.issues.length).map((r) => `${r.id} : ${r.issues.join(", ")}`)).toEqual([]);
    expect(rows.every((r) => r.where !== "—")).toBe(true);
  });
});

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { Store, type Attempt } from "../../src/storage/store";

const open = () => Store.open(new IDBFactory(), "test");

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  exerciseId: "ex",
  exerciseVersion: 1,
  at: new Date().toISOString(),
  code: "x",
  status: "failed",
  passedCount: 1,
  total: 2,
  hiddenPassed: 0,
  hiddenTotal: 1,
  misconceptions: [],
  hintLevel: 0,
  solutionViewed: false,
  durationMs: 3,
  ...over,
});

describe("Store — brouillons", () => {
  it("crée puis incrémente la révision", async () => {
    const s = await open();
    const a = await s.saveDraft("ex", 1, "v1", 0);
    expect(a.ok && a.draft.revision).toBe(1);
    const b = await s.saveDraft("ex", 1, "v2", 1);
    expect(b.ok && b.draft.revision).toBe(2);
    expect((await s.getDraft("ex"))?.code).toBe("v2");
  });

  it("refuse d'écraser une version plus récente (conflit) puis accepte un forçage explicite", async () => {
    const s = await open();
    await s.saveDraft("ex", 1, "onglet A", 0); // rev 1
    await s.saveDraft("ex", 1, "onglet A bis", 1); // rev 2
    const stale = await s.saveDraft("ex", 1, "onglet B (basé sur rev 1)", 1);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.conflict.code).toBe("onglet A bis");
    expect((await s.getDraft("ex"))?.code).toBe("onglet A bis");
    const forced = await s.saveDraft("ex", 1, "onglet B (choix explicite)", 1, true);
    expect(forced.ok && forced.draft.revision).toBe(3);
  });

  it("rattache le brouillon à la version de l'exercice", async () => {
    const s = await open();
    await s.saveDraft("ex", 2, "code", 0);
    expect((await s.getDraft("ex"))?.exerciseVersion).toBe(2);
  });
});

describe("Store — tentatives, export, suppression", () => {
  it("liste les tentatives par exercice", async () => {
    const s = await open();
    await s.addAttempt(attempt({ exerciseId: "a" }));
    await s.addAttempt(attempt({ exerciseId: "b" }));
    await s.addAttempt(attempt({ exerciseId: "a", status: "passed" }));
    expect(await s.listAttempts("a")).toHaveLength(2);
    expect(await s.listAttempts()).toHaveLength(3);
  });

  it("export puis réimport restitue les mêmes données", async () => {
    const s = await open();
    await s.saveProfile({ name: "K" } as never);
    await s.saveDraft("ex", 1, "brouillon", 0);
    await s.addAttempt(attempt());
    await s.addEvent({ type: "lesson-open", lessonId: "l" });
    const dump = await s.exportAll();
    await s.clearAll();
    expect(await s.listAttempts()).toHaveLength(0);
    await s.importAll(JSON.parse(JSON.stringify(dump)));
    expect((await s.getProfile())?.name).toBe("K");
    expect((await s.getDraft("ex"))?.code).toBe("brouillon");
    expect(await s.listAttempts()).toHaveLength(1);
    expect(await s.listEvents("lesson-open")).toHaveLength(1);
  });

  it("refuse un fichier d'import inconnu", async () => {
    const s = await open();
    await expect(s.importAll({ format: "autre" } as never)).rejects.toThrow("non reconnu");
  });

  it("cumule le temps actif par jour", async () => {
    const s = await open();
    await s.addActiveSeconds(15, "2026-10-30");
    await s.addActiveSeconds(15, "2026-10-30");
    expect((await s.getActivity())["2026-10-30"]).toBe(30);
  });
});

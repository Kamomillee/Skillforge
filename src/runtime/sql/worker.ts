/// <reference lib="webworker" />
/**
 * PostgreSQL (PGlite) isolé dans un Web Worker. statement_timeout n'est pas opérant dans PGlite :
 * la limite de temps est appliquée par le client, qui termine ce worker et en recrée un.
 */
import { PGlite } from "@electric-sql/pglite";
import { describeSchema, runChecks, runQuery, seedPme } from "./engine";
import type { FromSqlWorker, ToSqlWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;
let db: PGlite | null = null;
const post = (m: FromSqlWorker) => self.postMessage(m);

self.onmessage = async (ev: MessageEvent<ToSqlWorker>) => {
  const m = ev.data;
  try {
    if (m.type === "init") {
      const t0 = performance.now();
      try {
        db = await PGlite.create();
        await seedPme(db);
        const v = await db.query<{ v: string }>("SELECT current_setting('server_version') AS v");
        post({ type: "ready", id: m.id, version: v.rows[0].v, loadMs: Math.round(performance.now() - t0) });
      } catch (e) {
        post({ type: "init-error", id: m.id, message: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (!db) return post({ type: "fatal", id: m.id, message: "Base non initialisée." });
    if (m.type === "query") post({ type: "query-done", id: m.id, outcome: await runQuery(db, m.sql, m.maxRows) });
    else if (m.type === "checks") post({ type: "checks-done", id: m.id, outcomes: await runChecks(db, m.student, m.reference, m.checks) });
    else if (m.type === "schema") post({ type: "schema-done", id: m.id, tables: await describeSchema(db) });
    else if (m.type === "reset") {
      await seedPme(db);
      post({ type: "reset-done", id: m.id });
    }
  } catch (e) {
    post({ type: "fatal", id: m.id, message: e instanceof Error ? e.message : String(e) });
  }
};

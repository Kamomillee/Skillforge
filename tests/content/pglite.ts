import { PGlite } from "@electric-sql/pglite";
import { runChecks, runQuery, seedPme } from "../../src/runtime/sql/engine";
import { buildSqlReport } from "../../src/grading/evaluate";
import { checkSpecs, type SqlExercise } from "../../src/content/types";

let db: Promise<PGlite> | null = null;

/** Même moteur, même schéma et mêmes données que dans le navigateur. */
export function getDb() {
  db ??= (async () => {
    const d = await PGlite.create();
    await seedPme(d);
    return d;
  })();
  return db;
}

export async function gradeSql(ex: SqlExercise, code: string) {
  const d = await getDb();
  const outcomes = await runChecks(d, code, ex.referenceSolution, checkSpecs(ex));
  return buildSqlReport(ex, outcomes, 0, code);
}

export async function q(sql: string, setup?: string) {
  const r = await runQuery(await getDb(), sql, 10_000, setup);
  if (!r.ok) throw new Error(`${r.error.code} ${r.error.message}\n${sql}`);
  return r.result;
}

/**
 * Moteur SQL commun au worker du navigateur et aux tests Node : PGlite (PostgreSQL 18 en WebAssembly).
 * Toute requête d'exercice est exécutée dans une transaction annulée (ROLLBACK) : la base de formation
 * reste intacte, quelle que soit la requête.
 */
import type { PGlite } from "@electric-sql/pglite";
import { PME_SCHEMA, generatePme } from "../../content/datasets/pme";

export interface ResultSet {
  columns: string[];
  types: number[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
}

export interface SqlError {
  message: string;
  code?: string;
  position?: number;
  hint?: string;
  detail?: string;
}

export type QueryOutcome = { ok: true; result: ResultSet; durationMs: number } | { ok: false; error: SqlError; durationMs: number };

export interface CheckSpec {
  id: string;
  setup?: string;
}

export interface CheckOutcome {
  id: string;
  expected: QueryOutcome;
  got: QueryOutcome;
}

const DATE = 1082;

function normalizeValue(v: unknown, type: number): unknown {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return String(v);
    return type === DATE ? v.toISOString().slice(0, 10) : v.toISOString().replace("T", " ").replace(".000Z", "");
  }
  if (typeof v === "bigint") return Number(v);
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v;
}

export function toSqlError(e: unknown): SqlError {
  const x = e as { message?: string; code?: string; position?: string | number; hint?: string; detail?: string };
  return {
    message: x?.message ?? String(e),
    code: x?.code,
    position: x?.position !== undefined ? Number(x.position) : undefined,
    hint: x?.hint,
    detail: x?.detail,
  };
}

export async function seedPme(db: PGlite) {
  await db.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await db.exec(PME_SCHEMA);
  await db.exec(generatePme().sql);
}

/** Premier mot-clé d'une requête, commentaires retirés. */
export function firstKeyword(sql: string) {
  const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  return (/^[A-Za-z]+/.exec(s)?.[0] ?? "").toUpperCase();
}

const TX_CONTROL = new Set(["BEGIN", "START", "COMMIT", "END", "ROLLBACK", "ABORT", "SAVEPOINT", "RELEASE", "PREPARE"]);

/** Exécute une requête unique dans une transaction annulée. */
export async function runQuery(db: PGlite, sql: string, maxRows = 500, setup?: string): Promise<QueryOutcome> {
  const t0 = performance.now();
  if (TX_CONTROL.has(firstKeyword(sql)))
    return {
      ok: false,
      durationMs: 0,
      error: { message: "Les commandes de transaction (BEGIN, COMMIT, ROLLBACK…) ne sont pas utilisées ici : chaque requête s'exécute déjà dans une transaction annulée.", code: "SF001" },
    };
  if (!sql.trim()) return { ok: false, durationMs: 0, error: { message: "La requête est vide.", code: "SF002" } };
  await db.exec("BEGIN");
  try {
    if (setup) await db.exec(setup);
    const res = await db.query<unknown[]>(sql, [], { rowMode: "array" });
    const types = res.fields.map((f) => f.dataTypeID);
    const all = res.rows ?? [];
    return {
      ok: true,
      durationMs: Math.round(performance.now() - t0),
      result: {
        columns: res.fields.map((f) => f.name),
        types,
        rows: all.slice(0, maxRows).map((row) => row.map((v, i) => normalizeValue(v, types[i]))),
        rowCount: res.affectedRows && !res.fields.length ? res.affectedRows : all.length,
        truncated: all.length > maxRows,
      },
    };
  } catch (e) {
    return { ok: false, error: toSqlError(e), durationMs: Math.round(performance.now() - t0) };
  } finally {
    await db.exec("ROLLBACK");
  }
}

/** Pour chaque vérification : même état de base (+ préparation éventuelle), requête de référence puis requête de l'étudiant. */
export async function runChecks(db: PGlite, student: string, reference: string, checks: CheckSpec[], maxRows = 5000): Promise<CheckOutcome[]> {
  const out: CheckOutcome[] = [];
  for (const c of checks) {
    const expected = await runQuery(db, reference, maxRows, c.setup);
    const got = await runQuery(db, student, maxRows, c.setup);
    out.push({ id: c.id, expected, got });
  }
  return out;
}

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string; nullable: boolean; pk: boolean; fk?: string }[];
  rowCount: number;
}

export async function describeSchema(db: PGlite): Promise<SchemaTable[]> {
  const cols = await db.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  );
  const keys = await db.query<{ table_name: string; column_name: string; constraint_type: string; ref_table: string | null; ref_column: string | null }>(
    `SELECT kcu.table_name, kcu.column_name, tc.constraint_type, ccu.table_name AS ref_table, ccu.column_name AS ref_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_type = 'FOREIGN KEY' AND ccu.constraint_name = tc.constraint_name
     WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')`,
  );
  const tables = new Map<string, SchemaTable>();
  for (const c of cols.rows) {
    const t = tables.get(c.table_name) ?? { name: c.table_name, columns: [], rowCount: 0 };
    const k = keys.rows.filter((x) => x.table_name === c.table_name && x.column_name === c.column_name);
    const fk = k.find((x) => x.constraint_type === "FOREIGN KEY");
    t.columns.push({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === "YES",
      pk: k.some((x) => x.constraint_type === "PRIMARY KEY"),
      fk: fk ? `${fk.ref_table}.${fk.ref_column}` : undefined,
    });
    tables.set(c.table_name, t);
  }
  for (const t of tables.values()) {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${t.name}"`);
    t.rowCount = r.rows[0].n;
  }
  return [...tables.values()];
}

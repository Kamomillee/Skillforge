import type { ResultSet } from "../runtime/sql/engine";

/**
 * Comparaison de résultats SQL avec une sémantique adaptée :
 * - multiensemble de lignes (les doublons comptent) ;
 * - ordre vérifié seulement si l'exercice l'exige, et seulement sur les colonnes de tri (les ex aequo peuvent permuter) ;
 * - colonnes comparées par nom (alias) ou par position ;
 * - nombres comparés avec tolérance (numeric renvoyé en texte par PostgreSQL).
 */
export interface CompareOptions {
  columnMode: "names" | "position";
  orderBy?: string[];
  tolerance: number;
}

export type Diff =
  | { kind: "ok" }
  | { kind: "columns"; expected: string[]; got: string[] }
  | { kind: "rows"; expectedCount: number; gotCount: number; missing: unknown[][]; extra: unknown[][] }
  | { kind: "order"; firstMismatch: number };

const NUMERIC_TYPES = new Set([20, 21, 23, 700, 701, 1700]);

function norm(v: unknown, numeric: boolean, tol: number): unknown {
  if (v === null || v === undefined) return null;
  if (numeric || typeof v === "number") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isNaN(n)) {
      const step = tol > 0 ? tol * 2 : 1e-9;
      return Math.round(n / step) * step;
    }
  }
  return v;
}

const key = (row: unknown[]) => JSON.stringify(row);

export function compareResults(expected: ResultSet, got: ResultSet, opt: CompareOptions): Diff {
  const ec = expected.columns.map((c) => c.toLowerCase());
  const gc = got.columns.map((c) => c.toLowerCase());
  let mapping: number[];
  if (opt.columnMode === "names") {
    if (ec.length !== gc.length || ec.some((c) => !gc.includes(c))) return { kind: "columns", expected: expected.columns, got: got.columns };
    mapping = ec.map((c) => gc.indexOf(c));
  } else {
    if (ec.length !== gc.length) return { kind: "columns", expected: expected.columns, got: got.columns };
    mapping = ec.map((_, i) => i);
  }
  const numeric = expected.types.map((t, i) => NUMERIC_TYPES.has(t) || NUMERIC_TYPES.has(got.types[mapping[i]]));
  const E = expected.rows.map((r) => r.map((v, i) => norm(v, numeric[i], opt.tolerance)));
  const G = got.rows.map((r) => mapping.map((j, i) => norm(r[j], numeric[i], opt.tolerance)));

  // Multiensemble.
  const counts = new Map<string, { n: number; row: unknown[] }>();
  for (const r of E) {
    const k = key(r);
    counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, row: r });
  }
  const extra: unknown[][] = [];
  for (const r of G) {
    const k = key(r);
    const c = counts.get(k);
    if (c && c.n > 0) c.n--;
    else extra.push(r);
  }
  const missing: unknown[][] = [];
  for (const c of counts.values()) for (let i = 0; i < c.n; i++) missing.push(c.row);
  if (missing.length || extra.length || expected.rowCount !== got.rowCount)
    return { kind: "rows", expectedCount: expected.rowCount, gotCount: got.rowCount, missing: missing.slice(0, 3), extra: extra.slice(0, 3) };

  if (opt.orderBy?.length) {
    const idx = opt.orderBy.map((c) => ec.indexOf(c.toLowerCase()));
    if (idx.some((i) => i < 0)) throw new Error(`Colonne de tri inconnue dans l'exercice : ${opt.orderBy.join(", ")}`);
    for (let i = 0; i < E.length; i++) {
      if (key(idx.map((j) => E[i][j])) !== key(idx.map((j) => G[i][j]))) return { kind: "order", firstMismatch: i + 1 };
    }
  }
  return { kind: "ok" };
}

const cell = (v: unknown) => (v === null ? "NULL" : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v));
export const formatRow = (r: unknown[]) => `(${r.map(cell).join(", ")})`;

export function describeDiff(d: Diff): string {
  switch (d.kind) {
    case "ok":
      return "Résultat identique.";
    case "columns":
      return `Colonnes attendues : ${d.expected.join(", ")}. Colonnes obtenues : ${d.got.join(", ") || "(aucune)"}.`;
    case "rows": {
      const parts = [`Lignes attendues : ${d.expectedCount}, obtenues : ${d.gotCount}.`];
      if (d.missing.length) parts.push(`Manquante(s) : ${d.missing.map(formatRow).join(" ; ")}`);
      if (d.extra.length) parts.push(`En trop ou différente(s) : ${d.extra.map(formatRow).join(" ; ")}`);
      return parts.join("\n");
    }
    case "order":
      return `Les bonnes lignes sont présentes, mais l'ordre demandé n'est pas respecté (première différence à la ligne ${d.firstMismatch}).`;
  }
}

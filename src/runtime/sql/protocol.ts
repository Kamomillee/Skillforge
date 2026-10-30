import type { CheckOutcome, CheckSpec, QueryOutcome, SchemaTable } from "./engine";

export type ToSqlWorker =
  | { type: "init"; id: number }
  | { type: "query"; id: number; sql: string; maxRows: number; setup?: string }
  | { type: "checks"; id: number; student: string; reference: string; checks: CheckSpec[] }
  | { type: "schema"; id: number }
  | { type: "reset"; id: number };

export type FromSqlWorker =
  | { type: "ready"; id: number; version: string; loadMs: number }
  | { type: "init-error"; id: number; message: string }
  | { type: "query-done"; id: number; outcome: QueryOutcome }
  | { type: "checks-done"; id: number; outcomes: CheckOutcome[] }
  | { type: "schema-done"; id: number; tables: SchemaTable[] }
  | { type: "reset-done"; id: number }
  | { type: "fatal"; id: number; message: string };

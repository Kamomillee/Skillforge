import { checkSpecs, type SqlExercise } from "../../content/types";
import { buildSqlReport, type GradeReport } from "../../grading/evaluate";
import type { QueryOutcome, SchemaTable } from "./engine";
import type { FromSqlWorker, ToSqlWorker } from "./protocol";
import type { RunnerState } from "../python/client";

type Reply = Exclude<FromSqlWorker, { type: "ready" | "init-error" }>;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * Client du worker PostgreSQL (PGlite). Une requête à la fois ; limite de temps appliquée en
 * terminant le worker (PGlite n'applique pas statement_timeout), puis base recréée et réensemencée.
 */
export class SqlRunner {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private pending: { id: number; resolve: (r: Reply | null) => void; timer: ReturnType<typeof setTimeout>; stopped?: "timeout" | "interrupted" } | null = null;
  private nextId = 1;
  private version = "";
  private listeners = new Set<(s: RunnerState) => void>();
  state: RunnerState = { kind: "idle" };

  subscribe(fn: (s: RunnerState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => void this.listeners.delete(fn);
  }
  private setState(s: RunnerState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }
  private setReady() {
    this.setState({ kind: "ready", pythonVersion: `PostgreSQL ${this.version}`, interruptible: false });
  }
  get isBusy() {
    return this.pending !== null;
  }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.setState({ kind: "loading", message: "Démarrage de PostgreSQL dans le navigateur…" });
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "sql" });
    this.worker = worker;
    const id = this.nextId++;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (ev: MessageEvent<FromSqlWorker>) => {
        const m = ev.data;
        if (m.type === "ready") {
          this.version = m.version;
          this.setReady();
          resolve();
        } else if (m.type === "init-error") {
          this.ready = null;
          this.setState({ kind: "error", message: `PostgreSQL n'a pas pu démarrer : ${m.message}` });
          reject(new Error(m.message));
        } else if (this.pending && m.id === this.pending.id) this.finish(m);
      };
      worker.onerror = (e) => {
        this.ready = null;
        this.setState({ kind: "error", message: `Le moteur SQL a rencontré une erreur : ${e.message}` });
        reject(new Error(e.message));
      };
    });
    worker.postMessage({ type: "init", id } satisfies ToSqlWorker);
    return this.ready;
  }

  private finish(m: Reply | null) {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    if (this.worker) this.setReady();
    p.resolve(m);
  }

  stop(reason: "timeout" | "interrupted" = "interrupted") {
    const p = this.pending;
    if (!p) return;
    p.stopped = reason;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.setState({ kind: "idle" });
    this.finish(null);
    void this.init().catch(() => {});
  }

  /** Les requêtes sont sérialisées : une visualisation de leçon attend la fin de la requête en cours. */
  private chain: Promise<unknown> = Promise.resolve();

  private send(msg: DistributiveOmit<ToSqlWorker, "id">, timeoutMs: number, busyMessage: string) {
    const run = this.chain.catch(() => {}).then(() => this.sendNow(msg, timeoutMs, busyMessage));
    this.chain = run;
    return run;
  }

  private async sendNow(msg: DistributiveOmit<ToSqlWorker, "id">, timeoutMs: number, busyMessage: string) {
    await this.init();
    const id = this.nextId++;
    this.setState({ kind: "busy", message: busyMessage });
    const started = performance.now();
    let stopped: "timeout" | "interrupted" | undefined;
    const reply = await new Promise<Reply | null>((resolve) => {
      const timer = setTimeout(() => this.stop("timeout"), timeoutMs);
      this.pending = { id, resolve, timer };
      const p = this.pending;
      const orig = resolve;
      p.resolve = (r) => {
        stopped = p.stopped;
        orig(r);
      };
      this.worker!.postMessage({ ...msg, id } as ToSqlWorker);
    });
    return { reply, stopped, durationMs: Math.round(performance.now() - started) };
  }

  async query(sql: string, timeoutMs = 8000, maxRows = 500, setup?: string): Promise<{ status: "ok" | "timeout" | "interrupted" | "error"; outcome?: QueryOutcome; message?: string }> {
    const { reply, stopped } = await this.send({ type: "query", sql, maxRows, setup }, timeoutMs, "Exécution de la requête…");
    if (stopped || !reply) return { status: stopped ?? "interrupted" };
    if (reply.type === "fatal") return { status: "error", message: reply.message };
    if (reply.type !== "query-done") return { status: "error", message: "Réponse inattendue." };
    return { status: "ok", outcome: reply.outcome };
  }

  async grade(ex: SqlExercise, code: string): Promise<GradeReport> {
    const { reply, stopped, durationMs } = await this.send(
      { type: "checks", student: code, reference: ex.referenceSolution, checks: checkSpecs(ex) },
      ex.timeLimitMs,
      "Vérification sur les données de test…",
    );
    const empty: GradeReport = {
      exerciseId: ex.id,
      exerciseVersion: ex.version,
      status: stopped ?? "error",
      passedCount: 0,
      total: ex.checks.length,
      hiddenPassed: 0,
      hiddenTotal: ex.checks.filter((c) => c.hidden).length,
      tests: [],
      misconceptions: [],
      stdout: "",
      durationMs,
    };
    if (stopped || !reply) return empty;
    if (reply.type === "fatal") return { ...empty, sqlError: { message: reply.message } };
    if (reply.type !== "checks-done") return empty;
    return buildSqlReport(ex, reply.outcomes, durationMs, code);
  }

  async schema(): Promise<SchemaTable[]> {
    const { reply } = await this.send({ type: "schema" }, 15000, "Lecture du schéma…");
    return reply?.type === "schema-done" ? reply.tables : [];
  }

  async reset(): Promise<void> {
    await this.send({ type: "reset" }, 30000, "Réinitialisation des données…");
  }
}

let shared: SqlRunner | null = null;
export function getSqlRunner() {
  shared ??= new SqlRunner();
  return shared;
}

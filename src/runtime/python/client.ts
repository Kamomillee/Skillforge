import type { PythonExercise } from "../../content/types";
import type { PyErrorInfo } from "../../grading/errors";
import { buildReport, gradingSpec, type GradeReport } from "../../grading/evaluate";
import type { FromWorker, ToWorker } from "./protocol";

export type RunnerState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "ready"; pythonVersion: string; interruptible: boolean }
  | { kind: "busy"; message: string }
  | { kind: "error"; message: string };

export interface RunResult {
  status: "ok" | "error" | "timeout" | "interrupted";
  error: PyErrorInfo | null;
  output: string;
  durationMs: number;
}

type StopReason = "timeout" | "interrupted";
type Done = Extract<FromWorker, { type: "run-done" | "grade-done" | "fatal" }>;
type Payload = { code: string; packages: string[]; spec?: string };

interface Pending {
  id: number;
  kind: "run" | "grade";
  resolve: (r: { msg: Done | null; stopReason?: StopReason }) => void;
  onStdout?: (t: string) => void;
  timer: ReturnType<typeof setTimeout>;
  stopReason?: StopReason;
}

/**
 * Client du worker Python. Un seul programme à la fois ; limite de temps ;
 * interruption douce (KeyboardInterrupt) puis, à défaut, arrêt et redémarrage du worker.
 */
export class PythonRunner {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private interrupt: Uint8Array | null = null;
  private pending: Pending | null = null;
  private nextId = 1;
  private pythonVersion = "";
  private listeners = new Set<(s: RunnerState) => void>();
  state: RunnerState = { kind: "idle" };

  constructor(private readonly indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, location.origin).href) {}

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
    this.setState({ kind: "ready", pythonVersion: this.pythonVersion, interruptible: this.interrupt !== null });
  }

  get isBusy() {
    return this.pending !== null;
  }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.setState({ kind: "loading", message: "Démarrage de Python dans le navigateur…" });
    const sab = typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated ? new SharedArrayBuffer(1) : null;
    this.interrupt = sab ? new Uint8Array(sab) : null;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "python" });
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (ev: MessageEvent<FromWorker>) => {
        const m = ev.data;
        if (m.type === "ready") {
          this.pythonVersion = m.pythonVersion;
          this.setReady();
          resolve();
        } else if (m.type === "init-error") {
          this.ready = null;
          this.setState({ kind: "error", message: `Python n'a pas pu démarrer : ${m.message}` });
          reject(new Error(m.message));
        } else this.onMessage(m);
      };
      worker.onerror = (e) => {
        this.ready = null;
        this.setState({ kind: "error", message: `Le moteur Python a rencontré une erreur : ${e.message}` });
        reject(new Error(e.message));
      };
    });
    worker.postMessage({ type: "init", indexURL: this.indexURL, interruptBuffer: sab } satisfies ToWorker);
    return this.ready;
  }

  private onMessage(m: FromWorker) {
    if (m.type === "status") return this.setState({ kind: "busy", message: m.message });
    const p = this.pending;
    if (!p || !("id" in m) || m.id !== p.id) return;
    if (m.type === "stdout") return p.onStdout?.(m.text);
    if (m.type === "stdout-truncated") return p.onStdout?.("[… sortie tronquée après 50 000 caractères]");
    this.finish(p, m);
  }

  private finish(p: Pending, msg: Done | null) {
    clearTimeout(p.timer);
    if (this.pending === p) this.pending = null;
    if (this.worker) this.setReady();
    p.resolve({ msg, stopReason: p.stopReason });
  }

  /** Arrête le programme en cours (bouton « Arrêter » ou limite de temps). */
  stop(reason: StopReason = "interrupted") {
    const p = this.pending;
    if (!p) return;
    p.stopReason = reason;
    if (this.interrupt) {
      Atomics.store(this.interrupt, 0, 2); // SIGINT → KeyboardInterrupt dans Python
      // Si Python ne rend pas la main (code natif bloquant), on termine le worker.
      setTimeout(() => this.pending === p && this.restart(), 1500);
    } else this.restart();
  }

  /** Termine le worker (état Python perdu) et en prépare un neuf. */
  restart() {
    const p = this.pending;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.pending = null;
    this.setState({ kind: "idle" });
    if (p) this.finish(p, null);
    void this.init().catch(() => {});
  }

  private async send(kind: "run" | "grade", payload: Payload, timeoutMs: number, onStdout?: (t: string) => void) {
    if (this.pending) throw new Error("Un programme est déjà en cours d'exécution.");
    await this.init();
    const id = this.nextId++;
    if (this.interrupt) Atomics.store(this.interrupt, 0, 0);
    this.setState({ kind: "busy", message: kind === "run" ? "Exécution…" : "Vérification avec les tests…" });
    const started = performance.now();
    const res = await new Promise<{ msg: Done | null; stopReason?: StopReason }>((resolve) => {
      const timer = setTimeout(() => this.stop("timeout"), timeoutMs);
      this.pending = { id, kind, resolve, onStdout, timer };
      this.worker!.postMessage({ type: kind, id, code: payload.code, packages: payload.packages, spec: payload.spec ?? "" } as ToWorker);
    });
    return { ...res, durationMs: Math.round(performance.now() - started) };
  }

  async run(code: string, opts: { timeoutMs?: number; packages?: string[]; onStdout?: (t: string) => void } = {}): Promise<RunResult> {
    let output = "";
    const { msg, stopReason, durationMs } = await this.send("run", { code, packages: opts.packages ?? [] }, opts.timeoutMs ?? 10_000, (t) => {
      output += t + "\n";
      opts.onStdout?.(t);
    });
    if (stopReason || !msg || (msg.type === "run-done" && msg.interrupted))
      return { status: stopReason ?? "interrupted", error: null, output, durationMs };
    if (msg.type === "fatal") return { status: "error", error: fatalError(msg.message), output, durationMs };
    const error = msg.type === "run-done" ? msg.error : null;
    return { status: error ? "error" : "ok", error, output, durationMs };
  }

  async grade(ex: PythonExercise, code: string): Promise<GradeReport> {
    const { msg, stopReason, durationMs } = await this.send("grade", { code, spec: gradingSpec(ex), packages: ex.packages }, ex.timeLimitMs);
    const empty: GradeReport = {
      exerciseId: ex.id,
      exerciseVersion: ex.version,
      status: "error",
      passedCount: 0,
      total: ex.tests.length,
      hiddenPassed: 0,
      hiddenTotal: ex.tests.filter((t) => t.hidden).length,
      tests: [],
      misconceptions: [],
      stdout: "",
      durationMs,
    };
    if (stopReason || !msg || (msg.type === "grade-done" && msg.interrupted)) return { ...empty, status: stopReason ?? "interrupted" };
    if (msg.type === "fatal") return { ...empty, loadError: fatalError(msg.message) };
    if (msg.type !== "grade-done" || !msg.result) return empty;
    return buildReport(ex, msg.result, durationMs);
  }
}

function fatalError(message: string): PyErrorInfo {
  return { type: "Erreur interne", message, line: null, text: null, summary: message, frames: [] };
}

let shared: PythonRunner | null = null;
export function getRunner() {
  shared ??= new PythonRunner();
  return shared;
}

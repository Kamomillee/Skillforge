/// <reference lib="webworker" />
/**
 * Exécution Python isolée dans un Web Worker (Pyodide).
 * - Jamais dans le thread principal ni sur un serveur applicatif.
 * - Pas de secrets : le worker ne reçoit que le code et la spécification de test.
 * - Interruption : SharedArrayBuffer (KeyboardInterrupt) si l'isolation cross-origin est active,
 *   sinon le client termine le worker et en démarre un neuf.
 */
import type { PyodideInterface } from "pyodide";
import { HARNESS_PY } from "../../grading/harness";
import type { FromWorker, ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const MAX_STREAM_CHARS = 50_000;
let py: PyodideInterface | null = null;
let currentId = -1;
let streamed = 0;
let truncatedSent = false;
const loadedPackages = new Set<string>();

const post = (m: FromWorker) => self.postMessage(m);

async function init(indexURL: string, interruptBuffer: SharedArrayBuffer | null) {
  const t0 = performance.now();
  try {
    const mod = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as typeof import("pyodide");
    py = await mod.loadPyodide({ indexURL });
    if (interruptBuffer) py.setInterruptBuffer(new Uint8Array(interruptBuffer));
    py.setStdout({
      batched: (text) => {
        if (currentId < 0) return;
        if (streamed > MAX_STREAM_CHARS) {
          if (!truncatedSent) post({ type: "stdout-truncated", id: currentId });
          truncatedSent = true;
          return;
        }
        streamed += text.length;
        post({ type: "stdout", id: currentId, text });
      },
    });
    py.setStderr({ batched: (text) => currentId >= 0 && post({ type: "stdout", id: currentId, text }) });
    // Pas d'accès réseau depuis le code d'exercice : on retire pyfetch / open_url.
    py.runPython(`
import sys
for _m in ("pyodide.http",):
    sys.modules[_m] = None
del _m
`);
    py.runPython(HARNESS_PY);
    const pythonVersion = py.runPython("import sys; sys.version.split()[0]") as string;
    post({ type: "ready", version: py.version, pythonVersion, loadMs: Math.round(performance.now() - t0) });
  } catch (e) {
    post({ type: "init-error", message: e instanceof Error ? e.message : String(e) });
  }
}

async function ensurePackages(id: number, pkgs: string[]) {
  const missing = pkgs.filter((p) => !loadedPackages.has(p));
  if (!missing.length || !py) return;
  post({ type: "packages", id, phase: "start" });
  post({ type: "status", message: `Chargement de ${missing.join(", ")} (une seule fois)…` });
  try {
    await py.loadPackage(missing, { messageCallback: () => {} });
    missing.forEach((p) => loadedPackages.add(p));
  } finally {
    post({ type: "packages", id, phase: "done" });
  }
}

const isInterrupt = (e: unknown) => e instanceof Error && /KeyboardInterrupt/.test(e.message);

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  if (msg.type === "init") return init(msg.indexURL, msg.interruptBuffer);
  if (!py) return post({ type: "fatal", id: msg.id, message: "Python n'est pas initialisé." });
  currentId = msg.id;
  streamed = 0;
  truncatedSent = false;
  try {
    await ensurePackages(msg.id, msg.packages);
    if (msg.type === "run") {
      const fn = py.globals.get("sf_run");
      try {
        const out = JSON.parse(fn(msg.code));
        post({ type: "run-done", id: msg.id, error: out.error, interrupted: false });
      } finally {
        fn.destroy();
      }
    } else {
      const fn = py.globals.get("sf_grade");
      try {
        post({ type: "grade-done", id: msg.id, result: JSON.parse(fn(msg.code, msg.spec)), interrupted: false });
      } finally {
        fn.destroy();
      }
    }
  } catch (e) {
    if (isInterrupt(e)) {
      if (msg.type === "run") post({ type: "run-done", id: msg.id, error: null, interrupted: true });
      else post({ type: "grade-done", id: msg.id, result: null, interrupted: true });
    } else {
      post({ type: "fatal", id: msg.id, message: e instanceof Error ? e.message : String(e) });
    }
  } finally {
    currentId = -1;
  }
};

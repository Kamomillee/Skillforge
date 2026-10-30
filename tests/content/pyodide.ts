import { loadPyodide, type PyodideInterface } from "pyodide";
import { resolve } from "node:path";
import { HARNESS_PY } from "../../src/grading/harness";
import { buildReport, gradingSpec, type RawGradeResult } from "../../src/grading/evaluate";
import type { PythonExercise } from "../../src/content/types";

let py: Promise<PyodideInterface> | null = null;

/** Même harnais et même version de Pyodide que dans le navigateur (public/pyodide). */
export function getPyodide() {
  py ??= (async () => {
    const p = await loadPyodide({ indexURL: resolve("public/pyodide") + "/" });
    p.runPython(HARNESS_PY);
    return p;
  })();
  return py;
}

export async function grade(ex: PythonExercise, code: string) {
  const p = await getPyodide();
  const fn = p.globals.get("sf_grade");
  const raw = JSON.parse(fn(code, gradingSpec(ex))) as RawGradeResult;
  fn.destroy();
  return buildReport(ex, raw, 0);
}

export async function trace(code: string, watch: string[]) {
  const p = await getPyodide();
  const fn = p.globals.get("sf_trace");
  const out = JSON.parse(fn(code, JSON.stringify(watch)));
  fn.destroy();
  return out as { steps: { line: number; vars: Record<string, string> }[]; stdout: string };
}

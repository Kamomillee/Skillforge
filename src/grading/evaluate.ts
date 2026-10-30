import type { Exercise, TestCase } from "../content/types";
import type { PyErrorInfo } from "./errors";

/** Résultat brut renvoyé par sf_grade (harnais Python). */
export interface RawGradeResult {
  stdout: string;
  stdoutTruncated?: boolean;
  loadError: PyErrorInfo | null;
  missingFunction: boolean;
  placeholder: boolean;
  tests: {
    id: string;
    passed: boolean;
    got?: string;
    error?: PyErrorInfo;
    returnedNone?: boolean;
    mutated?: boolean;
    stdout?: string;
  }[];
}

export interface TestReport {
  id: string;
  label: string;
  hidden: boolean;
  passed: boolean;
  /** Détails visibles seulement pour les tests visibles. */
  args?: string;
  expected?: string;
  got?: string;
  error?: PyErrorInfo;
  feedback?: string;
  misconception?: string;
}

export interface GradeReport {
  exerciseId: string;
  exerciseVersion: number;
  status: "passed" | "failed" | "error" | "timeout" | "interrupted";
  passedCount: number;
  total: number;
  hiddenPassed: number;
  hiddenTotal: number;
  loadError?: PyErrorInfo;
  missingFunction?: boolean;
  placeholder?: boolean;
  tests: TestReport[];
  misconceptions: string[];
  stdout: string;
  durationMs: number;
}

const show = (v: unknown) => pyRepr(v);

/** Représentation façon Python (True/False/None, guillemets simples) pour l'affichage. */
export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "string") return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  if (typeof v === "object") return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(", ")}}`;
  return String(v);
}

function feedbackFor(t: TestCase, r: RawGradeResult["tests"][number]): string | undefined {
  if (r.passed) return undefined;
  if (r.error) return `La fonction a levé ${r.error.type} sur ce cas.`;
  if (r.mutated) return "Le résultat est juste, mais la liste reçue en argument a été modifiée.";
  if (r.returnedNone) return "La fonction a retourné None : as-tu oublié return (ou utilisé print à la place) ?";
  return t.hidden ? "Le résultat ne correspond pas à l'attendu sur ce cas." : undefined;
}

export function buildReport(ex: Exercise, raw: RawGradeResult, durationMs: number): GradeReport {
  const tests: TestReport[] = ex.tests.map((t) => {
    const r = raw.tests.find((x) => x.id === t.id);
    const passed = !!r?.passed;
    const base: TestReport = { id: t.id, label: t.label, hidden: t.hidden, passed };
    if (!r) return base;
    base.feedback = feedbackFor(t, r);
    base.error = r.error;
    if (!passed && t.misconception) base.misconception = t.misconception;
    if (!t.hidden) {
      base.args = t.args.map(show).join(", ");
      base.expected = t.display ?? show(t.expected);
      base.got = r.got;
    }
    return base;
  });
  const passedCount = tests.filter((t) => t.passed).length;
  const hidden = tests.filter((t) => t.hidden);
  const misconceptions = new Set<string>();
  for (const t of tests) if (t.misconception) misconceptions.add(t.misconception);
  if (raw.tests.some((t) => t.returnedNone)) misconceptions.add("valeur-retour");
  if (raw.tests.some((t) => t.mutated)) misconceptions.add("mutation-argument");
  let status: GradeReport["status"] = passedCount === tests.length ? "passed" : "failed";
  if (raw.loadError || raw.missingFunction) status = "error";
  return {
    exerciseId: ex.id,
    exerciseVersion: ex.version,
    status,
    passedCount,
    total: tests.length,
    hiddenPassed: hidden.filter((t) => t.passed).length,
    hiddenTotal: hidden.length,
    loadError: raw.loadError ?? undefined,
    missingFunction: raw.missingFunction || undefined,
    placeholder: raw.placeholder || undefined,
    tests,
    misconceptions: [...misconceptions],
    stdout: raw.stdout,
    durationMs,
  };
}

/** Spécification transmise au harnais (sans la solution de référence). */
export function gradingSpec(ex: Exercise) {
  return JSON.stringify({ functionName: ex.functionName, tests: ex.tests });
}

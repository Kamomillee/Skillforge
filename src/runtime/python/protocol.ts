import type { PyErrorInfo } from "../../grading/errors";
import type { RawGradeResult } from "../../grading/evaluate";

export type ToWorker =
  | { type: "init"; indexURL: string; interruptBuffer: SharedArrayBuffer | null }
  | { type: "run"; id: number; code: string; packages: string[] }
  | { type: "grade"; id: number; code: string; spec: string; packages: string[] };

export type FromWorker =
  | { type: "ready"; version: string; pythonVersion: string; loadMs: number }
  | { type: "init-error"; message: string }
  | { type: "status"; message: string }
  /** Début / fin du chargement de paquets : la limite de temps de l'exercice ne court pas pendant ce chargement. */
  | { type: "packages"; id: number; phase: "start" | "done" }
  | { type: "stdout"; id: number; text: string }
  | { type: "stdout-truncated"; id: number }
  | { type: "run-done"; id: number; error: PyErrorInfo | null; interrupted: boolean }
  | { type: "grade-done"; id: number; result: RawGradeResult | null; interrupted: boolean }
  | { type: "fatal"; id: number; message: string };

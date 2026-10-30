import { z } from "zod";

/**
 * Modèle des contenus pédagogiques. Les contenus sont des données versionnées,
 * séparées de la progression (storage/) et de l'exécution (runtime/).
 * Toute tentative est rattachée à `exerciseId` + `version`.
 */

export const contentStatus = ["prevu", "redige", "implemente", "teste", "disponible"] as const;
export type ContentStatus = (typeof contentStatus)[number];

export const statusLabel: Record<ContentStatus, string> = {
  prevu: "Prévu",
  redige: "Rédigé",
  implemente: "Implémenté",
  teste: "Testé",
  disponible: "Disponible",
};

export type DomainId = "python" | "sql" | "llm" | "bi" | "ml";

export interface Notion {
  id: string;
  title: string;
  status: ContentStatus;
  /** Objectif observable : ce que l'étudiant sait faire, vérifiable. */
  objective?: string;
  activities?: string[];
  evaluation?: string;
  project?: string;
  prerequisites?: string[];
  /** Leçons qui couvrent cette notion. */
  lessonIds?: string[];
}

export interface Module {
  id: string;
  domain: DomainId;
  letter: string;
  title: string;
  notions: Notion[];
}

export interface Domain {
  id: DomainId;
  title: string;
  short: string;
  description: string;
  modules: Module[];
  project: { title: string; summary: string; status: ContentStatus };
  plannedVisualizations: string[];
}

// ---------- Exercices ----------

export const testCaseSchema = z.object({
  id: z.string(),
  label: z.string(),
  args: z.array(z.unknown()),
  expected: z.unknown(),
  /** Affichage Python de la valeur attendue quand JSON la déforme (ex. 75.0 devient 75). */
  display: z.string().optional(),
  compare: z.enum(["exact", "approx"]).default("exact"),
  tolerance: z.number().optional(),
  hidden: z.boolean(),
  /** Étiquette d'erreur fréquente si ce test échoue (alimente le carnet d'erreurs). */
  misconception: z.string().optional(),
  /** Vérifie que la fonction ne modifie pas ses arguments. */
  checkNoMutation: z.boolean().optional(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const hintSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string(),
});

export const exerciseSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  kind: z.enum(["guided", "autonomous", "debug", "validation"]),
  title: z.string(),
  prompt: z.string(),
  functionName: z.string(),
  starterCode: z.string(),
  referenceSolution: z.string(),
  tests: z.array(testCaseSchema).min(1),
  hints: z.array(hintSchema).length(4),
  explanation: z.string(),
  conceptIds: z.array(z.string()).min(1),
  packages: z.array(z.string()).default([]),
  timeLimitMs: z.number().int().positive().default(5000),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const misconceptionLabels: Record<string, string> = {
  "liste-vide": "Oublier le cas de la liste vide",
  "accumulateur-reinitialise": "Réinitialiser l'accumulateur dans la boucle",
  "statut-ignore": "Ne pas filtrer selon le statut",
  "signe-remboursement": "Additionner un remboursement au lieu de le soustraire",
  "arrondi-flottant": "Oublier l'arrondi des nombres à virgule",
  "division-zero": "Diviser par zéro quand il n'y a aucun élément",
  "mutation-argument": "Modifier la liste reçue en argument",
  "condition-inversee": "Inverser ou élargir la condition (>, >=, <)",
  "valeur-retour": "Afficher avec print au lieu de retourner avec return",
};

// ---------- Leçons ----------

export interface TraceStep {
  /** Numéro de ligne (1-indexé) sur le point d'être exécutée. */
  line: number;
  vars: Record<string, string>;
  /** Explication textuelle équivalente (accessibilité, mode sans animation). */
  note: string;
  output?: string;
}

export type LessonBlock =
  | { type: "text"; md: string }
  | { type: "callout"; tone: "info" | "warning" | "success"; title: string; md: string }
  | { type: "code"; code: string; runnable?: boolean; caption?: string }
  | { type: "trace"; title: string; code: string; steps: TraceStep[] }
  | {
      type: "prediction";
      id: string;
      question: string;
      code?: string;
      choices: { id: string; label: string }[];
      answer: string;
      explanation: string;
    }
  | { type: "exercise"; exerciseId: string }
  | { type: "explain"; id: string; prompt: string; criteria: string[] }
  | { type: "project"; title: string; md: string };

/** Les 10 temps de la boucle pédagogique. */
export const loopStages = [
  "probleme",
  "intuition",
  "schema",
  "demonstration",
  "prediction",
  "guide",
  "autonome",
  "correction",
  "projet",
  "revision",
] as const;
export type LoopStage = (typeof loopStages)[number];

export const stageLabel: Record<LoopStage, string> = {
  probleme: "Problème concret",
  intuition: "Intuition",
  schema: "Schéma interactif",
  demonstration: "Démonstration",
  prediction: "Prédiction",
  guide: "Exercice guidé",
  autonome: "Exercice autonome",
  correction: "Débogage et correction",
  projet: "Application au projet",
  revision: "Révision",
};

export interface LessonSection {
  id: string;
  stage: LoopStage;
  title: string;
  blocks: LessonBlock[];
}

export interface Lesson {
  id: string;
  version: number;
  domain: DomainId;
  moduleId: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  conceptIds: string[];
  prerequisites: string[];
  objectives: string[];
  glossary: { term: string; en?: string; definition: string }[];
  /** Exercice qui permet de « sauter » la leçon en prouvant la compétence. */
  validationExerciseId?: string;
  sections: LessonSection[];
}

export interface Concept {
  id: string;
  title: string;
  domain: DomainId;
  definition: string;
}

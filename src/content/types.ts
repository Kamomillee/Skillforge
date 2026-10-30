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

export const exerciseKinds = ["guided", "autonomous", "debug", "validation", "project"] as const;

export const pythonExerciseSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  language: z.literal("python").default("python"),
  kind: z.enum(exerciseKinds),
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
export type PythonExercise = z.infer<typeof pythonExerciseSchema>;

export const sqlCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  hidden: z.boolean(),
  /** SQL exécuté avant la vérification, dans la même transaction annulée (données modifiées). */
  setup: z.string().optional(),
  misconception: z.string().optional(),
});
export type SqlCheck = z.infer<typeof sqlCheckSchema>;

export const sqlExerciseSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  language: z.literal("sql"),
  kind: z.enum(exerciseKinds),
  title: z.string(),
  prompt: z.string(),
  dataset: z.literal("pme"),
  starterCode: z.string(),
  referenceSolution: z.string(),
  /** L'ordre des lignes n'est vérifié que si l'énoncé l'exige ; il porte alors sur ces colonnes. */
  orderBy: z.array(z.string()).optional(),
  /** "names" : les noms (alias) de colonnes comptent ; "position" : seul l'ordre des colonnes compte. */
  columnMode: z.enum(["names", "position"]).default("names"),
  tolerance: z.number().default(0.005),
  checks: z.array(sqlCheckSchema).min(1),
  hints: z.array(hintSchema).length(4),
  explanation: z.string(),
  conceptIds: z.array(z.string()).min(1),
  timeLimitMs: z.number().int().positive().default(8000),
});
export type SqlExercise = z.infer<typeof sqlExerciseSchema>;

export type Exercise = PythonExercise | SqlExercise;

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
  "null-egalite": "Comparer à NULL avec = au lieu de IS NULL",
  "where-having": "Confondre WHERE et HAVING",
  "jointure-doublons": "Doublons créés par une jointure (montants comptés plusieurs fois)",
  "inner-au-lieu-de-left": "INNER JOIN qui fait disparaître les lignes sans correspondance",
  "count-etoile-left": "COUNT(*) au lieu de COUNT(colonne) après un LEFT JOIN",
  "statut-annule": "Inclure les commandes annulées",
  "ordre-tri": "Tri absent ou dans le mauvais sens",
  "colonnes": "Colonnes ou alias différents de ceux demandés",
  "valeur-codee-en-dur": "Valeur codée en dur au lieu d'être calculée",
  "group-by-granularite": "Mauvaise granularité du GROUP BY",
  "division-entiere": "Division entière qui tronque un taux",
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
  | { type: "code"; code: string; language?: "python" | "sql"; runnable?: boolean; caption?: string }
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
  | { type: "sql-steps"; title: string; stages: { clause: string; label: string; sql: string; note: string }[] }
  | { type: "join-viz"; title: string }
  | { type: "explain"; id: string; prompt: string; criteria: string[] }
  | { type: "project"; title: string; md: string; projectId?: string }
  // ---- Activités réutilisables (tous domaines) ----
  | { type: "ordering"; id: string; prompt: string; items: { id: string; label: string }[]; /** ordre correct (ids) */ answer: string[]; explanation: string }
  | {
      type: "matching";
      id: string;
      prompt: string;
      pairs: { id: string; left: string; answer: string }[];
      options: { id: string; label: string }[];
      explanation: string;
    }
  | {
      type: "chart-question";
      id: string;
      title: string;
      /** Requête qui calcule les données (exécutée en direct, deux colonnes : libellé, valeur) ou données fixes. */
      sql?: string;
      data?: { label: string; value: number }[];
      unit?: string;
      question: string;
      choices: { id: string; label: string }[];
      answer: string;
      explanation: string;
    }
  | {
      type: "fill-code";
      id: string;
      prompt: string;
      language: "python" | "sql";
      /** Gabarit avec des trous {{id}}. */
      template: string;
      blanks: { id: string; accept: string[]; hint: string }[];
      explanation: string;
    };

export type ActivityBlock = Extract<LessonBlock, { type: "ordering" | "matching" | "chart-question" | "fill-code" }>;
export const activityKindLabel: Record<ActivityBlock["type"], string> = {
  ordering: "Classement",
  matching: "Association",
  "chart-question": "Lecture de graphique",
  "fill-code": "Code à compléter",
};

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

export type PythonExerciseInput = z.input<typeof pythonExerciseSchema>;
export type SqlExerciseInput = z.input<typeof sqlExerciseSchema>;

// ---------- Projets ----------

export interface ProjectStep {
  id: string;
  title: string;
  exerciseId: string;
  /** Question posée pour le journal de décisions de cette étape. */
  decisionPrompt: string;
}

export interface Project {
  id: string;
  version: number;
  domain: DomainId;
  title: string;
  summary: string;
  brief: string;
  deliverables: string[];
  acceptance: string[];
  steps: ProjectStep[];
}

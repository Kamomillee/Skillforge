import type { Project, ProjectStep } from "../content/types";
import { questionsReference } from "../content/datasets/documents";
import { chargerVentes, EXPORT_BOUTIQUE, nettoyerVentes } from "../content/datasets/import-boutique";
import { tableauEvaluation } from "../content/llm/rag-core";
import { churn, entrainerSeuil, exactitudeTest, passagesPour, RECLAMATIONS, repondreAvecSources } from "../content/transversal/copilote";
import type { Attempt } from "../storage/store";
import { isCleanPass } from "./mastery";

export const journalKey = (projectId: string, stepId: string) => `journal:${projectId}:${stepId}`;
/** Clé d'un champ d'une étape de rédaction. */
export const fieldKey = (projectId: string, stepId: string, fieldId: string) => journalKey(projectId, `${stepId}.${fieldId}`);

export type StepStatus = "verifiee" | "redigee" | "a-faire";

/** Réussite enregistrée d'une étape vérifiée (la plus récente). */
export function lastPass(attempts: Attempt[], exerciseId: string) {
  return attempts.filter((a) => a.exerciseId === exerciseId && a.status === "passed").sort((a, b) => b.at.localeCompare(a.at))[0];
}

/**
 * Statut d'une étape. « vérifiée » : l'exercice passe toutes ses vérifications. « rédigée » : tous les champs
 * d'une étape de rédaction sont remplis — c'est déclaratif, jamais une preuve de maîtrise.
 */
export function stepStatus(project: Project, step: ProjectStep, attempts: Attempt[], written: Record<string, string>): StepStatus {
  if (step.exerciseId) return lastPass(attempts, step.exerciseId) ? "verifiee" : "a-faire";
  const fields = step.fields ?? [];
  return fields.length && fields.every((f) => (written[fieldKey(project.id, step.id, f.id)] ?? "").trim().length > 0) ? "redigee" : "a-faire";
}

export const verifiableSteps = (p: Project) => p.steps.filter((s) => s.exerciseId);

export interface EvaluationRow {
  composant: string;
  mesure: string;
  /** Valeur mesurée, ou null tant que l'étape n'est pas vérifiée (rien n'est affiché d'avance). */
  valeur: string | null;
  preuve: string;
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;

/**
 * Tableau d'évaluation du copilote. Chaque valeur n'apparaît que si l'étape correspondante est vérifiée :
 * le code de l'étudiant a alors produit exactement ces résultats sur les données du test visible.
 * Les valeurs sont recalculées par les miroirs TypeScript, eux-mêmes vérifiés contre Pyodide (tests/content).
 */
export function evaluationCopilote(attempts: Attempt[]): EvaluationRow[] {
  const ok = (id: string) => lastPass(attempts, id);
  const preuve = (id: string) => {
    const a = ok(id);
    return a ? `${a.passedCount}/${a.total} vérifications (dont ${a.hiddenPassed}/${a.hiddenTotal} cachées), le ${new Date(a.at).toLocaleDateString("fr-CH")}${a.solutionViewed ? ", solution consultée" : ""}` : "étape non vérifiée";
  };
  const brutes = chargerVentes(EXPORT_BOUTIQUE);
  const n = nettoyerVentes(brutes);
  const rejets = n.rejets.date_invalide + n.rejets.quantite_invalide + n.rejets.doublon;

  const train = entrainerSeuil(
    churn.X_train.map((r) => r[RECLAMATIONS]),
    churn.y_train,
  )!;
  const unsTest = churn.y_test.reduce((a, b) => a + b, 0);
  const baseTest = Math.max(unsTest, churn.y_test.length - unsTest) / churn.y_test.length;
  const accTest = exactitudeTest(train.seuil!);

  const eval13 = tableauEvaluation(questionsReference.map((q) => ({ attendu: q.attendu, cites: repondreAvecSources(passagesPour(q.question), 2).sources })));

  return [
    { composant: "Import", mesure: "Lignes lues", valeur: ok("cp-1-import") ? `${brutes.length}` : null, preuve: preuve("cp-1-import") },
    {
      composant: "Nettoyage",
      mesure: "Lignes rejetées (date / quantité / doublon)",
      valeur: ok("cp-2-nettoyage") ? `${rejets} sur ${brutes.length} (${n.rejets.date_invalide} / ${n.rejets.quantite_invalide} / ${n.rejets.doublon})` : null,
      preuve: preuve("cp-2-nettoyage"),
    },
    { composant: "Base", mesure: "Intégrité : import rejouable, clients inconnus écartés", valeur: ok("cp-3-base") ? "vérifiée sur 3 états des données" : null, preuve: preuve("cp-3-base") },
    { composant: "Questions métier", mesure: "CA et clients distincts par mois", valeur: ok("cp-4-questions") ? "conforme à la référence (3 états)" : null, preuve: preuve("cp-4-questions") },
    { composant: "Tableau de bord", mesure: "Indicateurs source (CA, commandes, panier)", valeur: ok("cp-5-tableau") ? "conformes ; affichage dans l'outil de BI non vérifié" : null, preuve: preuve("cp-5-tableau") },
    {
      composant: "Modèle",
      mesure: `Exactitude « réclamations ≥ ${train.seuil} » : entraînement / test (base majoritaire)`,
      valeur: ok("cp-6-modele") ? `${pct(train.exactitude)} (base ${pct(train.base)}) / ${pct(accTest)} (base ${pct(baseTest)})` : null,
      preuve: preuve("cp-6-modele"),
    },
    {
      composant: "Assistant",
      mesure: `13 questions de référence : bonne source / mauvaise source / silence à tort / abstention correcte / réponse inventée`,
      valeur: ok("cp-7-assistant")
        ? `${eval13.citation_correcte} / ${eval13.mauvaise_source} / ${eval13.silence_a_tort} / ${eval13.abstention_correcte} / ${eval13.reponse_inventee}`
        : null,
      preuve: preuve("cp-7-assistant"),
    },
  ];
}

/** Nombre d'étapes vérifiées « proprement » (sans solution affichée), pour le portfolio. */
export function cleanVerified(project: Project, attempts: Attempt[]) {
  return verifiableSteps(project).filter((s) => attempts.some((a) => a.exerciseId === s.exerciseId && isCleanPass(a))).length;
}

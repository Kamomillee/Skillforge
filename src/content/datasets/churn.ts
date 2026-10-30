import { mulberry32 } from "./pme";

/**
 * Jeu de données « départ de clients » (Torréfaction du Léman, abonnements café) — SYNTHÉTIQUE.
 * Généré de façon déterministe (graine 7) par un modèle logistique connu + bruit : on sait donc
 * exactement d'où viennent les étiquettes. Aucune personne réelle.
 *
 * Variables : anciennete_mois, commandes_6m (commandes sur 6 mois), reclamations (sur 12 mois).
 * Étiquette : parti = 1 si le client a résilié son abonnement dans les 3 mois suivants.
 */
export const CHURN_FEATURES = ["anciennete_mois", "commandes_6m", "reclamations"] as const;

export interface ChurnData {
  X_train: number[][];
  y_train: number[];
  X_test: number[][];
  y_test: number[];
}

export function generateChurn(seed = 7): ChurnData {
  const r = mulberry32(seed);
  const rows: { x: number[]; y: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const anciennete = 1 + Math.floor(r() * 48);
    const commandes = Math.floor(r() * 9);
    const reclamations = r() < 0.75 ? 0 : 1 + Math.floor(r() * 3);
    const z = 0.6 - 0.05 * anciennete - 0.35 * commandes + 0.9 * reclamations + (r() - 0.5) * 1.6;
    const p = 1 / (1 + Math.exp(-z));
    rows.push({ x: [anciennete, commandes, reclamations], y: r() < p ? 1 : 0 });
  }
  const train = rows.slice(0, 120);
  const test = rows.slice(120);
  return { X_train: train.map((t) => t.x), y_train: train.map((t) => t.y), X_test: test.map((t) => t.x), y_test: test.map((t) => t.y) };
}

export const churnInfo = {
  id: "churn",
  title: "Départ de clients abonnés (synthétique)",
  provenance:
    "Généré de façon déterministe (graine 7) : étiquettes tirées d'un modèle logistique connu (ancienneté −, commandes −, réclamations +) avec bruit. Aucune personne réelle.",
};

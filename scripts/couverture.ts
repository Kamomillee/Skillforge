import { coverageStats, curriculum } from "../src/content";
import { contentStatus, statusLabel } from "../src/content/types";

/** Rendu Markdown de la matrice de couverture (source de vérité : src/content/curriculum.ts). */
export function renderCoverage(): string {
  const cell = (s?: string | string[]) => (s === undefined || (Array.isArray(s) && !s.length) ? "—" : (Array.isArray(s) ? s.join(", ") : s).replace(/\|/g, "\\|"));
  const out: string[] = [
    "# Matrice de couverture pédagogique",
    "",
    "> Fichier généré depuis `src/content/curriculum.ts` (source de vérité, également affichée dans l'application : page **Programme**). Régénérer avec `pnpm docs:couverture` ; `pnpm test` échoue si ce fichier n'est plus à jour.",
    "> Statuts : Prévu → Rédigé → Implémenté → Testé → Disponible. Seul « Disponible » est jouable comme leçon ; « Testé » signifie qu'un exercice vérifié existe (par exemple une étape de projet) sans leçon dédiée.",
    "",
    "## Synthèse",
    "",
    `| Domaine | Notions | ${contentStatus.map((s) => statusLabel[s]).join(" | ")} | Projet |`,
    `|---|---|${contentStatus.map(() => "---").join("|")}|---|`,
  ];
  for (const d of curriculum) {
    const st = coverageStats(d.id);
    out.push(`| ${d.short} | ${st.total} | ${contentStatus.map((s) => st.counts[s]).join(" | ")} | ${d.project.title} (${statusLabel[d.project.status]}) |`);
  }
  const all = coverageStats();
  out.push(`| **Total** | **${all.total}** | ${contentStatus.map((s) => all.counts[s]).join(" | ")} | Projet transversal : copilote data PME (Prévu) |`, "");
  for (const d of curriculum) {
    out.push(`## ${d.title}`, "", `Visualisations prévues : ${d.plannedVisualizations.join(" · ")}.`, "");
    out.push("| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |", "|---|---|---|---|---|---|---|");
    for (const m of d.modules)
      for (const n of m.notions)
        out.push(
          `| ${m.letter}. ${m.title} | ${n.title} | ${statusLabel[n.status]} | ${cell(n.objective)} | ${cell(n.activities)} | ${cell(n.evaluation)} | ${cell(n.project ?? d.project.title)} |`,
        );
    out.push("");
  }
  return out.join("\n");
}

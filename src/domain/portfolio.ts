import { allNotions, exerciseById, exercises, lessons, projects, type Project } from "../content";
import type { Attempt, LearningEvent, Review } from "../storage/store";
import { estimateMastery, isCleanPass, masteryLabel } from "./mastery";
import { evaluationCopilote, fieldKey, journalKey, lastPass, verifiableSteps, type EvaluationRow } from "./projects";

/**
 * Portfolio généré UNIQUEMENT à partir de preuves enregistrées : étapes vérifiées par des tests, textes rédigés
 * par l'étudiant, maîtrise explicable. Rien n'est inventé : pas de gain de productivité, pas de score, pas
 * d'expérience professionnelle. Les attestations sont internes au parcours, jamais présentées comme une certification.
 */

export interface PortfolioProject {
  project: Project;
  verified: { title: string; detail: string; clean: boolean }[];
  total: number;
  technologies: string[];
  decisions: { step: string; text: string }[];
  limits: string[];
  evaluation?: EvaluationRow[];
  cvLine: string;
}

export interface PortfolioData {
  projects: PortfolioProject[];
  notions: { title: string; domain: string; level: string; at: string }[];
  interviews: number;
  generatedAt: string;
}

const TECH: Record<string, string> = { python: "Python", sql: "SQL (PostgreSQL)", ml: "Machine learning", llm: "RAG (recherche, citations, abstention)", bi: "Indicateurs BI" };

export function technologiesOf(p: Project): string[] {
  const ids = verifiableSteps(p).map((s) => exerciseById.get(s.exerciseId!)!);
  const t = new Set<string>();
  for (const e of ids) {
    t.add(e.language === "sql" ? "SQL (PostgreSQL)" : "Python");
    if (e.language === "python" && e.packages.includes("scikit-learn")) t.add("scikit-learn");
  }
  for (const d of p.domains ?? [p.domain]) if (d !== "python" && d !== "sql") t.add(TECH[d]);
  return [...t];
}

/** Proposition de ligne de CV : uniquement des faits vérifiables, formulée comme un projet de formation. */
export function cvLine(p: Project, verified: number, total: number, technologies: string[]): string {
  return `Projet de formation « ${p.title} » (SkillForge AI, données synthétiques) : ${p.summary.replace(/\.$/, "")}. ${technologies.join(", ")}. ${verified}/${total} étapes vérifiées par des tests automatisés.`;
}

export function buildPortfolio(input: { attempts: Attempt[]; events: LearningEvent[]; reviews: Review[]; kv: Record<string, { text?: string } | undefined>; interviews: number; now?: Date }): PortfolioData {
  const { attempts, kv } = input;
  const text = (k: string) => (kv[k]?.text ?? "").trim();
  const out: PortfolioProject[] = [];
  for (const p of projects) {
    const steps = verifiableSteps(p);
    const verified = steps.flatMap((s) => {
      const a = lastPass(attempts, s.exerciseId!);
      return a ? [{ title: s.title, detail: `${a.passedCount}/${a.total} vérifications, dont ${a.hiddenPassed}/${a.hiddenTotal} cachées`, clean: attempts.some((x) => x.exerciseId === s.exerciseId && isCleanPass(x)) }] : [];
    });
    if (!verified.length) continue;
    const decisions = p.steps.flatMap((s) => (text(journalKey(p.id, s.id)) ? [{ step: s.title, text: text(journalKey(p.id, s.id)) }] : []));
    const limits = [
      ...(p.steps.find((s) => s.id === "s9")?.fields ?? []).map((f) => text(fieldKey(p.id, "s9", f.id))).filter(Boolean),
      ...(text(journalKey(p.id, "bilan")) ? [text(journalKey(p.id, "bilan"))] : []),
    ];
    const technologies = technologiesOf(p);
    out.push({
      project: p,
      verified,
      total: steps.length,
      technologies,
      decisions,
      limits,
      evaluation: p.id === "copilote-pme" ? evaluationCopilote(attempts).filter((r) => r.valeur !== null) : undefined,
      cvLine: cvLine(p, verified.length, steps.length, technologies),
    });
  }
  const notions = allNotions()
    .filter(({ notion }) => notion.status === "disponible" || notion.status === "teste")
    .flatMap(({ notion, domain }) => {
      const m = estimateMastery(notion.id, { lessons, exercises, attempts, events: input.events, review: input.reviews.find((r) => r.conceptId === notion.id) });
      if (m.level < 3) return [];
      const at = m.evidence.filter((e) => e.verified).map((e) => e.at).sort().at(-1) ?? "";
      return [{ title: notion.title, domain: domain.short, level: masteryLabel[m.level], at }];
    });
  return { projects: out, notions, interviews: input.interviews, generatedAt: (input.now ?? new Date()).toISOString() };
}

export const ATTESTATION =
  "Attestation interne de parcours SkillForge AI : elle liste des notions démontrées par des exercices corrigés automatiquement sur des données synthétiques. Ce n'est ni un diplôme, ni une certification officielle, ni une expérience professionnelle.";

/** README du portfolio (Markdown), à joindre à un dépôt ou à envoyer. */
export function portfolioReadme(d: PortfolioData, name?: string): string {
  const out = [`# Portfolio${name ? ` — ${name}` : ""}`, "", `_Généré par SkillForge AI le ${new Date(d.generatedAt).toLocaleDateString("fr-CH")} à partir de preuves enregistrées (tests exécutés, textes rédigés). Projets de formation sur données synthétiques._`, ""];
  if (!d.projects.length) out.push("_Aucun projet avec une étape vérifiée pour l'instant._", "");
  for (const p of d.projects) {
    out.push(`## ${p.project.title}`, "", p.project.summary, "", `**Technologies :** ${p.technologies.join(", ")}`, "", `**Étapes vérifiées (${p.verified.length}/${p.total}) :**`, "");
    for (const v of p.verified) out.push(`- ${v.title} — ${v.detail}${v.clean ? "" : " (après consultation de la solution)"}`);
    out.push("");
    if (p.evaluation?.length) {
      out.push("**Résultats mesurés :**", "", "| Composant | Mesure | Valeur |", "| --- | --- | --- |", ...p.evaluation.map((r) => `| ${r.composant} | ${r.mesure} | ${r.valeur} |`), "");
    }
    if (p.decisions.length) out.push("**Décisions :**", "", ...p.decisions.map((x) => `- _${x.step}_ : ${x.text}`), "");
    out.push("**Limites :**", "", ...(p.limits.length ? p.limits.map((l) => `- ${l}`) : ["- Données synthétiques ; limites détaillées non encore rédigées."]), "");
    out.push(`**Proposition de ligne de CV :** ${p.cvLine}`, "");
  }
  out.push("## Attestation interne de parcours", "", ATTESTATION, "");
  if (d.notions.length) out.push("| Notion | Domaine | Niveau | Dernière preuve |", "| --- | --- | --- | --- |", ...d.notions.map((n) => `| ${n.title} | ${n.domain} | ${n.level} | ${n.at ? new Date(n.at).toLocaleDateString("fr-CH") : ""} |`), "");
  else out.push("_Aucune notion démontrée pour l'instant._", "");
  out.push(`Entretiens blancs réalisés : ${d.interviews}.`, "");
  return out.join("\n");
}

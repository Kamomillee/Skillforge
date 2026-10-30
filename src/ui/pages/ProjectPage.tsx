import { useEffect, useRef, useState } from "react";
import { exerciseById, projectById, type Project } from "../../content";
import type { ResultSet } from "../../runtime/sql/engine";
import { useApp } from "../app-context";
import type { Route } from "../router";
import { Md } from "../Md";
import { Workbench } from "../components/Workbench";
import { Sandbox, SqlSandbox } from "../components/Sandbox";
import { domainById } from "../../content";
import { SchemaPanel, useSchema } from "../components/SqlParts";

export const projectHref = (projectId: string, stepId?: string) => `#/projet/${projectId}${stepId ? `/${stepId}` : ""}`;
export const journalKey = (projectId: string, stepId: string) => `journal:${projectId}:${stepId}`;
export interface ProjectResume {
  projectId: string;
  stepId?: string;
  at: string;
}

/** Relations entre tables, lues dans les clés étrangères du schéma réel (diagramme entité-relation en texte). */
function Relations() {
  const { tables } = useSchema();
  if (!tables) return <p className="small muted">Lecture du schéma…</p>;
  const rels = tables.flatMap((t) => t.columns.filter((c) => c.fk).map((c) => ({ from: t.name, col: c.name, to: c.fk! })));
  return (
    <ul className="er-list" data-testid="relations">
      {rels.map((r) => (
        <li key={`${r.from}.${r.col}`}>
          <code>{r.to.split(".")[0]}</code> <span aria-hidden="true">1 ──&lt; N</span>
          <span className="sr-only">un vers plusieurs</span> <code>{r.from}</code>{" "}
          <span className="small muted">
            (chaque ligne de {r.from} référence une ligne de {r.to.split(".")[0]} par {r.col})
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Champ de journal sauvegardé automatiquement (une clé par étape : deux onglets ne s'écrasent qu'au niveau d'une étape). */
function JournalField({ projectId, stepId, label, rows = 4 }: { projectId: string; stepId: string; label: string; rows?: number }) {
  const { store } = useApp();
  const key = journalKey(projectId, stepId);
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    dirty.current = false;
    setText(null);
    store.get<{ text: string; at: string }>(key).then((v) => {
      setText(v?.text ?? "");
      setSaved(v?.at ?? null);
    });
  }, [store, key]);

  useEffect(() => {
    if (text === null || !dirty.current) return;
    const t = setTimeout(async () => {
      const at = new Date().toISOString();
      await store.set(key, { text, at });
      setSaved(at);
    }, 600);
    return () => clearTimeout(t);
  }, [text, key, store]);

  return (
    <label className="field">
      {label}
      <textarea
        rows={rows}
        value={text ?? ""}
        disabled={text === null}
        onChange={(e) => {
          dirty.current = true;
          setText(e.target.value);
        }}
        data-testid={`journal-${stepId}`}
      />
      <span className="small muted" role="status">
        {saved ? `✓ Enregistré ${new Date(saved).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}` : "Sauvegarde automatique"}
      </span>
    </label>
  );
}

export const selfCheckKey = (projectId: string) => `selfcheck:${projectId}`;
type SelfCheckState = { checked: string[]; at: string };

/** Auto-évaluation d'un parcours hors de SkillForge : déclarative, signalée comme telle, jamais une preuve de maîtrise. */
function SelfCheck({ project }: { project: Project }) {
  const { store } = useApp();
  const sc = project.selfCheck!;
  const [state, setState] = useState<SelfCheckState | null>(null);
  useEffect(() => {
    store.get<SelfCheckState>(selfCheckKey(project.id)).then((v) => setState(v ?? { checked: [], at: "" }));
  }, [store, project.id]);
  async function toggle(id: string) {
    if (!state) return;
    const checked = state.checked.includes(id) ? state.checked.filter((x) => x !== id) : [...state.checked, id];
    const next = { checked, at: new Date().toISOString() };
    setState(next);
    await store.set(selfCheckKey(project.id), next);
  }
  return (
    <fieldset className="selfcheck" data-testid="selfcheck">
      <legend>
        {sc.title} — auto-évaluation ({state?.checked.length ?? 0}/{sc.items.length})
      </legend>
      <p className="small muted">Ces cases sont déclaratives : SkillForge ne peut pas ouvrir ton fichier Power BI. Elles ne comptent pas dans ta maîtrise et sont exportées comme « auto-évaluation ».</p>
      {sc.items.map((it) => (
        <label key={it.id} className="small selfcheck-item">
          <input type="checkbox" checked={!!state?.checked.includes(it.id)} disabled={!state} onChange={() => toggle(it.id)} /> {it.label}
        </label>
      ))}
    </fieldset>
  );
}

function mdTable(r: ResultSet, max = 20) {
  const esc = (v: unknown) => (v === null ? "NULL" : String(v).replace(/\|/g, "\\|"));
  const lines = [`| ${r.columns.join(" | ")} |`, `| ${r.columns.map(() => "---").join(" | ")} |`, ...r.rows.slice(0, max).map((row) => `| ${row.map(esc).join(" | ")} |`)];
  if (r.rowCount > max) lines.push(`\n_${r.rowCount} lignes au total, ${max} premières affichées._`);
  return lines.join("\n");
}

export function ProjectPage({ route }: { route: Route }) {
  const [projectId, stepId] = route.params;
  const project = projectById.get(projectId);
  const { store, data, sqlRunner, toast } = useApp();
  const step = project?.steps.find((s) => s.id === stepId);
  const exercise = step ? exerciseById.get(step.exerciseId) : undefined;
  const [exporting, setExporting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"cours" | "atelier">("cours");

  useEffect(() => {
    if (project) void store.set<ProjectResume>("resume:project", { projectId: project.id, stepId: step?.id, at: new Date().toISOString() });
  }, [store, project, step]);

  if (!project)
    return (
      <div className="page">
        <h1>Projet introuvable</h1>
        <a href="#/lecons">Voir les leçons</a>
      </div>
    );

  const passed = (exId: string) => data.attempts.some((a) => a.exerciseId === exId && a.status === "passed");
  const doneCount = project.steps.filter((s) => passed(s.exerciseId)).length;

  async function exportMarkdown(p: Project) {
    setExporting(true);
    try {
      const parts: string[] = [`# ${p.title}`, "", `_Export SkillForge AI du ${new Date().toLocaleString("fr-CH")} · projet v${p.version} · données synthétiques « Torréfaction du Léman »._`, "", p.brief, ""];
      for (const s of p.steps) {
        const ex = exerciseById.get(s.exerciseId);
        const ok = data.attempts.filter((a) => a.exerciseId === s.exerciseId && a.status === "passed").sort((a, b) => b.at.localeCompare(a.at))[0];
        const draft = data.drafts.find((d) => d.exerciseId === s.exerciseId);
        const code = ok?.code ?? draft?.code;
        const journal = (await store.get<{ text: string }>(journalKey(p.id, s.id)))?.text?.trim();
        parts.push(`## ${s.title}`, "", ex ? ex.prompt : "", "");
        parts.push(`**Statut :** ${ok ? `vérifiée (toutes les vérifications passent, v${ok.exerciseVersion}, ${new Date(ok.at).toLocaleDateString("fr-CH")})` : code ? "brouillon non validé" : "non commencée"}`, "");
        if (code && ex?.language === "sql") {
          parts.push("```sql", code.trim(), "```", "");
          const r = await sqlRunner.query(code, 8000, 50);
          if (r.outcome?.ok) parts.push("Résultat :", "", mdTable(r.outcome.result), "");
          else if (r.outcome) parts.push(`Résultat : erreur PostgreSQL — ${r.outcome.error.message}`, "");
        } else if (code) {
          parts.push("```python", code.trim(), "```", "");
          if (ok) parts.push(`Vérifications : ${ok.passedCount}/${ok.total} (dont ${ok.hiddenPassed}/${ok.hiddenTotal} cachées).`, "");
        }
        parts.push(`**Décision — ${s.decisionPrompt}**`, "", journal || "_(pas encore rédigée)_", "");
      }
      if (p.selfCheck) {
        const sc = await store.get<SelfCheckState>(selfCheckKey(p.id));
        parts.push(`## ${p.selfCheck.title} (auto-évaluation, non vérifiée par SkillForge)`, "", ...p.selfCheck.items.map((it) => `- [${sc?.checked.includes(it.id) ? "x" : " "}] ${it.label}`), "");
      }
      const bilan = (await store.get<{ text: string }>(journalKey(p.id, "bilan")))?.text?.trim();
      parts.push("## Bilan et limites", "", bilan || "_(pas encore rédigé)_", "");
      const blob = new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${p.id}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      await store.addEvent({ type: "project-export", data: { projectId: p.id, steps: doneCount } });
      toast("Export Markdown téléchargé.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="lesson-layout" data-mobile={mobileTab} style={{ ["--atelier-w" as string]: "50%" }}>
      <div className="mobile-tabs" role="tablist" aria-label="Vue">
        <button role="tab" aria-selected={mobileTab === "cours"} onClick={() => setMobileTab("cours")}>
          Mandat
        </button>
        <button role="tab" aria-selected={mobileTab === "atelier"} onClick={() => setMobileTab("atelier")}>
          Atelier{exercise ? " · étape" : ""}
        </button>
      </div>
      <nav className="lesson-nav" aria-label="Étapes du projet">
        <div className="eyebrow">Projet {domainById[project.domain].short}</div>
        <div style={{ fontWeight: 650, marginBottom: 4, lineHeight: 1.35 }}>{project.title}</div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {doneCount}/{project.steps.length} étapes vérifiées
        </p>
        <ol>
          <li>
            <a href={projectHref(project.id)} aria-current={!step ? "step" : undefined}>
              <span className="stage-num">00</span>
              <span>Mandat et données</span>
            </a>
          </li>
          {project.steps.map((s, k) => (
            <li key={s.id}>
              <a href={projectHref(project.id, s.id)} aria-current={s.id === step?.id ? "step" : undefined}>
                <span className="stage-num">{String(k + 1).padStart(2, "0")}</span>
                <span>{s.title}</span>
                {passed(s.exerciseId) && (
                  <span className="stage-check" title="Vérifiée" aria-label="vérifiée">
                    ✓
                  </span>
                )}
              </a>
            </li>
          ))}
          <li>
            <a href={projectHref(project.id, "bilan")} aria-current={stepId === "bilan" ? "step" : undefined}>
              <span className="stage-num">{String(project.steps.length + 1).padStart(2, "0")}</span>
              <span>Bilan et export</span>
            </a>
          </li>
        </ol>
      </nav>

      <div className="lesson-main">
        <article className="lesson-content">
          <select
            className="mobile-only"
            aria-label="Étape du projet"
            value={stepId ?? ""}
            onChange={(e) => (location.hash = projectHref(project.id, e.target.value || undefined).slice(1))}
          >
            <option value="">Mandat et données</option>
            {project.steps.map((s, k) => (
              <option key={s.id} value={s.id}>
                {k + 1}. {s.title}
                {passed(s.exerciseId) ? " ✓" : ""}
              </option>
            ))}
            <option value="bilan">Bilan et export</option>
          </select>
          {step && exercise ? (
            <>
              <span className="stage-tag">
                Étape {project.steps.indexOf(step) + 1}/{project.steps.length}
              </span>
              <h1>{step.title}</h1>
              <p>
                La question, l'éditeur et les vérifications sont dans l'atelier. Une fois la requête vérifiée, note ta décision : c'est ce qui rend le chiffre défendable
                devant la direction.
              </p>
              <button className="btn sm mobile-only" onClick={() => setMobileTab("atelier")}>
                Ouvrir l'atelier
              </button>
              <JournalField projectId={project.id} stepId={step.id} label={`Journal de décisions — ${step.decisionPrompt}`} />
              <div className="section-pager">
                {project.steps.indexOf(step) > 0 ? (
                  <a className="btn" href={projectHref(project.id, project.steps[project.steps.indexOf(step) - 1].id)}>
                    ← Étape précédente
                  </a>
                ) : (
                  <a className="btn" href={projectHref(project.id)}>
                    ← Mandat
                  </a>
                )}
                <a className="btn primary" href={projectHref(project.id, project.steps[project.steps.indexOf(step) + 1]?.id ?? "bilan")}>
                  {project.steps[project.steps.indexOf(step) + 1] ? "Étape suivante →" : "Bilan et export →"}
                </a>
              </div>
            </>
          ) : stepId === "bilan" ? (
            <>
              <h1>Bilan et export</h1>
              <ul className="list-plain">
                {project.steps.map((s) => (
                  <li key={s.id}>
                    {passed(s.exerciseId) ? <span className="badge success">✓ vérifiée</span> : <span className="badge">à faire</span>} {s.title}
                  </li>
                ))}
              </ul>
              {project.selfCheck && <SelfCheck project={project} />}
              <JournalField
                projectId={project.id}
                stepId="bilan"
                rows={6}
                label="Bilan : qu'as-tu livré, quelles limites ont les données ou tes définitions, que ferais-tu ensuite ?"
              />
              <h2>Critères d'acceptation</h2>
              <ul>
                {project.acceptance.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button className="btn primary" onClick={() => exportMarkdown(project)} disabled={exporting} data-testid="export-md">
                {exporting ? "Préparation…" : "Exporter en Markdown"}
              </button>
              <p className="small muted">
                L'export contient ton code (la dernière version vérifiée, sinon ton brouillon, signalé comme tel), le résultat des requêtes SQL recalculé maintenant par PostgreSQL et ton
                journal. Aucune note globale n'est calculée : les critères ci-dessus se vérifient à la lecture.
              </p>
            </>
          ) : (
            <>
              <span className="stage-tag">Mandat</span>
              <h1>{project.title}</h1>
              <Md text={project.brief} />
              <h2>Livrables</h2>
              <ul>
                {project.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <h2>Les données</h2>
              {project.data && <Md text={project.data} />}
              {project.selfCheck && (
                <>
                  <h2>{project.selfCheck.title}</h2>
                  <Md text={project.selfCheck.intro} />
                  <p className="small muted">Tu cocheras ces points dans « Bilan et export » (auto-évaluation).</p>
                </>
              )}
              {(project.domain === "sql" || project.domain === "bi") && (
                <>
                  <p>Relations entre tables (lues dans les clés étrangères de la base) :</p>
                  <Relations />
                  <details className="schema-details" open>
                    <summary>Tables, colonnes et aperçu</summary>
                    <SchemaPanel />
                  </details>
                </>
              )}
              <div className="section-pager">
                <span />
                <a className="btn primary" href={projectHref(project.id, project.steps[0].id)}>
                  Commencer : {project.steps[0].title} →
                </a>
              </div>
            </>
          )}
        </article>
      </div>

      <div className="splitter static" aria-hidden="true" />

      <aside className="atelier" aria-label="Atelier pratique">
        {exercise ? <Workbench key={exercise.id} exercise={exercise} /> : project.domain === "sql" || project.domain === "bi" ? <SqlSandbox /> : <Sandbox />}
      </aside>
    </div>
  );
}

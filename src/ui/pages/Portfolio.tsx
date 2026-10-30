import { useEffect, useState } from "react";
import { projects } from "../../content";
import { ATTESTATION, buildPortfolio, portfolioReadme, type PortfolioData } from "../../domain/portfolio";
import { fieldKey, journalKey } from "../../domain/projects";
import type { InterviewSession } from "../../domain/interview";
import { useApp } from "../app-context";

function download(name: string, content: string, type: string) {
  const el = document.createElement("a");
  el.href = URL.createObjectURL(new Blob([content], { type }));
  el.download = name;
  el.click();
  setTimeout(() => URL.revokeObjectURL(el.href), 1000);
}

/** Portfolio généré depuis les preuves réelles ; rien n'y est inventé. */
export function Portfolio() {
  const { store, data } = useApp();
  const [d, setD] = useState<PortfolioData | null>(null);

  useEffect(() => {
    (async () => {
      const keys = projects.flatMap((p) => [journalKey(p.id, "bilan"), ...p.steps.flatMap((s) => [journalKey(p.id, s.id), ...(s.fields ?? []).map((f) => fieldKey(p.id, s.id, f.id))])]);
      const kv = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await store.get<{ text: string }>(k)] as const)));
      const interviews = ((await store.get<InterviewSession[]>("entretien:sessions")) ?? []).length;
      setD(buildPortfolio({ attempts: data.attempts, events: data.events, reviews: data.reviews, kv, interviews }));
    })();
  }, [store, data]);

  if (!d) return null;
  const name = data.profile?.name;
  async function exportReadme() {
    download(`portfolio-${new Date().toISOString().slice(0, 10)}.md`, portfolioReadme(d!, name), "text/markdown;charset=utf-8");
    await store.addEvent({ type: "portfolio-export", data: { format: "md", projects: d!.projects.length } });
  }
  async function exportJson() {
    download(`portfolio-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: "skillforge-portfolio", formatVersion: 1, ...d, projects: d!.projects.map((p) => ({ ...p, project: { id: p.project.id, title: p.project.title, version: p.project.version } })) }, null, 2), "application/json");
    await store.addEvent({ type: "portfolio-export", data: { format: "json", projects: d!.projects.length } });
  }

  return (
    <div className="page">
      <div className="eyebrow">Preuves exportables</div>
      <h1>Mon portfolio</h1>
      <p>
        Généré à partir de ce que tu as <strong>réellement</strong> fait : étapes de projet vérifiées par des tests, décisions et limites que tu as rédigées, notions démontrées. Rien
        n'est ajouté : pas de gain de productivité, pas de score, pas d'expérience professionnelle.
      </p>
      <div className="row">
        <button className="btn primary" onClick={exportReadme} data-testid="portfolio-readme">
          Télécharger le README (Markdown)
        </button>
        <button className="btn" onClick={exportJson}>
          Télécharger les données (JSON)
        </button>
      </div>

      {d.projects.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }} data-testid="portfolio-vide">
          Aucun projet n'a encore d'étape vérifiée. Commence par le <a href="#/projet/copilote-pme">projet transversal</a> ou un projet de domaine.
        </p>
      ) : (
        d.projects.map((p) => (
          <section key={p.project.id} className="panel portfolio-entry" data-testid={`portfolio-${p.project.id}`}>
            <h2>{p.project.title}</h2>
            <p>{p.project.summary}</p>
            <p className="small">
              <strong>Technologies :</strong> {p.technologies.join(", ")}
            </p>
            <strong className="small">
              Étapes vérifiées ({p.verified.length}/{p.total})
            </strong>
            <ul className="small">
              {p.verified.map((v) => (
                <li key={v.title}>
                  {v.title} — {v.detail}
                  {!v.clean && " (après consultation de la solution)"}
                </li>
              ))}
            </ul>
            {p.evaluation && p.evaluation.length > 0 && (
              <div className="result-wrap">
                <table className="result eval-table">
                  <caption className="small muted" style={{ textAlign: "left" }}>
                    Résultats mesurés
                  </caption>
                  <tbody>
                    {p.evaluation.map((r) => (
                      <tr key={r.composant}>
                        <th scope="row">{r.composant}</th>
                        <td>{r.mesure}</td>
                        <td>{r.valeur}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <strong className="small">Décisions</strong>
            {p.decisions.length ? (
              <ul className="small">
                {p.decisions.map((x) => (
                  <li key={x.step}>
                    <em>{x.step}</em> : {x.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Aucune décision rédigée dans le journal du projet.</p>
            )}
            <strong className="small">Limites</strong>
            {p.limits.length ? (
              <ul className="small">
                {p.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Pas encore rédigées (étape « Documenter les limites » ou bilan du projet).</p>
            )}
            <div className="hint-box">
              <div className="eyebrow">Proposition de ligne de CV</div>
              <p style={{ margin: 0 }} data-testid="cv-line">
                {p.cvLine}
              </p>
              <p className="small muted" style={{ marginBottom: 0 }}>
                À présenter comme un projet de formation, jamais comme une expérience en entreprise.
              </p>
            </div>
            <p className="small" style={{ marginBottom: 0 }}>
              <a href={`#/projet/${p.project.id}/bilan`}>Export Markdown détaillé du projet (code, résultats, journal)</a>
            </p>
          </section>
        ))
      )}

      <section className="panel portfolio-entry" aria-labelledby="attestation">
        <h2 id="attestation">Attestation interne de parcours</h2>
        <p className="small">{ATTESTATION}</p>
        {d.notions.length ? (
          <ul className="small" data-testid="attestation-notions">
            {d.notions.map((n) => (
              <li key={n.title}>
                {n.title} ({n.domain}) — {n.level}
                {n.at && `, dernière preuve le ${new Date(n.at).toLocaleDateString("fr-CH")}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Aucune notion démontrée pour l'instant : une notion l'est après un exercice autonome ou un test de validation réussi sans solution affichée.</p>
        )}
        <p className="small muted">Entretiens blancs réalisés : {d.interviews}.</p>
      </section>
    </div>
  );
}

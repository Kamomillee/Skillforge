import { curriculum, exercises, lessons, projects } from "../../content";
import { estimateMastery, masteryLabel } from "../../domain/mastery";
import { lessonHref } from "../../domain/recommend";
import { useApp } from "../app-context";
import { projectHref } from "./ProjectPage";

/** Catalogue des leçons et projets jouables, groupés par domaine, avec la progression prouvée. */
export function LessonsPage() {
  const { data } = useApp();
  const passed = (id: string) => data.attempts.some((a) => a.exerciseId === id && a.status === "passed");

  return (
    <div className="page">
      <div className="eyebrow">Leçons</div>
      <h1>Leçons et projets disponibles</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Seul le contenu vérifié par des tests est listé ici. Le reste du périmètre est visible dans le <a href="#/programme">programme</a>, avec son statut.
      </p>
      {curriculum.map((d) => {
        const ls = lessons.filter((l) => l.domain === d.id);
        const ps = projects.filter((p) => p.domain === d.id);
        return (
          <section key={d.id} style={{ marginTop: 28 }} aria-labelledby={`dom-${d.id}`}>
            <h2 id={`dom-${d.id}`}>{d.title}</h2>
            {ls.length === 0 && ps.length === 0 ? (
              <p className="small muted">Pas encore de leçon disponible dans ce domaine (prévu dans la feuille de route).</p>
            ) : (
              <div className="card-grid">
                {ls.map((l) => {
                  const exIds = l.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === "exercise" ? [b.exerciseId] : [])));
                  const done = exIds.filter(passed).length;
                  const m = estimateMastery(l.conceptIds[0], { lessons, exercises, attempts: data.attempts, events: data.events, review: data.reviews.find((r) => r.conceptId === l.conceptIds[0]) });
                  return (
                    <a key={l.id} className="panel card-link" href={lessonHref(l.id)} data-testid={`lesson-card-${l.id}`}>
                      <div className="eyebrow">Leçon · ~{l.estimatedMinutes} min</div>
                      <strong>{l.title}</strong>
                      <p className="small muted" style={{ margin: "6px 0" }}>
                        {l.summary}
                      </p>
                      <span className="small">
                        {done}/{exIds.length} exercices réussis · {masteryLabel[m.level]}
                      </span>
                    </a>
                  );
                })}
                {ps.map((p) => {
                  const done = p.steps.filter((s) => s.exerciseId && passed(s.exerciseId)).length;
                  return (
                    <a key={p.id} className="panel card-link" href={projectHref(p.id)} data-testid={`project-card-${p.id}`}>
                      <div className="eyebrow">{p.domains ? "Projet transversal" : "Projet"}</div>
                      <strong>{p.title}</strong>
                      <p className="small muted" style={{ margin: "6px 0" }}>
                        {p.summary}
                      </p>
                      <span className="small">
                        {done}/{p.steps.filter((s) => s.exerciseId).length} étapes vérifiées
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import { allNotions, coverageStats, curriculum, lessonById } from "../../content";
import { contentStatus, statusLabel, type ContentStatus, type DomainId } from "../../content/types";
import { lessonHref } from "../../domain/recommend";

const statusTone: Record<ContentStatus, string> = { prevu: "", redige: "info", implemente: "info", teste: "accent", disponible: "success" };
const statusIcon: Record<ContentStatus, string> = { prevu: "○", redige: "◔", implemente: "◑", teste: "◕", disponible: "●" };

/** Matrice de couverture : domaine → module → notion → objectif → activités → évaluation → projet. */
export function Curriculum() {
  const [domain, setDomain] = useState<DomainId | "all">("all");
  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      allNotions().filter(
        (r) =>
          (domain === "all" || r.domain.id === domain) &&
          (status === "all" || r.notion.status === status) &&
          (!q || `${r.notion.title} ${r.module.title}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [domain, status, q],
  );
  const stats = coverageStats(domain === "all" ? undefined : domain);

  return (
    <div className="page">
      <div className="eyebrow">Programme</div>
      <h1>Matrice de couverture pédagogique</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Tout le périmètre prévu est listé. Seules les notions marquées « Disponible » ont une leçon rédigée, des exercices vérifiés par tests et sont jouables. Une carte de module ne
        compte jamais comme un module terminé.
      </p>
      <div className="row" style={{ gap: 16, margin: "16px 0" }} aria-label="Légende des statuts">
        {contentStatus.map((s) => (
          <span key={s} className={`badge ${statusTone[s]}`}>
            {statusIcon[s]} {statusLabel[s]} · {stats.counts[s]}
          </span>
        ))}
        <span className="small muted">sur {stats.total} notions</span>
      </div>
      <div className="filters">
        <label className="field small">
          Domaine
          <select value={domain} onChange={(e) => setDomain(e.target.value as DomainId | "all")}>
            <option value="all">Tous</option>
            {curriculum.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short}
              </option>
            ))}
          </select>
        </label>
        <label className="field small">
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus | "all")}>
            <option value="all">Tous</option>
            {contentStatus.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field small">
          Rechercher
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex. jointure, boucle…" />
        </label>
        <span className="small muted" aria-live="polite">
          {rows.length} notion(s)
        </span>
      </div>
      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Domaine · module</th>
              <th scope="col">Notion</th>
              <th scope="col">Statut</th>
              <th scope="col">Objectif observable</th>
              <th scope="col">Activités</th>
              <th scope="col">Évaluation</th>
              <th scope="col">Projet associé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ domain: d, module: m, notion: n }) => {
              const lesson = n.lessonIds?.[0] ? lessonById.get(n.lessonIds[0]) : undefined;
              return (
                <tr key={n.id}>
                  <td className="small">
                    {d.short} · {m.letter}. {m.title}
                  </td>
                  <td>{lesson && n.status === "disponible" ? <a href={lessonHref(lesson.id)}>{n.title}</a> : n.title}</td>
                  <td>
                    <span className={`badge ${statusTone[n.status]}`}>
                      {statusIcon[n.status]} {statusLabel[n.status]}
                    </span>
                  </td>
                  <td className="small">{n.objective ?? <span className="muted">—</span>}</td>
                  <td className="small">{n.activities?.join(", ") ?? <span className="muted">—</span>}</td>
                  <td className="small">{n.evaluation ?? <span className="muted">—</span>}</td>
                  <td className="small">{n.project ?? <span className="muted">{d.project.title} (prévu)</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

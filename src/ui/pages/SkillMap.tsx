import { useMemo, useState } from "react";
import { allNotions, curriculum, exercises, lessonById, lessons, moduleById, moduleDependencies, projects } from "../../content";
import { statusLabel, type ContentStatus, type Domain, type DomainId, type Module, type Notion } from "../../content/types";
import { estimateMastery, masteryLabel, type MasteryEstimate, type MasteryLevel } from "../../domain/mastery";
import { lessonHref } from "../../domain/recommend";
import { useApp } from "../app-context";
import type { Route } from "../router";
import { projectHref } from "./ProjectPage";

/** Icône de maîtrise : disque rempli par quarts (forme), toujours accompagnée de son libellé. */
export function MasteryIcon({ level }: { level: MasteryLevel }) {
  const r = 6;
  const a = (level / 4) * 2 * Math.PI;
  const x = 7 + r * Math.sin(a);
  const y = 7 - r * Math.cos(a);
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="mastery-icon">
      <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.4" />
      {level === 4 ? <circle cx="7" cy="7" r={r} fill="currentColor" /> : level > 0 && <path d={`M7,7 L7,1 A${r},${r} 0 ${level > 2 ? 1 : 0} 1 ${x},${y} Z`} fill="currentColor" />}
    </svg>
  );
}
const levels: MasteryLevel[] = [0, 1, 2, 3, 4];
const playable = (s: ContentStatus) => s === "disponible" || s === "teste";
export const mapHref = (moduleId?: string, notionId?: string) => `#/carte${moduleId ? `/${moduleId}` : ""}${notionId ? `/${notionId}` : ""}`;

type MasteryFilter = "all" | "demo" | "progress" | "todo";

function useMasteryMap() {
  const { data } = useApp();
  return useMemo(() => {
    const m = new Map<string, MasteryEstimate>();
    for (const { notion } of allNotions())
      if (playable(notion.status))
        m.set(notion.id, estimateMastery(notion.id, { lessons, exercises, attempts: data.attempts, events: data.events, review: data.reviews.find((r) => r.conceptId === notion.id) }));
    return m;
  }, [data]);
}

function matchesMastery(f: MasteryFilter, n: Notion, m?: MasteryEstimate) {
  if (f === "all") return true;
  if (!playable(n.status)) return false;
  const level = m?.level ?? 0;
  return f === "demo" ? level >= 3 : f === "progress" ? level === 1 || level === 2 : level === 0;
}

const NODE_W = 172;
const NODE_H = 64;
const COL = 200;
const ROW = 104;
const LEFT = 92;
const TOP = 24;

/** Vue d'ensemble : un rang par domaine, un nœud par module, flèches « s'appuie sur ». */
function Overview({ domains: input, mastery }: { domains: Domain[]; mastery: Map<string, MasteryEstimate> }) {
  let domains = input;
  // Ordre des rangs choisi pour que les dépendances entre domaines relient des rangs voisins.
  const rowOrder: DomainId[] = ["bi", "sql", "ml", "python", "llm"];
  domains = [...domains].sort((a, b) => rowOrder.indexOf(a.id) - rowOrder.indexOf(b.id));
  const pos = new Map<string, { x: number; y: number }>();
  domains.forEach((d, row) => d.modules.forEach((m, col) => pos.set(m.id, { x: LEFT + col * COL, y: TOP + row * ROW })));
  const arcSide = new Map<string, number>();
  const width = LEFT + 5 * COL;
  const height = TOP + domains.length * ROW;
  const edges = moduleDependencies.filter((e) => pos.has(e.from) && pos.has(e.to));

  const edgePath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (from.y === to.y) {
      const x1 = from.x + NODE_W;
      const x2 = to.x;
      const y = from.y + NODE_H / 2;
      if (x2 - x1 <= COL - NODE_W + 1) return `M${x1},${y} L${x2 - 2},${y}`;
      // Saut par-dessus un module : arcs alternativement au-dessus et au-dessous du rang.
      const n = arcSide.get(String(from.y)) ?? 0;
      arcSide.set(String(from.y), n + 1);
      const above = n % 2 === 0;
      const yy = above ? from.y : from.y + NODE_H;
      const c = above ? yy - 20 : yy + 20;
      const ax = from.x + NODE_W * 0.7;
      const bx = to.x + NODE_W * 0.3;
      return `M${ax},${yy} C${ax},${c} ${bx},${c} ${bx},${above ? yy - 2 : yy + 2}`;
    }
    const down = to.y > from.y;
    const x1 = from.x + NODE_W / 2;
    const y1 = down ? from.y + NODE_H : from.y;
    const x2 = to.x + NODE_W / 2;
    const y2 = down ? to.y - 2 : to.y + NODE_H + 2;
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  };

  return (
    <div className="map-scroll">
      <svg className="skill-map" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label="Carte des modules : un rang par domaine">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="map-arrow" />
          </marker>
        </defs>
        {domains.map((d, row) => (
          <text key={d.id} x={8} y={TOP + row * ROW + NODE_H / 2 + 5} className="map-domain">
            {d.short}
          </text>
        ))}
        {edges.map((e) => (
          <path
            key={`${e.from}-${e.to}`}
            d={edgePath(pos.get(e.from)!, pos.get(e.to)!)}
            className={`map-edge${moduleById(e.from)?.domain !== moduleById(e.to)?.domain ? " cross" : ""}`}
            markerEnd="url(#arrow)"
          >
            <title>
              {moduleById(e.from)?.title} → {moduleById(e.to)?.title} : {e.reason}
            </title>
          </path>
        ))}
        {domains.flatMap((d) =>
          d.modules.map((m) => {
            const p = pos.get(m.id)!;
            const avail = m.notions.filter((n) => playable(n.status));
            const demo = avail.filter((n) => (mastery.get(n.id)?.level ?? 0) >= 3).length;
            const shown = m.title.length > 22 ? `${m.title.slice(0, 21)}…` : m.title;
            const meta = avail.length ? `${avail.length}/${m.notions.length} jouables` : `${m.notions.length} notions · prévu`;
            const demoText = avail.length > 0 ? `${demo} démontrée${demo > 1 ? "s" : ""}` : "";
            // Pas d'aria-label : le nom accessible est le texte visible du nœud (WCAG 2.5.3) ; la version liste donne les titres complets.
            return (
              <a key={m.id} href={mapHref(m.id)} className={`map-node${avail.length ? " has-content" : ""}`} data-testid={`map-node-${m.id}`}>
                <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={8} />
                <text x={p.x + 10} y={p.y + 20} className="map-node-title">
                  {m.letter}. {shown}
                </text>
                <text x={p.x + 10} y={p.y + 40} className="map-node-meta">
                  {meta}
                </text>
                {avail.length > 0 && (
                  <text x={p.x + 10} y={p.y + 56} className="map-node-meta">
                    {demoText}
                  </text>
                )}
              </a>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function NotionCard({ n, m, onOpen }: { n: Notion; m?: MasteryEstimate; onOpen: string }) {
  return (
    <a className={`notion-card${playable(n.status) ? " playable" : ""}`} href={onOpen} data-testid={`notion-${n.id}`}>
      <span className="small muted">{statusLabel[n.status]}</span>
      <strong>{n.title}</strong>
      <span className="small">
        {playable(n.status) ? (
          <>
            <MasteryIcon level={m?.level ?? 0} /> {masteryLabel[m?.level ?? 0]}
          </>
        ) : (
          <span className="muted">Pas encore jouable</span>
        )}
      </span>
    </a>
  );
}

function ModuleView({ module: m, mastery, filter }: { module: Module; mastery: Map<string, MasteryEstimate>; filter: MasteryFilter }) {
  const deps = moduleDependencies.filter((e) => e.to === m.id);
  const next = moduleDependencies.filter((e) => e.from === m.id);
  const shown = m.notions.filter((n) => matchesMastery(filter, n, mastery.get(n.id)));
  return (
    <>
      {(deps.length > 0 || next.length > 0) && (
        <div className="row small" style={{ gap: 16, marginBottom: 12, alignItems: "flex-start" }}>
          {deps.length > 0 && (
            <div>
              <strong>S'appuie sur :</strong>{" "}
              {deps.map((e, k) => (
                <span key={e.from}>
                  {k > 0 && ", "}
                  <a href={mapHref(e.from)} title={e.reason}>
                    {moduleLabel(e.from)}
                  </a>
                </span>
              ))}
            </div>
          )}
          {next.length > 0 && (
            <div>
              <strong>Prépare à :</strong>{" "}
              {next.map((e, k) => (
                <span key={e.to}>
                  {k > 0 && ", "}
                  <a href={mapHref(e.to)} title={e.reason}>
                    {moduleLabel(e.to)}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="notion-grid">
        {shown.map((n) => (
          <NotionCard key={n.id} n={n} m={mastery.get(n.id)} onOpen={mapHref(m.id, n.id)} />
        ))}
      </div>
      {shown.length === 0 && <p className="small muted">Aucune notion de ce module ne correspond au filtre.</p>}
    </>
  );
}

function moduleLabel(id: string) {
  const m = moduleById(id);
  const d = curriculum.find((x) => x.id === m?.domain);
  return m ? `${d?.short} ${m.letter}. ${m.title}` : id;
}

/** Vue locale : prérequis → notion → notions qui en dépendent, avec les preuves de maîtrise. */
function LocalView({ notionId, mastery }: { notionId: string; mastery: Map<string, MasteryEstimate> }) {
  const rows = allNotions();
  const row = rows.find((r) => r.notion.id === notionId);
  if (!row) return <p>Notion introuvable.</p>;
  const { notion: n, module: m } = row;
  const pre = (n.prerequisites ?? []).map((id) => rows.find((r) => r.notion.id === id)).filter(Boolean) as typeof rows;
  const post = rows.filter((r) => r.notion.prerequisites?.includes(n.id));
  const me = mastery.get(n.id);
  const lesson = n.lessonIds?.[0] ? lessonById.get(n.lessonIds[0]) : undefined;
  const project = projects.find((p) => p.steps.some((s) => exercises.find((e) => e.id === s.exerciseId)?.conceptIds.includes(n.id)));

  const col = (title: string, items: typeof rows, empty: string) => (
    <div className="local-col">
      <div className="eyebrow">{title}</div>
      {items.length ? (
        items.map((r) => <NotionCard key={r.notion.id} n={r.notion} m={mastery.get(r.notion.id)} onOpen={mapHref(r.module.id, r.notion.id)} />)
      ) : (
        <p className="small muted">{empty}</p>
      )}
    </div>
  );

  return (
    <div className="local-view" data-testid="local-view">
      {col("Prérequis", pre, "Aucun prérequis fin renseigné. Voir les modules dont celui-ci dépend.")}
      <div className="local-center panel">
        <div className="eyebrow">{moduleLabel(m.id)}</div>
        <h2 style={{ marginTop: 4 }}>{n.title}</h2>
        <p className="small">
          <span className="badge">{statusLabel[n.status]}</span>{" "}
          {playable(n.status) && (
            <span className="badge accent">
              <MasteryIcon level={me?.level ?? 0} /> {masteryLabel[me?.level ?? 0]}
            </span>
          )}
        </p>
        {n.objective ? <p>{n.objective}</p> : <p className="muted small">Objectif détaillé à rédiger : cette notion est prévue au programme.</p>}
        {me && (
          <>
            <ul className="small">
              {me.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {me.evidence.length > 0 && (
              <>
                <strong className="small">Preuves</strong>
                <ul className="list-plain small">
                  {me.evidence.slice(0, 5).map((e, k) => (
                    <li key={k}>
                      {e.verified ? "✓ vérifiée" : "≈ auto-déclarée"} · {e.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          {lesson && n.status === "disponible" && (
            <a className="btn sm primary" href={lessonHref(lesson.id)}>
              Ouvrir la leçon
            </a>
          )}
          {project && (
            <a className="btn sm" href={projectHref(project.id)}>
              Pratiquer dans le projet
            </a>
          )}
        </div>
      </div>
      {col("Prépare à", post, "Aucune notion jouable n'en dépend encore explicitement.")}
    </div>
  );
}

/** Équivalent textuel complet de la carte. */
function ListView({ domains, mastery, filter, q }: { domains: Domain[]; mastery: Map<string, MasteryEstimate>; filter: MasteryFilter; q: string }) {
  return (
    <div data-testid="map-list">
      {domains.map((d) => (
        <section key={d.id}>
          <h2>{d.title}</h2>
          <ul>
            {d.modules.map((m) => {
              const ns = m.notions.filter((n) => matchesMastery(filter, n, mastery.get(n.id)) && (!q || n.title.toLowerCase().includes(q.toLowerCase())));
              if (!ns.length) return null;
              const deps = moduleDependencies.filter((e) => e.to === m.id).map((e) => moduleLabel(e.from));
              return (
                <li key={m.id}>
                  <a href={mapHref(m.id)}>
                    {m.letter}. {m.title}
                  </a>
                  {deps.length > 0 && <span className="small muted"> — s'appuie sur {deps.join(", ")}</span>}
                  <ul>
                    {ns.map((n) => (
                      <li key={n.id} className="small">
                        <a href={mapHref(m.id, n.id)}>{n.title}</a> — {statusLabel[n.status]}
                        {playable(n.status) ? ` · ${masteryLabel[mastery.get(n.id)?.level ?? 0]}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SkillMap({ route }: { route: Route }) {
  const [moduleId, notionId] = route.params;
  const mastery = useMasteryMap();
  const [hidden, setHidden] = useState<Set<DomainId>>(new Set());
  const [filter, setFilter] = useState<MasteryFilter>("all");
  const [q, setQ] = useState("");
  const [list, setList] = useState(false);
  const mod = moduleId ? moduleById(moduleId) : undefined;
  const dom = mod ? curriculum.find((d) => d.id === mod.domain) : undefined;
  const notion = notionId ? mod?.notions.find((n) => n.id === notionId) : undefined;
  const domains = curriculum.filter((d) => !hidden.has(d.id));
  const level = notion ? 2 : mod ? 1 : 0;
  const hits = q.trim().length >= 2 ? allNotions().filter((r) => r.notion.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12) : [];

  const zoomOut = notion ? mapHref(mod!.id) : mod ? mapHref() : undefined;
  const zoomIn = !mod ? mapHref(curriculum.find((d) => !hidden.has(d.id))?.modules.find((m) => m.notions.some((n) => playable(n.status)))?.id) : !notion ? mapHref(mod.id, mod.notions.find((n) => playable(n.status))?.id ?? mod.notions[0].id) : undefined;

  return (
    <div className="page">
      <div className="eyebrow">Carte des compétences</div>
      <h1>Où en es-tu, et qu'est-ce qui vient ensuite ?</h1>
      <p className="muted" style={{ maxWidth: 760 }}>
        Chaque nœud indique son statut (jouable : cadre plein ; prévu : cadre pointillé) et ta maîtrise prouvée par des exercices réussis. Les flèches signifient « s'appuie
        sur » (pointillées entre deux domaines).
      </p>
      <p className="small row" style={{ gap: 14 }} aria-label="Légende de la maîtrise">
        {levels.map((l) => (
          <span key={l} className="row" style={{ gap: 4 }}>
            <MasteryIcon level={l} /> {masteryLabel[l]}
          </span>
        ))}
      </p>

      <nav aria-label="Niveau de zoom" className="row map-toolbar">
        <ol className="breadcrumb">
          <li>
            <a href={mapHref()} aria-current={level === 0 ? "page" : undefined}>
              Tous les domaines
            </a>
          </li>
          {mod && dom && (
            <li>
              <a href={mapHref(mod.id)} aria-current={level === 1 ? "page" : undefined}>
                {dom.short} · {mod.letter}. {mod.title}
              </a>
            </li>
          )}
          {notion && (
            <li>
              <span aria-current="page">{notion.title}</span>
            </li>
          )}
        </ol>
        <span className="spacer" />
        <a className={`btn sm${zoomOut ? "" : " disabled"}`} href={zoomOut} aria-disabled={!zoomOut} aria-label="Dézoomer">
          − Dézoomer
        </a>
        <a className={`btn sm${zoomIn ? "" : " disabled"}`} href={zoomIn} aria-disabled={!zoomIn} aria-label="Zoomer">
          + Zoomer
        </a>
        <button className="btn sm ghost" aria-pressed={list} onClick={() => setList((l) => !l)}>
          {list ? "Vue carte" : "Version liste"}
        </button>
      </nav>

      <div className="filters">
        <fieldset className="row" style={{ border: 0, padding: 0, margin: 0, gap: 10 }}>
          <legend className="small" style={{ float: "left", marginRight: 8 }}>
            Domaines
          </legend>
          {curriculum.map((d) => (
            <label key={d.id} className="small row" style={{ gap: 4 }}>
              <input
                type="checkbox"
                checked={!hidden.has(d.id)}
                onChange={() =>
                  setHidden((h) => {
                    const x = new Set(h);
                    if (x.has(d.id)) x.delete(d.id);
                    else x.add(d.id);
                    return x;
                  })
                }
              />
              {d.short}
            </label>
          ))}
        </fieldset>
        <label className="field small">
          Maîtrise
          <select value={filter} onChange={(e) => setFilter(e.target.value as MasteryFilter)}>
            <option value="all">Tout le programme</option>
            <option value="demo">Démontrées ou consolidées</option>
            <option value="progress">Commencées, à prouver</option>
            <option value="todo">Jouables, pas commencées</option>
          </select>
        </label>
        <label className="field small">
          Rechercher une notion
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex. jointure, RAG, DAX…" />
        </label>
      </div>
      {hits.length > 0 && (
        <ul className="list-plain small search-hits" aria-label="Résultats de recherche">
          {hits.map((r) => (
            <li key={r.notion.id}>
              <a href={mapHref(r.module.id, r.notion.id)}>{r.notion.title}</a> <span className="muted">· {moduleLabel(r.module.id)} · {statusLabel[r.notion.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {list ? (
        <ListView domains={mod ? curriculum.filter((d) => d.id === mod.domain) : domains} mastery={mastery} filter={filter} q={q} />
      ) : notion ? (
        <LocalView notionId={notion.id} mastery={mastery} />
      ) : mod ? (
        <ModuleView module={mod} mastery={mastery} filter={filter} />
      ) : (
        <Overview domains={domains} mastery={mastery} />
      )}
    </div>
  );
}

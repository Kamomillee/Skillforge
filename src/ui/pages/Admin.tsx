import { useCallback, useEffect, useMemo, useState } from "react";
import { exerciseById } from "../../content";
import { contentInventory } from "../../domain/admin";
import { exerciseHref } from "../../domain/tutor";
import { api, statutSignalement, useCompte, type Signalement } from "../../services/serveur";
import { useApp } from "../app-context";

interface Stats {
  comptes: number;
  actifs7j: number;
  progressionsSynchronisees: number;
  ia: { demandesAujourdhui: number; jetonsAujourdhui: number; estimees: boolean; erreurs7j: number };
  signalements: Record<string, number>;
  budget: { requestsPerDay: number; tokensPerDay: number };
}
interface Metrics {
  depuis: string;
  dureeSecondes: number;
  routes: { route: string; requetes: number; erreurs5xx: number; p50ms: number; p95ms: number }[];
  appelsIA: Record<string, number>;
  erreursClient: number;
}

const STATUTS = Object.keys(statutSignalement) as Signalement["status"][];

/** Administration (`#/admin`) : réservée aux comptes « admin » ; le serveur vérifie le rôle à chaque requête. */
export function Admin() {
  const compte = useCompte();
  if (compte.kind === "chargement") return <div className="page">Chargement…</div>;
  if (compte.kind !== "connecte" || compte.user.role !== "admin")
    return (
      <div className="page page-narrow">
        <h1>Administration</h1>
        <p data-testid="admin-refus">
          {compte.kind === "hors-ligne" ? "L'administration demande le serveur SkillForge (pnpm serve)." : "Réservé aux comptes d'administration. "}
          {compte.kind === "anonyme" && <a href="#/parametres">Se connecter</a>}
        </p>
      </div>
    );
  return <AdminPanels />;
}

function AdminPanels() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const load = useCallback(() => {
    void api<Stats>("GET", "/api/admin/statistiques").then((r) => r.ok && setStats(r.data));
    void api<Metrics>("GET", "/api/admin/metriques").then((r) => r.ok && setMetrics(r.data));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="page">
      <p className="eyebrow">Équipe pédagogique</p>
      <h1>Administration</h1>
      {stats && (
        <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="adm-stats" data-testid="admin-stats">
          <h2 id="adm-stats">Vue d'ensemble</h2>
          <div className="stat-row">
            <div>
              <strong>{stats.comptes}</strong> comptes
            </div>
            <div>
              <strong>{stats.actifs7j}</strong> actifs sur 7 jours
            </div>
            <div>
              <strong>{stats.progressionsSynchronisees}</strong> progressions synchronisées
            </div>
            <div>
              <strong>{stats.ia.demandesAujourdhui}</strong> demandes IA aujourd'hui
            </div>
            <div>
              <strong>{stats.ia.jetonsAujourdhui.toLocaleString("fr-CH")}</strong> jetons aujourd'hui{stats.ia.estimees ? " (dont estimés)" : ""}
            </div>
            <div>
              <strong>{stats.ia.erreurs7j}</strong> erreurs ou refus IA sur 7 jours
            </div>
          </div>
          <p className="small muted">
            Agrégats uniquement : aucune donnée individuelle n'est affichée ici. Budget IA par compte : {stats.budget.requestsPerDay} demandes et {stats.budget.tokensPerDay.toLocaleString("fr-CH")}{" "}
            jetons par jour.
          </p>
        </section>
      )}
      <Reports onChange={load} />
      <Inventory />
      {metrics && <MetricsPanel m={metrics} />}
    </div>
  );
}

function Reports({ onChange }: { onChange: () => void }) {
  const { toast } = useApp();
  const [filter, setFilter] = useState<Signalement["status"] | "">("nouveau");
  const [rows, setRows] = useState<Signalement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    void api<Signalement[]>("GET", `/api/admin/signalements${filter ? `?statut=${filter}` : ""}`).then((r) => (r.ok ? setRows(r.data) : setError(r.erreur)));
  }, [filter]);
  useEffect(load, [load]);

  async function save(id: number, status: Signalement["status"], note: string) {
    const r = await api("PATCH", `/api/admin/signalements/${id}`, { status, note });
    toast(r.ok ? `Signalement n° ${id} : ${statutSignalement[status].toLowerCase()}.` : `Échec : ${r.erreur}`);
    load();
    onChange();
  }

  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="adm-sig" data-testid="admin-signalements">
      <h2 id="adm-sig">Signalements</h2>
      <label className="field" style={{ maxWidth: 260 }}>
        Statut
        <select value={filter} onChange={(e) => setFilter(e.target.value as Signalement["status"] | "")}>
          <option value="">Tous</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {statutSignalement[s]}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {rows && !rows.length && <p className="small">Aucun signalement avec ce statut.</p>}
      <ul className="plain-list" style={{ marginTop: 12 }}>
        {rows?.map((r) => <ReportItem key={r.id} r={r} onSave={save} />)}
      </ul>
    </section>
  );
}

function ReportItem({ r, onSave }: { r: Signalement; onSave: (id: number, s: Signalement["status"], note: string) => void }) {
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.note);
  const ex = exerciseById.get(r.target);
  const href = ex ? exerciseHref(ex.id) : r.kind === "lecon" ? `#/lecon/${r.target}` : undefined;
  const outdated = ex && r.targetVersion && r.targetVersion !== ex.version;
  return (
    <li className="admin-report" data-testid={`signalement-${r.id}`}>
      <div className="small muted">
        N° {r.id} · {new Date(r.at).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })} · {r.kind === "tuteur" ? "réponse du tuteur" : r.kind}
      </div>
      <div>
        <strong>{href ? <a href={href}>{ex?.title ?? r.target}</a> : r.target}</strong>
        {r.targetVersion ? ` · version ${r.targetVersion}` : ""}
        {outdated && <span className="badge warning"> version actuelle : {ex!.version}</span>}
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.message}</p>
      <div className="row" style={{ alignItems: "end" }}>
        <label className="field">
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value as Signalement["status"])}>
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {statutSignalement[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          Réponse visible par l'étudiant
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </label>
        <button className="btn primary" onClick={() => onSave(r.id, status, note)}>
          Enregistrer
        </button>
      </div>
    </li>
  );
}

function Inventory() {
  const rows = useMemo(contentInventory, []);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const issues = rows.filter((r) => r.issues.length).length;
  const shown = onlyIssues ? rows.filter((r) => r.issues.length) : rows;
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="adm-inv" data-testid="admin-inventaire">
      <h2 id="adm-inv">Inventaire des contenus</h2>
      <p className="small">
        {rows.length} exercices, {issues ? `${issues} avec un problème détecté` : "aucun problème détecté par les contrôles automatiques"}. Les contenus se modifient dans le code (
        <code>src/content</code>) : chaque modification passe par les tests de contenu, qui exécutent la solution de référence et vérifient que les tests cachés détectent les erreurs typiques.
        Changer un énoncé ou un test impose d'augmenter la version de l'exercice ; les anciennes tentatives restent rattachées à leur version.
      </p>
      <label className="small">
        <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Seulement les exercices à corriger
      </label>
      <div className="table-scroll">
        <table className="matrix">
          <caption className="sr-only">Exercices, versions, tests et contrôles</caption>
          <thead>
            <tr>
              <th scope="col">Exercice</th>
              <th scope="col">Langage</th>
              <th scope="col">Version</th>
              <th scope="col">Tests (visibles / cachés)</th>
              <th scope="col">Emplacement</th>
              <th scope="col">Contrôles</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.href ? <a href={r.href}>{r.title}</a> : r.title}</td>
                <td>{r.language === "sql" ? "SQL" : "Python"}</td>
                <td>{r.version}</td>
                <td>
                  {r.visibleTests} / {r.hiddenTests}
                </td>
                <td className="small">{r.where}</td>
                <td>{r.issues.length ? <span className="badge danger">{r.issues.join(" ; ")}</span> : <span className="badge success">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricsPanel({ m }: { m: Metrics }) {
  return (
    <section className="panel" aria-labelledby="adm-met" data-testid="admin-metriques">
      <h2 id="adm-met">Fonctionnement du serveur</h2>
      <p className="small">
        Depuis le {new Date(m.depuis).toLocaleString("fr-CH")} ({Math.round(m.dureeSecondes / 60)} min). Appels IA :{" "}
        {Object.entries(m.appelsIA)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ") || "aucun"}
        . Erreurs remontées par les navigateurs : {m.erreursClient}. Les journaux détaillés (JSON, sans contenu ni secret) sont sur la sortie standard du serveur.
      </p>
      <div className="table-scroll">
        <table className="matrix">
          <caption className="sr-only">Requêtes par route</caption>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Requêtes</th>
              <th scope="col">Erreurs 5xx</th>
              <th scope="col">Médiane</th>
              <th scope="col">95e centile</th>
            </tr>
          </thead>
          <tbody>
            {m.routes.map((r) => (
              <tr key={r.route}>
                <td>
                  <code>{r.route}</code>
                </td>
                <td>{r.requetes}</td>
                <td>{r.erreurs5xx}</td>
                <td>{r.p50ms} ms</td>
                <td>{r.p95ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

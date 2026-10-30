import { useEffect, useState, type FormEvent } from "react";
import { SYNC_KEY, type SyncState } from "../../domain/sync";
import { api, connexion, deconnexion, inscription, statutSignalement, supprimerCompte, useCompte, type Consommation, type Signalement, type Utilisateur } from "../../services/serveur";
import { synchroniser, type SyncOutcome } from "../../services/sync";
import { useApp } from "../app-context";
import { Dialog } from "./Dialog";

const dateHeure = (iso: string) => new Date(iso).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" });

/** Section « Compte et synchronisation » des paramètres. */
export function AccountPanel() {
  const compte = useCompte();
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="compte-titre" data-testid="compte">
      <h2 id="compte-titre">Compte et synchronisation</h2>
      {compte.kind === "chargement" && <p className="small muted">Recherche du serveur SkillForge…</p>}
      {compte.kind === "hors-ligne" && (
        <p className="small" data-testid="compte-hors-ligne">
          <span className="badge">Mode local</span> Aucun serveur SkillForge ne répond : ta progression reste dans ce navigateur, et tout fonctionne sans compte. Les comptes, la
          synchronisation entre appareils et le tuteur IA demandent le serveur (<code>pnpm serve</code>).
        </p>
      )}
      {compte.kind === "anonyme" && <LoginForm />}
      {compte.kind === "connecte" && <Connected user={compte.user} />}
    </section>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === "connexion" ? await connexion(email, password) : await inscription(email, password, name);
    setBusy(false);
    if (!r.ok) setError(r.erreur);
  }

  return (
    <>
      <p className="small">
        Un compte permet de retrouver ta progression sur un autre appareil et d'utiliser le tuteur IA dans la limite d'un budget quotidien. Sans compte, rien ne quitte ce
        navigateur.
      </p>
      <div className="row" role="group" aria-label="Choisir">
        <button className="btn sm" aria-pressed={mode === "connexion"} onClick={() => setMode("connexion")}>
          Se connecter
        </button>
        <button className="btn sm" aria-pressed={mode === "inscription"} onClick={() => setMode("inscription")}>
          Créer un compte
        </button>
      </div>
      <form onSubmit={submit} className="account-form" aria-label={mode === "connexion" ? "Connexion" : "Création de compte"}>
        {mode === "inscription" && (
          <label className="field">
            Prénom (facultatif)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="given-name" />
          </label>
        )}
        <label className="field">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          Mot de passe{mode === "inscription" ? " (10 caractères au moins)" : ""}
          <input type="password" required minLength={mode === "inscription" ? 10 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "connexion" ? "current-password" : "new-password"} />
        </label>
        {error && (
          <p role="alert" className="small" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </>
  );
}

const outcomeText = (o: SyncOutcome): string =>
  o.kind === "a-jour"
    ? "Déjà à jour."
    : o.kind === "envoye"
      ? `Progression de ce navigateur enregistrée sur ton compte (version ${o.revision}).`
      : o.kind === "recupere"
        ? `Progression de ton compte chargée dans ce navigateur (version ${o.revision}).`
        : o.kind === "erreur"
          ? `Synchronisation impossible : ${o.message}. Ta progression locale est intacte.`
          : "";

function Connected({ user }: { user: Utilisateur }) {
  const { store, refresh, toast } = useApp();
  const [state, setState] = useState<SyncState | undefined>();
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pwd, setPwd] = useState("");
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    void store.get<SyncState>(SYNC_KEY).then(setState);
  }, [store, outcome]);

  async function sync(force?: "local" | "serveur") {
    setBusy(true);
    const o = await synchroniser(store, user.id, force);
    setBusy(false);
    setOutcome(o);
    if (o.kind === "recupere") await refresh();
  }

  async function remove() {
    const r = await supprimerCompte(pwd);
    if (!r.ok) return setDelError(r.erreur);
    setDeleting(false);
    toast("Compte supprimé sur le serveur. La progression de ce navigateur est conservée.");
  }

  return (
    <>
      <p>
        Connecté·e : <strong data-testid="compte-email">{user.email}</strong> {user.role === "admin" && <span className="badge accent">Administration</span>}
      </p>
      <p className="small muted" data-testid="sync-etat">
        {state && state.userId === user.id ? `Dernière synchronisation : ${dateHeure(state.at)} (version ${state.revision}).` : "Ce navigateur n'a jamais été synchronisé avec ce compte."}
      </p>
      <div className="row">
        <button className="btn primary" onClick={() => sync()} disabled={busy}>
          {busy ? "Synchronisation…" : "Synchroniser maintenant"}
        </button>
        <button className="btn" onClick={() => void deconnexion()}>
          Se déconnecter
        </button>
      </div>
      {outcome && outcome.kind !== "conflit" && (
        <p role="status" className="small" data-testid="sync-resultat">
          {outcomeText(outcome)}
        </p>
      )}
      {outcome?.kind === "conflit" && (
        <div className="callout warning" role="alert" data-testid="sync-conflit">
          <p className="callout-title">Deux versions différentes : rien n'a été écrasé</p>
          <p className="small">
            Raison : {outcome.raison}. Version du compte : {outcome.serverRevision}
            {outcome.serverUpdatedAt ? `, enregistrée le ${dateHeure(outcome.serverUpdatedAt)}` : ""}. Choisis celle à garder :
          </p>
          <div className="row">
            <button className="btn" onClick={() => sync("local")} disabled={busy}>
              Garder ce navigateur (remplace le compte)
            </button>
            <button className="btn" onClick={() => sync("serveur")} disabled={busy}>
              Prendre le compte (copie de ce navigateur téléchargée avant)
            </button>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: "1rem", marginTop: 20 }}>Tes données sur le serveur</h3>
      <p className="small">
        Le serveur conserve : ton e-mail, un hachage de ton mot de passe, la progression synchronisée, tes demandes au tuteur IA (date, mode, jetons ; jamais leur texte) pendant 90 jours, et
        tes signalements. Détails dans la politique de conservation (docs/CONFIDENTIALITE.md).
      </p>
      <div className="row">
        <a className="btn" href="/api/moi/export" download>
          Exporter mes données du serveur (JSON)
        </a>
        <button className="btn danger" onClick={() => setDeleting(true)}>
          Supprimer mon compte
        </button>
      </div>
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Supprimer ton compte ?"
        actions={
          <>
            <button className="btn" onClick={() => setDeleting(false)}>
              Annuler
            </button>
            <button className="btn danger" onClick={remove} disabled={!pwd}>
              Supprimer définitivement
            </button>
          </>
        }
      >
        <p>Le compte, la progression synchronisée et l'historique IA sont effacés du serveur ; tes signalements restent, sans lien avec toi. La progression de ce navigateur n'est pas touchée.</p>
        <label className="field">
          Mot de passe
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="current-password" />
        </label>
        {delError && (
          <p role="alert" className="small" style={{ color: "var(--danger)" }}>
            {delError}
          </p>
        )}
      </Dialog>
    </>
  );
}

/** Consommation IA réelle du compte (jetons renvoyés par l'API), estimations signalées. */
export function ConsumptionPanel() {
  const compte = useCompte();
  const [c, setC] = useState<Consommation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (compte.kind !== "connecte") return;
    void api<Consommation>("GET", "/api/consommation").then((r) => (r.ok ? setC(r.data) : setErr(r.erreur)));
  }, [compte.kind]);
  if (compte.kind !== "connecte") return null;
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="conso-titre" data-testid="consommation">
      <h2 id="conso-titre">Consommation du tuteur IA</h2>
      {err && <p className="small">Indisponible : {err}</p>}
      {c && (
        <>
          <p>
            Aujourd'hui : <strong>{c.aujourdhui.requests}</strong> / {c.budget.requestsPerDay} demandes, <strong>{c.aujourdhui.tokens.toLocaleString("fr-CH")}</strong> /{" "}
            {c.budget.tokensPerDay.toLocaleString("fr-CH")} jetons {c.aujourdhui.estimated && <span className="badge warning">estimation (tuteur simulé)</span>}
          </p>
          <p className="small muted">
            Les jetons sont ceux comptés par le fournisseur pour chaque réponse. Le budget est un plafond technique par jour : aucune facturation n'est activée. Au-delà, le tuteur local reste
            disponible.
          </p>
          {c.executions.length ? (
            <div className="table-scroll">
              <table className="matrix">
                <caption className="sr-only">Dernières demandes au tuteur IA</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Jetons (entrée / sortie)</th>
                    <th scope="col">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {c.executions.map((e, i) => (
                    <tr key={i}>
                      <td>{dateHeure(e.at)}</td>
                      <td>{e.mode}</td>
                      <td>
                        {e.inputTokens} / {e.outputTokens}
                        {e.estimated ? " (estimé)" : ""}
                      </td>
                      <td>{e.status === "ok" ? "réponse" : e.status === "refus" ? "refus du modèle" : "erreur"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small">Aucune demande pour l'instant.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Signalements envoyés par l'étudiant, avec la réponse de l'équipe. */
export function MyReports() {
  const compte = useCompte();
  const [rows, setRows] = useState<Signalement[] | null>(null);
  useEffect(() => {
    if (compte.kind === "connecte") void api<Signalement[]>("GET", "/api/signalements").then((r) => r.ok && setRows(r.data));
  }, [compte.kind]);
  if (compte.kind !== "connecte" || !rows?.length) return null;
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="sig-titre" data-testid="mes-signalements">
      <h2 id="sig-titre">Mes signalements</h2>
      <ul className="plain-list">
        {rows.map((r) => (
          <li key={r.id}>
            <span className={`badge ${r.status === "corrige" ? "success" : r.status === "rejete" ? "" : "info"}`}>{statutSignalement[r.status]}</span> <strong>{r.target}</strong>
            {r.targetVersion ? ` (v${r.targetVersion})` : ""} — {r.message}
            {r.note && <p className="small">Réponse : {r.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

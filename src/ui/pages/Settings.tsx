import { useRef, useState } from "react";
import { useApp } from "../app-context";
import { AccountPanel, ConsumptionPanel, MyReports } from "../components/Account";
import { ConfirmDialog } from "../components/Dialog";
import { navigate } from "../router";

type Theme = "system" | "light" | "dark";

export function applyTheme(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem("sf-theme");
    else localStorage.setItem("sf-theme", t);
  } catch {
    /* préférence non mémorisée */
  }
}

export function Settings() {
  const { store, refresh, runnerState, toast } = useApp();
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) ?? "system");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function exportData() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `skillforge-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(f: File) {
    setImportError(null);
    if (f.size > 20 * 1024 * 1024) return setImportError("Fichier trop volumineux (20 Mo maximum).");
    try {
      await store.importAll(JSON.parse(await f.text()));
      await refresh();
      toast("Données importées.");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteAll() {
    setConfirmDelete(false);
    await store.clearAll();
    await refresh();
    toast("Toutes tes données locales ont été supprimées.");
    navigate("#/");
  }

  return (
    <div className="page page-narrow">
      <h1>Paramètres</h1>

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2>Apparence</h2>
        <fieldset style={{ margin: 0 }}>
          <legend className="sr-only">Thème</legend>
          <div className="choice-grid">
            {(
              [
                ["system", "Comme le système"],
                ["light", "Clair"],
                ["dark", "Sombre"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="choice">
                <input
                  type="radio"
                  name="theme"
                  checked={theme === v}
                  onChange={() => {
                    setTheme(v);
                    applyTheme(v);
                  }}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <AccountPanel />
      <ConsumptionPanel />
      <MyReports />

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2>Tes données</h2>
        <p className="small">
          Ta progression (profil, brouillons, tentatives, révisions, notes d'explication) est stockée <strong>dans ce navigateur</strong> (IndexedDB). Elle n'est envoyée au serveur que si tu
          te connectes à un compte et synchronises ; au fournisseur d'IA, seul le contexte de l'exercice en cours part quand tu interroges le tuteur IA. Effacer les données du site dans le
          navigateur les supprime aussi.
        </p>
        <div className="row">
          <button className="btn" onClick={exportData}>
            Exporter (JSON)
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            Importer…
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          <button className="btn danger" onClick={() => setConfirmDelete(true)}>
            Supprimer toutes mes données
          </button>
        </div>
        {importError && (
          <p role="alert" className="small" style={{ color: "var(--danger)" }}>
            Import impossible : {importError}
          </p>
        )}
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2>Moteur Python</h2>
        <p className="small">
          Python s'exécute dans ton navigateur (Pyodide, WebAssembly), dans un Web Worker isolé de la page. État :{" "}
          <strong>
            {runnerState.kind === "ready"
              ? `prêt (Python ${runnerState.pythonVersion}, interruption douce ${runnerState.interruptible ? "disponible" : "indisponible : l'arrêt redémarre le moteur"})`
              : runnerState.kind === "error"
                ? runnerState.message
                : runnerState.kind === "busy"
                  ? runnerState.message
                  : "en veille (démarre à la première exécution)"}
          </strong>
          .
        </p>
      </section>

      <Diagnostic />

      <section className="panel">
        <h2>Raccourcis clavier</h2>
        <table className="matrix">
          <tbody>
            <tr>
              <td>
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Entrée</kbd>
              </td>
              <td>Exécuter le code</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Maj</kbd> + <kbd>Entrée</kbd>
              </td>
              <td>Vérifier avec les tests</td>
            </tr>
            <tr>
              <td>
                <kbd>Alt</kbd> + <kbd>Page↓</kbd> / <kbd>Page↑</kbd>
              </td>
              <td>Étape suivante / précédente de la leçon</td>
            </tr>
            <tr>
              <td>
                <kbd>←</kbd> <kbd>→</kbd> sur une visualisation
              </td>
              <td>Étape précédente / suivante</td>
            </tr>
            <tr>
              <td>
                <kbd>Échap</kbd> puis <kbd>Tab</kbd>
              </td>
              <td>Sortir de l'éditeur de code au clavier</td>
            </tr>
            <tr>
              <td>
                <kbd>Échap</kbd>
              </td>
              <td>Quitter le plein écran de l'atelier</td>
            </tr>
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer toutes tes données ?"
        message={<p>Profil, parcours, brouillons, tentatives, révisions : tout sera effacé de ce navigateur. Exporte d'abord si tu veux garder une copie. Action irréversible.</p>}
        confirmLabel="Tout supprimer"
        danger
        onConfirm={deleteAll}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** Erreurs techniques récentes de ce navigateur (message et page seulement), pour les décrire dans un signalement. */
function Diagnostic() {
  const [errors, setErrors] = useState<{ at: string; message: string; route: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sf-erreurs") ?? "[]");
    } catch {
      return [];
    }
  });
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="diag-titre">
      <h2 id="diag-titre">Diagnostic</h2>
      {errors.length ? (
        <>
          <p className="small">Erreurs techniques récentes de l'application dans ce navigateur (message et page seulement ; jamais ton code). Elles sont aussi transmises au serveur s'il existe.</p>
          <ul className="small">
            {errors.map((e, i) => (
              <li key={i}>
                {new Date(e.at).toLocaleString("fr-CH")} · <code>{e.route || "#/"}</code> · {e.message}
              </li>
            ))}
          </ul>
          <button
            className="btn sm"
            onClick={() => {
              try {
                localStorage.removeItem("sf-erreurs");
              } catch {
                /* rien */
              }
              setErrors([]);
            }}
          >
            Effacer
          </button>
        </>
      ) : (
        <p className="small">Aucune erreur technique enregistrée dans ce navigateur.</p>
      )}
    </section>
  );
}

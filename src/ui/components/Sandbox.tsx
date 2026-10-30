import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import { CodeEditor } from "./CodeEditor";
import { explainError, type PyErrorInfo } from "../../grading/errors";
import type { QueryOutcome } from "../../runtime/sql/engine";
import { ResultTable, SchemaPanel, SqlErrorCard } from "./SqlParts";

const DEFAULT = `# Bac à sable : essaie ce que tu veux ici.
montants = [120, -30, 45, 80]
for m in montants:
    print(m, m > 0)
`;

/** Éditeur libre sans tests, sauvegardé localement. */
export function Sandbox() {
  const { store, runner, runnerState } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [out, setOut] = useState<{ text: string; error: PyErrorInfo | null; status: string } | null>(null);
  const busy = runnerState.kind === "busy" || runner.isBusy;

  useEffect(() => {
    store.get<string>("sandbox").then((c) => setCode(c ?? DEFAULT));
    void runner.init().catch(() => {});
  }, [store, runner]);

  useEffect(() => {
    if (code === null) return;
    const t = setTimeout(() => void store.set("sandbox", code), 600);
    return () => clearTimeout(t);
  }, [code, store]);

  async function run() {
    if (busy || code === null) return;
    setOut({ text: "", error: null, status: "running" });
    const r = await runner.run(code, { timeoutMs: 10_000, onStdout: (t) => setOut((o) => (o ? { ...o, text: o.text + t + "\n" } : o)) });
    setOut((o) => ({ text: o?.text ?? r.output, error: r.error, status: r.status }));
  }

  return (
    <>
      <div className="wb-head">
        <span className="badge">Bac à sable</span>
        <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>Expérimente librement</h2>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Pas de tests ici : rien n'est noté. Les exercices s'ouvrent dans cet atelier depuis la leçon.
        </p>
      </div>
      <div className="wb-scroll">
        <div className="wb-toolbar">
          <button className="btn sm primary" onClick={run} disabled={busy || code === null}>
            ▶ Exécuter <kbd>Ctrl ↵</kbd>
          </button>
          {busy && (
            <button className="btn sm danger" onClick={() => runner.stop()}>
              ■ Arrêter
            </button>
          )}
        </div>
        {code !== null && <CodeEditor value={code} onChange={setCode} onRun={run} label="Éditeur Python du bac à sable" />}
        <div className="out-panel" aria-live="polite">
          <div className="console" data-testid="sandbox-console">
            {out ? out.text || (out.status === "running" ? "Exécution…" : "(aucune sortie)") : <span className="muted">La sortie s'affichera ici.</span>}
          </div>
          {out?.status === "timeout" && <div className="callout danger">Programme arrêté : limite de 10 s dépassée.</div>}
          {out?.error && (
            <div className="error-card">
              <strong>{explainError(out.error).title}</strong>
              <p style={{ margin: "4px 0 0" }}>{explainError(out.error).hint}</p>
              <pre>{out.error.summary}</pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const DEFAULT_SQL = `-- Bac à sable SQL : la base de formation est en lecture seule (chaque requête est annulée).
SELECT statut, COUNT(*) AS nb
FROM commandes
GROUP BY statut
ORDER BY nb DESC;
`;

/** Bac à sable SQL sur la base de formation PME. */
export function SqlSandbox() {
  const { store, sqlRunner, sqlState } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [out, setOut] = useState<{ status: string; outcome?: QueryOutcome } | null>(null);
  const busy = sqlState.kind === "busy" || sqlRunner.isBusy;

  useEffect(() => {
    store.get<string>("sandbox:sql").then((c) => setCode(c ?? DEFAULT_SQL));
    void sqlRunner.init().catch(() => {});
  }, [store, sqlRunner]);

  useEffect(() => {
    if (code === null) return;
    const t = setTimeout(() => void store.set("sandbox:sql", code), 600);
    return () => clearTimeout(t);
  }, [code, store]);

  async function run() {
    if (busy || code === null) return;
    setOut({ status: "running" });
    const r = await sqlRunner.query(code, 8000);
    setOut({ status: r.status, outcome: r.outcome });
  }

  return (
    <>
      <div className="wb-head">
        <span className="badge">Bac à sable SQL</span>
        <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>Interroge la base de la PME</h2>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          Pas de tests ici : rien n'est noté. Les exercices s'ouvrent dans cet atelier depuis la leçon.
        </p>
      </div>
      <div className="wb-scroll">
        <div className="wb-toolbar">
          <button className="btn sm primary" onClick={run} disabled={busy || code === null}>
            ▶ Exécuter <kbd>Ctrl ↵</kbd>
          </button>
          {busy && (
            <button className="btn sm danger" onClick={() => sqlRunner.stop()}>
              ■ Arrêter
            </button>
          )}
        </div>
        {code !== null && <CodeEditor value={code} onChange={setCode} onRun={run} label="Éditeur SQL du bac à sable" language="sql" />}
        <details className="schema-details">
          <summary>Schéma de la base et aperçu des tables</summary>
          <SchemaPanel />
        </details>
        <div className="out-panel" aria-live="polite" data-testid="sandbox-sql-output">
          {!out ? (
            <p className="muted small">Le résultat s'affichera ici.</p>
          ) : out.status === "running" ? (
            <p className="muted small">Exécution…</p>
          ) : out.status === "timeout" ? (
            <div className="callout danger">Requête arrêtée : limite de 8 s dépassée. Le moteur a été redémarré.</div>
          ) : out.outcome?.ok ? (
            <ResultTable result={out.outcome.result} />
          ) : out.outcome ? (
            <SqlErrorCard err={out.outcome.error} sql={code ?? ""} />
          ) : (
            <p className="small">Requête interrompue.</p>
          )}
        </div>
      </div>
    </>
  );
}

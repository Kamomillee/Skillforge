import { useEffect, useState } from "react";
import { useApp } from "../app-context";
import { CodeEditor } from "./CodeEditor";
import { explainError, type PyErrorInfo } from "../../grading/errors";

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

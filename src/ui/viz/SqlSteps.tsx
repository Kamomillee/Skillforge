import { useEffect, useId, useState } from "react";
import type { ResultSet } from "../../runtime/sql/engine";
import { useApp } from "../app-context";
import { ResultTable } from "../components/SqlParts";
import { StepperControls, useStepper } from "./Stepper";

type Stage = { clause: string; label: string; sql: string; note: string };
type Loaded = { result?: ResultSet; error?: string };

/**
 * Ordre logique d'exécution d'une requête (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT).
 * Chaque étape est une vraie requête exécutée par PostgreSQL : les lignes affichées ne sont pas inventées.
 */
export function SqlSteps({ title, stages }: { title: string; stages: Stage[] }) {
  const { sqlRunner } = useApp();
  const s = useStepper(stages.length);
  const [loaded, setLoaded] = useState<Loaded[] | null>(null);
  const [textMode, setTextMode] = useState(false);
  const id = useId();

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Loaded[] = [];
      for (const st of stages) {
        const r = await sqlRunner.query(st.sql, 8000, 200);
        out.push(r.outcome?.ok ? { result: r.outcome.result } : { error: r.outcome && !r.outcome.ok ? r.outcome.error.message : "Moteur SQL indisponible." });
      }
      if (alive) setLoaded(out);
    })();
    return () => {
      alive = false;
    };
  }, [sqlRunner, stages]);

  const stage = stages[s.i];
  const cur = loaded?.[s.i];
  const prevCount = s.i > 0 ? loaded?.[s.i - 1]?.result?.rowCount : undefined;
  const count = (k: number) => loaded?.[k]?.result?.rowCount;

  return (
    <figure className="tracer" aria-labelledby={`${id}-t`} onKeyDown={s.onKey} style={{ margin: "16px 0" }} data-testid="sql-steps">
      <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
        <figcaption id={`${id}-t`} style={{ fontWeight: 650 }}>
          {title}
        </figcaption>
        <button className="btn sm ghost" aria-pressed={textMode} onClick={() => setTextMode((t) => !t)}>
          {textMode ? "Vue animée" : "Version texte"}
        </button>
      </div>
      {textMode ? (
        <ol style={{ margin: 0, padding: "12px 16px 12px 40px", fontSize: "0.9rem" }}>
          {stages.map((st, k) => (
            <li key={k} style={{ marginBottom: 6 }}>
              <strong>{st.clause}</strong> <code>{st.label}</code> — {st.note} {count(k) !== undefined && <span className="muted">({count(k)} lignes)</span>}
            </li>
          ))}
        </ol>
      ) : (
        <div style={{ padding: "12px 16px" }}>
          <ol className="clause-pipeline" aria-label="Clauses dans l'ordre logique d'exécution">
            {stages.map((st, k) => (
              <li key={k} className={k === s.i ? "current" : k < s.i ? "done" : ""} aria-current={k === s.i ? "step" : undefined}>
                {k === s.i && <span aria-hidden="true">▶ </span>}
                {st.clause}
                {count(k) !== undefined && <span className="small muted"> · {count(k)}</span>}
              </li>
            ))}
          </ol>
          <pre className="codeblock" style={{ margin: "10px 0" }}>
            {stage.label}
          </pre>
          <div className="tracer-note" aria-live="polite" style={{ padding: 0, border: 0 }}>
            <span className="badge" style={{ marginRight: 8 }}>
              Étape {s.i + 1} · {stage.clause}
            </span>
            {stage.note}
            {cur?.result && prevCount !== undefined && (
              <strong>
                {" "}
                ({prevCount} → {cur.result.rowCount} lignes)
              </strong>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            {!loaded ? (
              <p className="small muted">PostgreSQL calcule chaque étape…</p>
            ) : cur?.error ? (
              <p className="small">Étape non calculée : {cur.error}</p>
            ) : cur?.result ? (
              <ResultTable result={{ ...cur.result, rows: cur.result.rows.slice(0, 12) }} caption={`Résultat après ${stage.clause}`} />
            ) : null}
          </div>
        </div>
      )}
      <StepperControls s={s} label="Clause affichée" />
    </figure>
  );
}

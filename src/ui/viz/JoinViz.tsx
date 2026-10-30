import { useId, useMemo, useState } from "react";
import { joinVizData } from "../../content/sql/jointures";
import { joinSteps, type Cell } from "./joinSteps";
import { StepperControls, useStepper } from "./Stepper";

const show = (v: Cell) => (v === null ? "NULL" : String(v));

/**
 * Jointure pas à pas sur deux petites tables : chaque ligne de clients est comparée à chaque ligne de commandes.
 * INNER JOIN ne garde que les paires correspondantes ; LEFT JOIN garde aussi les clients sans commande (NULL à droite).
 * Le résultat final est vérifié contre PostgreSQL dans tests/content/sql.test.ts.
 */
export function JoinViz({ title }: { title: string }) {
  const [kind, setKind] = useState<"inner" | "left">("inner");
  const { clients, commandes } = joinVizData;
  const steps = useMemo(() => joinSteps(clients, commandes, "client_id", "client_id", kind), [clients, commandes, kind]);
  const s = useStepper(steps.length);
  const [textMode, setTextMode] = useState(false);
  const id = useId();
  const step = steps[Math.min(s.i, steps.length - 1)];
  const resultCols = ["c.client_id", "c.nom", "o.commande_id", "o.client_id", "o.montant"];

  return (
    <figure className="tracer" aria-labelledby={`${id}-t`} onKeyDown={s.onKey} style={{ margin: "16px 0" }} data-testid="join-viz">
      <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
        <figcaption id={`${id}-t`} style={{ fontWeight: 650 }}>
          {title}
        </figcaption>
        <div className="row">
          <div role="radiogroup" aria-label="Type de jointure" className="row" style={{ gap: 4 }}>
            {(["inner", "left"] as const).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={kind === k}
                className={`btn sm ${kind === k ? "primary" : ""}`}
                onClick={() => {
                  setKind(k);
                  s.go(0);
                }}
              >
                {k === "inner" ? "INNER JOIN" : "LEFT JOIN"}
              </button>
            ))}
          </div>
          <button className="btn sm ghost" aria-pressed={textMode} onClick={() => setTextMode((t) => !t)}>
            {textMode ? "Vue animée" : "Version texte"}
          </button>
        </div>
      </div>
      <pre className="codeblock" style={{ margin: "12px 16px" }}>
        {`SELECT c.*, o.*\nFROM clients c\n${kind === "inner" ? "INNER JOIN" : "LEFT JOIN"} commandes o ON o.client_id = c.client_id;`}
      </pre>
      {textMode ? (
        <ol style={{ margin: 0, padding: "0 16px 12px 40px", fontSize: "0.9rem" }}>
          {steps.map((st, k) => (
            <li key={k}>{st.note}</li>
          ))}
          <li>
            Résultat final : {steps[steps.length - 1].resultSoFar.length} lignes —{" "}
            {steps[steps.length - 1].resultSoFar.map((r) => `(${r.map(show).join(", ")})`).join(" ; ")}.
          </li>
        </ol>
      ) : (
        <div style={{ padding: "0 16px 12px" }}>
          <div className="join-grid">
            <MiniTable
              caption="clients (c)"
              columns={clients.columns}
              rows={clients.rows}
              current={step.leftIndex}
              marker={() => "▶ en cours"}
            />
            <MiniTable
              caption="commandes (o)"
              columns={commandes.columns}
              rows={commandes.rows}
              current={step.rightIndex}
              marker={() => (step.match ? "✓ correspond" : "✗ ne correspond pas")}
              tone={step.match ? "match" : "nomatch"}
            />
          </div>
          <div className="tracer-note" aria-live="polite" style={{ padding: "8px 0", border: 0 }}>
            <span className="badge" style={{ marginRight: 8 }}>
              Étape {s.i + 1}
            </span>
            {step.note}
          </div>
          <MiniTable
            caption={`Résultat (${step.resultSoFar.length} ligne${step.resultSoFar.length > 1 ? "s" : ""} pour l'instant)`}
            columns={resultCols}
            rows={step.resultSoFar}
            current={step.emitted ? step.resultSoFar.length - 1 : -1}
            marker={() => "+ ajoutée"}
            tone="match"
          />
        </div>
      )}
      <StepperControls s={s} label="Comparaison affichée" />
    </figure>
  );
}

function MiniTable({
  caption,
  columns,
  rows,
  current,
  marker,
  tone,
}: {
  caption: string;
  columns: string[];
  rows: Cell[][];
  current: number;
  marker: () => string;
  tone?: "match" | "nomatch";
}) {
  return (
    <table className="result mini">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
          <th scope="col">
            <span className="sr-only">État</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, k) => (
          <tr key={k} className={k === current ? `current ${tone ?? ""}` : undefined}>
            {r.map((v, j) => (
              <td key={j}>{v === null ? <span className="null-cell">NULL</span> : String(v)}</td>
            ))}
            <td className="small">{k === current ? marker() : ""}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length + 1} className="muted small">
              (vide)
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

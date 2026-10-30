import { useEffect, useId, useRef, useState } from "react";
import type { TraceStep } from "../../content/types";

const SPEEDS = [
  { label: "0,5×", ms: 2400 },
  { label: "1×", ms: 1300 },
  { label: "2×", ms: 650 },
];

const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Trace pas à pas d'un programme : ligne courante, variables, explication textuelle.
 * Contrôles : lecture/pause, étape suivante/précédente, réinitialisation, vitesse, curseur.
 * La version texte liste toutes les étapes (équivalent sans animation).
 */
export function LoopTracer({ title, code, steps }: { title: string; code: string; steps: TraceStep[] }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [textMode, setTextMode] = useState(false);
  const lines = code.split("\n");
  const step = steps[i];
  const prev = i > 0 ? steps[i - 1] : undefined;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setI((x) => Math.min(x + 1, steps.length - 1)), SPEEDS[speed].ms);
    return () => clearTimeout(timer.current);
  }, [playing, i, speed, steps.length]);

  const go = (n: number) => {
    setPlaying(false);
    setI(Math.max(0, Math.min(n, steps.length - 1)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === "ArrowRight") (e.preventDefault(), go(i + 1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), go(i - 1));
    else if (e.key === "Home") (e.preventDefault(), go(0));
    else if (e.key === "End") (e.preventDefault(), go(steps.length - 1));
  };

  const varNames = Array.from(new Set(steps.flatMap((s) => Object.keys(s.vars))));
  const outputSoFar = steps
    .slice(0, i + 1)
    .map((s) => s.output)
    .filter(Boolean);

  return (
    <figure className="tracer" aria-labelledby={`${id}-t`} onKeyDown={onKey} style={{ margin: "16px 0" }}>
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
          {steps.map((s, k) => (
            <li key={k} style={{ marginBottom: 6 }}>
              {s.line > 0 ? (
                <>
                  <strong>Ligne {s.line}</strong> <code>{lines[s.line - 1].trim()}</code> —{" "}
                </>
              ) : null}
              {s.note}{" "}
              {Object.keys(s.vars).length > 0 && (
                <span className="muted">
                  (
                  {Object.entries(s.vars)
                    .map(([k2, v]) => `${k2} = ${v}`)
                    .join(" ; ")}
                  )
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div className="tracer-grid">
            <div className="tracer-code" aria-hidden="true">
              {lines.map((l, k) => {
                const current = step.line === k + 1;
                return (
                  <div key={k} className={`tracer-line${current ? " current" : ""}`}>
                    <span className="ln">{k + 1}</span>
                    <span className="arrow">{current ? "▶" : ""}</span>
                    <span>{l || " "}</span>
                  </div>
                );
              })}
            </div>
            <div className="tracer-vars">
              <table>
                <caption className="sr-only">Variables à l'étape {i + 1}</caption>
                <thead>
                  <tr>
                    <th scope="col">Variable</th>
                    <th scope="col">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {varNames.map((n) => {
                    const v = step.vars[n];
                    const changed = v !== undefined && prev?.vars[n] !== v;
                    return (
                      <tr key={n} className={changed ? "changed" : ""}>
                        <td>{n}</td>
                        <td className="val">
                          {v === undefined ? (
                            <span className="muted">— pas encore créée</span>
                          ) : (
                            <span key={`${n}-${v}`} className={changed && !prefersReducedMotion() ? "var-pop" : ""}>
                              {v}
                            </span>
                          )}
                          {changed && <span className="badge accent" style={{ marginLeft: 8 }}>modifiée</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="tracer-out">
                <div className="eyebrow" style={{ marginBottom: 2 }}>
                  Sortie
                </div>
                <div>{outputSoFar.length ? outputSoFar.join("\n") : <span className="muted">(rien pour l'instant)</span>}</div>
              </div>
            </div>
          </div>
          <div className="tracer-note" aria-live="polite">
            <span className="badge" style={{ marginRight: 8 }}>
              {step.line > 0 ? `Ligne ${step.line}` : "Fin"}
            </span>
            {step.note}
          </div>
        </>
      )}

      <div className="tracer-controls" role="group" aria-label="Contrôles de la visualisation">
        <button className="btn sm" onClick={() => go(0)} aria-label="Revenir au début">
          ⏮
        </button>
        <button className="btn sm" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Étape précédente">
          ◀
        </button>
        <button
          className="btn sm primary"
          onClick={() => {
            if (i >= steps.length - 1) setI(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause" : "Lecture"}
        >
          {playing ? "❚❚ Pause" : "▶ Lecture"}
        </button>
        <button className="btn sm" onClick={() => go(i + 1)} disabled={i === steps.length - 1} aria-label="Étape suivante">
          ▶|
        </button>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          value={i}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Position dans l'exécution"
          aria-valuetext={`Étape ${i + 1} sur ${steps.length}`}
        />
        <span className="small muted" aria-hidden="true">
          {i + 1}/{steps.length}
        </span>
        <label className="small row" style={{ gap: 4 }}>
          Vitesse
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s, k) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </figure>
  );
}

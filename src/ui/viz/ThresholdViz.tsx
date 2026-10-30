import { useId, useState } from "react";
import { churn, churnTestProbas } from "../../content/ml/evaluation";
import { confusionAt, SWEEP } from "./threshold";
import { StepperControls, useStepper } from "./Stepper";

const pct = (x: number) =>
  `${(x * 100).toLocaleString("fr-CH", { maximumFractionDigits: 1 })} %`;

/**
 * Seuil de décision sur les 40 abonnés de test : qui est contacté, matrice de confusion,
 * précision / rappel et coût. Animation = balayage du seuil de 0,95 à 0,05.
 */
export function ThresholdViz({ title }: { title: string }) {
  const s = useStepper(SWEEP.length);
  const [coutFn, setCoutFn] = useState(400);
  const [coutFp, setCoutFp] = useState(30);
  const [textMode, setTextMode] = useState(false);
  const id = useId();
  const seuil = SWEEP[s.i];
  const y = churn.y_test;
  const order = churnTestProbas
    .map((p, i) => ({ p, v: y[i], i }))
    .sort((a, b) => b.p - a.p);
  const c = confusionAt(y, churnTestProbas, seuil, coutFn, coutFp);
  const all = SWEEP.map((t) => ({
    t,
    ...confusionAt(y, churnTestProbas, t, coutFn, coutFp),
  }));
  const best = all.reduce((a, b) =>
    b.cout < a.cout || (b.cout === a.cout && b.t > a.t) ? b : a,
  );

  return (
    <figure
      className="tracer"
      aria-labelledby={`${id}-t`}
      onKeyDown={s.onKey}
      style={{ margin: "16px 0" }}
      data-testid="threshold-viz"
    >
      <div
        className="row"
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--line)",
          justifyContent: "space-between",
        }}
      >
        <figcaption id={`${id}-t`} style={{ fontWeight: 650 }}>
          {title}
        </figcaption>
        <button
          className="btn sm ghost"
          aria-pressed={textMode}
          onClick={() => setTextMode((t) => !t)}
        >
          {textMode ? "Vue animée" : "Version texte"}
        </button>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div className="row" style={{ gap: 16 }}>
          <label
            className="field small"
            style={{ flex: "1 1 180px", maxWidth: 240 }}
          >
            Coût d'un départ raté (CHF)
            <input
              type="number"
              min={0}
              value={coutFn}
              onChange={(e) => setCoutFn(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label
            className="field small"
            style={{ flex: "1 1 180px", maxWidth: 240 }}
          >
            Coût d'une offre (CHF)
            <input
              type="number"
              min={0}
              value={coutFp}
              onChange={(e) => setCoutFp(Math.max(0, Number(e.target.value)))}
            />
          </label>
        </div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Coût total = départs ratés (FN) × coût d'un départ + abonnés contactés
          (VP + FP) × coût d'une offre.
        </p>
        {textMode ? (
          <div className="result-wrap">
            <table className="result">
              <caption>
                Effet du seuil (coût départ {coutFn} CHF, offre {coutFp} CHF)
              </caption>
              <thead>
                <tr>
                  {[
                    "Seuil",
                    "Contactés",
                    "VP",
                    "FP",
                    "FN",
                    "VN",
                    "Précision",
                    "Rappel",
                    "Coût total (CHF)",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.t}>
                    <td>{r.t.toFixed(2)}</td>
                    <td className="num">{r.contactes}</td>
                    <td className="num">{r.vp}</td>
                    <td className="num">{r.fp}</td>
                    <td className="num">{r.fn}</td>
                    <td className="num">{r.vn}</td>
                    <td className="num">{pct(r.precision)}</td>
                    <td className="num">{pct(r.rappel)}</td>
                    <td className="num">
                      {r.cout}
                      {r.t === best.t ? " (minimum)" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <p className="small" style={{ margin: "8px 0" }}>
              Abonnés triés par probabilité de départ. Au-dessus du seuil{" "}
              <strong>{seuil.toFixed(2)}</strong> : contactés. ● = est
              réellement parti, ○ = est resté.
            </p>
            <ol
              className="score-strip"
              aria-label="Abonnés de test triés par probabilité"
            >
              {order.map((o, k) => {
                const above = o.p >= seuil;
                const prevAbove = k > 0 && order[k - 1].p >= seuil;
                const cell = above ? (o.v ? "VP" : "FP") : o.v ? "FN" : "VN";
                return (
                  <li
                    key={o.i}
                    className={`score ${above ? "contacte" : ""} ${cell.toLowerCase()}`}
                    data-cut={
                      !above && (k === 0 || prevAbove) ? "true" : undefined
                    }
                  >
                    <span aria-hidden="true">{o.v ? "●" : "○"}</span>{" "}
                    {o.p.toFixed(3)} <span className="small">{cell}</span>
                  </li>
                );
              })}
            </ol>
            <div className="threshold-grid">
              <table
                className="result mini confusion"
                aria-label="Matrice de confusion"
              >
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Réellement parti</th>
                    <th scope="col">Réellement resté</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Prédit « part »</th>
                    <td>VP {c.vp}</td>
                    <td>FP {c.fp}</td>
                  </tr>
                  <tr>
                    <th scope="row">Prédit « reste »</th>
                    <td>FN {c.fn}</td>
                    <td>VN {c.vn}</td>
                  </tr>
                </tbody>
              </table>
              <dl className="metrics" aria-live="polite">
                <dt>Contactés</dt>
                <dd>{c.contactes}</dd>
                <dt>Précision</dt>
                <dd>{pct(c.precision)}</dd>
                <dt>Rappel</dt>
                <dd>{pct(c.rappel)}</dd>
                <dt>Exactitude</dt>
                <dd>{pct(c.exactitude)}</dd>
                <dt>Coût total</dt>
                <dd>
                  {c.fn} × {coutFn} + {c.contactes} × {coutFp} ={" "}
                  <strong>{c.cout} CHF</strong>
                </dd>
              </dl>
            </div>
            <p className="small muted">
              Seuil le moins coûteux avec ces coûts :{" "}
              <strong>{best.t.toFixed(2)}</strong> ({best.cout} CHF,{" "}
              {best.contactes} appels). Données synthétiques, 40 abonnés : un
              ordre de grandeur, pas une vérité.
            </p>
          </>
        )}
      </div>
      <StepperControls
        s={s}
        label="Seuil"
        valueText={`Seuil ${seuil.toFixed(2)}`}
      />
    </figure>
  );
}

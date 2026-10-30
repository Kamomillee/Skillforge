import { useEffect, useId, useMemo, useState } from "react";
import { activityKindLabel, type ActivityBlock, type Lesson } from "../../content/types";
import { useApp } from "../app-context";
import { Md } from "../Md";
import { blankIsCorrect } from "../../domain/answers";

type Of<T extends ActivityBlock["type"]> = Extract<ActivityBlock, { type: T }>;

/**
 * Enregistre chaque validation d'une activité. Seule la première réussite devient une preuve
 * (avec le numéro de l'essai) : refaire l'activité après avoir vu la correction ne prouve rien de plus.
 */
function useActivityRecord(block: ActivityBlock, lesson: Lesson) {
  const { store, data, refresh } = useApp();
  const past = data.events.filter((e) => e.type === "activity" && e.data?.id === block.id);
  const solved = past.some((e) => e.data?.correct);
  async function record(correct: boolean, detail: Record<string, unknown> = {}) {
    await store.addEvent({
      type: "activity",
      lessonId: lesson.id,
      data: { id: block.id, kind: block.type, label: activityKindLabel[block.type], correct, attempt: past.length + 1, first: correct && !solved, ...detail },
    });
    await refresh();
  }
  return { attempts: past.length, solved, record };
}

function Shell({ block, children, solved, attempts }: { block: ActivityBlock; children: React.ReactNode; solved: boolean; attempts: number }) {
  const id = useId();
  return (
    <section className="activity" aria-labelledby={id} data-testid={`activity-${block.id}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="eyebrow" id={id}>
          {activityKindLabel[block.type]}
        </div>
        <span className="small muted">
          {solved ? "✓ réussie" : attempts ? `${attempts} essai${attempts > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      {children}
    </section>
  );
}

function Feedback({ ok, explanation, wrongText }: { ok: boolean | null; explanation: string; wrongText: string }) {
  if (ok === null) return null;
  return (
    <div className={`callout ${ok ? "success" : "warning"}`} role="status">
      <div className="callout-title">{ok ? "✓ Correct" : `✗ ${wrongText}`}</div>
      {ok && <Md text={explanation} />}
    </div>
  );
}

const shuffle = <T,>(xs: T[], seed: string) => {
  // Mélange déterministe (même ordre à chaque affichage), jamais égal à la réponse si possible.
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Classement : remettre des éléments dans l'ordre, au clavier (boutons Monter / Descendre). */
export function Ordering({ block, lesson }: { block: Of<"ordering">; lesson: Lesson }) {
  const { attempts, solved, record } = useActivityRecord(block, lesson);
  const initial = useMemo(() => {
    const s = shuffle(block.items, block.id);
    return s.map((x) => x.id).join() === block.answer.join() ? [...s].reverse() : s;
  }, [block]);
  const [order, setOrder] = useState(initial.map((x) => x.id));
  const [result, setResult] = useState<boolean[] | null>(null);
  const [announce, setAnnounce] = useState("");
  const label = (id: string) => block.items.find((x) => x.id === id)!.label;

  const move = (k: number, d: -1 | 1) => {
    const j = k + d;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[k], o[j]] = [o[j], o[k]];
    setOrder(o);
    setResult(null);
    setAnnounce(`${label(o[j])} déplacé en position ${j + 1}.`);
  };

  async function check() {
    const r = order.map((id, k) => id === block.answer[k]);
    setResult(r);
    await record(r.every(Boolean), { order });
  }

  const ok = result ? result.every(Boolean) : null;
  return (
    <Shell block={block} solved={solved} attempts={attempts}>
      <Md text={block.prompt} glossary={lesson.glossary} />
      <ol className="ordering">
        {order.map((id, k) => (
          <li key={id} className={result ? (result[k] ? "ok" : "ko") : undefined}>
            <span className="ord-num">{k + 1}</span>
            <span className="ord-label">{label(id)}</span>
            {result && <span className="small">{result[k] ? "✓ bien placé" : "✗ à déplacer"}</span>}
            <span className="row" style={{ gap: 4 }}>
              <button className="btn sm" onClick={() => move(k, -1)} disabled={k === 0} aria-label={`Monter ${label(id)}`}>
                ↑
              </button>
              <button className="btn sm" onClick={() => move(k, 1)} disabled={k === order.length - 1} aria-label={`Descendre ${label(id)}`}>
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <button className="btn primary" onClick={check}>
        Vérifier l'ordre
      </button>
      <Feedback ok={ok} explanation={block.explanation} wrongText={`${result?.filter(Boolean).length ?? 0}/${order.length} bien placés. Réessaie : seuls les éléments marqués « à déplacer » sont faux.`} />
    </Shell>
  );
}

/** Association : relier chaque situation à la bonne réponse (listes déroulantes, accessibles au clavier). */
export function Matching({ block, lesson }: { block: Of<"matching">; lesson: Lesson }) {
  const { attempts, solved, record } = useActivityRecord(block, lesson);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, boolean> | null>(null);
  const complete = block.pairs.every((p) => choice[p.id]);

  async function check() {
    const r = Object.fromEntries(block.pairs.map((p) => [p.id, choice[p.id] === p.answer]));
    setResult(r);
    await record(Object.values(r).every(Boolean), { choice });
  }
  const ok = result ? Object.values(result).every(Boolean) : null;
  return (
    <Shell block={block} solved={solved} attempts={attempts}>
      <Md text={block.prompt} glossary={lesson.glossary} />
      <div className="matching">
        {block.pairs.map((p) => (
          <label key={p.id} className={`match-row${result ? (result[p.id] ? " ok" : " ko") : ""}`}>
            <span>{p.left}</span>
            <select
              value={choice[p.id] ?? ""}
              onChange={(e) => {
                setChoice({ ...choice, [p.id]: e.target.value });
                setResult(null);
              }}
            >
              <option value="">— choisir —</option>
              {block.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {result && <span className="small">{result[p.id] ? "✓" : "✗ à revoir"}</span>}
          </label>
        ))}
      </div>
      <button className="btn primary" onClick={check} disabled={!complete}>
        Vérifier les associations
      </button>
      <Feedback
        ok={ok}
        explanation={block.explanation}
        wrongText={`${result ? Object.values(result).filter(Boolean).length : 0}/${block.pairs.length} associations correctes. Réessaie celles marquées « à revoir ».`}
      />
    </Shell>
  );
}

/** Graphique en barres horizontales, avec valeurs écrites et tableau équivalent. */
export function BarChart({ data, unit, title }: { data: { label: string; value: number }[]; unit?: string; title: string }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const fmt = (v: number) => `${v.toLocaleString("fr-CH", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  return (
    <figure className="bar-chart" style={{ margin: "8px 0" }}>
      <figcaption className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
        {title}
      </figcaption>
      <div aria-hidden="true">
        {data.map((d) => (
          <div key={d.label} className="bar-row">
            <span className="bar-label">{d.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="bar-value">{fmt(d.value)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Interprétation de graphique : les données viennent d'une vraie requête quand `sql` est fourni. */
export function ChartQuestion({ block, lesson }: { block: Of<"chart-question">; lesson: Lesson }) {
  const { sqlRunner } = useApp();
  const { attempts, solved, record } = useActivityRecord(block, lesson);
  const [data, setData] = useState(block.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!block.sql) return;
    let alive = true;
    sqlRunner.query(block.sql, 8000, 50).then((r) => {
      if (!alive) return;
      if (r.outcome?.ok) setData(r.outcome.result.rows.map((row) => ({ label: String(row[0]), value: Number(row[1]) })));
      else setError("Données indisponibles pour le moment (moteur SQL).");
    });
    return () => {
      alive = false;
    };
  }, [block.sql, sqlRunner]);

  async function check() {
    if (!choice) return;
    const good = choice === block.answer;
    setOk(good);
    await record(good, { choice });
  }

  return (
    <Shell block={block} solved={solved} attempts={attempts}>
      {data ? <BarChart data={data} unit={block.unit} title={block.title} /> : <p className="small muted">{error ?? "Calcul des données par PostgreSQL…"}</p>}
      {block.sql && (
        <details className="small">
          <summary>Requête qui produit ce graphique</summary>
          <pre tabIndex={0} className="codeblock">{block.sql}</pre>
        </details>
      )}
      <p style={{ fontWeight: 600 }}>{block.question}</p>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">{block.question}</legend>
        <div className="choices">
          {block.choices.map((c) => (
            <label key={c.id} className="choice">
              <input
                type="radio"
                name={block.id}
                checked={choice === c.id}
                onChange={() => {
                  setChoice(c.id);
                  setOk(null);
                }}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn primary" onClick={check} disabled={!choice}>
        Vérifier
      </button>
      <Feedback ok={ok} explanation={block.explanation} wrongText="Pas tout à fait. Relis le graphique : que mesure exactement l'axe des valeurs ?" />
    </Shell>
  );
}


/** Code à compléter sans exécution : chaque trou accepte plusieurs écritures équivalentes. */
export function FillCode({ block, lesson }: { block: Of<"fill-code">; lesson: Lesson }) {
  const { attempts, solved, record } = useActivityRecord(block, lesson);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, boolean> | null>(null);
  const parts = block.template.split(/(\{\{\w+\}\})/);

  async function check() {
    const r = Object.fromEntries(block.blanks.map((b) => [b.id, blankIsCorrect(b.accept, values[b.id] ?? "")]));
    setResult(r);
    await record(Object.values(r).every(Boolean), { values });
  }
  const ok = result ? Object.values(result).every(Boolean) : null;
  return (
    <Shell block={block} solved={solved} attempts={attempts}>
      <Md text={block.prompt} glossary={lesson.glossary} />
      <pre tabIndex={0} className="codeblock fill-code">
        {parts.map((part, k) => {
          const m = /^\{\{(\w+)\}\}$/.exec(part);
          if (!m) return <span key={k}>{part}</span>;
          const b = block.blanks.find((x) => x.id === m[1])!;
          const state = result ? (result[b.id] ? "ok" : "ko") : "";
          return (
            <input
              key={k}
              className={`blank ${state}`}
              aria-label={`Trou ${b.id} : ${b.hint}`}
              value={values[b.id] ?? ""}
              size={Math.max(6, (values[b.id] ?? "").length + 1)}
              onChange={(e) => {
                setValues({ ...values, [b.id]: e.target.value });
                setResult(null);
              }}
              spellCheck={false}
              autoCapitalize="off"
            />
          );
        })}
      </pre>
      {result && !ok && (
        <ul className="small">
          {block.blanks
            .filter((b) => !result[b.id])
            .map((b) => (
              <li key={b.id}>
                ✗ Trou {b.id} : {b.hint}
              </li>
            ))}
        </ul>
      )}
      <button className="btn primary" onClick={check} disabled={block.blanks.some((b) => !(values[b.id] ?? "").trim())}>
        Vérifier
      </button>
      <Feedback ok={ok} explanation={block.explanation} wrongText="Certains trous sont à revoir (indice ci-dessus)." />
    </Shell>
  );
}

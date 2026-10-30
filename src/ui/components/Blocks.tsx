import { useEffect, useState } from "react";
import type { Lesson, LessonBlock } from "../../content/types";
import { useApp } from "../app-context";
import { Md } from "../Md";
import { LoopTracer } from "../viz/LoopTracer";
import { explainError, type PyErrorInfo } from "../../grading/errors";
import type { QueryOutcome } from "../../runtime/sql/engine";
import { ResultTable, SqlErrorCard } from "./SqlParts";
import { SqlSteps } from "../viz/SqlSteps";
import { JoinViz } from "../viz/JoinViz";
import { ThresholdViz } from "../viz/ThresholdViz";
import { RagViz } from "../viz/RagViz";
import { projectById } from "../../content";
import { ChartQuestion, FillCode, Matching, Ordering } from "./Activities";

type PredictionBlock = Extract<LessonBlock, { type: "prediction" }>;
type ExplainBlockT = Extract<LessonBlock, { type: "explain" }>;

export function Prediction({ block, lesson }: { block: PredictionBlock; lesson: Lesson }) {
  const { store, data, refresh } = useApp();
  const previous = data.events.find((e) => e.type === "prediction" && e.data?.id === block.id);
  const [choice, setChoice] = useState<string | null>((previous?.data?.choice as string) ?? null);
  const [revealed, setRevealed] = useState(!!previous);
  const correct = choice === block.answer;

  async function validate() {
    if (!choice) return;
    setRevealed(true);
    // Seule la première réponse est enregistrée comme preuve.
    if (!previous) {
      await store.addEvent({ type: "prediction", lessonId: lesson.id, data: { id: block.id, choice, correct: choice === block.answer } });
      await refresh();
    }
  }

  return (
    <div className="prediction">
      <div className="eyebrow">Prédiction</div>
      <h3 style={{ marginBottom: 8 }}>{block.question}</h3>
      {block.code && <pre className="codeblock">{block.code}</pre>}
      <fieldset style={{ margin: 0 }} disabled={revealed}>
        <legend className="sr-only">{block.question}</legend>
        <div className="choices">
          {block.choices.map((c) => (
            <label key={c.id} className="choice">
              <input type="radio" name={block.id} value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} />
              <span style={{ fontFamily: "var(--font-mono)" }}>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {!revealed ? (
        <button className="btn primary" onClick={validate} disabled={!choice}>
          Valider ma prédiction
        </button>
      ) : (
        <div className={`callout ${correct ? "success" : "warning"}`} role="status">
          <div className="callout-title">
            {correct ? "✓ Bonne prédiction" : `✗ Pas tout à fait — la bonne réponse est ${block.choices.find((c) => c.id === block.answer)?.label}`}
          </div>
          <p>{block.explanation}</p>
          {previous && <p className="small muted">Ta première réponse est enregistrée.</p>}
        </div>
      )}
    </div>
  );
}

export function ExplainBlock({ block, lesson }: { block: ExplainBlockT; lesson: Lesson }) {
  const { store, refresh, toast } = useApp();
  const key = `explain:${block.id}`;
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<boolean[]>(block.criteria.map(() => false));
  useEffect(() => {
    store.get<{ text: string; checked: boolean[] }>(key).then((v) => {
      if (v) {
        setText(v.text);
        setChecked(v.checked);
      }
    });
  }, [store, key]);

  async function save() {
    await store.set(key, { text, checked });
    await store.addEvent({ type: "explain", lessonId: lesson.id, data: { id: block.id, checked: checked.filter(Boolean).length, length: text.length } });
    await refresh();
    toast("Explication enregistrée.");
  }

  return (
    <div className="prediction">
      <div className="eyebrow">Explique avec tes mots</div>
      <label className="field">
        {block.prompt}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />
      </label>
      <fieldset style={{ margin: "12px 0" }}>
        <legend className="small">Auto-évaluation : coche ce que ton explication contient vraiment.</legend>
        {block.criteria.map((c, i) => (
          <label key={i} className="row small" style={{ alignItems: "flex-start", marginBottom: 4 }}>
            <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((arr) => arr.map((x, k) => (k === i ? e.target.checked : x)))} />
            {c}
          </label>
        ))}
      </fieldset>
      <button className="btn" onClick={save} disabled={text.trim().length < 20}>
        Enregistrer mon explication
      </button>
      <p className="small muted" style={{ marginTop: 8 }}>
        C'est une auto-évaluation : elle apparaît dans tes preuves comme « non vérifiée ». Le tuteur IA pourra la commenter dans une prochaine étape.
      </p>
    </div>
  );
}

export function RunnableCode({ code, packages = [], prelude }: { code: string; packages?: string[]; prelude?: string }) {
  const { runner, runnerState } = useApp();
  const [out, setOut] = useState<{ text: string; error: PyErrorInfo | null; status: string } | null>(null);
  const busy = runnerState.kind === "busy" || runner.isBusy;
  async function run() {
    setOut({ text: "", error: null, status: "running" });
    // Le prélude tient sur une ligne : les numéros de ligne des erreurs sont décalés de 1, corrigés ci-dessous.
    const r = await runner.run(prelude ? `${prelude}\n${code}` : code, { timeoutMs: 10_000, packages, onStdout: (t) => setOut((o) => (o ? { ...o, text: o.text + t + "\n" } : o)) });
    const error = r.error && prelude && r.error.line ? { ...r.error, line: r.error.line - 1 } : r.error;
    setOut({ text: r.output, error, status: r.status });
  }
  return (
    <div style={{ margin: "12px 0" }}>
      <pre className="codeblock" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        {code}
      </pre>
      <div className="row" style={{ border: "1px solid var(--line)", borderTop: 0, padding: "6px 10px", borderRadius: "0 0 6px 6px", background: "var(--surface-2)" }}>
        <button className="btn sm primary" onClick={run} disabled={busy}>
          ▶ Exécuter l'exemple
        </button>
        <span className="small muted">
          Exécution réelle dans ton navigateur (Pyodide){packages.length ? ` · charge ${packages.join(", ")} au premier lancement` : ""}.
        </span>
      </div>
      {out && (
        <div className="console" style={{ marginTop: 8 }} aria-live="polite" data-testid="demo-output">
          {out.status === "running" ? out.text || (runnerState.kind === "busy" ? runnerState.message : "Exécution…") : out.text || "(aucune sortie)"}
          {out.status === "timeout" && "\nArrêté : limite de temps dépassée."}
          {out.error && `\n${explainError(out.error).title} : ${out.error.summary}`}
        </div>
      )}
    </div>
  );
}

/** Exemple SQL exécutable sur la base de formation (lecture seule, transaction annulée). */
export function RunnableSql({ code }: { code: string }) {
  const { sqlRunner } = useApp();
  const [out, setOut] = useState<{ status: string; outcome?: QueryOutcome } | null>(null);
  async function run() {
    setOut({ status: "running" });
    const r = await sqlRunner.query(code, 8000, 100);
    setOut({ status: r.status, outcome: r.outcome });
  }
  return (
    <div style={{ margin: "12px 0" }}>
      <pre className="codeblock" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        {code}
      </pre>
      <div className="row" style={{ border: "1px solid var(--line)", borderTop: 0, padding: "6px 10px", borderRadius: "0 0 6px 6px", background: "var(--surface-2)" }}>
        <button className="btn sm primary" onClick={run} disabled={out?.status === "running"}>
          ▶ Exécuter la requête
        </button>
        <span className="small muted">Exécution réelle par PostgreSQL dans ton navigateur.</span>
      </div>
      {out && (
        <div style={{ marginTop: 8 }} aria-live="polite" data-testid="demo-output">
          {out.status === "running" ? (
            <p className="small muted">Exécution…</p>
          ) : out.outcome?.ok ? (
            <ResultTable result={out.outcome.result} />
          ) : out.outcome ? (
            <SqlErrorCard err={out.outcome.error} sql={code} />
          ) : (
            <p className="small">Requête interrompue ({out.status}).</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LessonBlockView({ block, lesson, onOpenExercise }: { block: LessonBlock; lesson: Lesson; onOpenExercise: (id: string) => void }) {
  switch (block.type) {
    case "text":
      return <Md text={block.md} glossary={lesson.glossary} />;
    case "callout":
      return (
        <div className={`callout ${block.tone}`}>
          <div className="callout-title">{block.title}</div>
          <Md text={block.md} glossary={lesson.glossary} />
        </div>
      );
    case "code":
      return block.runnable ? (
        block.language === "sql" ? (
          <RunnableSql code={block.code} />
        ) : (
          <RunnableCode code={block.code} packages={block.packages} prelude={block.prelude} />
        )
      ) : (
        <>
          <pre className="codeblock">{block.code}</pre>
          {block.caption && <p className="caption">{block.caption}</p>}
        </>
      );
    case "trace":
      return <LoopTracer title={block.title} code={block.code} steps={block.steps} />;
    case "sql-steps":
      return <SqlSteps title={block.title} stages={block.stages} />;
    case "join-viz":
      return <JoinViz title={block.title} />;
    case "threshold-viz":
      return <ThresholdViz title={block.title} />;
    case "rag-viz":
      return <RagViz title={block.title} />;
    case "ordering":
      return <Ordering block={block} lesson={lesson} />;
    case "matching":
      return <Matching block={block} lesson={lesson} />;
    case "chart-question":
      return <ChartQuestion block={block} lesson={lesson} />;
    case "fill-code":
      return <FillCode block={block} lesson={lesson} />;
    case "prediction":
      return <Prediction block={block} lesson={lesson} />;
    case "explain":
      return <ExplainBlock block={block} lesson={lesson} />;
    case "exercise":
      return <ExerciseStub id={block.exerciseId} onOpen={onOpenExercise} />;
    case "project": {
      const project = block.projectId ? projectById.get(block.projectId) : undefined;
      return (
        <div className="panel" style={{ borderStyle: project ? "solid" : "dashed" }}>
          <div className="eyebrow">{project ? "Projet · disponible" : "Projet · prévu"}</div>
          <h3>{block.title}</h3>
          <Md text={block.md} glossary={lesson.glossary} />
          {project && (
            <a className="btn sm" href={`#/projet/${project.id}`}>
              Ouvrir le projet
            </a>
          )}
        </div>
      );
    }
  }
}

function ExerciseStub({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { data } = useApp();
  const solved = data.attempts.some((a) => a.exerciseId === id && a.status === "passed");
  return (
    <div className="callout" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span>
        L'énoncé, l'éditeur et les tests sont dans l'<strong>atelier</strong>. {solved && <span className="badge success">✓ Réussi</span>}
      </span>
      <button className="btn sm" onClick={() => onOpen(id)}>
        Ouvrir dans l'atelier
      </button>
    </div>
  );
}

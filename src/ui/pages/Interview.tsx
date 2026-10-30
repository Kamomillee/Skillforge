import { useEffect, useRef, useState } from "react";
import { formatLabels, interviewProfiles, questionById, type InterviewProfile } from "../../content/entretien";
import { sessionFeedback, sessionMarkdown, sessionSummary, type CodeGrade, type InterviewSession } from "../../domain/interview";
import { useApp } from "../app-context";
import { CodeEditor } from "../components/CodeEditor";
import { ResultTable } from "../components/SqlParts";
import { Md } from "../Md";
import { navigate, type Route } from "../router";

const CURRENT = "entretien:en-cours";
const SESSIONS = "entretien:sessions";

type Running = InterviewSession & { index: number };

export function Interview({ route }: { route: Route }) {
  if (route.params[0] === "session") return <SessionView />;
  if (route.params[0] === "bilan" && route.params[1]) return <Debrief id={route.params[1]} />;
  return <Home />;
}

function Home() {
  const { store } = useApp();
  const [current, setCurrent] = useState<Running | null | undefined>(undefined);
  const [past, setPast] = useState<InterviewSession[]>([]);
  useEffect(() => {
    store.get<Running>(CURRENT).then((c) => setCurrent(c ?? null));
    store.get<InterviewSession[]>(SESSIONS).then((s) => setPast(s ?? []));
  }, [store]);

  async function start(profile: InterviewProfile) {
    const p = interviewProfiles.find((x) => x.id === profile)!;
    const s: Running = {
      id: Date.now().toString(36),
      profile,
      startedAt: new Date().toISOString(),
      index: 0,
      answers: p.questions.map((questionId) => {
        const q = questionById.get(questionId)!;
        return { questionId, text: q.kind === "code" ? q.exercise.starterCode : "", runs: 0, ms: 0 };
      }),
    };
    await store.set(CURRENT, s);
    navigate("#/entretien/session");
  }

  return (
    <div className="page">
      <div className="eyebrow">Préparation</div>
      <h1>Mode entretien</h1>
      <p>
        Une session dure une vingtaine de minutes : quatre questions adaptées au stage visé, <strong>sans indice ni tuteur</strong>. Les questions de code s'exécutent mais ne sont
        corrigées qu'à la fin. La correction distingue exactitude, raisonnement, communication, autonomie observée et limites reconnues, en citant tes réponses ; elle ne donne
        pas de note.
      </p>
      {current && (
        <div className="banner" role="status">
          Une session est en cours ({interviewProfiles.find((p) => p.id === current.profile)?.label}, question {current.index + 1}/{current.answers.length}).
          <a className="btn sm primary" href="#/entretien/session">
            Reprendre
          </a>
        </div>
      )}
      <div className="card-grid" style={{ marginTop: 16 }}>
        {interviewProfiles.map((p) => (
          <div key={p.id} className="panel" style={{ padding: 16 }}>
            <strong>{p.label}</strong>
            <p className="small muted">{p.description}</p>
            <ul className="small">
              {p.questions.map((id) => (
                <li key={id}>{formatLabels[questionById.get(id)!.format]}</li>
              ))}
            </ul>
            <button className="btn primary" onClick={() => start(p.id)} disabled={!!current}>
              Commencer (sans indices)
            </button>
          </div>
        ))}
      </div>
      {past.length > 0 && (
        <>
          <h2>Sessions passées</h2>
          <ul className="list-plain" data-testid="entretien-historique">
            {[...past].reverse().map((s) => (
              <li key={s.id}>
                <a href={`#/entretien/bilan/${s.id}`}>
                  {interviewProfiles.find((p) => p.id === s.profile)?.label} — {new Date(s.startedAt).toLocaleString("fr-CH")}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SessionView() {
  const { store, runner, sqlRunner, toast } = useApp();
  const [s, setS] = useState<Running | null | undefined>(undefined);
  const [out, setOut] = useState<string | { columns: string[]; rows: unknown[][]; rowCount: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [grading, setGrading] = useState(false);
  const since = useRef(Date.now());
  const save = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => void store.get<Running>(CURRENT).then((c) => setS(c ?? null)), [store]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (s === undefined) return null;
  if (s === null)
    return (
      <div className="page">
        <h1>Aucune session en cours</h1>
        <a href="#/entretien">Choisir un profil</a>
      </div>
    );

  const q = questionById.get(s.answers[s.index].questionId)!;
  const a = s.answers[s.index];
  const profile = interviewProfiles.find((p) => p.id === s.profile)!;

  /** Ajoute le temps passé sur la question affichée, puis enregistre (la session survit à un rechargement). */
  function withTime(next: Running): Running {
    const ms = Date.now() - since.current;
    since.current = Date.now();
    return { ...next, answers: next.answers.map((x, k) => (k === s!.index ? { ...x, ms: x.ms + ms } : x)) };
  }
  function update(patch: Partial<InterviewSession["answers"][number]>) {
    const next = { ...s!, answers: s!.answers.map((x, k) => (k === s!.index ? { ...x, ...patch } : x)) };
    setS(next);
    if (save.current) clearTimeout(save.current);
    save.current = setTimeout(() => void store.set(CURRENT, next), 400);
  }
  async function go(index: number) {
    const next = withTime({ ...s!, index });
    setS(next);
    setOut(null);
    await store.set(CURRENT, next);
  }
  async function run() {
    if (q.kind !== "code") return;
    update({ runs: a.runs + 1 });
    setOut("Exécution…");
    if (q.exercise.language === "sql") {
      const r = await sqlRunner.query(a.text, 8000, 50);
      if (r.outcome?.ok) setOut(r.outcome.result);
      else setOut(r.outcome && !r.outcome.ok ? `Erreur PostgreSQL : ${r.outcome.error.message}` : `Exécution interrompue (${r.status}).`);
    } else {
      const r = await runner.run(`${a.text}\n\nprint(${q.exercise.functionName}(${JSON.stringify(q.exercise.tests[0].args[0])}))`, { timeoutMs: 5000 });
      setOut(r.error ? `${r.output}\n${r.error.type} : ${r.error.summary}` : r.output || "(aucune sortie)");
    }
  }
  async function finish() {
    setGrading(true);
    const done = withTime(s!);
    const grades: Record<string, CodeGrade> = {};
    for (const ans of done.answers) {
      const qq = questionById.get(ans.questionId)!;
      if (qq.kind !== "code") continue;
      const r = qq.exercise.language === "sql" ? await sqlRunner.grade(qq.exercise, ans.text) : await runner.grade(qq.exercise, ans.text);
      grades[ans.questionId] = { status: r.status, passed: r.passedCount, total: r.total, hiddenPassed: r.hiddenPassed, hiddenTotal: r.hiddenTotal, misconceptions: r.misconceptions };
    }
    const { index: _index, ...rest } = done;
    void _index;
    const finished: InterviewSession = { ...rest, finishedAt: new Date().toISOString(), grades };
    const past = (await store.get<InterviewSession[]>(SESSIONS)) ?? [];
    await store.set(SESSIONS, [...past, finished]);
    await store.set(CURRENT, undefined);
    await store.addEvent({ type: "interview", data: { profile: s!.profile, id: s!.id } });
    toast("Session terminée : voici la correction.");
    navigate(`#/entretien/bilan/${finished.id}`);
  }
  async function abandon() {
    await store.set(CURRENT, undefined);
    navigate("#/entretien");
  }

  const elapsed = Math.floor((a.ms + now - since.current) / 1000);
  return (
    <div className="page interview">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="eyebrow">
          {profile.label} · question {s.index + 1}/{s.answers.length} · sans indices
        </div>
        <span className="small muted" aria-live="off">
          ⏱ {Math.floor(elapsed / 60)} min {String(elapsed % 60).padStart(2, "0")} s
        </span>
      </div>
      <span className="badge">{formatLabels[q.format]}</span>
      <h1 style={{ fontSize: "1.3rem" }} data-testid="entretien-question">
        {q.question}
      </h1>
      {q.kind === "texte" ? (
        <label className="field">
          Ta réponse (écris comme tu parlerais, {q.mots[0]} à {q.mots[1]} mots)
          <textarea rows={10} value={a.text} onChange={(e) => update({ text: e.target.value })} data-testid="entretien-reponse" />
        </label>
      ) : (
        <div className="interview-editor">
          <CodeEditor value={a.text} onChange={(v) => update({ text: v })} onRun={run} label={`Éditeur ${q.exercise.language === "sql" ? "SQL" : "Python"}`} language={q.exercise.language} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={run}>
              ▶ Exécuter
            </button>
            <span className="small muted">
              {q.exercise.language === "sql" ? "Exécute ta requête sur la base." : `Exécute ta fonction sur l'exemple ${JSON.stringify(q.exercise.tests[0].args[0])}.`} Les tests ne sont lancés qu'à la fin de la session.
            </span>
          </div>
          {out &&
            (typeof out === "string" ? (
              <pre className="console" data-testid="entretien-sortie">
                {out}
              </pre>
            ) : (
              <ResultTable result={out as never} />
            ))}
        </div>
      )}
      <div className="section-pager">
        {s.index > 0 ? (
          <button className="btn" onClick={() => go(s.index - 1)}>
            ← Question précédente
          </button>
        ) : (
          <button className="btn ghost" onClick={abandon}>
            Abandonner la session
          </button>
        )}
        {s.index < s.answers.length - 1 ? (
          <button className="btn primary" onClick={() => go(s.index + 1)}>
            Question suivante →
          </button>
        ) : (
          <button className="btn primary" onClick={finish} disabled={grading}>
            {grading ? "Correction en cours…" : "Terminer et voir la correction"}
          </button>
        )}
      </div>
    </div>
  );
}

function Debrief({ id }: { id: string }) {
  const { store } = useApp();
  const [s, setS] = useState<InterviewSession | null | undefined>(undefined);
  useEffect(() => void store.get<InterviewSession[]>(SESSIONS).then((all) => setS(all?.find((x) => x.id === id) ?? null)), [store, id]);
  if (s === undefined) return null;
  if (s === null)
    return (
      <div className="page">
        <h1>Session introuvable</h1>
        <a href="#/entretien">Retour</a>
      </div>
    );
  const label = interviewProfiles.find((p) => p.id === s.profile)!.label;
  const sum = sessionSummary(s);
  function exportMd() {
    const blob = new Blob([sessionMarkdown(s!, label)], { type: "text/markdown;charset=utf-8" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `entretien-${s!.profile}-${s!.startedAt.slice(0, 10)}.md`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(el.href), 1000);
  }
  return (
    <div className="page">
      <div className="eyebrow">Correction après la session</div>
      <h1>{label}</h1>
      <p className="small muted">
        Session du {new Date(s.startedAt).toLocaleString("fr-CH")}. Le code a été <strong>testé</strong> ; l'écrit est relu par des <strong>repères textuels approximatifs</strong>{" "}
        (mots ou expressions attendus) : un ✗ veut dire « non repéré », pas forcément « absent ». Aucune note globale.
      </p>
      <section className="panel" style={{ padding: 16 }} aria-labelledby="synthese" data-testid="entretien-synthese">
        <h2 id="synthese" style={{ marginTop: 0 }}>
          Synthèse
        </h2>
        <dl className="criteria">
          <dt>Exactitude</dt>
          <dd>{sum.exactitude}</dd>
          <dt>Raisonnement</dt>
          <dd>{sum.raisonnement}</dd>
          <dt>Communication</dt>
          <dd>{sum.communication}</dd>
          <dt>Autonomie observée</dt>
          <dd>{sum.autonomie}</dd>
          <dt>Limites reconnues</dt>
          <dd>{sum.limites}</dd>
        </dl>
        <button className="btn sm" onClick={exportMd}>
          Exporter en Markdown
        </button>
      </section>
      {sessionFeedback(s).map((f, k) => (
        <section key={f.question.id} className="panel interview-fb" style={{ padding: 16, marginTop: 16 }} data-testid={`fb-${f.question.id}`}>
          <div className="eyebrow">
            {k + 1}. {formatLabels[f.question.format]}
          </div>
          <h2 style={{ fontSize: "1.05rem" }}>{f.question.question}</h2>
          <details>
            <summary className="small">Ta réponse</summary>
            {f.question.kind === "code" ? <pre className="codeblock">{f.answer.text}</pre> : <p style={{ whiteSpace: "pre-wrap" }}>{f.answer.text || "(pas de réponse)"}</p>}
          </details>
          <p>
            <strong>Exactitude.</strong> {f.exactitude}
          </p>
          <div>
            <strong>Raisonnement.</strong>
            <ul className="list-plain">
              {f.raisonnement.map((r) => (
                <li key={r.attendu.id} className="small">
                  <span aria-hidden="true">{r.trouve ? "✓" : "✗"}</span> <span className="sr-only">{r.trouve ? "Repéré :" : "Non repéré :"}</span>
                  {r.attendu.label}
                  {r.citation && <span className="muted"> — « {r.citation} »</span>}
                </li>
              ))}
            </ul>
          </div>
          {f.communication.length > 0 && (
            <p className="small">
              <strong>Communication.</strong> {f.communication.join(" ")}
            </p>
          )}
          <p className="small">
            <strong>Autonomie observée.</strong> {f.autonomie.join(" ")}
          </p>
          <p className="small">
            <strong>Limites reconnues.</strong> {f.limites}
          </p>
          <details>
            <summary className="small">Réponse modèle</summary>
            {f.question.kind === "code" ? <pre className="codeblock">{f.question.reponseModele}</pre> : <Md text={f.question.reponseModele} />}
          </details>
        </section>
      ))}
      <p style={{ marginTop: 16 }}>
        <a href="#/entretien">Nouvelle session</a>
      </p>
    </div>
  );
}

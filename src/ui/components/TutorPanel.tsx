import { useEffect, useState } from "react";
import type { Exercise, Lesson } from "../../content/types";
import type { GradeReport } from "../../grading/evaluate";
import { contextSummary, localTutor, tutorModes, tutorPayload, type RunError, type TutorContext, type TutorMode, type TutorReply } from "../../domain/tutor";
import type { Attempt } from "../../storage/store";
import { useApp } from "../app-context";
import { Md } from "../Md";
import { api, sante, useCompte } from "../../services/serveur";

/** Disponibilité du tuteur IA : le serveur SkillForge répond sur /api/sante avec une clé configurée côté serveur. */
type AiStatus = { available: false; reason: string } | { available: true; model: string };
export function checkAi(): Promise<AiStatus> {
  return sante().then((s) =>
    !s ? { available: false as const, reason: "serveur SkillForge absent (version statique)" } : s.tuteurIA ? { available: true as const, model: s.modele ?? "" } : { available: false as const, reason: "aucune clé API configurée sur le serveur" },
  );
}

type Shown = { source: "local"; reply: TutorReply } | { source: "ia"; mode: TutorMode; text: string; model: string } | { source: "ia-erreur"; mode: TutorMode; message: string; fallback: TutorReply };

export function TutorPanel(props: {
  exercise: Exercise;
  lesson?: Lesson;
  code: string;
  report?: GradeReport;
  runError?: RunError;
  attempts: Attempt[];
  hintLevel: number;
  onHint: () => void;
  onReport: (text: string) => void;
  onEvidence: () => void;
}) {
  const { data, store } = useApp();
  const [shown, setShown] = useState<Shown | null>(null);
  const [turn, setTurn] = useState(0);
  const [answer, setAnswer] = useState(false);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState<TutorMode | null>(null);
  const compte = useCompte();
  const connected = compte.kind === "connecte";

  useEffect(() => void checkAi().then(setAi), []);
  useEffect(() => setShown(null), [props.exercise.id]);

  const ctx: TutorContext = {
    exercise: props.exercise,
    lesson: props.lesson,
    code: props.code,
    report: props.report,
    runError: props.runError,
    attempts: props.attempts,
    allAttempts: data.attempts,
    hintLevel: props.hintLevel,
    turn,
  };

  async function ask(mode: TutorMode) {
    setAnswer(false);
    setTurn((t) => t + 1);
    // « Donne un indice » suit l'aide progressive : il débloque le niveau suivant (jusqu'au 3). Le niveau 4 se demande dans « Aide progressive ».
    if (mode === "indice" && props.hintLevel < 3) props.onHint();
    void store.addEvent({ type: "tutor", exerciseId: props.exercise.id, lessonId: props.lesson?.id, data: { mode, source: useAi && ai?.available && connected ? "ia" : "local" } });
    const local = localTutor(mode, ctx);
    if (!(useAi && ai?.available && connected) || mode === "indice") return setShown({ source: "local", reply: local });
    setLoading(mode);
    const r = await api<{ texte: string; modele: string }>("POST", "/api/tuteur", tutorPayload(mode, ctx, question.trim() || undefined));
    setLoading(null);
    if (!r.ok || !r.data.texte) setShown({ source: "ia-erreur", mode, message: r.ok ? "réponse vide" : r.erreur, fallback: local });
    else setShown({ source: "ia", mode, text: r.data.texte, model: r.data.modele ?? (ai.available ? ai.model : "") });
  }

  const reply = shown?.source === "local" ? shown.reply : shown?.source === "ia-erreur" ? shown.fallback : undefined;
  const activeMode = shown ? (shown.source === "local" ? shown.reply.mode : shown.mode) : null;

  return (
    <section className="tutor" aria-labelledby="tutor-title" data-testid="tutor">
      <h3 id="tutor-title" style={{ margin: 0, fontSize: "1rem" }}>
        Tuteur
      </h3>
      <details className="small" style={{ marginTop: 4 }}>
        <summary>Ce que le tuteur sait</summary>
        <ul className="tutor-basis" data-testid="tutor-context">
          {contextSummary(ctx).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <div className="tutor-modes" role="group" aria-label="Que veux-tu ?">
        {tutorModes.map((m) => (
          <button key={m.id} className="btn sm" aria-pressed={activeMode === m.id} onClick={() => ask(m.id)} disabled={!!loading}>
            {loading === m.id ? "…" : m.label}
          </button>
        ))}
      </div>

      {ai?.available && !connected ? (
        <p className="small muted" style={{ margin: 0 }} data-testid="tutor-ia-compte">
          Tuteur local. Le tuteur IA est disponible sur ce serveur pour les comptes connectés (budget quotidien par compte) : <a href="#/parametres">se connecter</a>.
        </p>
      ) : ai?.available ? (
        <div className="small">
          <label className="tutor-ai-toggle">
            <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
            Utiliser le tuteur IA (Claude) — il peut se tromper ; « Donne un indice » reste l'aide progressive vérifiée.
          </label>
          {useAi && (
            <label className="field" style={{ marginTop: 6 }}>
              Ta question (facultative)
              <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="Ex. : pourquoi mon total est-il négatif ?" />
            </label>
          )}
        </div>
      ) : ai ? (
        <p className="small muted" style={{ margin: 0 }}>
          Tuteur local : il assemble des explications rédigées et tes résultats réels, sans IA générative ({ai.reason}).
        </p>
      ) : null}

      {shown?.source === "ia" && (
        <div className="tutor-reply ai" data-testid="tutor-reply" aria-live="polite">
          <div className="tutor-source">Avis du tuteur IA · non vérifié, peut se tromper</div>
          <Md text={shown.text} />
          <p className="small muted" style={{ marginBottom: 0 }}>
            {shown.model} · Seuls les tests disent si ton code est juste.
          </p>
        </div>
      )}
      {shown?.source === "ia-erreur" && (
        <p className="small" role="status">
          Le tuteur IA n'a pas pu répondre ({shown.message}). Voici la réponse du tuteur local.
        </p>
      )}
      {reply && <LocalReply reply={reply} answer={answer} onAnswer={() => setAnswer(true)} />}

      {shown && (
        <div className="row small" style={{ marginTop: 8 }}>
          <button className="btn sm ghost" onClick={props.onEvidence}>
            Voir les preuves d'exécution
          </button>
          <button
            className="btn sm ghost"
            onClick={() => props.onReport(`Réponse du tuteur (${shown.source === "ia" ? "IA" : "local"}, mode « ${tutorModes.find((m) => m.id === activeMode)?.label} ») qui me semble fausse : `)}
          >
            Signaler une erreur du tuteur
          </button>
        </div>
      )}
    </section>
  );
}

function LocalReply({ reply, answer, onAnswer }: { reply: TutorReply; answer: boolean; onAnswer: () => void }) {
  return (
    <div className="tutor-reply" data-testid="tutor-reply" aria-live="polite">
      <div className="tutor-source">Avis du tuteur local · non testé</div>
      <strong>{reply.title}</strong>
      <Md text={reply.md} />
      {reply.code?.map((c, k) => (
        <figure key={k} style={{ margin: "8px 0" }}>
          {c.caption && <figcaption className="small muted">{c.caption}</figcaption>}
          <pre tabIndex={0} className="codeblock">{c.text}</pre>
        </figure>
      ))}
      {reply.quiz && (
        <div className="hint-box">
          <p style={{ fontWeight: 600, marginTop: 0 }}>{reply.quiz.question}</p>
          {answer ? (
            <Md text={reply.quiz.reponse} />
          ) : (
            <button className="btn sm" onClick={onAnswer}>
              Afficher la réponse
            </button>
          )}
        </div>
      )}
      {reply.checklist && (
        <details>
          <summary className="small">Éléments attendus dans une bonne réponse</summary>
          <ul>
            {reply.checklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      )}
      {reply.links && reply.links.length > 0 && (
        <ul className="list-plain">
          {reply.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.title}</a>
              <div className="small muted">{l.reason}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

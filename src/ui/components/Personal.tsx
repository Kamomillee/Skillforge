import { useEffect, useRef, useState } from "react";
import { lessonById } from "../../content";
import { fiches } from "../../content/guides";
import type { Note } from "../../storage/store";
import { useApp } from "../app-context";
import { Md } from "../Md";
import { RunnableCode, RunnableSql } from "./Blocks";

/** Étoile de favori : leçon, exercice ou fiche. */
export function FavButton({ favKey, title, href }: { favKey: string; title: string; href: string }) {
  const { store, data, refresh } = useApp();
  const on = data.favorites.some((f) => f.key === favKey);
  async function toggle() {
    await store.toggleFavorite({ key: favKey, title, href });
    await refresh();
  }
  return (
    <button className="btn sm ghost" onClick={toggle} aria-pressed={on} title={on ? "Retirer des favoris" : "Ajouter aux favoris"}>
      <span aria-hidden="true">{on ? "★" : "☆"}</span> {on ? "En favori" : "Favori"}
    </button>
  );
}

/** Notes personnelles d'une leçon, enregistrées automatiquement sans jamais écraser une version plus récente. */
export function NoteBox({ lessonId, compact }: { lessonId: string; compact?: boolean }) {
  const { store } = useApp();
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"" | "pending" | "saved" | "conflict" | "error">("");
  const [conflict, setConflict] = useState<Note | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    store.getNote(lessonId).then((n) => {
      setNote(n ?? null);
      setText(n?.text ?? "");
    });
  }, [store, lessonId]);

  async function save(value: string, force = false) {
    try {
      const r = await store.saveNote(lessonId, value, note?.revision ?? 0, force);
      if (r.ok) {
        setNote(r.note);
        setConflict(null);
        setState("saved");
      } else {
        setConflict(r.conflict);
        setState("conflict");
      }
    } catch {
      setState("error");
    }
  }

  function onChange(v: string) {
    setText(v);
    setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(v), 600);
  }

  if (text === null) return null;
  return (
    <div className="note-box">
      <label className="field" style={{ margin: 0 }}>
        <span className={compact ? "small" : undefined}>Mes notes sur « {lessonById.get(lessonId)?.title ?? lessonId} »</span>
        <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={compact ? 4 : 6} maxLength={20_000} placeholder="Ce que je retiens, mes questions, mes pièges…" />
      </label>
      <span className="small muted" role="status">
        {state === "pending" ? "Enregistrement…" : state === "saved" ? "✓ Note enregistrée" : state === "error" ? "⚠ Non enregistrée" : ""}
      </span>
      {conflict && (
        <div className="banner" role="alert">
          Cette note a été modifiée ailleurs ({new Date(conflict.updatedAt).toLocaleTimeString("fr-CH")}).
          <button
            className="btn sm"
            onClick={() => {
              setNote(conflict);
              setText(conflict.text);
              setConflict(null);
              setState("");
            }}
          >
            Charger la plus récente
          </button>
          <button className="btn sm" onClick={() => void save(text, true)}>
            Garder la mienne
          </button>
        </div>
      )}
    </div>
  );
}

/** Fiche de notion : résumé, points clés, exemple exécutable, mini-test de rappel (auto-évalué). */
export function FicheView({ lessonId }: { lessonId: string }) {
  const { store, data, refresh } = useApp();
  const fiche = fiches[lessonId];
  const lesson = lessonById.get(lessonId);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  if (!fiche || !lesson) return null;
  const q = fiche.questions[i % fiche.questions.length];
  const recalls = data.events.filter((e) => e.type === "recall" && e.lessonId === lessonId);
  const ok = recalls.filter((e) => e.data?.ok).length;

  async function answer(knew: boolean) {
    await store.addEvent({ type: "recall", lessonId, data: { ok: knew, question: i % fiche.questions.length } });
    await refresh();
    setShown(false);
    setI((x) => x + 1);
  }

  return (
    <article className="fiche" aria-label={`Fiche : ${lesson.title}`}>
      <Md text={fiche.resume} glossary={lesson.glossary} />
      <h3>À retenir</h3>
      <ul>
        {fiche.pointsCles.map((p) => (
          <li key={p}>
            <Md text={p} />
          </li>
        ))}
      </ul>
      <h3>Exemple</h3>
      {fiche.exemple.language === "sql" ? <RunnableSql code={fiche.exemple.code} /> : <RunnableCode code={fiche.exemple.code} />}
      <Md text={fiche.exemple.explication} className="small" />

      <h3>Mini-test de rappel</h3>
      <div className="panel recall" data-testid="recall">
        <div className="eyebrow">
          Question {(i % fiche.questions.length) + 1}/{fiche.questions.length}
        </div>
        <p style={{ fontWeight: 600 }}>{q.question}</p>
        {shown ? (
          <>
            <div className="hint-box">
              <Md text={q.reponse} />
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => answer(true)}>
                ✓ Je savais
              </button>
              <button className="btn sm" onClick={() => answer(false)}>
                ↻ À revoir
              </button>
            </div>
          </>
        ) : (
          <button className="btn sm primary" onClick={() => setShown(true)}>
            Afficher la réponse
          </button>
        )}
        <p className="small muted" style={{ marginTop: 8 }}>
          Auto-évaluation : {recalls.length ? `${ok}/${recalls.length} « je savais » jusqu'ici` : "aucune réponse encore"}. Elle t'aide à choisir quoi revoir, mais ne compte pas comme preuve
          de maîtrise : seuls les exercices testés le font.
        </p>
      </div>
      <p className="small">
        <a href={`#/lecon/${lesson.id}`}>Ouvrir la leçon</a>
      </p>
    </article>
  );
}

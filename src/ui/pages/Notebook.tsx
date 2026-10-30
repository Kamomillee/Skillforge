import { useEffect, useMemo, useState } from "react";
import { lessonForExercise, lessonById, lessons } from "../../content";
import { fiches } from "../../content/guides";
import { errorNotebook } from "../../domain/notebook";
import type { Note } from "../../storage/store";
import { useApp } from "../app-context";
import { FavButton, FicheView, NoteBox } from "../components/Personal";
import type { Route } from "../router";

const tabs = [
  { id: "erreurs", label: "Erreurs" },
  { id: "favoris", label: "Favoris" },
  { id: "notes", label: "Notes" },
  { id: "fiches", label: "Fiches" },
] as const;
type Tab = (typeof tabs)[number]["id"];

/** Carnet : erreurs observées, favoris, notes et fiches de notions. */
export function Notebook({ route }: { route: Route }) {
  const tab: Tab = (tabs.find((t) => t.id === route.params[0])?.id ?? "erreurs") as Tab;
  return (
    <div className="page">
      <div className="eyebrow">Révision</div>
      <h1>Mon carnet</h1>
      <p className="muted">Tes erreurs réellement détectées par les tests, tes favoris, tes notes et les fiches de chaque notion.</p>
      <nav className="tabs" aria-label="Sections du carnet">
        {tabs.map((t) => (
          <a key={t.id} href={`#/carnet/${t.id}`} aria-current={t.id === tab ? "page" : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {tab === "erreurs" && <Errors />}
      {tab === "favoris" && <Favorites />}
      {tab === "notes" && <Notes />}
      {tab === "fiches" && <Fiches selected={route.params[1]} />}
    </div>
  );
}

function Errors() {
  const { data } = useApp();
  const entries = useMemo(() => errorNotebook(data.attempts), [data.attempts]);
  if (!entries.length)
    return (
      <p className="muted" data-testid="carnet-vide">
        Aucune erreur enregistrée. Quand un test échoue en révélant une erreur fréquente (par exemple « confondre WHERE et HAVING »), elle apparaît ici avec les exercices pour la
        travailler.
      </p>
    );
  const open = entries.filter((e) => !e.resolved);
  return (
    <>
      <p className="small muted">
        {open.length} erreur{open.length > 1 ? "s" : ""} à travailler, {entries.length - open.length} surmontée{entries.length - open.length > 1 ? "s" : ""}. Une erreur est surmontée quand
        chaque exercice où elle est apparue a été réussi ensuite.
      </p>
      <ul className="list-plain carnet-list" data-testid="carnet-erreurs">
        {entries.map((e) => {
          const lessonIds = [...new Set(e.occurrences.map((o) => lessonForExercise(o.exerciseId)?.id).filter((x): x is string => !!x && !!fiches[x]))];
          return (
            <li key={e.id} className={`panel carnet-entry${e.resolved ? " resolved" : ""}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{e.label}</h2>
                <span className={`badge ${e.resolved ? "success" : "warning"}`}>{e.resolved ? "✓ Surmontée" : "À travailler"}</span>
              </div>
              <p className="small muted" style={{ margin: "4px 0 8px" }}>
                Vue {e.count} fois, dernière le {new Date(e.lastAt).toLocaleDateString("fr-CH")}
              </p>
              {e.guide && (
                <>
                  <p style={{ margin: "0 0 6px" }}>{e.guide.explication}</p>
                  <p className="small">
                    <strong>Pour vérifier toi-même :</strong> {e.guide.question}
                  </p>
                </>
              )}
              <details>
                <summary className="small">Où elle est apparue ({e.occurrences.length})</summary>
                <ul className="small">
                  {e.occurrences.map((o) => (
                    <li key={o.exerciseId}>
                      {o.title} · {new Date(o.at).toLocaleDateString("fr-CH")} · v{o.version} · {o.resolved ? "réussi ensuite" : "pas encore réussi"}
                    </li>
                  ))}
                </ul>
              </details>
              {!e.resolved && e.practice.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong className="small">Pour la travailler</strong>
                  <ul className="list-plain">
                    {e.practice.map((p) => (
                      <li key={p.href}>
                        <a href={p.href}>{p.title}</a>
                        <div className="small muted">{p.reason}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lessonIds.length > 0 && (
                <p className="small" style={{ marginBottom: 0 }}>
                  Fiche :{" "}
                  {lessonIds.map((id, k) => (
                    <span key={id}>
                      {k > 0 && ", "}
                      <a href={`#/carnet/fiches/${id}`}>{lessonById.get(id)?.title}</a>
                    </span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Favorites() {
  const { data, store, refresh } = useApp();
  if (!data.favorites.length) return <p className="muted">Aucun favori. Utilise l'étoile « ☆ Favori » sur une leçon, un exercice ou une fiche pour la retrouver ici.</p>;
  return (
    <ul className="list-plain" data-testid="favoris">
      {data.favorites.map((f) => (
        <li key={f.key} className="row" style={{ justifyContent: "space-between" }}>
          <span>
            <span className="badge">{f.key.startsWith("lecon:") ? "Leçon" : f.key.startsWith("fiche:") ? "Fiche" : "Exercice"}</span> <a href={f.href}>{f.title}</a>
          </span>
          <button
            className="btn sm ghost"
            onClick={async () => {
              await store.toggleFavorite(f);
              await refresh();
            }}
          >
            Retirer
          </button>
        </li>
      ))}
    </ul>
  );
}

function Notes() {
  const { store } = useApp();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [adding, setAdding] = useState("");
  useEffect(() => void store.listNotes().then(setNotes), [store]);
  if (!notes) return null;
  const free = lessons.filter((l) => !notes.some((n) => n.lessonId === l.id));
  return (
    <>
      {notes.length === 0 && <p className="muted">Aucune note. Tu peux en écrire depuis chaque leçon (panneau « Mes notes ») ou ici.</p>}
      <div className="notes-grid">
        {notes.map((n) => (
          <div key={n.lessonId} className="panel">
            <NoteBox lessonId={n.lessonId} />
            <a className="small" href={`#/lecon/${n.lessonId}`}>
              Ouvrir la leçon
            </a>
          </div>
        ))}
        {adding && (
          <div className="panel">
            <NoteBox lessonId={adding} />
          </div>
        )}
      </div>
      {free.length > 0 && !adding && (
        <label className="field" style={{ maxWidth: 420, marginTop: 16 }}>
          Nouvelle note pour la leçon
          <select value="" onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choisir…</option>
            {free.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

function Fiches({ selected }: { selected?: string }) {
  const { data } = useApp();
  const ids = lessons.filter((l) => fiches[l.id]).map((l) => l.id);
  const current = selected && fiches[selected] ? selected : undefined;
  // Fiches à revoir : celles où « à revoir » a été répondu au dernier rappel.
  const toReview = new Set(
    ids.filter((id) => {
      const last = data.events.filter((e) => e.type === "recall" && e.lessonId === id).sort((a, b) => b.at.localeCompare(a.at))[0];
      return last && !last.data?.ok;
    }),
  );
  return (
    <div className="fiches-layout">
      <nav aria-label="Fiches de notions">
        <ul className="list-plain">
          {ids.map((id) => (
            <li key={id}>
              <a href={`#/carnet/fiches/${id}`} aria-current={id === current ? "page" : undefined}>
                {lessonById.get(id)!.title}
              </a>
              {toReview.has(id) && <span className="small muted"> · à revoir (dernier rappel)</span>}
            </li>
          ))}
        </ul>
      </nav>
      <div>
        {current && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{lessonById.get(current)!.title}</h2>
            <FavButton favKey={`fiche:${current}`} title={`Fiche : ${lessonById.get(current)!.title}`} href={`#/carnet/fiches/${current}`} />
          </div>
        )}
        {current ? <FicheView key={current} lessonId={current} /> : <p className="muted">Choisis une notion : résumé, exemple exécutable et mini-test de rappel.</p>}
      </div>
    </div>
  );
}

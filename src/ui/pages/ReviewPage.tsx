import { exerciseById, lessons } from "../../content";
import { recordReview } from "../../domain/reviews";
import { useApp } from "../app-context";
import { Workbench } from "../components/Workbench";
import { navigate, type Route } from "../router";

/** Révision espacée : refaire un exercice de validation dans un éditeur neuf. */
export function ReviewPage({ route }: { route: Route }) {
  const conceptId = route.params[0];
  const { data, store, refresh, toast } = useApp();
  const review = data.reviews.find((r) => r.conceptId === conceptId);
  const lesson = lessons.find((l) => l.conceptIds.includes(conceptId));
  const ex = lesson?.validationExerciseId ? exerciseById.get(lesson.validationExerciseId) : undefined;
  if (!review || !lesson || !ex)
    return (
      <div className="page">
        <h1>Aucune révision à faire ici</h1>
        <a href="#/tableau">Retour au tableau de bord</a>
      </div>
    );

  async function giveUp() {
    await store.putReview(recordReview(review!, false));
    await refresh();
    toast("Pas de souci : la notion reviendra demain.");
    navigate("#/tableau");
  }

  return (
    <div className="lesson-layout" style={{ gridTemplateColumns: "minmax(0,1fr) 0 minmax(0, 1.4fr)" }}>
      <div className="lesson-main">
        <article className="lesson-content">
          <div className="eyebrow">Révision espacée</div>
          <h1>{lesson.title}</h1>
          <p>{review.reason}</p>
          <p className="muted">
            Rappel actif : résous l'exercice sans relire la leçon. Réussir sans afficher la solution compte comme révision réussie et espace la prochaine. Échouer n'est pas grave :
            la notion reviendra plus tôt.
          </p>
          <div className="row">
            <a className="btn" href={`#/lecon/${lesson.id}`}>
              Relire la leçon
            </a>
            <button className="btn ghost" onClick={giveUp}>
              Je n'y arrive pas pour l'instant
            </button>
          </div>
        </article>
      </div>
      <div />
      <aside className="atelier" aria-label="Atelier de révision">
        <Workbench
          exercise={ex}
          lesson={lesson}
          mode="review"
          onPassed={() => {
            toast("Révision réussie.");
          }}
        />
      </aside>
    </div>
  );
}

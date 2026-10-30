import { useMemo } from "react";
import { allNotions, curriculum, exercises, lessonById, lessons, sectionForExercise } from "../../content";
import { estimateMastery, masteryLabel } from "../../domain/mastery";
import { frequentErrors, lessonHref, recommendNext } from "../../domain/recommend";
import { isDue } from "../../domain/reviews";
import { useApp } from "../app-context";

function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function Dashboard() {
  const { data } = useApp();
  const rec = useMemo(
    () => recommendNext({ path: data.path, lessons, exercises, attempts: data.attempts, drafts: data.drafts, reviews: data.reviews, resume: data.resume }),
    [data],
  );
  const errors = useMemo(() => frequentErrors(data.attempts, exercises).slice(0, 4), [data.attempts]);
  const masteryByNotion = useMemo(() => {
    const m = new Map<string, ReturnType<typeof estimateMastery>>();
    for (const { notion } of allNotions())
      if (notion.status === "disponible")
        m.set(notion.id, estimateMastery(notion.id, { lessons, exercises, attempts: data.attempts, events: data.events, review: data.reviews.find((r) => r.conceptId === notion.id) }));
    return m;
  }, [data]);
  const evidence = [...masteryByNotion.values()].flatMap((m) => m.evidence.filter((e) => e.verified)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  const ws = weekStart();
  const weekSeconds = Object.entries(data.activity)
    .filter(([day]) => new Date(day) >= ws)
    .reduce((s, [, v]) => s + v, 0);
  const goalH = data.profile?.hoursPerWeek ?? 0;

  const resume = data.resume;
  const resumeLesson = resume ? lessonById.get(resume.lessonId) : undefined;
  const resumeSection = resumeLesson?.sections.find((s) => s.id === resume?.sectionId);
  const resumeEx = resume?.exerciseId ? exercises.find((e) => e.id === resume.exerciseId) : undefined;
  const order = data.path?.domainOrder ?? curriculum.map((d) => d.id);
  const reviewsSorted = [...data.reviews].sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>{data.profile?.name ? `Bonjour ${data.profile.name}` : "Ton tableau de bord"}</h1>
      <div className="dash">
        <section className="hero" aria-labelledby="next-title">
          <div>
            <div className="eyebrow">Prochaine activité recommandée</div>
            <h2 id="next-title">{rec.title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              <strong>Pourquoi :</strong> {rec.reason}
            </p>
          </div>
          <div className="stack" style={{ justifyItems: "end" }}>
            <a className="btn primary" href={rec.href} data-testid="next-activity">
              Commencer →
            </a>
            {resumeLesson && resumeSection && (
              <a className="btn" href={lessonHref(resumeLesson.id, resumeSection.id, resumeEx?.id)} data-testid="resume">
                ↺ Reprendre exactement où j'en étais
              </a>
            )}
          </div>
          {resumeLesson && resumeSection && (
            <p className="small muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Dernière position : « {resumeSection.title} »{resumeEx ? `, exercice « ${resumeEx.title} »` : ""} — {new Date(resume!.at).toLocaleString("fr-CH")}
            </p>
          )}
        </section>

        <section aria-labelledby="prog-title">
          <h2 id="prog-title">Progression par domaine</h2>
          <div className="domain-rows">
            {order.map((id) => {
              const d = curriculum.find((x) => x.id === id)!;
              const notions = d.modules.flatMap((m) => m.notions);
              const avail = notions.filter((n) => n.status === "disponible");
              const demo = avail.filter((n) => (masteryByNotion.get(n.id)?.level ?? 0) >= 3).length;
              return (
                <div key={d.id} className="domain-row">
                  <strong>{d.short}</strong>
                  <div>
                    <div
                      className="bar"
                      role="img"
                      aria-label={`${d.short} : ${demo} notion(s) démontrée(s), ${avail.length} disponible(s) sur ${notions.length} au programme`}
                    >
                      <span className="demo" style={{ width: `${(demo / notions.length) * 100}%` }} />
                      <span className="avail" style={{ width: `${((avail.length - demo) / notions.length) * 100}%` }} />
                    </div>
                  </div>
                  <span className="small muted">
                    {demo} démontrée{demo > 1 ? "s" : ""} · {avail.length}/{notions.length} disponible{avail.length > 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Vert : notions démontrées par des exercices réussis. Bleu : notions disponibles. Le reste du programme est prévu et n'est pas encore jouable —{" "}
            <a href="#/programme">voir la matrice de couverture</a>.
          </p>

          <h2 style={{ marginTop: 28 }}>Preuves de maîtrise récentes</h2>
          {evidence.length ? (
            <ul className="list-plain">
              {evidence.map((e, k) => (
                <li key={k} className="small">
                  ✓ {e.label} <span className="muted">· {new Date(e.at).toLocaleDateString("fr-CH")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Aucune preuve pour l'instant. Une preuve = un exercice réussi avec les tests, pas une leçon lue.</p>
          )}

          <h2 style={{ marginTop: 28 }}>Projets en cours</h2>
          <p className="small muted">
            Aucun projet ouvert. Le premier projet (pipeline de données Python) s'ouvrira avec le module correspondant ; tes exercices réussis y seront réutilisables.
          </p>
        </section>

        <aside className="stack" style={{ alignContent: "start", gap: 28 }}>
          <section aria-labelledby="time-title">
            <h2 id="time-title">Cette semaine</h2>
            <div className="meter-text">
              {Math.round(weekSeconds / 60)} min <span className="small muted">actives</span>
            </div>
            {goalH > 0 && (
              <>
                <div className="bar" style={{ margin: "8px 0" }} role="img" aria-label={`${Math.round(weekSeconds / 60)} minutes sur un objectif de ${goalH} heures`}>
                  <span className="demo" style={{ width: `${Math.min(100, (weekSeconds / (goalH * 3600)) * 100)}%` }} />
                </div>
                <p className="small muted">
                  Objectif souple : {goalH} h. Temps mesuré dans ce navigateur, seulement quand la page est visible et que tu interagis. Pas de pénalité si tu fais une pause.
                </p>
              </>
            )}
          </section>

          <section aria-labelledby="rev-title">
            <h2 id="rev-title">Notions à réviser</h2>
            {reviewsSorted.length ? (
              <ul className="list-plain">
                {reviewsSorted.map((r) => {
                  const l = lessons.find((x) => x.conceptIds.includes(r.conceptId));
                  const due = isDue(r);
                  return (
                    <li key={r.conceptId} className="small">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span>{l?.title ?? r.conceptId}</span>
                        {due ? (
                          <a className="btn sm primary" href={`#/revision/${encodeURIComponent(r.conceptId)}`}>
                            Réviser
                          </a>
                        ) : (
                          <span className="badge">le {new Date(r.dueAt).toLocaleDateString("fr-CH")}</span>
                        )}
                      </div>
                      <div className="muted">{r.reason}</div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small muted">Les révisions sont planifiées après une réussite autonome.</p>
            )}
          </section>

          <section aria-labelledby="err-title">
            <h2 id="err-title">Erreurs fréquentes</h2>
            {errors.length ? (
              <ul className="list-plain">
                {errors.map((e) => (
                  <li key={e.id} className="small">
                    <strong>{e.label}</strong> — {e.count} fois
                    <div className="muted">dans {e.exercises.join(", ")}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Les erreurs détectées par les tests apparaîtront ici, pour cibler tes révisions.</p>
            )}
          </section>

          <section>
            <h2>Maîtrise des notions disponibles</h2>
            <ul className="list-plain">
              {[...masteryByNotion.entries()].map(([id, m]) => {
                const n = allNotions().find((x) => x.notion.id === id)!;
                const l = n.notion.lessonIds?.[0];
                const lesson = l ? lessonById.get(l) : undefined;
                const firstEx = lesson?.validationExerciseId;
                return (
                  <li key={id} className="small row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {n.domain.short} · {n.notion.title}
                    </span>
                    <span className={`badge ${m.level >= 3 ? "success" : m.level >= 1 ? "info" : ""}`}>{masteryLabel[m.level]}</span>
                    {lesson && firstEx && m.level < 3 && (
                      <a className="small" href={lessonHref(lesson.id, sectionForExercise(lesson, firstEx)?.id ?? lesson.sections[0].id, firstEx)}>
                        passer le test de validation
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

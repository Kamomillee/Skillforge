import { useEffect, useMemo, useRef, useState } from "react";
import { exerciseById, lessonById, stageLabel } from "../../content";
import { estimateMastery, masteryLabel } from "../../domain/mastery";
import { lessons, exercises } from "../../content";
import { lessonHref } from "../../domain/recommend";
import { useApp } from "../app-context";
import { navigate, type Route } from "../router";
import { LessonBlockView } from "../components/Blocks";
import { Workbench } from "../components/Workbench";
import { Sandbox, SqlSandbox } from "../components/Sandbox";
import { domainById, moduleById } from "../../content";
import { Dialog } from "../components/Dialog";

const readWidth = () => {
  try {
    return Number(localStorage.getItem("sf-atelier-w")) || 46;
  } catch {
    return 46;
  }
};

export function LessonPage({ route }: { route: Route }) {
  const [lessonId, sectionParam] = route.params;
  const lesson = lessonById.get(lessonId);
  const { store, data, refresh } = useApp();
  const [focus, setFocus] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"cours" | "atelier">("cours");
  const [width, setWidth] = useState(readWidth);
  const [whyOpen, setWhyOpen] = useState(false);
  const layout = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const section = lesson?.sections.find((s) => s.id === sectionParam) ?? lesson?.sections[0];
  const sectionIdx = lesson && section ? lesson.sections.indexOf(section) : 0;
  const exParam = route.query.get("ex");
  const sectionExercise = section?.blocks.find((b) => b.type === "exercise");
  const exerciseId = exParam ?? (sectionExercise?.type === "exercise" ? sectionExercise.exerciseId : undefined);
  const exercise = exerciseId ? exerciseById.get(exerciseId) : undefined;

  // Événement d'ouverture (une fois par affichage de la leçon) — distinct de toute preuve de maîtrise.
  useEffect(() => {
    if (lesson) void store.addEvent({ type: "lesson-open", lessonId: lesson.id }).then(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  // Point de reprise exact : leçon, section, exercice ouvert.
  useEffect(() => {
    if (!lesson || !section) return;
    void store.saveResume({ lessonId: lesson.id, sectionId: section.id, exerciseId, at: new Date().toISOString() });
    mainRef.current?.scrollTo({ top: 0 });
  }, [store, lesson, section, exerciseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lesson) return;
      if (e.altKey && e.key === "PageDown" && sectionIdx < lesson.sections.length - 1) navigate(lessonHref(lesson.id, lesson.sections[sectionIdx + 1].id));
      if (e.altKey && e.key === "PageUp" && sectionIdx > 0) navigate(lessonHref(lesson.id, lesson.sections[sectionIdx - 1].id));
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [lesson, sectionIdx, fullscreen]);

  const mastery = useMemo(
    () =>
      lesson
        ? estimateMastery(lesson.conceptIds[0], { lessons, exercises, attempts: data.attempts, events: data.events, review: data.reviews.find((r) => r.conceptId === lesson.conceptIds[0]) })
        : null,
    [lesson, data],
  );

  if (!lesson || !section)
    return (
      <div className="page">
        <h1>Leçon introuvable</h1>
        <a href="#/programme">Voir le programme</a>
      </div>
    );

  const sectionDone = (sid: string) => {
    const s = lesson.sections.find((x) => x.id === sid)!;
    const exIds = s.blocks.flatMap((b) => (b.type === "exercise" ? [b.exerciseId] : []));
    const predIds = s.blocks.flatMap((b) => (b.type === "prediction" ? [b.id] : []));
    if (exIds.length) return exIds.every((id) => data.attempts.some((a) => a.exerciseId === id && a.status === "passed"));
    if (predIds.length) return predIds.every((id) => data.events.some((e) => e.type === "prediction" && e.data?.id === id));
    return false;
  };

  const openExercise = (id: string) => {
    navigate(lessonHref(lesson.id, section.id, id));
    setMobileTab("atelier");
  };

  function startDrag(e: React.PointerEvent) {
    const el = layout.current;
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const w = Math.max(28, Math.min(70, ((rect.right - ev.clientX) / rect.width) * 100));
      setWidth(w);
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      setWidth((w) => {
        try {
          localStorage.setItem("sf-atelier-w", String(Math.round(w)));
        } catch {
          /* stockage indisponible : largeur non mémorisée */
        }
        return w;
      });
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  }

  const onSplitterKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setWidth((w) => Math.min(70, w + 3));
    if (e.key === "ArrowRight") setWidth((w) => Math.max(28, w - 3));
  };

  const prev = lesson.sections[sectionIdx - 1];
  const next = lesson.sections[sectionIdx + 1];

  return (
    <div
      ref={layout}
      className={`lesson-layout${focus ? " focus" : ""}`}
      data-mobile={mobileTab}
      style={{ ["--atelier-w" as string]: `${width}%` }}
    >
      <div className="mobile-tabs" role="tablist" aria-label="Vue">
        <button role="tab" aria-selected={mobileTab === "cours"} onClick={() => setMobileTab("cours")}>
          Cours
        </button>
        <button role="tab" aria-selected={mobileTab === "atelier"} onClick={() => setMobileTab("atelier")}>
          Atelier{exercise ? " · exercice" : ""}
        </button>
      </div>

      <nav className="lesson-nav" aria-label="Étapes de la leçon">
        <div className="eyebrow">
          {domainById[lesson.domain].short} · Module {moduleById(lesson.moduleId)?.letter ?? ""}
        </div>
        <div style={{ fontWeight: 650, marginBottom: 12, lineHeight: 1.35 }}>{lesson.title}</div>
        <ol>
          {lesson.sections.map((s, k) => (
            <li key={s.id}>
              <a href={lessonHref(lesson.id, s.id)} aria-current={s.id === section.id ? "step" : undefined}>
                <span className="stage-num">{String(k + 1).padStart(2, "0")}</span>
                <span>
                  {s.title}
                  <span className="sr-only"> ({stageLabel[s.stage]})</span>
                </span>
                {sectionDone(s.id) && (
                  <span className="stage-check" title="Terminé" aria-label="terminé">
                    ✓
                  </span>
                )}
              </a>
            </li>
          ))}
        </ol>
        {mastery && (
          <div className="panel" style={{ padding: 12, marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Maîtrise estimée
            </div>
            <div style={{ fontWeight: 650 }}>{masteryLabel[mastery.level]}</div>
            <button className="btn sm ghost" style={{ paddingLeft: 0 }} onClick={() => setWhyOpen(true)}>
              Pourquoi ce statut ?
            </button>
          </div>
        )}
        {lesson.validationExerciseId && (
          <div style={{ marginTop: 12 }}>
            <a className="btn sm" href={lessonHref(lesson.id, section.id, lesson.validationExerciseId)}>
              Je connais déjà : passer le test
            </a>
          </div>
        )}
      </nav>

      <div className="lesson-main" ref={mainRef}>
        <article className="lesson-content" id="contenu">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="stage-tag">
              {sectionIdx + 1}/{lesson.sections.length} · {stageLabel[section.stage]}
            </span>
            <button className="btn sm ghost" onClick={() => setFocus((f) => !f)} aria-pressed={focus}>
              {focus ? "Quitter le mode concentration" : "Mode concentration"}
            </button>
          </div>
          <h1>{section.title}</h1>
          {sectionIdx === 0 && (
            <details className="panel" style={{ padding: "12px 16px", marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Objectifs, prérequis et durée (~{lesson.estimatedMinutes} min)
              </summary>
              <ul>
                {lesson.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <p className="small muted">Prérequis : {lesson.prerequisites.join(", ")}.</p>
            </details>
          )}
          {section.blocks.map((b, k) => (
            <LessonBlockView key={`${section.id}-${k}`} block={b} lesson={lesson} onOpenExercise={openExercise} />
          ))}
          <div className="section-pager">
            {prev ? (
              <a className="btn" href={lessonHref(lesson.id, prev.id)}>
                ← {prev.title}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a className="btn primary" href={lessonHref(lesson.id, next.id)}>
                {next.title} →
              </a>
            ) : (
              <a className="btn primary" href="#/tableau">
                Retour au tableau de bord
              </a>
            )}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Astuce : <kbd>Alt</kbd>+<kbd>Page↓</kbd> / <kbd>Page↑</kbd> pour changer d'étape. Toutes les étapes restent accessibles librement.
          </p>
        </article>
      </div>

      <div
        className="splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner l'atelier"
        aria-valuenow={Math.round(width)}
        aria-valuemin={28}
        aria-valuemax={70}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onSplitterKey}
      />

      <aside className={`atelier${fullscreen ? " fullscreen" : ""}`} aria-label="Atelier pratique">
        {exercise ? (
          <Workbench key={exercise.id} exercise={exercise} lesson={lesson} fullscreen={fullscreen} onFullscreen={setFullscreen} />
        ) : lesson.domain === "sql" || lesson.domain === "bi" ? (
          <SqlSandbox />
        ) : (
          <Sandbox />
        )}
      </aside>

      {mastery && (
        <Dialog
          open={whyOpen}
          onClose={() => setWhyOpen(false)}
          title={`Maîtrise : ${masteryLabel[mastery.level]}`}
          actions={
            <button className="btn" onClick={() => setWhyOpen(false)}>
              Fermer
            </button>
          }
        >
          <ul>
            {mastery.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <h3>Preuves</h3>
          {mastery.evidence.length ? (
            <ul className="list-plain">
              {mastery.evidence.map((e, k) => (
                <li key={k} className="small">
                  <span className={`badge ${e.verified ? "success" : ""}`}>{e.verified ? "vérifiée" : "auto-déclarée"}</span> {e.label}{" "}
                  <span className="muted">· {new Date(e.at).toLocaleDateString("fr-CH")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aucune preuve pour l'instant. Lire la leçon ne suffit pas : réussis un exercice.</p>
          )}
        </Dialog>
      )}
    </div>
  );
}

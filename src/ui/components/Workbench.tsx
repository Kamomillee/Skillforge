import { useEffect, useMemo, useRef, useState } from "react";
import { misconceptionLabels, type Exercise, type Lesson } from "../../content/types";
import { explainError, type PyErrorInfo } from "../../grading/errors";
import type { GradeReport } from "../../grading/evaluate";
import { scheduleAfterSuccess, recordReview } from "../../domain/reviews";
import { useApp } from "../app-context";
import { useDraft, type SaveState } from "../hooks/useDraft";
import { CodeEditor, type EditorHandle } from "./CodeEditor";
import { ConfirmDialog, Dialog } from "./Dialog";
import { Md } from "../Md";
import type { QueryOutcome } from "../../runtime/sql/engine";
import { ResultTable, SchemaPanel, SqlErrorCard } from "./SqlParts";
import { TutorPanel } from "./TutorPanel";
import { exerciseHref, type RunError } from "../../domain/tutor";
import { FavButton } from "./Personal";

const kindLabel: Record<Exercise["kind"], string> = {
  guided: "Exercice guidé",
  autonomous: "Exercice autonome",
  debug: "Débogage",
  validation: "Test de validation",
  project: "Étape de projet",
};

const hintLabel = ["", "Question d'orientation", "Indice conceptuel", "Aide ciblée", "Solution expliquée"];

type Output =
  | { kind: "none" }
  | { kind: "run"; text: string; status: "running" | "ok" | "error" | "timeout" | "interrupted"; error: PyErrorInfo | null; ms?: number }
  | { kind: "sql"; status: "running" | "ok" | "error" | "timeout" | "interrupted"; outcome?: QueryOutcome; message?: string }
  | { kind: "grade"; report: GradeReport; code: string };

export function Workbench({
  exercise: ex,
  lesson,
  mode = "lesson",
  onFullscreen,
  fullscreen,
  onPassed,
  variantSeed = 0,
}: {
  variantSeed?: number;
  exercise: Exercise;
  lesson?: Lesson;
  mode?: "lesson" | "review";
  fullscreen?: boolean;
  onFullscreen?: (v: boolean) => void;
  onPassed?: (r: GradeReport) => void;
}) {
  const { store, runner, runnerState, sqlRunner, sqlState, data, refresh, toast } = useApp();
  const isSql = ex.language === "sql";
  const engineState = isSql ? sqlState : runnerState;
  const engine = isSql ? sqlRunner : runner;
  // Tentatives de révision : `<id>#revision`. Brouillon et aides sont propres à chaque variante.
  const attemptKey = mode === "review" ? `${ex.id}#revision` : ex.id;
  const draftKey = variantSeed ? `${attemptKey}~${variantSeed}` : attemptKey;
  const draft = useDraft(store, ex, draftKey);
  const [out, setOut] = useState<Output>({ kind: "none" });
  const [tab, setTab] = useState<"console" | "tests">("console");
  const [hintLevel, setHintLevel] = useState(0);
  const [confirm, setConfirm] = useState<null | "reset" | "solution" | { restore: string }>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const editor = useRef<EditorHandle | null>(null);
  const busy = engineState.kind === "busy" || engine.isBusy;
  const hintsKey = `hints:${draftKey}`;

  useEffect(() => {
    setOut({ kind: "none" });
    store.get<number>(hintsKey).then((h) => setHintLevel(h ?? 0));
  }, [store, hintsKey]);

  // Démarrage anticipé du moteur (Python ou PostgreSQL) dès qu'un exercice est affiché.
  useEffect(() => void engine.init().catch(() => {}), [engine]);

  const attempts = useMemo(
    () => data.attempts.filter((a) => a.exerciseId === attemptKey).sort((a, b) => b.at.localeCompare(a.at)),
    [data.attempts, attemptKey],
  );
  const solved = attempts.some((a) => a.status === "passed");

  async function run() {
    if (busy || draft.code === null) return;
    setTab("console");
    if (ex.language === "sql") {
      setOut({ kind: "sql", status: "running" });
      const r = await sqlRunner.query(draft.code, ex.timeLimitMs);
      const status = r.status === "ok" && r.outcome && !r.outcome.ok ? "error" : r.status;
      setOut({ kind: "sql", status, outcome: r.outcome, message: r.message });
      void store.addEvent({ type: "run", exerciseId: attemptKey, lessonId: lesson?.id, data: { status, errorType: r.outcome && !r.outcome.ok ? r.outcome.error.code : undefined } });
      return;
    }
    setOut({ kind: "run", text: "", status: "running", error: null });
    const res = await runner.run(draft.code, {
      timeoutMs: ex.timeLimitMs,
      packages: ex.packages,
      onStdout: (t) => setOut((o) => (o.kind === "run" ? { ...o, text: o.text + t + "\n" } : o)),
    });
    setOut((o) => ({ kind: "run", text: o.kind === "run" ? o.text : res.output, status: res.status, error: res.error, ms: res.durationMs }));
    void store.addEvent({ type: "run", exerciseId: attemptKey, lessonId: lesson?.id, data: { status: res.status, errorType: res.error?.type } });
  }

  async function submit() {
    if (busy || draft.code === null) return;
    await draft.flush();
    setTab("tests");
    const code = draft.code;
    const report = ex.language === "sql" ? await sqlRunner.grade(ex, code) : await runner.grade(ex, code);
    setOut({ kind: "grade", report, code });
    const solutionViewed = hintLevel >= 4;
    await store.addAttempt({
      exerciseId: attemptKey,
      exerciseVersion: ex.version,
      ...(variantSeed ? { variantSeed } : {}),
      at: new Date().toISOString(),
      code: draft.code,
      status: report.status,
      passedCount: report.passedCount,
      total: report.total,
      hiddenPassed: report.hiddenPassed,
      hiddenTotal: report.hiddenTotal,
      misconceptions: report.misconceptions,
      errorType: report.loadError?.type ?? report.sqlError?.code,
      hintLevel,
      solutionViewed,
      durationMs: report.durationMs,
    });
    if (report.status === "passed") {
      const concept = ex.conceptIds[0];
      const existing = await store.getReview(concept);
      if (mode === "review" && existing) {
        await store.putReview(recordReview(existing, !solutionViewed));
        await store.addEvent({ type: "review-done", exerciseId: ex.id, data: { ok: !solutionViewed } });
      } else if (!solutionViewed && (ex.kind === "autonomous" || ex.kind === "validation" || ex.kind === "project")) {
        await store.putReview(scheduleAfterSuccess(concept, existing, new Date(), `Planifiée après la réussite de « ${ex.title} ».`));
      }
      onPassed?.(report);
    }
    await refresh();
  }

  async function revealHint() {
    const next = Math.min(hintLevel + 1, 4);
    if (next === 4) return setConfirm("solution");
    setHintLevel(next);
    await store.set(hintsKey, next);
    await store.addEvent({ type: "hint", exerciseId: attemptKey, lessonId: lesson?.id, data: { level: next } });
  }

  async function confirmAction() {
    const c = confirm;
    setConfirm(null);
    if (c === "reset") {
      await draft.replace(ex.starterCode);
      setOut({ kind: "none" });
      toast("Code initial restauré. Tes tentatives restent dans l'historique.");
    } else if (c === "solution") {
      setHintLevel(4);
      await store.set(hintsKey, 4);
      await store.addEvent({ type: "hint", exerciseId: attemptKey, lessonId: lesson?.id, data: { level: 4 } });
    } else if (c && typeof c === "object") {
      await draft.replace(c.restore);
      setHistoryOpen(false);
      toast("Code de la tentative restauré.");
    }
  }

  const lastReport = out.kind === "grade" ? out.report : undefined;
  const runError: RunError | undefined =
    out.kind === "run" && out.error ? { kind: "python", error: out.error } : out.kind === "sql" && out.outcome && !out.outcome.ok ? { kind: "sql", message: out.outcome.error.message, code: out.outcome.error.code } : undefined;

  function showEvidence() {
    if (lastReport) setTab("tests");
    else if (attempts.length) setHistoryOpen(true);
    else toast("Aucune exécution vérifiée pour l'instant : lance « ✓ Vérifier ».");
  }

  async function sendReport() {
    await store.addEvent({ type: "report", exerciseId: ex.id, lessonId: lesson?.id, data: { text: reportText.slice(0, 2000), exerciseVersion: ex.version } });
    setReportOpen(false);
    setReportText("");
    toast("Signalement enregistré localement. Merci !");
  }

  return (
    <section className="wb" aria-label={`Atelier : ${ex.title}`} style={{ display: "contents" }}>
      <div className="wb-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <span className="badge accent">{mode === "review" ? "Révision" : kindLabel[ex.kind]}</span>
            {solved && <span className="badge success">✓ Réussi</span>}
            <span className="small muted">v{ex.version}</span>
          </div>
          <div className="row">
            {mode === "lesson" && exerciseHref(ex.id) && <FavButton favKey={`exercice:${ex.id}`} title={ex.title} href={exerciseHref(ex.id)!} />}
            {onFullscreen && (
              <button className="btn sm ghost" onClick={() => onFullscreen(!fullscreen)} aria-pressed={!!fullscreen}>
                {fullscreen ? "⤡ Quitter le plein écran" : "⤢ Plein écran"}
              </button>
            )}
          </div>
        </div>
        <h2 style={{ margin: "8px 0 0", fontSize: "1.1rem" }}>{ex.title}</h2>
      </div>

      {draft.versionChanged && (
        <div className="banner" role="status">
          Cet exercice a été mis à jour depuis ton brouillon. Ton code est conservé ; les nouvelles tentatives seront rattachées à la version {ex.version}.
        </div>
      )}
      {draft.save.kind === "conflict" && (
        <div className="banner" role="alert">
          <strong>Une version plus récente de ce brouillon existe</strong> (modifiée dans un autre onglet le{" "}
          {new Date(draft.save.theirs.updatedAt).toLocaleTimeString("fr-CH")}).
          <button className="btn sm" onClick={() => draft.resolveConflict("theirs")}>
            Charger la plus récente
          </button>
          <button className="btn sm" onClick={() => draft.resolveConflict("mine")}>
            Garder la mienne
          </button>
        </div>
      )}

      <div className="wb-scroll">
        <div className="wb-prompt">
          <Md text={ex.prompt} glossary={lesson?.glossary} />
        </div>

        <div className="wb-toolbar" role="toolbar" aria-label="Actions sur le code">
          <button className="btn sm" onClick={run} disabled={busy || draft.code === null} title="Ctrl/⌘ + Entrée">
            ▶ Exécuter <kbd>Ctrl ↵</kbd>
          </button>
          <button className="btn sm primary" onClick={submit} disabled={busy || draft.code === null} title="Ctrl/⌘ + Maj + Entrée">
            ✓ Vérifier
          </button>
          {busy && (
            <button className="btn sm danger" onClick={() => engine.stop()}>
              ■ Arrêter
            </button>
          )}
          <span className="spacer" />
          <SaveIndicator s={draft.save} onRetry={() => draft.flush()} />
          <button className="btn sm ghost" onClick={() => setHistoryOpen(true)} disabled={!attempts.length}>
            Historique ({attempts.length})
          </button>
          <button className="btn sm ghost" onClick={() => setConfirm("reset")}>
            Réinitialiser
          </button>
        </div>

        {draft.code === null ? (
          <div className="editor-wrap" aria-busy="true" />
        ) : (
          <CodeEditor
            value={draft.code}
            onChange={draft.setCode}
            onRun={run}
            onSubmit={submit}
            label={`Éditeur ${isSql ? "SQL" : "Python"} : ${ex.title}`}
            handleRef={editor}
            language={ex.language}
          />
        )}

        {isSql && (
          <details className="schema-details">
            <summary>Schéma de la base et aperçu des tables</summary>
            <SchemaPanel />
          </details>
        )}

        <div className="out-tabs" role="tablist" aria-label="Résultats">
          <button role="tab" aria-selected={tab === "console"} onClick={() => setTab("console")}>
            {isSql ? "Résultat" : "Console"}
          </button>
          <button role="tab" aria-selected={tab === "tests"} onClick={() => setTab("tests")}>
            Tests
          </button>
          <span className="spacer" style={{ flex: 1 }} />
          <EngineLine sql={isSql} />
        </div>
        <div className="out-panel" role="tabpanel" aria-live="polite">
          {tab === "console" ? (
            isSql ? (
              <SqlConsoleView out={out} code={draft.code ?? ""} limitMs={ex.timeLimitMs} onGoto={(l) => editor.current?.goToLine(l)} />
            ) : (
              <ConsoleView out={out} onGoto={(l) => editor.current?.goToLine(l)} />
            )
          ) : (
            <TestsView out={out} ex={ex} onGoto={(l) => editor.current?.goToLine(l)} />
          )}

          <HelpPanel ex={ex} level={hintLevel} onMore={revealHint} attempts={attempts.length} />

          <TutorPanel
            exercise={ex}
            lesson={lesson}
            code={draft.code ?? ""}
            report={lastReport}
            runError={runError}
            attempts={attempts}
            hintLevel={hintLevel}
            onHint={revealHint}
            onReport={(t) => {
              setReportText(t);
              setReportOpen(true);
            }}
            onEvidence={showEvidence}
          />

          {out.kind === "grade" && out.report.status === "passed" && (
            <div className="callout success" style={{ marginTop: 16 }}>
              <div className="callout-title">Correction expliquée</div>
              <Md text={ex.explanation} />
              {hintLevel >= 4 ? (
                <p className="small">La solution avait été affichée : cette réussite est enregistrée mais ne compte pas comme preuve de maîtrise autonome.</p>
              ) : ex.kind === "autonomous" || ex.kind === "validation" || ex.kind === "project" ? (
                <p className="small">Preuve enregistrée. Une révision est planifiée pour consolider la notion.</p>
              ) : null}
            </div>
          )}

          <p className="small muted" style={{ marginTop: 16 }}>
            Les résultats de l'onglet « Tests » sont <strong>testés</strong> ({isSql ? "ta requête et la requête de référence exécutées sur les mêmes données, dans ton navigateur" : "tests déterministes exécutés dans ton navigateur"}). Le tuteur donne un <strong>avis</strong>, séparé et non testé : en cas de désaccord, les tests font foi.{" "}
            <button className="btn sm ghost" onClick={() => setReportOpen(true)}>
              Signaler un problème dans cet exercice
            </button>
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "reset"}
        title="Revenir au code initial ?"
        message={<p>Ton code actuel sera remplacé par le code de départ. Les versions soumises restent disponibles dans l'historique des tentatives.</p>}
        confirmLabel="Réinitialiser"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "solution"}
        title="Afficher la solution ?"
        message={
          <p>
            Tu peux la consulter à tout moment. Une réussite après l'avoir vue restera enregistrée, mais ne comptera pas comme preuve de maîtrise autonome. Essaie peut-être
            d'abord l'aide ciblée.
          </p>
        }
        confirmLabel="Afficher la solution"
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={!!confirm && typeof confirm === "object"}
        title="Restaurer cette tentative ?"
        message={<p>Le code actuel de l'éditeur sera remplacé par celui de la tentative choisie.</p>}
        confirmLabel="Restaurer"
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Historique des tentatives"
        actions={
          <button className="btn" onClick={() => setHistoryOpen(false)}>
            Fermer
          </button>
        }
      >
        <ol className="list-plain" style={{ maxHeight: "50vh", overflow: "auto" }}>
          {attempts.map((a) => (
            <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>
                <StatusBadge status={a.status} /> {a.passedCount}/{a.total} tests · {new Date(a.at).toLocaleString("fr-CH")}
                {a.exerciseVersion !== ex.version && <span className="badge">v{a.exerciseVersion}</span>}
              </span>
              <button className="btn sm" onClick={() => setConfirm({ restore: a.code })}>
                Restaurer
              </button>
            </li>
          ))}
        </ol>
      </Dialog>
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler un problème"
        actions={
          <>
            <button className="btn" onClick={() => setReportOpen(false)}>
              Annuler
            </button>
            <button className="btn primary" onClick={sendReport} disabled={!reportText.trim()}>
              Enregistrer
            </button>
          </>
        }
      >
        <label className="field">
          Qu'est-ce qui te semble faux (énoncé, test, correction) ?
          <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} maxLength={2000} />
        </label>
        <p className="small muted">Le signalement est enregistré dans ce navigateur, avec la version de l'exercice, et inclus dans l'export de tes données.</p>
      </Dialog>
    </section>
  );
}

function SaveIndicator({ s, onRetry }: { s: SaveState; onRetry: () => void }) {
  if (s.kind === "error")
    return (
      <span className="save-state error" role="status">
        ⚠ Non enregistré — nouvel essai dans {Math.round(s.retryIn / 1000)} s
        <button className="btn sm ghost" onClick={onRetry}>
          Réessayer
        </button>
      </span>
    );
  const text =
    s.kind === "saved"
      ? `✓ Enregistré ${new Date(s.at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}`
      : s.kind === "saving" || s.kind === "pending"
        ? "Enregistrement…"
        : s.kind === "conflict"
          ? "⚠ Conflit"
          : "";
  return (
    <span className="save-state" role="status" data-testid="save-state">
      {text}
    </span>
  );
}

function EngineLine({ sql }: { sql?: boolean }) {
  const { runnerState, sqlState } = useApp();
  const s = sql ? sqlState : runnerState;
  const name = sql ? "PostgreSQL" : "Python";
  const text =
    s.kind === "ready"
      ? sql
        ? `${s.pythonVersion} prêt`
        : `Python ${s.pythonVersion} prêt`
      : s.kind === "loading"
        ? `${name} démarre…`
        : s.kind === "busy"
          ? s.message
          : s.kind === "error"
            ? `${name} indisponible`
            : `${name} en veille`;
  return (
    <span className="engine-status" style={{ alignSelf: "center" }} data-testid="engine">
      <span className={`dot ${s.kind === "ready" ? "ok" : s.kind === "error" ? "err" : "busy"}`} aria-hidden="true" />
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: GradeReport["status"] }) {
  const map = {
    passed: ["success", "✓ Réussi"],
    failed: ["warning", "✗ Tests échoués"],
    error: ["danger", "⚠ Erreur"],
    timeout: ["danger", "⏱ Temps dépassé"],
    interrupted: ["", "■ Interrompu"],
  } as const;
  const [tone, label] = map[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

function ErrorCard({ err, onGoto }: { err: PyErrorInfo; onGoto: (l: number) => void }) {
  const e = explainError(err);
  return (
    <div className="error-card" role="alert">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>
          {e.title} <span className="muted small">({err.type})</span>
        </strong>
        {err.line && (
          <button className="btn sm" onClick={() => onGoto(err.line!)}>
            Aller à la ligne {err.line}
          </button>
        )}
      </div>
      <p style={{ margin: "6px 0 0" }}>{e.hint}</p>
      <pre>
        {err.line ? `Ligne ${err.line}${err.text ? ` : ${err.text.trim()}` : ""}\n` : ""}
        {err.summary}
      </pre>
    </div>
  );
}

function ConsoleView({ out, onGoto }: { out: Output; onGoto: (l: number) => void }) {
  if (out.kind === "none")
    return (
      <p className="muted small">
        Exécute ton code pour voir sa sortie ici. <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> exécute, <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Entrée</kbd> vérifie avec les tests.
      </p>
    );
  if (out.kind === "sql") return null;
  if (out.kind === "grade")
    return (
      <>
        <div className="console" data-testid="console">
          {out.report.stdout || <span className="muted">(aucun affichage pendant le chargement du code)</span>}
        </div>
        <p className="small muted">Les résultats des tests sont dans l'onglet « Tests ».</p>
      </>
    );
  return (
    <>
      <div className="console" data-testid="console">
        {out.text || (out.status === "running" ? <span className="muted">Exécution…</span> : <span className="muted">(aucune sortie — utilise print() pour afficher une valeur)</span>)}
      </div>
      {out.status === "timeout" && (
        <div className="callout danger" role="alert">
          <div className="callout-title">Programme arrêté : limite de temps dépassée</div>
          <p>Ton programme tournait encore après la limite de temps. Une boucle while dont la condition ne devient jamais fausse est la cause la plus fréquente.</p>
        </div>
      )}
      {out.status === "interrupted" && <p className="small">■ Exécution interrompue.</p>}
      {out.error && <ErrorCard err={out.error} onGoto={onGoto} />}
      {out.status === "ok" && out.ms !== undefined && <p className="small muted">Terminé en {out.ms} ms.</p>}
    </>
  );
}

function SqlConsoleView({ out, code, limitMs, onGoto }: { out: Output; code: string; limitMs: number; onGoto: (l: number) => void }) {
  if (out.kind === "grade") return <p className="small muted">Les résultats de la vérification sont dans l'onglet « Tests ». « Exécuter » affiche le résultat de ta requête ici.</p>;
  if (out.kind !== "sql")
    return (
      <p className="muted small">
        Exécute ta requête pour voir son résultat ici. <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> exécute, <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Entrée</kbd> vérifie.
      </p>
    );
  if (out.status === "running") return <p className="muted small">Exécution…</p>;
  if (out.status === "timeout")
    return (
      <div className="callout danger" role="alert">
        <div className="callout-title">Requête arrêtée : limite de {limitMs / 1000} s dépassée</div>
        <p>Cause fréquente : une CTE récursive sans condition d'arrêt, ou une jointure sans condition (produit cartésien). Le moteur a été redémarré, les données sont intactes.</p>
      </div>
    );
  if (out.status === "interrupted") return <p className="small">■ Requête interrompue. Le moteur a été redémarré.</p>;
  if (!out.outcome) return <p className="small">Le moteur SQL a rencontré un problème : {out.message ?? "inconnu"}</p>;
  if (!out.outcome.ok) return <SqlErrorCard err={out.outcome.error} sql={code} onGoto={onGoto} />;
  const r = out.outcome.result;
  return (
    <>
      {r.columns.length ? <ResultTable result={r} /> : <p className="small">Requête exécutée, aucune colonne renvoyée.</p>}
      <p className="small muted">Exécutée en {out.outcome.durationMs} ms.</p>
    </>
  );
}

function TestsView({ out, ex, onGoto }: { out: Output; ex: Exercise; onGoto: (l: number) => void }) {
  if (out.kind !== "grade")
    return ex.language === "sql" ? (
      <p className="muted small">
        « Vérifier » exécute ta requête et la requête de référence sur {ex.checks.length} états des données ({ex.checks.filter((c) => c.hidden).length} cachés), puis compare les
        résultats : mêmes colonnes, mêmes lignes{ex.orderBy ? ", et le même ordre (demandé dans l'énoncé)" : " (l'ordre ne compte pas, sauf s'il est demandé)"}. Toute requête
        correcte est acceptée.
      </p>
    ) : (
      <p className="muted small">
        « Vérifier » exécute ta fonction sur {ex.tests.filter((t) => !t.hidden).length} cas visibles et {ex.tests.filter((t) => t.hidden).length} cas cachés. Seul le comportement
        compte : toute solution correcte est acceptée.
      </p>
    );
  const r = out.report;
  if (r.status === "timeout" || r.status === "interrupted")
    return (
      <div className="callout danger" role="alert">
        <div className="callout-title">{r.status === "timeout" ? `Limite de temps dépassée (${ex.timeLimitMs / 1000} s)` : "Vérification interrompue"}</div>
        <p>{ex.language === "sql" ? "Vérifie qu'aucune CTE récursive ne tourne sans fin et que chaque jointure a une condition." : "Vérifie qu'aucune boucle ne tourne indéfiniment."}</p>
      </div>
    );
  const label = ex.language === "sql" ? "vérifications" : "tests";
  return (
    <>
      <div className={`grade-summary ${r.status === "passed" ? "passed" : ""}`} data-testid="grade-summary">
        <span className="big">
          {r.status === "passed"
            ? ex.language === "sql"
              ? "✓ Toutes les vérifications passent"
              : "✓ Tous les tests passent"
            : r.status === "error"
              ? ex.language === "sql"
                ? "⚠ La requête produit une erreur"
                : "⚠ Le code ne peut pas être testé"
              : `✗ ${r.passedCount}/${r.total} ${label} réussi${ex.language === "sql" ? "es" : "s"}`}
        </span>
        <span className="small muted">
          dont {r.hiddenPassed}/{r.hiddenTotal} cachés · {r.durationMs} ms · résultat testé
        </span>
      </div>
      {r.placeholder && <div className="callout warning">Il reste des « ___ » à remplacer dans ton code.</div>}
      {r.loadError && <ErrorCard err={r.loadError} onGoto={onGoto} />}
      {r.status === "error" && r.sqlError && <SqlErrorCard err={r.sqlError} sql={out.code} onGoto={onGoto} />}
      {r.missingFunction && ex.language === "python" && (
        <div className="callout warning">
          La fonction <code>{ex.functionName}</code> n'est pas définie. Vérifie son nom exact (et qu'elle n'est pas indentée dans un autre bloc).
        </div>
      )}
      {r.tests.length > 0 && (
        <ul className="tests">
          {r.tests.map((t) => (
            <li key={t.id} className={t.passed ? "pass" : "fail"}>
              <div className="t-head">
                <span aria-hidden="true">{t.passed ? "✓" : "✗"}</span>
                <span className="sr-only">{t.passed ? "Réussi :" : "Échoué :"}</span>
                <span>{t.label}</span>
                {t.hidden && <span className="badge">caché</span>}
              </div>
              {ex.language === "python" && !t.hidden && !t.passed && (
                <div className="t-detail">{`Appel   : ${ex.functionName}(${t.args})\nAttendu : ${t.expected}\nObtenu  : ${t.got ?? "—"}`}</div>
              )}
              {!t.passed && t.detail && <div className="t-detail">{t.detail}</div>}
              {!t.passed && t.feedback && <div className="small" style={{ marginTop: 4 }}>{t.feedback}</div>}
              {t.error && !t.passed && <ErrorCard err={t.error} onGoto={onGoto} />}
              {t.sqlError && !t.passed && r.status !== "error" && <SqlErrorCard err={t.sqlError} sql={out.code} onGoto={onGoto} />}
              {t.misconception && (
                <div className="small" style={{ marginTop: 4 }}>
                  <strong>Piste :</strong> {misconceptionLabels[t.misconception]}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HelpPanel({ ex, level, onMore, attempts }: { ex: Exercise; level: number; onMore: () => void; attempts: number }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong className="small">Aide progressive · {level}/4</strong>
        {level < 4 && (
          <button className="btn sm" onClick={onMore}>
            {level === 0 ? "Obtenir une première piste" : `Niveau suivant : ${hintLabel[level + 1]}`}
          </button>
        )}
      </div>
      {level === 0 && attempts >= 2 && <p className="small muted">Plusieurs tentatives : une question d'orientation peut t'aider sans te donner la réponse.</p>}
      {ex.hints
        .filter((h) => h.level <= level)
        .map((h) => (
          <div key={h.level} className="hint-box">
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {h.level}. {hintLabel[h.level]}
            </div>
            {h.text.includes("\n") && /^(def |SELECT|WITH)/i.test(h.text.trimStart()) ? <pre>{h.text}</pre> : <Md text={h.text} />}
          </div>
        ))}
    </div>
  );
}

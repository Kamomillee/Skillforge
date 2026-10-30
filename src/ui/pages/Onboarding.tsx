import { useState } from "react";
import { domainById } from "../../content";
import type { DomainId } from "../../content/types";
import { goalLabel, levelLabel, recommendPath } from "../../domain/path";
import type { Goal, LearningPath, Level, Profile } from "../../storage/store";
import { useApp } from "../app-context";
import { navigate } from "../router";

const LEVELS: Level[] = ["aucun", "debutant", "intermediaire", "avance"];
const GOALS: { id: Goal; hint: string }[] = [
  { id: "data", hint: "Python, SQL, analyse et visualisation" },
  { id: "ia", hint: "Applications LLM, RAG, outils" },
  { id: "bi", hint: "Modélisation, DAX, Power BI" },
  { id: "automatisation", hint: "Scripts, API, pipelines" },
  { id: "exploration", hint: "Découvrir les cinq domaines" },
];

/** Diagnostic court et facultatif : tâches de prédiction réelles, pas d'auto-déclaration. */
const DIAG = [
  { id: "d1", code: "x = 3\nx = x + 2\nprint(x * 2)", answer: "10" },
  { id: "d2", code: "total = 0\nfor n in [2, 4, 6]:\n    if n > 3:\n        total += n\nprint(total)", answer: "10" },
  { id: "d3", code: 'notes = {"a": 4, "b": 5}\nnotes["a"] = 6\nprint(len(notes), notes["a"])', answer: "2 6" },
];

export function Welcome() {
  return (
    <div className="page">
      <div className="welcome-hero">
        <div>
          <div className="eyebrow">SkillForge AI · version de formation</div>
          <h1>Comprendre le code que tu écris, pas seulement le faire tourner.</h1>
          <p className="lede">
            Python, SQL, applications LLM, BI et machine learning, appris par la pratique : tu exécutes ton propre code, une correction fondée sur des tests te répond, et ta
            progression repose sur des preuves.
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <a className="btn primary" href="#/onboarding">
              Construire mon parcours (3 min)
            </a>
            <a className="btn" href="#/lecon/py-boucles-accumulateurs">
              Essayer une leçon directement
            </a>
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            Aucun compte ni clé API nécessaire. Ta progression est enregistrée dans ce navigateur ; tu peux l'exporter ou la supprimer à tout moment.
          </p>
        </div>
        <figure className="loop-figure" aria-labelledby="loop-cap">
          <figcaption id="loop-cap" className="eyebrow">
            Chaque notion suit la même boucle
          </figcaption>
          <ol>
            <li>Problème concret</li>
            <li>Intuition</li>
            <li>Schéma interactif</li>
            <li>Démonstration</li>
            <li>Ta prédiction</li>
            <li>Exercice guidé</li>
            <li>Exercice autonome</li>
            <li>Correction expliquée</li>
            <li>Application au projet</li>
            <li>Révision espacée</li>
          </ol>
        </figure>
      </div>
    </div>
  );
}

export function Onboarding() {
  const { store, refresh, data } = useApp();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(
    data.profile ?? {
      name: "",
      programmingLevel: "debutant",
      levels: { python: "debutant", sql: "aucun", stats: "debutant", bi: "aucun" },
      goal: "data",
      hoursPerWeek: 4,
      preferences: { concreteExamples: true, visualFirst: true, shortSessions: false },
      apiKey: "plus-tard",
      createdAt: new Date().toISOString(),
    },
  );
  const [path, setPath] = useState<LearningPath | null>(null);
  const [diag, setDiag] = useState<Record<string, string>>({});
  const [diagDone, setDiagDone] = useState(false);
  const total = 5;

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  function computePath() {
    setPath(recommendPath(p));
    setStep(4);
  }

  function move(i: number, d: -1 | 1) {
    if (!path) return;
    const order = [...path.domainOrder];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setPath({ ...path, domainOrder: order, reasons: [...path.reasons.filter((r) => !r.startsWith("Ordre modifié")), "Ordre modifié par toi."] });
  }

  async function finishDiag() {
    const score = DIAG.filter((d) => (diag[d.id] ?? "").trim().replace(/\s+/g, " ") === d.answer).length;
    await store.addEvent({ type: "diagnostic", data: { score, total: DIAG.length } });
    setDiagDone(true);
  }

  async function finish() {
    await store.saveProfile({ ...p, createdAt: data.profile?.createdAt ?? new Date().toISOString() });
    await store.savePath(path ?? recommendPath(p));
    await refresh();
    navigate("#/tableau");
  }

  const diagScore = DIAG.filter((d) => (diag[d.id] ?? "").trim().replace(/\s+/g, " ") === d.answer).length;

  return (
    <div className="page page-narrow">
      <div className="steps-indicator" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-done={i <= step} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Étape {step + 1} sur {total}
      </p>

      {step === 0 && (
        <section>
          <h1>Faisons connaissance</h1>
          <p className="muted">Tes réponses servent uniquement à proposer un parcours. Tu pourras tout modifier ensuite.</p>
          <label className="field" style={{ marginBottom: 20 }}>
            Prénom ou pseudo <span className="field-hint">facultatif, reste dans ce navigateur</span>
            <input type="text" value={p.name} onChange={(e) => update("name", e.target.value)} maxLength={40} autoComplete="given-name" />
          </label>
          <LevelChoice legend="Ton niveau général en programmation" value={p.programmingLevel} onChange={(v) => update("programmingLevel", v)} name="prog" />
          <Nav onNext={() => setStep(1)} />
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Ton niveau par domaine</h1>
          <p className="muted">Une estimation honnête suffit ; un test pratique pourra la confirmer.</p>
          {(["python", "sql", "stats", "bi"] as const).map((k) => (
            <LevelChoice
              key={k}
              legend={{ python: "Python", sql: "SQL", stats: "Statistiques", bi: "BI / Power BI" }[k]}
              value={p.levels[k]}
              onChange={(v) => update("levels", { ...p.levels, [k]: v })}
              name={k}
            />
          ))}
          <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>Ton objectif et ton rythme</h1>
          <fieldset>
            <legend>Objectif principal</legend>
            <div className="choice-grid">
              {GOALS.map((g) => (
                <label key={g.id} className="choice">
                  <input type="radio" name="goal" checked={p.goal === g.id} onChange={() => update("goal", g.id)} />
                  <span>
                    {goalLabel[g.id]}
                    <small>{g.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row" style={{ gap: 24, alignItems: "flex-start", marginBottom: 24 }}>
            <label className="field">
              Heures disponibles par semaine
              <input type="number" min={1} max={40} value={p.hoursPerWeek} onChange={(e) => update("hoursPerWeek", Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
            </label>
            <label className="field">
              Date cible <span className="field-hint">facultative (ex. début des candidatures)</span>
              <input type="date" value={p.targetDate ?? ""} onChange={(e) => update("targetDate", e.target.value || undefined)} />
            </label>
          </div>
          <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>Comment tu apprends le mieux</h1>
          <fieldset>
            <legend>Préférences pédagogiques</legend>
            {(
              [
                ["concreteExamples", "Des exemples concrets d'entreprise avant la théorie"],
                ["visualFirst", "Des schémas et visualisations interactives"],
                ["shortSessions", "Des séances courtes (15 à 20 minutes)"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="row" style={{ marginBottom: 6 }}>
                <input type="checkbox" checked={p.preferences[k]} onChange={(e) => update("preferences", { ...p.preferences, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Clé API personnelle pour le tuteur IA</legend>
            <div className="choice-grid">
              {(
                [
                  ["non", "Non", "Tout le cours, les exercices et les corrections fonctionnent sans IA."],
                  ["plus-tard", "Peut-être plus tard", "Tu pourras l'ajouter quand le tuteur sera disponible."],
                  ["oui", "Oui", "Le tuteur IA arrive dans une prochaine étape ; aucune clé n'est demandée aujourd'hui."],
                ] as const
              ).map(([v, l, h]) => (
                <label key={v} className="choice">
                  <input type="radio" name="apikey" checked={p.apiKey === v} onChange={() => update("apiKey", v)} />
                  <span>
                    {l}
                    <small>{h}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Nav onBack={() => setStep(2)} onNext={computePath} nextLabel="Voir mon parcours" />
        </section>
      )}

      {step === 4 && path && (
        <section>
          <h1>Ton parcours recommandé{p.name ? `, ${p.name}` : ""}</h1>
          <ul>
            {path.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <h2 style={{ marginTop: 24 }}>Ordre des domaines</h2>
          <p className="small muted">Réordonne comme tu veux. Aucun contenu n'est verrouillé : tu peux ouvrir n'importe quelle leçon disponible.</p>
          <ol className="domain-order">
            {path.domainOrder.map((d: DomainId, i) => (
              <li key={d}>
                <span className="num">{i + 1}</span>
                <span className="grow">
                  <strong>{domainById[d].short}</strong> — {domainById[d].title}
                </span>
                <button className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${domainById[d].short}`}>
                  ↑
                </button>
                <button className="btn sm ghost" onClick={() => move(i, 1)} disabled={i === path.domainOrder.length - 1} aria-label={`Descendre ${domainById[d].short}`}>
                  ↓
                </button>
              </li>
            ))}
          </ol>

          <div className="panel" style={{ marginTop: 24 }}>
            <div className="eyebrow">Facultatif · 2 minutes</div>
            <h2>Mini-diagnostic Python</h2>
            <p className="small muted">Écris exactement ce que chaque programme affiche. Il ne couvre que Python pour l'instant (les autres domaines arrivent).</p>
            {DIAG.map((d, i) => (
              <div key={d.id} style={{ marginBottom: 16 }}>
                <pre className="codeblock">{d.code}</pre>
                <label className="field small">
                  Affichage du programme {i + 1}
                  <input type="text" value={diag[d.id] ?? ""} onChange={(e) => setDiag((x) => ({ ...x, [d.id]: e.target.value }))} disabled={diagDone} style={{ fontFamily: "var(--font-mono)" }} />
                </label>
                {diagDone && (
                  <div className="small">
                    {(diag[d.id] ?? "").trim().replace(/\s+/g, " ") === d.answer ? "✓ Correct" : `✗ Réponse attendue : ${d.answer}`}
                  </div>
                )}
              </div>
            ))}
            {!diagDone ? (
              <button className="btn" onClick={finishDiag}>
                Corriger le diagnostic
              </button>
            ) : (
              <p role="status">
                {diagScore}/{DIAG.length} correct.{" "}
                {diagScore === DIAG.length
                  ? "Tu peux tenter le test de validation de la leçon sur les boucles pour la passer."
                  : "La leçon sur les boucles et accumulateurs est un bon point de départ."}
              </p>
            )}
          </div>

          <div className="row" style={{ marginTop: 24, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setStep(3)}>
              ← Modifier mes réponses
            </button>
            <button className="btn primary" onClick={finish}>
              Enregistrer et commencer
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function LevelChoice({ legend, value, onChange, name }: { legend: string; value: Level; onChange: (v: Level) => void; name: string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="choice-grid">
        {LEVELS.map((l) => (
          <label key={l} className="choice">
            <input type="radio" name={name} checked={value === l} onChange={() => onChange(l)} />
            <span>{levelLabel[l]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continuer" }: { onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
      {onBack ? (
        <button className="btn" onClick={onBack}>
          ← Retour
        </button>
      ) : (
        <span />
      )}
      <button className="btn primary" onClick={onNext}>
        {nextLabel} →
      </button>
    </div>
  );
}

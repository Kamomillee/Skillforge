import { useId, useMemo, useState } from "react";
import {
  documentsPme,
  motsVides,
  questionsReference,
} from "../../content/datasets/documents";
import {
  docsCites,
  pipeline,
  REGLAGES,
  reponseSimulee,
  tableauEvaluation,
  termes,
  termesCommuns,
} from "../../content/llm/rag-core";
import { StepperControls, useStepper } from "./Stepper";

const ETAPES = ["Découpage", "Recherche", "Contexte", "Réponse"] as const;
const titreDoc = new Map(documentsPme.map((d) => [d.id, d.titre]));
const nbMots = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Surligne les mots du passage dont le terme normalisé est commun avec la question (pas seulement par la couleur : <mark>). */
function Surligne({ texte, communs }: { texte: string; communs: string[] }) {
  const set = new Set(communs);
  const parts = texte.split(/([\p{L}\p{N}_]+)/u);
  return (
    <>
      {parts.map((p, k) => {
        const t = termes(p, motsVides)[0];
        return t && set.has(t) ? (
          <mark key={k}>{p}</mark>
        ) : (
          <span key={k}>{p}</span>
        );
      })}
    </>
  );
}

/**
 * Pipeline RAG pas à pas sur les 8 documents synthétiques : découpage → recherche → contexte → réponse.
 * Tous les calculs viennent de content/llm/rag-core.ts (mêmes résultats que les fonctions Python des exercices).
 * La réponse finale est produite par un MODÈLE SIMULÉ (extraction d'une phrase), signalé à l'écran.
 */
export function RagViz({ title }: { title: string }) {
  const s = useStepper(ETAPES.length);
  const id = useId();
  const [question, setQuestion] = useState(questionsReference[0].question);
  const [seuil, setSeuil] = useState<number>(REGLAGES.seuil);
  const [taille, setTaille] = useState<number>(REGLAGES.taille);
  const [textMode, setTextMode] = useState(false);
  const reglages = {
    ...REGLAGES,
    seuil,
    taille,
    chevauchement: Math.min(REGLAGES.chevauchement, taille - 1),
  };
  const r = pipeline(question, documentsPme, motsVides, reglages);
  const parId = new Map(r.index.map((m) => [m.id, m]));
  const motsContexte = r.contexte.reduce(
    (n, cid) => n + nbMots(parId.get(cid)!.texte),
    0,
  );
  const meilleur = r.citations[0] ? parId.get(r.citations[0])! : undefined;
  const reponse = meilleur
    ? reponseSimulee(
        question,
        documentsPme.find((d) => d.id === meilleur.doc)!.texte,
        motsVides,
      )
    : null;

  const evaluation = useMemo(() => {
    const lignes = questionsReference.map((q) => {
      const cites = docsCites(
        pipeline(q.question, documentsPme, motsVides, reglages).citations,
      );
      const t = tableauEvaluation([{ attendu: q.attendu, cites }]);
      const verdict = (Object.keys(t) as (keyof typeof t)[]).find(
        (key) => key !== "questions" && t[key] === 1,
      )!;
      return { ...q, cites, verdict };
    });
    return {
      lignes,
      total: tableauEvaluation(
        lignes.map((l) => ({ attendu: l.attendu, cites: l.cites })),
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seuil, taille]);

  const verdictLabel: Record<string, string> = {
    citation_correcte: "✓ bonne source citée",
    mauvaise_source: "✗ mauvaise source",
    silence_a_tort: "✗ silence à tort",
    abstention_correcte: "✓ abstention justifiée",
    reponse_inventee: "✗ réponse sans appui",
  };

  const resume = [
    `${r.index.length} morceaux de ${reglages.taille} mots (chevauchement ${reglages.chevauchement}) pour ${documentsPme.length} documents.`,
    r.resultats.length
      ? `${r.resultats.length} morceau(x) trouvé(s) : ${r.resultats.map((x) => `${x.id} (score ${x.score})`).join(", ")}.`
      : "Aucun morceau ne partage de terme avec la question.",
    r.contexte.length
      ? `Contexte : ${r.contexte.join(", ")} — ${motsContexte} mots sur ${reglages.budget}.`
      : "Contexte vide.",
    r.abstention
      ? `Abstention : aucun passage n'atteint le seuil de ${seuil}.`
      : `Réponse citant ${r.citations.join(", ")}.`,
  ];

  return (
    <figure
      className="tracer"
      aria-labelledby={`${id}-t`}
      onKeyDown={s.onKey}
      style={{ margin: "16px 0" }}
      data-testid="rag-viz"
    >
      <div
        className="row"
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--line)",
          justifyContent: "space-between",
        }}
      >
        <figcaption id={`${id}-t`} style={{ fontWeight: 650 }}>
          {title}
        </figcaption>
        <button
          className="btn sm ghost"
          aria-pressed={textMode}
          onClick={() => setTextMode((t) => !t)}
        >
          {textMode ? "Vue animée" : "Version texte"}
        </button>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div className="row rag-settings">
          <label className="field small" style={{ flex: "2 1 260px" }}>
            Question
            <input
              type="text"
              list={`${id}-q`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <datalist id={`${id}-q`}>
              {questionsReference.map((q) => (
                <option key={q.question} value={q.question} />
              ))}
            </datalist>
          </label>
          <label className="field small" style={{ flex: "0 1 120px" }}>
            Seuil de citation
            <input
              type="number"
              min={1}
              max={5}
              value={seuil}
              onChange={(e) =>
                setSeuil(Math.max(1, Math.min(5, Number(e.target.value) || 1)))
              }
            />
          </label>
          <label className="field small" style={{ flex: "0 1 140px" }}>
            Taille des morceaux
            <select
              value={taille}
              onChange={(e) => setTaille(Number(e.target.value))}
            >
              {[10, 25, 50].map((t) => (
                <option key={t} value={t}>
                  {t} mots
                </option>
              ))}
            </select>
          </label>
        </div>

        {textMode ? (
          <ol className="small" style={{ marginTop: 8 }}>
            {resume.map((t, k) => (
              <li key={k}>
                <strong>{ETAPES[k]} :</strong> {t}
              </li>
            ))}
            {reponse && (
              <li>Phrase extraite par le modèle simulé : « {reponse} »</li>
            )}
          </ol>
        ) : (
          <>
            <ol className="rag-steps" aria-label="Étapes du pipeline">
              {ETAPES.map((e, k) => (
                <li
                  key={e}
                  aria-current={k === s.i ? "step" : undefined}
                  className={k === s.i ? "current" : k < s.i ? "done" : ""}
                >
                  <span aria-hidden="true">{k + 1}</span> {e}
                </li>
              ))}
            </ol>
            <div className="rag-stage" aria-live="polite">
              {s.i === 0 && (
                <>
                  <p className="small">{resume[0]}</p>
                  <ul className="rag-docs">
                    {documentsPme.map((d) => (
                      <li key={d.id}>
                        <strong>{d.titre}</strong>{" "}
                        <span className="small muted">
                          ({nbMots(d.texte)} mots →{" "}
                          {r.index.filter((m) => m.doc === d.id).length}{" "}
                          morceaux)
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {s.i === 1 && (
                <>
                  <p className="small">
                    Termes cherchés :{" "}
                    <code>
                      {termes(question, motsVides).join(" · ") || "(aucun)"}
                    </code>
                    . Score = nombre de termes communs. On garde les{" "}
                    {REGLAGES.k} meilleurs.
                  </p>
                  {r.resultats.length === 0 ? (
                    <p className="small">
                      Aucun morceau ne partage de terme avec la question.
                    </p>
                  ) : (
                    <ul className="rag-cards">
                      {r.resultats.map((x) => {
                        const m = parId.get(x.id)!;
                        return (
                          <li
                            key={x.id}
                            className={x.score >= seuil ? "fort" : ""}
                          >
                            <div
                              className="row"
                              style={{ justifyContent: "space-between" }}
                            >
                              <span className="small">
                                <strong>{titreDoc.get(m.doc)}</strong> ·{" "}
                                <code>{x.id}</code>
                              </span>
                              <span className="badge">
                                score {x.score}
                                {x.score >= seuil ? " ≥ seuil" : " < seuil"}
                              </span>
                            </div>
                            <p className="small" style={{ margin: "6px 0 0" }}>
                              <Surligne
                                texte={m.texte}
                                communs={termesCommuns(
                                  question,
                                  m.texte,
                                  motsVides,
                                )}
                              />
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              {s.i === 2 && (
                <>
                  <p className="small">
                    Budget de contexte : {REGLAGES.budget} mots. Les passages
                    entrent du plus pertinent au moins pertinent, jusqu'au
                    premier qui dépasserait.
                  </p>
                  <div
                    className="budget-bar"
                    role="img"
                    aria-label={`${motsContexte} mots utilisés sur ${REGLAGES.budget}`}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (motsContexte / REGLAGES.budget) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="small">
                    {motsContexte} / {REGLAGES.budget} mots ·{" "}
                    {r.contexte.length
                      ? r.contexte.map((c) => (
                          <code key={c} style={{ marginRight: 6 }}>
                            {c}
                          </code>
                        ))
                      : "contexte vide"}
                  </p>
                  {r.resultats.filter((x) => !r.contexte.includes(x.id))
                    .length > 0 && (
                    <p className="small muted">
                      Laissé de côté (budget) :{" "}
                      {r.resultats
                        .filter((x) => !r.contexte.includes(x.id))
                        .map((x) => x.id)
                        .join(", ")}
                    </p>
                  )}
                </>
              )}
              {s.i === 3 && (
                <div className="rag-answer" data-testid="rag-answer">
                  <div className="eyebrow">
                    Réponse du modèle simulé (extraction, aucune génération)
                  </div>
                  {r.abstention ? (
                    <p>
                      <strong>Abstention.</strong> Je ne trouve pas cette
                      information dans les documents de la Torréfaction du
                      Léman. Aucun passage n'atteint le seuil de {seuil}{" "}
                      terme(s) commun(s).
                    </p>
                  ) : (
                    <>
                      <p>« {reponse} »</p>
                      <p className="small">
                        Sources :{" "}
                        {r.citations
                          .map((c) => `${titreDoc.get(c.split("#")[0])} [${c}]`)
                          .join(" ; ")}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <details className="rag-eval" style={{ marginTop: 12 }}>
          <summary>
            Évaluer ces réglages sur les {evaluation.total.questions} questions
            de référence : {evaluation.total.citation_correcte} bonnes sources,{" "}
            {evaluation.total.abstention_correcte} abstentions justifiées,{" "}
            {evaluation.total.silence_a_tort} silences à tort,{" "}
            {evaluation.total.reponse_inventee} réponse(s) sans appui
          </summary>
          <div className="result-wrap">
            <table className="result mini eval-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Source attendue</th>
                  <th scope="col">Cité</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.lignes.map((l) => (
                  <tr key={l.question}>
                    <td>{l.question}</td>
                    <td>
                      {l.attendu
                        ? titreDoc.get(l.attendu)
                        : "aucune (hors base)"}
                    </td>
                    <td>
                      {l.cites.length
                        ? l.cites.map((c) => titreDoc.get(c)).join(", ")
                        : "—"}
                    </td>
                    <td>{verdictLabel[l.verdict]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      <StepperControls
        s={s}
        label="Étape du pipeline"
        valueText={`Étape ${s.i + 1} sur ${ETAPES.length} : ${ETAPES[s.i]}`}
      />
    </figure>
  );
}

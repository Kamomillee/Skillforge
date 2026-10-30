import { useEffect, useId, useState } from "react";
import { useApp } from "../app-context";
import { StepperControls, useStepper } from "./Stepper";
import { CATEGORIES, celluleSql, filtres, lireMatrice, matriceSql, MESURES, SEGMENTS, valeur, type Annee, type Cellule, type Matrice, type MesureId } from "./filterContext";

const fmt = (v: number | null, unite: "CHF" | "%") =>
  v === null ? "(vide)" : unite === "CHF" ? `${v.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${v.toLocaleString("fr-CH", { maximumFractionDigits: 1 })} %`;

/**
 * Visuel « matrice » à la Power BI, calculé par PostgreSQL : chaque cellule est la même mesure évaluée
 * dans un contexte de filtre différent. Pas à pas : les filtres de la cellule choisie s'ajoutent un par un.
 */
export function FilterContextViz({ title }: { title: string }) {
  const { sqlRunner } = useApp();
  const id = useId();
  const [annee, setAnnee] = useState<Annee>("2026");
  const [mesure, setMesure] = useState<MesureId>("ca");
  const [sel, setSel] = useState<Cellule>({ categorie: "Café", segment: "particulier" });
  const [m, setM] = useState<Matrice | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [verif, setVerif] = useState<{ sql: string; valeur: string } | null>(null);
  const [textMode, setTextMode] = useState(false);

  const fs = filtres(annee, sel);
  const etapes = [...fs.map((f) => `Filtre : ${f.texte}`), mesure === "part_ca" ? "Évaluer : numérateur, puis dénominateur sans filtre de catégorie (ALL)" : `Évaluer [${MESURES[mesure].label}]`];
  const s = useStepper(etapes.length + 1);
  const actifs = fs.slice(0, Math.min(s.i, fs.length));
  const evalue = s.i > fs.length;

  useEffect(() => {
    let alive = true;
    setM(null);
    sqlRunner.query(matriceSql(annee), 8000, 100).then((r) => {
      if (!alive) return;
      if (r.outcome?.ok) setM(lireMatrice(r.outcome.result.rows));
      else setErreur(r.outcome && !r.outcome.ok ? r.outcome.error.message : "Moteur SQL indisponible.");
    });
    return () => {
      alive = false;
    };
  }, [sqlRunner, annee]);

  useEffect(() => setVerif(null), [annee, mesure, sel]);

  const unite = MESURES[mesure].unite;
  const catFiltre = actifs.find((f) => f.source === "En-tête de ligne");
  const segFiltre = actifs.find((f) => f.source === "En-tête de colonne");
  const dansContexte = (c: Cellule) => (!catFiltre || c.categorie === sel.categorie) && (!segFiltre || c.segment === sel.segment);
  const v = m ? valeur(m, mesure, sel) : null;

  async function verifier() {
    const sql = celluleSql(mesure, annee, sel);
    const r = await sqlRunner.query(sql, 8000, 5);
    setVerif({ sql, valeur: r.outcome?.ok ? String(r.outcome.result.rows[0]?.[0] ?? "NULL") : "erreur" });
  }

  const cellule = (c: Cellule, entete: string) => {
    const choisie = c.categorie === sel.categorie && c.segment === sel.segment;
    const val = m ? valeur(m, mesure, c) : null;
    return (
      <td key={entete} className={`fc-cell ${dansContexte(c) ? "in" : ""} ${choisie ? "sel" : ""}`}>
        <button
          className="fc-btn"
          aria-pressed={choisie}
          aria-label={`${c.categorie ?? "Total catégories"}, ${c.segment ?? "total segments"} : ${fmt(val, unite)}`}
          onClick={() => {
            setSel(c);
            s.go(0);
          }}
        >
          {m ? fmt(val, unite) : "…"}
        </button>
      </td>
    );
  };

  const lignes: (string | null)[] = [...CATEGORIES, null];
  const colonnes: (string | null)[] = [...SEGMENTS, null];

  return (
    <figure className="tracer" aria-labelledby={`${id}-t`} onKeyDown={s.onKey} style={{ margin: "16px 0" }} data-testid="filter-context-viz">
      <div className="row" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
        <figcaption id={`${id}-t`} style={{ fontWeight: 650 }}>
          {title}
        </figcaption>
        <button className="btn sm ghost" aria-pressed={textMode} onClick={() => setTextMode((t) => !t)}>
          {textMode ? "Vue animée" : "Version texte"}
        </button>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div className="row" style={{ gap: 16, alignItems: "end" }}>
          <fieldset className="fc-slicer">
            <legend className="small">Segment (slicer) : année</legend>
            {(["2025", "2026", "toutes"] as Annee[]).map((a) => (
              <label key={a} className="small">
                <input type="radio" name={`${id}-annee`} checked={annee === a} onChange={() => (setAnnee(a), s.go(0))} /> {a === "toutes" ? "Toutes" : a}
              </label>
            ))}
          </fieldset>
          <label className="field small" style={{ flex: "0 1 240px" }}>
            Mesure
            <select value={mesure} onChange={(e) => (setMesure(e.target.value as MesureId), s.go(0))}>
              {(Object.keys(MESURES) as MesureId[]).map((k) => (
                <option key={k} value={k}>
                  {MESURES[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {erreur && <p className="small">Erreur : {erreur}</p>}

        <div className="result-wrap" style={{ maxHeight: "none" }}>
          <table className="result fc-matrix">
            <caption>
              {MESURES[mesure].label} par catégorie et segment client — {annee === "toutes" ? "toutes années" : annee} · commandes non annulées{unite === "CHF" ? ", en CHF" : ""}. Clique une cellule.
            </caption>
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                {colonnes.map((c) => (
                  <th key={c ?? "total"} scope="col" className={`num ${segFiltre && c === sel.segment ? "fc-head-on" : ""}`}>
                    {c ?? "Total"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((cat) => (
                <tr key={cat ?? "total"}>
                  <th scope="row" className={catFiltre && cat === sel.categorie ? "fc-head-on" : ""}>
                    {cat ?? "Total"}
                  </th>
                  {colonnes.map((seg) => cellule({ categorie: cat, segment: seg }, seg ?? "total"))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fc-panel" aria-live="polite">
          <h4 style={{ margin: "8px 0" }}>
            Contexte de filtre de la cellule « {sel.categorie ?? "Total"} × {sel.segment ?? "Total"} »
          </h4>
          {textMode ? (
            <ol className="small">
              {fs.length === 0 && <li>Aucun filtre : toutes les ventes non annulées.</li>}
              {fs.map((f) => (
                <li key={f.texte}>
                  {f.source} : {f.texte}
                </li>
              ))}
              <li>
                Résultat : {MESURES[mesure].label} = {fmt(v, unite)}
                {mesure === "part_ca" && " ; le dénominateur ignore le filtre de catégorie (ALL) mais garde les autres."}
              </li>
            </ol>
          ) : (
            <>
              <ul className="fc-filters">
                <li className="on">Ventes non annulées</li>
                {fs.map((f, k) => (
                  <li key={f.texte} className={k < actifs.length ? "on" : ""}>
                    <span className="small muted">{f.source} · </span>
                    {f.texte}
                    {k >= actifs.length && <span className="sr-only"> (pas encore appliqué)</span>}
                  </li>
                ))}
              </ul>
              <p className="small">
                Étape {s.i + 1}/{etapes.length + 1} : {s.i === 0 ? "on part de toutes les ventes non annulées" : etapes[s.i - 1]}.{" "}
                {!evalue && "Les cellules encadrées restent dans le contexte."}
              </p>
              {evalue && (
                <p data-testid="fc-result">
                  <strong>
                    {MESURES[mesure].label} = {fmt(v, unite)}
                  </strong>
                  {mesure === "part_ca" && sel.categorie && " — numérateur filtré sur la catégorie, dénominateur : toutes catégories (ALL), même segment et même année."}
                  {mesure === "part_ca" && !sel.categorie && " — sur la ligne Total, numérateur et dénominateur sont identiques : 100 %."}
                </p>
              )}
            </>
          )}
          <div className="threshold-grid">
            <div>
              <div className="eyebrow">DAX équivalent (affiché, non exécuté)</div>
              <pre className="codeblock small">{MESURES[mesure].dax}</pre>
            </div>
            <div>
              <div className="eyebrow">SQL exécuté pour cette cellule</div>
              <pre className="codeblock small">{celluleSql(mesure, annee, sel)}</pre>
              <button className="btn sm" onClick={verifier}>
                Exécuter cette requête
              </button>
              {verif && (
                <p className="small" data-testid="fc-verif">
                  PostgreSQL renvoie <strong>{verif.valeur}</strong> ; la matrice affiche {fmt(v, unite)}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <StepperControls s={s} label="Construction du contexte" valueText={`Étape ${s.i + 1} sur ${etapes.length + 1}`} />
    </figure>
  );
}

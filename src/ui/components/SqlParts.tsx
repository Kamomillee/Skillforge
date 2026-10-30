import { useEffect, useState } from "react";
import type { ResultSet, SchemaTable, SqlError } from "../../runtime/sql/engine";
import { explainSqlError, positionToLineCol } from "../../grading/sql-errors";
import { useApp } from "../app-context";

const DISPLAY_LIMIT = 200;

function Cell({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <span className="null-cell">NULL</span>;
  return <>{String(v)}</>;
}

/** Tableau de résultats : NULL affiché en toutes lettres (jamais une simple cellule vide), nombres alignés à droite. */
export function ResultTable({ result, caption }: { result: ResultSet; caption?: string }) {
  const rows = result.rows.slice(0, DISPLAY_LIMIT);
  const numeric = result.columns.map((_, i) => rows.length > 0 && rows.every((r) => r[i] === null || typeof r[i] === "number" || (typeof r[i] === "string" && /^-?\d+(\.\d+)?$/.test(r[i] as string))));
  return (
    <div className="result-wrap">
      <table className="result" data-testid="result-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {result.columns.map((c, i) => (
              <th key={i} scope="col" className={numeric[i] ? "num" : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={numeric[j] ? "num" : undefined}>
                  <Cell v={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        {result.rowCount} ligne{result.rowCount > 1 ? "s" : ""}
        {result.rowCount > rows.length ? ` · ${rows.length} premières affichées` : ""}
        {result.truncated ? " · résultat tronqué par sécurité" : ""}
      </p>
    </div>
  );
}

export function SqlErrorCard({ err, sql, onGoto }: { err: SqlError; sql?: string; onGoto?: (l: number) => void }) {
  const e = explainSqlError(err);
  const pos = sql ? positionToLineCol(sql, err.position) : null;
  return (
    <div className="error-card" role="alert">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>
          {e.title} {err.code && <span className="muted small">(SQLSTATE {err.code})</span>}
        </strong>
        {pos && onGoto && (
          <button className="btn sm" onClick={() => onGoto(pos.line)}>
            Aller à la ligne {pos.line}
          </button>
        )}
      </div>
      <p style={{ margin: "6px 0 0" }}>{e.hint}</p>
      <pre>
        {pos ? `Ligne ${pos.line}, colonne ${pos.col}\n` : ""}
        {err.message}
        {err.hint ? `\nIndication PostgreSQL : ${err.hint}` : ""}
      </pre>
    </div>
  );
}

let schemaCache: SchemaTable[] | null = null;

/** Schéma lu dans PostgreSQL (information_schema), mis en cache pour la session. */
export function useSchema() {
  const { sqlRunner } = useApp();
  const [tables, setTables] = useState<SchemaTable[] | null>(schemaCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (schemaCache) return;
    let alive = true;
    sqlRunner
      .schema()
      .then((t) => {
        if (!t.length) throw new Error("schéma vide");
        schemaCache = t;
        if (alive) setTables(t);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [sqlRunner]);
  return { tables, error };
}

/** Schéma de la base de formation : tables, colonnes, clés, nombre de lignes et aperçu. */
export function SchemaPanel() {
  const { sqlRunner } = useApp();
  const { tables, error } = useSchema();
  const [preview, setPreview] = useState<{ table: string; result?: ResultSet; error?: string } | null>(null);

  async function showPreview(table: string) {
    if (sqlRunner.isBusy) return;
    setPreview({ table });
    const r = await sqlRunner.query(`SELECT * FROM ${table} LIMIT 8`, 8000, 8);
    setPreview(r.outcome?.ok ? { table, result: r.outcome.result } : { table, error: "Aperçu indisponible pour le moment." });
  }

  if (error) return <p className="small muted">Schéma indisponible ({error}). Les requêtes restent possibles.</p>;
  if (!tables) return <p className="small muted">Lecture du schéma…</p>;
  return (
    <div className="schema" data-testid="schema">
      <p className="small muted" style={{ marginTop: 0 }}>
        Base « Torréfaction du Léman » (données synthétiques, PostgreSQL). <abbr title="Primary key, clé primaire">PK</abbr> : identifiant unique de la ligne. « → » : clé
        étrangère (référence vers une autre table). Tes requêtes sont toujours annulées après exécution : la base ne peut pas être abîmée.
      </p>
      <div className="schema-grid">
        {tables.map((t) => (
          <div key={t.name} className="schema-table">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t.name}</strong>
              <span className="small muted">{t.rowCount} lignes</span>
            </div>
            <ul className="list-plain small">
              {t.columns.map((c) => (
                <li key={c.name}>
                  <code>{c.name}</code> <span className="muted">{c.type}</span>
                  {c.pk && <span className="badge">PK</span>}
                  {c.fk && <span className="muted"> → {c.fk}</span>}
                  {c.nullable && !c.pk && <span className="muted"> · peut être NULL</span>}
                </li>
              ))}
            </ul>
            <button className="btn sm ghost" onClick={() => showPreview(t.name)} aria-label={`Aperçu de la table ${t.name}`}>
              Aperçu
            </button>
          </div>
        ))}
      </div>
      {preview && (
        <div style={{ marginTop: 12 }}>
          <strong className="small">Aperçu de {preview.table} (8 premières lignes)</strong>
          {preview.result ? <ResultTable result={preview.result} /> : preview.error ? <p className="small">{preview.error}</p> : <p className="small muted">Chargement…</p>}
        </div>
      )}
    </div>
  );
}

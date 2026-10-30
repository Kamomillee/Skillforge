/**
 * Déroulé pas à pas d'une jointure en boucle imbriquée (nested loop) : pour chaque ligne de gauche,
 * comparer à chaque ligne de droite. Pur et testé contre PostgreSQL (tests/content/sql-*.test.ts).
 */
export type Cell = number | string | null;

export interface JoinStep {
  leftIndex: number;
  /** -1 : étape de fin de ligne gauche (ajout éventuel d'une ligne NULL pour LEFT JOIN). */
  rightIndex: number;
  match: boolean;
  /** Ligne ajoutée au résultat à cette étape (si elle existe). */
  emitted?: Cell[];
  note: string;
  resultSoFar: Cell[][];
}

export function joinSteps(
  left: { columns: string[]; rows: Cell[][] },
  right: { columns: string[]; rows: Cell[][] },
  leftKey: string,
  rightKey: string,
  kind: "inner" | "left",
): JoinStep[] {
  const lk = left.columns.indexOf(leftKey);
  const rk = right.columns.indexOf(rightKey);
  const steps: JoinStep[] = [];
  const result: Cell[][] = [];
  left.rows.forEach((l, li) => {
    let found = 0;
    right.rows.forEach((r, ri) => {
      const match = l[lk] !== null && l[lk] === r[rk];
      let emitted: Cell[] | undefined;
      if (match) {
        found++;
        emitted = [...l, ...r];
        result.push(emitted);
      }
      steps.push({
        leftIndex: li,
        rightIndex: ri,
        match,
        emitted,
        note: match
          ? `${leftKey} ${l[lk]} = ${r[rk]} : correspondance, la paire est ajoutée au résultat.`
          : `${leftKey} ${l[lk]} ≠ ${r[rk]} : pas de correspondance.`,
        resultSoFar: result.map((x) => [...x]),
      });
    });
    if (found === 0) {
      let emitted: Cell[] | undefined;
      if (kind === "left") {
        emitted = [...l, ...right.columns.map(() => null)];
        result.push(emitted);
      }
      steps.push({
        leftIndex: li,
        rightIndex: -1,
        match: false,
        emitted,
        note:
          kind === "left"
            ? `Aucune commande pour ${l[1] ?? l[0]} : LEFT JOIN garde la ligne une fois, avec NULL côté droit.`
            : `Aucune commande pour ${l[1] ?? l[0]} : INNER JOIN ne garde rien pour cette ligne.`,
        resultSoFar: result.map((x) => [...x]),
      });
    }
  });
  return steps;
}

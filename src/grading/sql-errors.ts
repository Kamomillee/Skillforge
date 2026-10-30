import type { SqlError } from "../runtime/sql/engine";

/** Traduction pédagogique des erreurs PostgreSQL (SQLSTATE). Le message original reste affiché. */
export function explainSqlError(e: SqlError): { title: string; hint: string } {
  const m = e.message;
  switch (e.code) {
    case "42601":
      return { title: "Erreur de syntaxe", hint: `PostgreSQL ne comprend pas la requête ${/at or near "([^"]+)"/.exec(m) ? `près de « ${/at or near "([^"]+)"/.exec(m)![1]} »` : ""}. Vérifie l'ordre des clauses (SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT), les virgules entre colonnes et les guillemets simples autour du texte.` };
    case "42703":
      return { title: "Colonne inconnue", hint: "Cette colonne n'existe pas dans les tables citées. Vérifie son nom dans le schéma, et le préfixe de table ou d'alias. Les guillemets doubles servent aux noms de colonnes, les simples aux valeurs texte." };
    case "42P01":
      return { title: "Table inconnue", hint: "Cette table n'existe pas. Consulte la liste des tables à gauche de l'éditeur." };
    case "42803":
      return { title: "Colonne hors agrégation", hint: "Avec GROUP BY, chaque colonne du SELECT doit soit figurer dans le GROUP BY, soit être dans une fonction d'agrégation (SUM, COUNT, AVG…)." };
    case "42702":
      return { title: "Colonne ambiguë", hint: "Plusieurs tables de la jointure ont une colonne de ce nom. Préfixe-la avec le nom ou l'alias de la table (par exemple c.client_id)." };
    case "42883":
      return { title: "Fonction ou opérateur inexistant pour ces types", hint: "Tu combines des types incompatibles (texte et nombre, par exemple) ou la fonction n'existe pas en PostgreSQL." };
    case "42804":
      return { title: "Types incompatibles", hint: "Une expression produit un type différent de celui attendu." };
    case "22P02":
      return { title: "Valeur invalide pour ce type", hint: "Une valeur texte ne peut pas être convertie (par exemple 'abc' en nombre)." };
    case "22012":
      return { title: "Division par zéro", hint: "Utilise NULLIF(dénominateur, 0) pour éviter la division par zéro." };
    case "21000":
      return { title: "Sous-requête à plusieurs lignes", hint: "Une sous-requête utilisée comme valeur unique renvoie plusieurs lignes. Utilise IN, EXISTS ou une agrégation." };
    case "42P20":
      return { title: "Fonction de fenêtre mal placée", hint: "Les fonctions de fenêtre ne sont pas autorisées dans WHERE ou GROUP BY : calcule-les dans une sous-requête ou une CTE." };
    case "42809":
      return { title: "Agrégat mal placé", hint: "Une fonction d'agrégation ne peut pas être utilisée ici." };
    case "SF001":
    case "SF002":
      return { title: "Requête non exécutée", hint: m };
  }
  if (/aggregate functions are not allowed in WHERE/.test(m))
    return { title: "Agrégat dans WHERE", hint: "WHERE filtre les lignes AVANT le regroupement : il ne peut pas utiliser SUM, COUNT… Pour filtrer des groupes, utilise HAVING." };
  if (/cannot insert multiple commands/.test(m)) return { title: "Une seule requête à la fois", hint: "L'atelier exécute une seule instruction SQL. Retire les instructions supplémentaires." };
  if (/read-only/.test(m)) return { title: "Base en lecture seule", hint: "Cet exercice n'autorise que la lecture des données." };
  return { title: "Erreur SQL", hint: "Lis le message de PostgreSQL : il indique souvent la colonne ou le mot-clé en cause." };
}

/** Convertit une position (1-indexée, en caractères) en ligne et colonne. */
export function positionToLineCol(sql: string, position?: number) {
  if (!position) return null;
  const before = sql.slice(0, position - 1);
  const line = before.split("\n").length;
  const col = position - before.lastIndexOf("\n") - 1;
  return { line, col };
}

import type { Lesson, SqlExerciseInput } from "../types";

/** SQL — Module B, leçon 2 : agrégations, GROUP BY et HAVING. */

const C_AGG = "sql.b.agregations";
const C_GROUP = "sql.b.group-by-et-having";

export const exercisesAgregations: SqlExerciseInput[] = [
  {
    id: "sql-agg-ex1-statuts",
    version: 1,
    language: "sql",
    kind: "guided",
    title: "Commandes par statut",
    prompt: "Compte le nombre de commandes pour chaque statut.\n\nColonnes attendues : `statut`, `nb_commandes`. Remplace chaque `___`.",
    dataset: "pme",
    starterCode: `SELECT statut, ___ AS nb_commandes
FROM commandes
GROUP BY ___;`,
    referenceSolution: `SELECT statut, COUNT(*) AS nb_commandes
FROM commandes
GROUP BY statut;`,
    checks: [
      { id: "base", label: "Commandes actuelles", hidden: false, misconception: "colonnes" },
      {
        id: "ajout",
        label: "Une commande ajoutée est comptée",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (950, 1, '2026-10-29', 'annulee');",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Combien de groupes veux-tu obtenir, et quelle colonne les définit ?" },
      { level: 2, text: "GROUP BY crée un groupe par valeur distincte ; une fonction d'agrégation calcule une valeur par groupe." },
      { level: 3, text: "`COUNT(*)` compte les lignes de chaque groupe ; on groupe par `statut`." },
      { level: 4, text: "SELECT statut, COUNT(*) AS nb_commandes\nFROM commandes\nGROUP BY statut;" },
    ],
    explanation: "Chaque valeur distincte de `statut` forme un groupe ; `COUNT(*)` compte les lignes du groupe. L'alias `nb_commandes` nomme la colonne calculée, comme demandé.",
    conceptIds: [C_GROUP, C_AGG],
  },
  {
    id: "sql-agg-ex2-produits-ca",
    version: 1,
    language: "sql",
    kind: "autonomous",
    title: "Produits qui dépassent 1 000 CHF",
    prompt:
      "À partir de `lignes_commande` (toutes les lignes, sans tenir compte du statut pour l'instant), calcule pour chaque produit le nombre d'unités vendues et le chiffre d'affaires (quantité × prix facturé). Ne garde que les produits dont le chiffre d'affaires atteint **au moins 1 000 CHF**, du plus grand au plus petit.\n\nColonnes attendues : `produit_id`, `unites`, `ca`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT produit_id,
       SUM(quantite) AS unites,
       SUM(quantite * prix_unitaire) AS ca
FROM lignes_commande
GROUP BY produit_id
HAVING SUM(quantite * prix_unitaire) >= 1000
ORDER BY ca DESC;`,
    orderBy: ["ca"],
    checks: [
      { id: "base", label: "Ventes actuelles", hidden: false, misconception: "where-having" },
      {
        id: "seuil",
        label: "Un produit qui atteint exactement 1 000 CHF est inclus",
        hidden: true,
        setup: "INSERT INTO produits VALUES (92, 'Test seuil', 'Test', 100, 50); INSERT INTO lignes_commande VALUES (1, 99, 92, 10, 100.00);",
        misconception: "condition-inversee",
      },
      {
        id: "sous-seuil",
        label: "Un produit qui passe sous le seuil disparaît",
        hidden: true,
        setup: "DELETE FROM lignes_commande WHERE produit_id = 14 AND commande_id IN (SELECT commande_id FROM lignes_commande WHERE produit_id = 14 LIMIT 5);",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Le seuil de 1 000 CHF porte-t-il sur une ligne de commande, ou sur le total d'un produit ?" },
      { level: 2, text: "WHERE filtre les lignes AVANT le regroupement ; HAVING filtre les groupes APRÈS le calcul des agrégats." },
      { level: 3, text: "`GROUP BY produit_id`, `SUM(quantite * prix_unitaire) AS ca`, puis `HAVING SUM(quantite * prix_unitaire) >= 1000` et `ORDER BY ca DESC`." },
      {
        level: 4,
        text: "SELECT produit_id,\n       SUM(quantite) AS unites,\n       SUM(quantite * prix_unitaire) AS ca\nFROM lignes_commande\nGROUP BY produit_id\nHAVING SUM(quantite * prix_unitaire) >= 1000\nORDER BY ca DESC;",
      },
    ],
    explanation:
      "La condition porte sur un total par produit : elle ne peut être évaluée qu'après GROUP BY, donc dans HAVING. En PostgreSQL, HAVING ne peut pas utiliser l'alias `ca` (calculé dans SELECT, plus tard dans l'ordre logique) ; ORDER BY, lui, le peut.",
    conceptIds: [C_GROUP, C_AGG],
  },
  {
    id: "sql-agg-ex3-debug-having",
    version: 1,
    language: "sql",
    kind: "debug",
    title: "Débogage : clients fidèles",
    prompt:
      "On cherche les clients ayant au moins **10 commandes non annulées**, avec ce nombre. La requête du collègue produit une erreur. Corrige-la.\n\nColonnes attendues : `client_id`, `nb_commandes`.",
    dataset: "pme",
    starterCode: `SELECT client_id, COUNT(*) AS nb_commandes
FROM commandes
WHERE statut <> 'annulee' AND COUNT(*) >= 10
GROUP BY client_id;`,
    referenceSolution: `SELECT client_id, COUNT(*) AS nb_commandes
FROM commandes
WHERE statut <> 'annulee'
GROUP BY client_id
HAVING COUNT(*) >= 10;`,
    checks: [
      { id: "base", label: "Commandes actuelles", hidden: false, misconception: "where-having" },
      {
        id: "annulees",
        label: "Les commandes annulées ne comptent pas",
        hidden: true,
        setup: "INSERT INTO commandes SELECT 960 + g, 43, '2026-10-01', 'annulee' FROM generate_series(1, 12) AS g;",
        misconception: "statut-annule",
      },
    ],
    hints: [
      { level: 1, text: "Lis le message d'erreur : où une fonction d'agrégation n'est-elle pas autorisée ?" },
      { level: 2, text: "Deux filtres différents : l'un porte sur chaque commande (le statut), l'autre sur chaque groupe (le nombre)." },
      { level: 3, text: "Garde `statut <> 'annulee'` dans WHERE, et déplace `COUNT(*) >= 10` dans un `HAVING` placé après GROUP BY." },
      { level: 4, text: "SELECT client_id, COUNT(*) AS nb_commandes\nFROM commandes\nWHERE statut <> 'annulee'\nGROUP BY client_id\nHAVING COUNT(*) >= 10;" },
    ],
    explanation:
      "WHERE agit ligne par ligne, avant le regroupement : COUNT(*) n'y existe pas encore. HAVING agit sur les groupes. Les deux sont utiles ensemble : WHERE retire les commandes annulées, HAVING garde les clients fidèles.",
    conceptIds: [C_GROUP],
  },
  {
    id: "sql-agg-validation",
    version: 1,
    language: "sql",
    kind: "validation",
    title: "Test de validation : paiements par moyen",
    prompt:
      "Pour chaque moyen de paiement, donne le nombre de paiements et le montant total encaissé, du plus gros total au plus petit.\n\nColonnes attendues : `moyen`, `nb_paiements`, `total`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT moyen, COUNT(*) AS nb_paiements, SUM(montant) AS total
FROM paiements
GROUP BY moyen
ORDER BY total DESC;`,
    orderBy: ["total"],
    checks: [
      { id: "base", label: "Paiements actuels", hidden: false },
      {
        id: "inversion",
        label: "Le classement suit les données",
        hidden: true,
        setup: "INSERT INTO paiements VALUES (900, 1, '2026-10-29', 20000.00, 'facture');",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Quelle colonne définit les groupes ? Quelles deux valeurs calculer par groupe ?" },
      { level: 2, text: "COUNT pour le nombre, SUM pour le total, puis un tri décroissant." },
      { level: 3, text: "`GROUP BY moyen` et `ORDER BY total DESC`." },
      { level: 4, text: "SELECT moyen, COUNT(*) AS nb_paiements, SUM(montant) AS total\nFROM paiements\nGROUP BY moyen\nORDER BY total DESC;" },
    ],
    explanation: "Un groupe par moyen, deux agrégats, un tri sur l'alias.",
    conceptIds: [C_AGG, C_GROUP],
  },
];

export const lessonAgregations: Lesson = {
  id: "sql-requetes-agregations",
  version: 1,
  domain: "sql",
  moduleId: "sql.b",
  title: "Agréger : GROUP BY et HAVING",
  summary: "Résumer des milliers de lignes en quelques chiffres par groupe ; distinguer WHERE et HAVING.",
  estimatedMinutes: 40,
  conceptIds: [C_AGG, C_GROUP],
  prerequisites: ["SELECT, WHERE, ORDER BY"],
  objectives: [
    "Calculer COUNT, SUM, AVG, MIN, MAX sur une table entière ou par groupe.",
    "Choisir la colonne de regroupement selon la question posée (granularité).",
    "Filtrer les lignes avec WHERE et les groupes avec HAVING, et expliquer la différence.",
    "Prévoir l'effet de NULL sur COUNT(*) et COUNT(colonne).",
  ],
  glossary: [
    { term: "agrégat", en: "aggregate function", definition: "Fonction qui résume plusieurs lignes en une valeur : COUNT, SUM, AVG, MIN, MAX." },
    { term: "granularité", en: "grain", definition: "Ce que représente une ligne du résultat : un produit, un client, un mois…" },
    { term: "HAVING", en: "HAVING", definition: "Filtre appliqué aux groupes après le calcul des agrégats." },
  ],
  validationExerciseId: "sql-agg-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : quels produits comptent vraiment ?",
      blocks: [
        {
          type: "text",
          md: "Le gérant veut savoir quels produits génèrent l'essentiel des ventes. La table `lignes_commande` contient des centaines de lignes : une par produit commandé. Il ne veut pas une liste, mais **un total par produit**.",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : faire des piles, puis compter chaque pile",
      blocks: [
        {
          type: "text",
          md: "Imagine les lignes de commande imprimées sur des fiches. **GROUP BY produit_id** les répartit en piles, une par produit. Une [[agrégat|fonction d'agrégation]] calcule ensuite une valeur par pile : le nombre de fiches (`COUNT`), la somme des quantités (`SUM`)…\n\n- **WHERE** retire des fiches **avant** de faire les piles.\n- **HAVING** retire des piles entières **après** le calcul.\n\nLe résultat a une ligne par pile : sa [[granularité]] est le produit.",
        },
        {
          type: "fill-code",
          id: "trous-group-by",
          language: "sql",
          prompt: "Complète la requête : **nombre de lignes de commande** et **quantité totale** par produit, en ne gardant que les produits vendus à **au moins 60 unités**.",
          template: "SELECT produit_id, {{1}}(*) AS nb_lignes, SUM(quantite) AS unites\nFROM lignes_commande\nGROUP BY {{2}}\n{{3}} SUM(quantite) >= 60;",
          blanks: [
            { id: "1", accept: ["COUNT"], hint: "la fonction qui compte des lignes" },
            { id: "2", accept: ["produit_id", "1", "lignes_commande.produit_id"], hint: "la colonne qui définit une pile" },
            { id: "3", accept: ["HAVING"], hint: "le filtre qui s'applique aux piles, après le calcul" },
          ],
          explanation: "COUNT(*) compte les fiches de chaque pile, GROUP BY produit_id fait une pile par produit, HAVING filtre les piles après le calcul de SUM.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Voir le regroupement étape par étape",
      blocks: [
        {
          type: "sql-steps",
          title: "Produits à moins de 20 CHF vendus à au moins 60 unités",
          stages: [
            { clause: "FROM", label: "FROM lignes_commande", sql: "SELECT * FROM lignes_commande", note: "Toutes les lignes de commande." },
            {
              clause: "WHERE",
              label: "WHERE prix_unitaire < 20",
              sql: "SELECT * FROM lignes_commande WHERE prix_unitaire < 20",
              note: "WHERE retire les lignes chères, une par une, avant tout regroupement.",
            },
            {
              clause: "GROUP BY",
              label: "GROUP BY produit_id",
              sql: "SELECT produit_id, COUNT(*) AS lignes_dans_la_pile, array_agg(quantite ORDER BY commande_id) AS quantites_de_la_pile FROM lignes_commande WHERE prix_unitaire < 20 GROUP BY produit_id ORDER BY produit_id",
              note: "Une ligne par produit. Pour la visualisation, on affiche le contenu de chaque pile (array_agg).",
            },
            {
              clause: "HAVING",
              label: "HAVING SUM(quantite) >= 60",
              sql: "SELECT produit_id, SUM(quantite) AS total_unites FROM lignes_commande WHERE prix_unitaire < 20 GROUP BY produit_id HAVING SUM(quantite) >= 60 ORDER BY produit_id",
              note: "HAVING garde seulement les piles dont le total atteint 60.",
            },
            {
              clause: "SELECT",
              label: "SELECT produit_id, SUM(quantite) AS unites",
              sql: "SELECT produit_id, SUM(quantite) AS unites FROM lignes_commande WHERE prix_unitaire < 20 GROUP BY produit_id HAVING SUM(quantite) >= 60",
              note: "SELECT ne peut montrer que la clé de regroupement et des agrégats.",
            },
            {
              clause: "ORDER BY",
              label: "ORDER BY unites DESC",
              sql: "SELECT produit_id, SUM(quantite) AS unites FROM lignes_commande WHERE prix_unitaire < 20 GROUP BY produit_id HAVING SUM(quantite) >= 60 ORDER BY unites DESC",
              note: "Tri final ; l'alias défini dans SELECT est utilisable ici.",
            },
          ],
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : les cinq agrégats",
      blocks: [
        { type: "text", md: "Sans GROUP BY, un agrégat résume **toute** la table en une seule ligne. Exécute, puis ajoute `GROUP BY statut` et `statut` dans le SELECT pour comparer." },
        {
          type: "code",
          language: "sql",
          runnable: true,
          code: `SELECT COUNT(*)            AS nb_commandes,
       MIN(date_commande)  AS premiere,
       MAX(date_commande)  AS derniere
FROM commandes;`,
        },
        {
          type: "chart-question",
          id: "graphique-ca-categorie",
          title: "Chiffre d'affaires par catégorie (commandes non annulées)",
          sql: "SELECT p.categorie, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca\nFROM lignes_commande AS l\nJOIN produits AS p USING (produit_id)\nJOIN commandes AS o USING (commande_id)\nWHERE o.statut <> 'annulee'\nGROUP BY p.categorie\nORDER BY ca DESC;",
          unit: "CHF",
          question: "Les coffrets ont le deuxième chiffre d'affaires. Que peut-on en conclure ?",
          choices: [
            { id: "a", label: "Les coffrets sont la deuxième catégorie la plus rentable." },
            { id: "b", label: "Les coffrets rapportent le deuxième montant de ventes ; leur rentabilité ne se lit pas sur ce graphique." },
            { id: "c", label: "Les coffrets sont la deuxième catégorie la plus vendue en nombre d'unités." },
          ],
          answer: "b",
          explanation:
            "Le graphique mesure des **ventes** (quantité × prix facturé). La rentabilité dépend aussi du coût : calculée avec `cout_unitaire`, la marge du café dépasse celle des coffrets. Et le nombre d'unités est une autre mesure encore. Toujours vérifier **ce que mesure** l'axe avant de conclure.",
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : COUNT et NULL",
      blocks: [
        { type: "text", md: "Rappel : 44 clients, dont 7 sans ville renseignée ; les autres se répartissent entre 6 villes." },
        {
          type: "prediction",
          id: "pred-count-null",
          question: "Que renvoie cette requête ?",
          code: "SELECT COUNT(*), COUNT(ville), COUNT(DISTINCT ville)\nFROM clients;",
          choices: [
            { id: "a", label: "44 · 37 · 6" },
            { id: "b", label: "44 · 44 · 7" },
            { id: "c", label: "37 · 37 · 6" },
            { id: "d", label: "44 · 37 · 7" },
          ],
          answer: "a",
          explanation: "COUNT(*) compte les lignes (44). COUNT(ville) ignore les NULL (37). COUNT(DISTINCT ville) compte les valeurs différentes non NULL (6).",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "sql-agg-ex1-statuts" }] },
    { id: "autonome", stage: "autonome", title: "Exercice autonome", blocks: [{ type: "exercise", exerciseId: "sql-agg-ex2-produits-ca" }] },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "sql-agg-ex3-debug-having" },
        {
          type: "explain",
          id: "explain-where-having",
          prompt: "Explique la différence entre WHERE et HAVING à quelqu'un qui débute, avec un exemple sur la table commandes.",
          criteria: ["Je situe WHERE avant le regroupement.", "Je situe HAVING après le calcul des agrégats.", "Je donne un exemple pour chacun.", "J'explique pourquoi COUNT(*) est interdit dans WHERE."],
        },
      ],
    },
    {
      id: "projet",
      stage: "projet",
      title: "Dans le projet",
      blocks: [
        {
          type: "project",
          projectId: "sql-pme",
          title: "Base de données d'une PME",
          md: "Le chiffre d'affaires mensuel et le panier moyen par segment, demandés par la direction, sont des agrégations. La question de la **granularité** (une ligne par mois ? par commande ?) est la première décision à noter dans ton journal.",
        },
      ],
    },
    { id: "revision", stage: "revision", title: "Révision", blocks: [{ type: "text", md: "La révision espacée reprendra le test de validation de cette leçon." }] },
  ],
};

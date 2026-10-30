import type { Lesson, SqlExerciseInput } from "../types";

/**
 * SQL — Module B (requêtes), leçon 1 : interroger une table.
 * Dialecte : PostgreSQL 18 (PGlite). Les exercices sont vérifiés par tests/content/sql-*.test.ts.
 */

const C_SELECT = "sql.b.select-from-et-where";
const C_ORDER = "sql.b.order-by-et-limit";
const C_NULL = "sql.b.logique-a-trois-valeurs-avec-null";

export const exercisesSelect: SqlExerciseInput[] = [
  {
    id: "sql-select-ex1-produits-chers",
    version: 1,
    language: "sql",
    kind: "guided",
    title: "Produits de plus de 40 CHF",
    prompt:
      "Liste les produits dont le prix catalogue est **strictement supérieur à 40 CHF**, du plus cher au moins cher.\n\nColonnes attendues : `produit_id`, `nom`, `prix_unitaire`. Remplace chaque `___`.",
    dataset: "pme",
    starterCode: `SELECT produit_id, nom, prix_unitaire
FROM ___
WHERE ___
ORDER BY ___;`,
    referenceSolution: `SELECT produit_id, nom, prix_unitaire
FROM produits
WHERE prix_unitaire > 40
ORDER BY prix_unitaire DESC;`,
    orderBy: ["prix_unitaire"],
    checks: [
      { id: "base", label: "Catalogue actuel", hidden: false, misconception: "ordre-tri" },
      {
        id: "egal-40",
        label: "Un produit à exactement 40 CHF est exclu",
        hidden: true,
        setup: "INSERT INTO produits VALUES (90, 'Produit test à 40', 'Test', 40.00, 10.00);",
        misconception: "condition-inversee",
      },
      {
        id: "nouveau",
        label: "Un nouveau produit cher apparaît (pas de valeurs codées en dur)",
        hidden: true,
        setup: "INSERT INTO produits VALUES (91, 'Machine espresso', 'Accessoires', 499.00, 260.00);",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Dans quelle table se trouvent les prix catalogue ? Et quel opérateur traduit « strictement supérieur » ?" },
      { level: 2, text: "FROM indique la table ; WHERE garde les lignes pour lesquelles la condition est vraie ; ORDER BY … DESC trie du plus grand au plus petit." },
      { level: 3, text: "`FROM produits`, `WHERE prix_unitaire > 40`, `ORDER BY prix_unitaire DESC`." },
      { level: 4, text: "SELECT produit_id, nom, prix_unitaire\nFROM produits\nWHERE prix_unitaire > 40\nORDER BY prix_unitaire DESC;" },
    ],
    explanation:
      "`>` exclut 40 exactement (`>=` l'inclurait). Sans `DESC`, ORDER BY trie par ordre croissant. Sans ORDER BY, PostgreSQL ne garantit **aucun** ordre : c'est pourquoi la correction ne vérifie l'ordre que lorsque l'énoncé le demande.",
    conceptIds: [C_SELECT],
  },
  {
    id: "sql-select-ex2-fiches-incompletes",
    version: 1,
    language: "sql",
    kind: "autonomous",
    title: "Fiches clients incomplètes",
    prompt:
      "Le service client veut compléter les fiches : liste les clients dont la **ville** ou l'**e-mail** n'est pas renseigné (valeur NULL), de l'inscription la plus ancienne à la plus récente.\n\nColonnes attendues : `client_id`, `nom`, `ville`, `email`, `date_inscription`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT client_id, nom, ville, email, date_inscription
FROM clients
WHERE ville IS NULL OR email IS NULL
ORDER BY date_inscription;`,
    orderBy: ["date_inscription"],
    checks: [
      { id: "base", label: "Clients actuels", hidden: false, misconception: "null-egalite" },
      {
        id: "les-deux",
        label: "Un client sans ville NI e-mail n'apparaît qu'une fois",
        hidden: true,
        setup: "INSERT INTO clients VALUES (100, 'Client sans rien', NULL, NULL, 'particulier', '2024-12-31');",
      },
      {
        id: "complet",
        label: "Une fiche complétée disparaît de la liste",
        hidden: true,
        setup: "UPDATE clients SET ville = 'Genève' WHERE ville IS NULL AND client_id = (SELECT min(client_id) FROM clients WHERE ville IS NULL);",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Que renvoie la comparaison `ville = NULL` en SQL : vrai, faux… ou autre chose ?" },
      { level: 2, text: "En SQL, NULL signifie « inconnu ». Toute comparaison avec `=` ou `<>` donne « inconnu », jamais vrai. Il existe un opérateur dédié pour tester l'absence de valeur." },
      { level: 3, text: "Utilise `IS NULL`, deux conditions reliées par `OR`, puis `ORDER BY date_inscription` (croissant par défaut)." },
      {
        level: 4,
        text: "SELECT client_id, nom, ville, email, date_inscription\nFROM clients\nWHERE ville IS NULL OR email IS NULL\nORDER BY date_inscription;",
      },
    ],
    explanation:
      "`IS NULL` est le seul test fiable de l'absence de valeur : `ville = NULL` vaut NULL (inconnu), donc la ligne n'est jamais retenue. `OR` garde un client à qui il manque l'un **ou** l'autre, et une seule fois même s'il manque les deux.",
    conceptIds: [C_NULL, C_SELECT, C_ORDER],
  },
  {
    id: "sql-select-ex3-debug-priorite",
    version: 1,
    language: "sql",
    kind: "debug",
    title: "Débogage : trop de clients invités",
    prompt:
      "Pour un événement B2B, on veut les clients **entreprises** situés à **Genève ou Carouge**. La requête du collègue renvoie aussi des particuliers. Exécute-la, comprends pourquoi, puis corrige-la.\n\nColonnes attendues : `client_id`, `nom`, `ville`.",
    dataset: "pme",
    starterCode: `SELECT client_id, nom, ville
FROM clients
WHERE segment = 'entreprise' AND ville = 'Genève' OR ville = 'Carouge';`,
    referenceSolution: `SELECT client_id, nom, ville
FROM clients
WHERE segment = 'entreprise' AND (ville = 'Genève' OR ville = 'Carouge');`,
    checks: [
      { id: "base", label: "Clients actuels", hidden: false, misconception: "condition-inversee" },
      {
        id: "nouvelle-entreprise",
        label: "Une entreprise de Carouge est incluse",
        hidden: true,
        setup: "INSERT INTO clients VALUES (101, 'Fiduciaire Carouge SA', 'fid@exemple.ch', 'Carouge', 'entreprise', '2026-03-01');",
      },
    ],
    hints: [
      { level: 1, text: "Les lignes en trop sont-elles toutes dans la même ville ? Qu'ont-elles en commun ?" },
      { level: 2, text: "Comme × avant + en mathématiques, AND est évalué avant OR. La condition est donc lue comme (entreprise ET Genève) OU (Carouge)." },
      { level: 3, text: "Ajoute des parenthèses autour de `ville = 'Genève' OR ville = 'Carouge'`, ou utilise `ville IN ('Genève', 'Carouge')`." },
      { level: 4, text: "SELECT client_id, nom, ville\nFROM clients\nWHERE segment = 'entreprise' AND (ville = 'Genève' OR ville = 'Carouge');" },
    ],
    explanation:
      "AND a priorité sur OR. Sans parenthèses, tous les clients de Carouge passent, entreprises ou non. `ville IN ('Genève', 'Carouge')` est une écriture équivalente et plus lisible.",
    conceptIds: [C_SELECT],
  },
  {
    id: "sql-select-validation",
    version: 1,
    language: "sql",
    kind: "validation",
    title: "Test de validation : dernières livraisons",
    prompt:
      "Affiche les **5 commandes livrées** les plus récentes. En cas d'égalité de date, la commande au plus grand numéro passe en premier.\n\nColonnes attendues : `commande_id`, `client_id`, `date_commande`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT commande_id, client_id, date_commande
FROM commandes
WHERE statut = 'livree'
ORDER BY date_commande DESC, commande_id DESC
LIMIT 5;`,
    orderBy: ["date_commande", "commande_id"],
    checks: [
      { id: "base", label: "Commandes actuelles", hidden: false, misconception: "ordre-tri" },
      {
        id: "egalite",
        label: "Départage des égalités de date",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (900, 1, '2026-10-30', 'livree'), (901, 2, '2026-10-30', 'livree'), (902, 3, '2026-10-30', 'annulee');",
        misconception: "statut-annule",
      },
    ],
    hints: [
      { level: 1, text: "Quatre opérations : filtrer, trier, départager, limiter. Dans quel ordre les écrire ?" },
      { level: 2, text: "ORDER BY accepte plusieurs colonnes : la seconde ne sert qu'en cas d'égalité sur la première." },
      { level: 3, text: "`WHERE statut = 'livree'`, `ORDER BY date_commande DESC, commande_id DESC`, `LIMIT 5`." },
      { level: 4, text: "SELECT commande_id, client_id, date_commande\nFROM commandes\nWHERE statut = 'livree'\nORDER BY date_commande DESC, commande_id DESC\nLIMIT 5;" },
    ],
    explanation: "LIMIT sans tri complet donne un résultat instable : en cas d'égalité, PostgreSQL peut renvoyer n'importe laquelle des lignes ex aequo. Le second critère rend le résultat déterministe.",
    conceptIds: [C_ORDER, C_SELECT],
  },
];

export const lessonSelect: Lesson = {
  id: "sql-requetes-select",
  version: 1,
  domain: "sql",
  moduleId: "sql.b",
  title: "Interroger une table : SELECT, WHERE, ORDER BY",
  summary: "Filtrer, trier et limiter des lignes ; comprendre NULL et l'ordre logique d'une requête.",
  estimatedMinutes: 40,
  conceptIds: [C_SELECT, C_ORDER, C_NULL],
  prerequisites: ["Tables, lignes et colonnes (notion intuitive)"],
  objectives: [
    "Écrire une requête qui filtre (WHERE), trie (ORDER BY) et limite (LIMIT) les lignes d'une table.",
    "Expliquer l'ordre logique d'exécution d'une requête et ses résultats intermédiaires.",
    "Tester l'absence de valeur avec IS NULL et prévoir l'effet de NULL dans une condition.",
    "Rendre un classement déterministe en départageant les égalités.",
  ],
  glossary: [
    { term: "requête", en: "query", definition: "Instruction qui décrit le résultat voulu ; le moteur de base de données choisit comment le calculer." },
    { term: "clause", en: "clause", definition: "Partie d'une requête introduite par un mot-clé : SELECT, FROM, WHERE, ORDER BY…" },
    { term: "NULL", en: "NULL", definition: "Marqueur d'une valeur absente ou inconnue. Ce n'est ni 0 ni une chaîne vide." },
    { term: "logique à trois valeurs", en: "three-valued logic", definition: "En SQL, une condition peut être vraie, fausse ou inconnue (quand elle implique NULL). WHERE ne garde que les lignes « vraies »." },
    { term: "dialecte", en: "SQL dialect", definition: "Variante de SQL propre à un moteur. Ici : PostgreSQL 18." },
  ],
  validationExerciseId: "sql-select-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : préparer une invitation",
      blocks: [
        {
          type: "text",
          md: "La Torréfaction du Léman organise une dégustation à Genève. La responsable marketing te demande la liste des clients genevois, avec leur e-mail, triée par nom.\n\nLes données sont dans une base relationnelle. Tu ne vas pas « programmer » la recherche ligne par ligne comme en Python : tu vas **décrire le résultat** avec une [[requête]] SQL.",
        },
        {
          type: "callout",
          tone: "info",
          title: "La base de formation",
          md: "Six tables d'une PME fictive (données synthétiques) : `clients`, `produits`, `commandes`, `lignes_commande`, `paiements`, `retours`. Le schéma est visible à côté de l'éditeur SQL. Chaque requête s'exécute dans une transaction annulée : tu ne peux rien casser.",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : écrire dans un ordre, exécuter dans un autre",
      blocks: [
        {
          type: "text",
          md: "On **écrit** `SELECT … FROM … WHERE … ORDER BY … LIMIT`, mais le moteur raisonne dans un autre ordre :\n\n- **FROM** : quelle table ?\n- **WHERE** : quelles lignes garder ?\n- **SELECT** : quelles colonnes montrer ?\n- **ORDER BY** : dans quel ordre ?\n- **LIMIT** : combien de lignes au maximum ?\n\nCet ordre logique explique beaucoup d'erreurs, par exemple pourquoi un alias défini dans SELECT n'est pas encore connu dans WHERE.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Voir chaque étape de la requête",
      blocks: [
        {
          type: "text",
          md: "Chaque étape ci-dessous est **réellement exécutée** par PostgreSQL dans ton navigateur. Observe le nombre de lignes et de colonnes diminuer.",
        },
        {
          type: "sql-steps",
          title: "Ordre logique : clients genevois",
          stages: [
            { clause: "FROM", label: "FROM clients", sql: "SELECT * FROM clients", note: "Point de départ : toutes les lignes et toutes les colonnes de la table." },
            {
              clause: "WHERE",
              label: "WHERE ville = 'Genève'",
              sql: "SELECT * FROM clients WHERE ville = 'Genève'",
              note: "Seules les lignes pour lesquelles la condition est VRAIE sont gardées. Les villes NULL sont écartées (condition « inconnue »).",
            },
            { clause: "SELECT", label: "SELECT nom, email", sql: "SELECT nom, email FROM clients WHERE ville = 'Genève'", note: "On ne garde que les colonnes demandées." },
            { clause: "ORDER BY", label: "ORDER BY nom", sql: "SELECT nom, email FROM clients WHERE ville = 'Genève' ORDER BY nom", note: "Le tri n'intervient qu'à la fin. Sans ORDER BY, l'ordre n'est pas garanti." },
            {
              clause: "LIMIT",
              label: "LIMIT 5",
              sql: "SELECT nom, email FROM clients WHERE ville = 'Genève' ORDER BY nom LIMIT 5",
              note: "On coupe après 5 lignes, une fois le tri fait.",
            },
          ],
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : expressions et alias",
      blocks: [
        {
          type: "text",
          md: "SELECT peut aussi **calculer**. Ici, la marge unitaire de chaque produit, nommée avec un alias (`AS`). Exécute, puis essaie de filtrer `WHERE marge_unitaire > 20` : l'erreur obtenue s'explique par l'ordre logique (l'alias n'existe pas encore au moment du WHERE).",
        },
        {
          type: "code",
          language: "sql",
          runnable: true,
          code: `SELECT nom,
       prix_unitaire,
       cout_unitaire,
       prix_unitaire - cout_unitaire AS marge_unitaire
FROM produits
ORDER BY marge_unitaire DESC
LIMIT 5;`,
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : le piège de NULL",
      blocks: [
        {
          type: "text",
          md: "La table `clients` contient 44 clients : 13 à Genève et 7 dont la ville n'est pas renseignée (NULL).",
        },
        {
          type: "prediction",
          id: "pred-null-different",
          question: "Combien de lignes compte ce résultat ?",
          code: "SELECT count(*) FROM clients WHERE ville <> 'Genève';",
          choices: [
            { id: "a", label: "31" },
            { id: "b", label: "24" },
            { id: "c", label: "44" },
            { id: "d", label: "13" },
          ],
          answer: "b",
          explanation:
            "Pour les 7 clients sans ville, `NULL <> 'Genève'` ne vaut ni vrai ni faux, mais « inconnu ». WHERE ne garde que les lignes vraies : 44 − 13 − 7 = 24. C'est la logique à trois valeurs.",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "sql-select-ex1-produits-chers" }] },
    {
      id: "autonome",
      stage: "autonome",
      title: "Exercice autonome",
      blocks: [
        { type: "text", md: "La correction compare ton **résultat** à celui de la solution, sur les données actuelles et sur des données modifiées (cas cachés). Toute requête correcte est acceptée." },
        { type: "exercise", exerciseId: "sql-select-ex2-fiches-incompletes" },
      ],
    },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "sql-select-ex3-debug-priorite" },
        {
          type: "explain",
          id: "explain-null",
          prompt: "Explique à un collègue pourquoi `WHERE email = NULL` ne renvoie jamais de ligne, et ce qu'il faut écrire à la place.",
          criteria: [
            "Je dis ce que représente NULL.",
            "J'explique que la comparaison donne « inconnu », pas vrai.",
            "Je cite IS NULL / IS NOT NULL.",
            "Je donne un exemple tiré de la table clients.",
          ],
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
          md: "Le projet SQL te demande de répondre à des questions de la direction : factures impayées, chiffre d'affaires mensuel, produits les plus rentables. Les filtres, tris et la gestion de NULL de cette leçon y servent directement.",
        },
      ],
    },
    {
      id: "revision",
      stage: "revision",
      title: "Révision",
      blocks: [{ type: "text", md: "Après la réussite de l'exercice autonome, une révision est planifiée (1, 3 puis 7 jours) sur le test de validation, dans un éditeur vierge." }],
    },
  ],
};

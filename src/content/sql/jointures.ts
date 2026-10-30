import type { Lesson, SqlExerciseInput } from "../types";

/** SQL — Module B, leçon 3 : jointures INNER / LEFT et doublons créés par les jointures. */

const C_JOIN = "sql.b.inner-join-et-left-join";
const C_DUP = "sql.b.doublons-crees-par-les-jointures";

/**
 * Petites tables utilisées par la visualisation de jointure. Les résultats affichés sont calculés
 * par l'algorithme de la visualisation ET vérifiés contre PostgreSQL dans les tests.
 */
export const joinVizData = {
  clients: {
    columns: ["client_id", "nom"],
    rows: [
      [1, "Léa"],
      [2, "Noah"],
      [3, "Emma"],
      [4, "Luca"],
    ] as (number | string)[][],
  },
  commandes: {
    columns: ["commande_id", "client_id", "montant"],
    rows: [
      [101, 1, 40],
      [102, 2, 25],
      [103, 1, 60],
      [104, 3, 15],
      [105, 5, 30],
    ] as (number | string)[][],
  },
};

export const exercisesJointures: SqlExerciseInput[] = [
  {
    id: "sql-join-ex1-commandes-clients",
    version: 1,
    language: "sql",
    kind: "guided",
    title: "Commandes d'octobre 2026 avec le nom du client",
    prompt:
      "Affiche les commandes passées en **octobre 2026** avec le nom du client.\n\nColonnes attendues : `commande_id`, `date_commande`, `nom`. Complète la condition de jointure.",
    dataset: "pme",
    starterCode: `SELECT o.commande_id, o.date_commande, c.nom
FROM commandes AS o
JOIN clients AS c ON ___ = ___
WHERE o.date_commande >= '2026-10-01' AND o.date_commande < '2026-11-01';`,
    referenceSolution: `SELECT o.commande_id, o.date_commande, c.nom
FROM commandes AS o
JOIN clients AS c ON c.client_id = o.client_id
WHERE o.date_commande >= '2026-10-01' AND o.date_commande < '2026-11-01';`,
    checks: [
      { id: "base", label: "Commandes actuelles", hidden: false },
      {
        id: "nouvelle",
        label: "Une nouvelle commande d'octobre apparaît avec le bon nom",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (970, 43, '2026-10-31', 'expediee');",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Quelle colonne des deux tables désigne le même client ?" },
      { level: 2, text: "La clé étrangère `commandes.client_id` référence la clé primaire `clients.client_id`. La condition ON relie ces deux colonnes." },
      { level: 3, text: "Avec les alias : `ON c.client_id = o.client_id`." },
      { level: 4, text: "SELECT o.commande_id, o.date_commande, c.nom\nFROM commandes AS o\nJOIN clients AS c ON c.client_id = o.client_id\nWHERE o.date_commande >= '2026-10-01' AND o.date_commande < '2026-11-01';" },
    ],
    explanation:
      "La jointure associe chaque commande à **la** ligne client dont l'identifiant correspond. L'intervalle `>= '2026-10-01' AND < '2026-11-01'` est plus sûr que `BETWEEN … '2026-10-31'` dès qu'une colonne contient aussi l'heure.",
    conceptIds: [C_JOIN],
  },
  {
    id: "sql-join-ex2-commandes-par-client",
    version: 1,
    language: "sql",
    kind: "autonomous",
    title: "Nombre de commandes par client, sans oublier personne",
    prompt:
      "Pour **chaque client**, y compris ceux qui n'ont jamais commandé, donne le nombre de commandes (toutes, quel que soit le statut). Un client sans commande doit apparaître avec **0**.\n\nColonnes attendues : `client_id`, `nom`, `nb_commandes`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT c.client_id, c.nom, COUNT(o.commande_id) AS nb_commandes
FROM clients AS c
LEFT JOIN commandes AS o ON o.client_id = c.client_id
GROUP BY c.client_id, c.nom;`,
    checks: [
      { id: "base", label: "Clients actuels (dont 2 sans commande)", hidden: false, misconception: "inner-au-lieu-de-left" },
      {
        id: "nouveau-client",
        label: "Un nouveau client sans commande compte 0",
        hidden: true,
        setup: "INSERT INTO clients VALUES (102, 'Nouveau client', NULL, 'Nyon', 'particulier', '2026-10-29');",
        misconception: "count-etoile-left",
      },
      {
        id: "homonymes",
        label: "Deux clients homonymes restent distincts",
        hidden: true,
        setup: "UPDATE clients SET nom = 'Léa Rochat' WHERE client_id IN (1, 2);",
        misconception: "group-by-granularite",
      },
    ],
    hints: [
      { level: 1, text: "Avec une jointure classique, que deviennent les clients qui n'ont aucune commande correspondante ?" },
      { level: 2, text: "LEFT JOIN garde toutes les lignes de la table de gauche ; les colonnes de droite valent NULL quand rien ne correspond. Que compte COUNT(*) sur une telle ligne ?" },
      { level: 3, text: "`FROM clients c LEFT JOIN commandes o ON o.client_id = c.client_id`, `COUNT(o.commande_id)` (ignore les NULL), `GROUP BY c.client_id, c.nom`." },
      {
        level: 4,
        text: "SELECT c.client_id, c.nom, COUNT(o.commande_id) AS nb_commandes\nFROM clients AS c\nLEFT JOIN commandes AS o ON o.client_id = c.client_id\nGROUP BY c.client_id, c.nom;",
      },
    ],
    explanation:
      "INNER JOIN ferait disparaître les clients sans commande. Avec LEFT JOIN, ils restent, avec des colonnes de commande à NULL : `COUNT(*)` compterait cette ligne (1), alors que `COUNT(o.commande_id)` ignore le NULL (0). On groupe par l'identifiant, pas seulement par le nom, car deux clients peuvent porter le même nom.",
    conceptIds: [C_JOIN],
  },
  {
    id: "sql-join-ex3-debug-doublons",
    version: 1,
    language: "sql",
    kind: "debug",
    title: "Débogage : des montants payés gonflés",
    prompt:
      "On veut le **total payé par client**. Le total renvoyé par la requête du collègue est trop élevé pour beaucoup de clients. Trouve pourquoi et corrige.\n\nColonnes attendues : `client_id`, `total_paye`.",
    dataset: "pme",
    starterCode: `SELECT o.client_id, SUM(p.montant) AS total_paye
FROM commandes AS o
JOIN lignes_commande AS l ON l.commande_id = o.commande_id
JOIN paiements AS p ON p.commande_id = o.commande_id
GROUP BY o.client_id;`,
    referenceSolution: `SELECT o.client_id, SUM(p.montant) AS total_paye
FROM commandes AS o
JOIN paiements AS p ON p.commande_id = o.commande_id
GROUP BY o.client_id;`,
    checks: [
      { id: "base", label: "Paiements actuels", hidden: false, misconception: "jointure-doublons" },
      {
        id: "multi-lignes",
        label: "Une commande de 4 lignes et un paiement unique",
        hidden: true,
        setup:
          "INSERT INTO commandes VALUES (980, 43, '2026-10-20', 'livree'); INSERT INTO lignes_commande VALUES (980,1,1,1,12.90),(980,2,2,1,15.50),(980,3,3,1,13.90),(980,4,4,1,24.00); INSERT INTO paiements VALUES (980, 980, '2026-10-20', 66.30, 'carte');",
        misconception: "jointure-doublons",
      },
    ],
    hints: [
      { level: 1, text: "Pour une commande de 3 lignes, combien de lignes la jointure produit-elle avec son paiement ?" },
      { level: 2, text: "Joindre une table de détail (plusieurs lignes par commande) multiplie les lignes : le même paiement est répété, puis additionné plusieurs fois." },
      { level: 3, text: "La table lignes_commande n'est pas nécessaire pour cette question : retire sa jointure." },
      { level: 4, text: "SELECT o.client_id, SUM(p.montant) AS total_paye\nFROM commandes AS o\nJOIN paiements AS p ON p.commande_id = o.commande_id\nGROUP BY o.client_id;" },
    ],
    explanation:
      "Une jointure produit une ligne par **paire** correspondante. Une commande de 3 lignes jointe à son paiement donne 3 lignes, chacune avec le même montant : SUM le compte 3 fois. Règle pratique : avant d'agréger, demande-toi quelle est la granularité de chaque table jointe.",
    conceptIds: [C_DUP, C_JOIN],
  },
  {
    id: "sql-join-validation",
    version: 1,
    language: "sql",
    kind: "validation",
    title: "Test de validation : produits jamais vendus",
    prompt: "Liste les produits du catalogue qui n'apparaissent dans **aucune** ligne de commande.\n\nColonnes attendues : `produit_id`, `nom`.",
    dataset: "pme",
    starterCode: "-- Écris ta requête ici\n",
    referenceSolution: `SELECT p.produit_id, p.nom
FROM produits AS p
LEFT JOIN lignes_commande AS l ON l.produit_id = p.produit_id
WHERE l.produit_id IS NULL;`,
    checks: [
      { id: "base", label: "Catalogue actuel", hidden: false, misconception: "inner-au-lieu-de-left" },
      {
        id: "plus-vendu",
        label: "Un produit dont toutes les ventes sont supprimées apparaît",
        hidden: true,
        setup: "DELETE FROM retours WHERE produit_id = 10; DELETE FROM lignes_commande WHERE produit_id = 10;",
        misconception: "valeur-codee-en-dur",
      },
      {
        id: "nouveau",
        label: "Un nouveau produit apparaît",
        hidden: true,
        setup: "INSERT INTO produits VALUES (93, 'Nouveau thé', 'Thé', 12, 5);",
      },
    ],
    hints: [
      { level: 1, text: "Comment repérer, après une jointure, les produits qui n'ont trouvé aucune correspondance ?" },
      { level: 2, text: "Un LEFT JOIN suivi d'un test IS NULL sur une colonne de droite, ou bien NOT EXISTS." },
      { level: 3, text: "`LEFT JOIN lignes_commande l ON l.produit_id = p.produit_id WHERE l.produit_id IS NULL`." },
      { level: 4, text: "SELECT p.produit_id, p.nom\nFROM produits AS p\nLEFT JOIN lignes_commande AS l ON l.produit_id = p.produit_id\nWHERE l.produit_id IS NULL;" },
    ],
    explanation: "Variante équivalente : `WHERE NOT EXISTS (SELECT 1 FROM lignes_commande l WHERE l.produit_id = p.produit_id)`. Attention à `NOT IN` : il devient faux pour tout si la sous-requête contient un NULL.",
    conceptIds: [C_JOIN],
  },
];

export const lessonJointures: Lesson = {
  id: "sql-requetes-jointures",
  version: 1,
  domain: "sql",
  moduleId: "sql.b",
  title: "Jointures : relier les tables sans perdre ni dupliquer",
  summary: "INNER JOIN, LEFT JOIN, lignes sans correspondance et doublons créés par les jointures.",
  estimatedMinutes: 45,
  conceptIds: [C_JOIN, C_DUP],
  prerequisites: ["SELECT, WHERE, ORDER BY", "GROUP BY et agrégats", "Clé primaire et clé étrangère (intuition)"],
  objectives: [
    "Écrire une jointure à partir d'une clé étrangère.",
    "Choisir entre INNER JOIN et LEFT JOIN selon qu'on doit garder les lignes sans correspondance.",
    "Prédire le nombre de lignes d'une jointure.",
    "Diagnostiquer un total gonflé par une jointure avec une table de détail.",
  ],
  glossary: [
    { term: "jointure", en: "join", definition: "Opération qui associe les lignes de deux tables selon une condition (souvent clé étrangère = clé primaire)." },
    { term: "clé étrangère", en: "foreign key", definition: "Colonne qui référence la clé primaire d'une autre table (ex. commandes.client_id → clients.client_id)." },
    { term: "jointure externe gauche", en: "LEFT JOIN", definition: "Garde toutes les lignes de la table de gauche, avec des NULL quand rien ne correspond à droite." },
    { term: "cardinalité", en: "cardinality", definition: "Nombre de lignes d'une table qui peuvent correspondre à une ligne d'une autre (1-1, 1-n, n-n)." },
  ],
  validationExerciseId: "sql-join-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : une commande sans nom",
      blocks: [
        {
          type: "text",
          md: "La table `commandes` contient `client_id`, pas le nom du client. Pour un rapport lisible, il faut aller chercher le nom dans `clients`. C'est le rôle d'une [[jointure]].\n\nDeux pièges guettent : **perdre** des lignes (les clients sans commande disparaissent) et **dupliquer** des lignes (un montant compté plusieurs fois).",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : pour chaque ligne, chercher ses correspondances",
      blocks: [
        {
          type: "text",
          md: "Une jointure se lit comme une boucle : **pour chaque client**, parcourir les commandes et garder chaque paire dont les `client_id` sont égaux.\n\n- **INNER JOIN** : seules les paires trouvées sont gardées.\n- **LEFT JOIN** : un client sans aucune commande est quand même gardé, une fois, avec des NULL côté commande.\n\nUne ligne de gauche peut donc produire **0, 1 ou plusieurs** lignes : c'est la [[cardinalité]] qui décide.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Pourquoi pas des diagrammes de Venn ?",
          md: "Les cercles de Venn représentent des ensembles de valeurs, pas des paires de lignes : ils ne montrent ni les doublons, ni les NULL. La visualisation suivante montre les vraies lignes.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Voir la jointure ligne par ligne",
      blocks: [{ type: "join-viz", title: "clients ⋈ commandes sur client_id" }],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : une jointure sur la base",
      blocks: [
        { type: "text", md: "Les alias `o` et `c` raccourcissent l'écriture. Exécute. Ensuite, écris `FROM clients AS c LEFT JOIN commandes AS o ON o.client_id = c.client_id` et filtre `WHERE o.commande_id IS NULL` : tu verras apparaître les clients sans commande." },
        {
          type: "code",
          language: "sql",
          runnable: true,
          code: `SELECT o.commande_id, o.date_commande, c.nom, c.ville
FROM commandes AS o
JOIN clients AS c ON c.client_id = o.client_id
ORDER BY o.date_commande DESC
LIMIT 10;`,
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : combien de lignes ?",
      blocks: [
        { type: "text", md: "La base contient 280 commandes et 683 lignes de commande ; chaque ligne appartient à exactement une commande." },
        {
          type: "prediction",
          id: "pred-join-cardinalite",
          question: "Combien de lignes produit cette jointure ?",
          code: "SELECT COUNT(*)\nFROM commandes AS o\nJOIN lignes_commande AS l ON l.commande_id = o.commande_id;",
          choices: [
            { id: "a", label: "280" },
            { id: "b", label: "683" },
            { id: "c", label: "963" },
            { id: "d", label: "191240" },
          ],
          answer: "b",
          explanation:
            "Chaque ligne de commande trouve exactement une commande : on obtient une ligne par ligne de commande, 683. Une commande de 3 lignes apparaît donc 3 fois : additionner une colonne de `commandes` après cette jointure la compterait 3 fois. 191 240 (280 × 683) serait un produit cartésien, sans condition ON.",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "sql-join-ex1-commandes-clients" }] },
    { id: "autonome", stage: "autonome", title: "Exercice autonome", blocks: [{ type: "exercise", exerciseId: "sql-join-ex2-commandes-par-client" }] },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "sql-join-ex3-debug-doublons" },
        {
          type: "explain",
          id: "explain-doublons",
          prompt: "Explique comment une jointure peut gonfler un total, et comment tu le détectes avant de livrer un chiffre.",
          criteria: [
            "J'explique qu'une jointure produit une ligne par paire.",
            "Je relie cela à la granularité (une commande, plusieurs lignes).",
            "Je propose une vérification (compter les lignes avant/après, comparer à un total connu).",
            "Je propose une correction (retirer la jointure inutile ou agréger avant de joindre).",
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
          md: "La question « taux de retour par catégorie » combine ventes et retours : c'est exactement le piège des doublons. Note dans ton journal comment tu as évité de compter deux fois.",
        },
      ],
    },
    { id: "revision", stage: "revision", title: "Révision", blocks: [{ type: "text", md: "La révision espacée reprendra le test de validation de cette leçon." }] },
  ],
};

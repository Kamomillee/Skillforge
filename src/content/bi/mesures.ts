import type { Lesson, Project, SqlExerciseInput } from "../types";

/**
 * BI — Module C : mesures et contexte de filtre. Laboratoire NATIF : les mesures sont calculées en SQL
 * (PostgreSQL / PGlite) sur les données PME ; le DAX équivalent est montré mais jamais exécuté
 * (Power BI ne tourne pas dans un navigateur). Le rapport Power BI lui-même n'est pas vérifié par
 * SkillForge : il fait l'objet d'un parcours guidé en auto-évaluation, présenté comme tel.
 */

const C_MES = "bi.c.mesures-et-colonnes-calculees";
const C_DIV = "bi.c.divide";
const C_CTX = "bi.c.contexte-de-filtre";
const C_ALL = "bi.c.all-et-removefilters";
const C_PER = "bi.a.numerateur-denominateur-periode-et-granularite";
const C_TPS = "bi.c.comparaisons-temporelles";

const VENTES = `FROM lignes_commande l
JOIN commandes c ON c.commande_id = l.commande_id`;

export const exercisesBiMesures: SqlExerciseInput[] = [
  {
    id: "bi-ex1-ca-segment",
    version: 1,
    language: "sql",
    kind: "guided",
    title: "Une mesure dans un contexte : CA 2026 par segment",
    prompt:
      "Dans Power BI, un visuel « CA par segment » avec un slicer sur 2026 évalue la mesure `[CA]` une fois par segment. Écris la requête équivalente : chiffre d'affaires (quantité × prix facturé) des commandes **non annulées** passées en **2026**, par segment de client.\n\nColonnes attendues : `segment`, `ca`. Remplace chaque `___`.",
    dataset: "pme",
    starterCode: `SELECT cl.segment, SUM(l.quantite * l.prix_unitaire) AS ca
${VENTES}
JOIN clients cl ON cl.client_id = c.client_id
WHERE c.statut <> 'annulee'
  AND c.date_commande >= DATE '2026-01-01'
  AND c.date_commande < ___
GROUP BY ___;`,
    referenceSolution: `SELECT cl.segment, SUM(l.quantite * l.prix_unitaire) AS ca
${VENTES}
JOIN clients cl ON cl.client_id = c.client_id
WHERE c.statut <> 'annulee'
  AND c.date_commande >= DATE '2026-01-01'
  AND c.date_commande < DATE '2027-01-01'
GROUP BY cl.segment;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "colonnes" },
      {
        id: "bord",
        label: "Commande du 31 décembre 2025 exclue",
        hidden: true,
        setup: "UPDATE commandes SET date_commande = DATE '2025-12-31' WHERE commande_id = (SELECT min(commande_id) FROM commandes WHERE date_commande >= DATE '2026-01-01' AND statut <> 'annulee');",
        misconception: "group-by-granularite",
      },
      {
        id: "annule",
        label: "Commandes annulées exclues",
        hidden: true,
        setup: "UPDATE commandes SET statut = 'annulee' WHERE commande_id IN (SELECT commande_id FROM commandes WHERE date_commande >= DATE '2026-01-01' ORDER BY commande_id LIMIT 8);",
        misconception: "statut-annule",
      },
    ],
    hints: [
      { level: 1, text: "Les filtres du visuel (slicer 2026, commandes non annulées) deviennent le WHERE ; l'axe du visuel (segment) devient le GROUP BY." },
      { level: 2, text: "Une année entière : du 1er janvier inclus au 1er janvier suivant exclu." },
      { level: 3, text: "`AND c.date_commande < DATE '2027-01-01'` puis `GROUP BY cl.segment`." },
      {
        level: 4,
        text: "SELECT cl.segment, SUM(l.quantite * l.prix_unitaire) AS ca\nFROM lignes_commande l\nJOIN commandes c ON c.commande_id = l.commande_id\nJOIN clients cl ON cl.client_id = c.client_id\nWHERE c.statut <> 'annulee'\n  AND c.date_commande >= DATE '2026-01-01'\n  AND c.date_commande < DATE '2027-01-01'\nGROUP BY cl.segment;",
      },
    ],
    explanation:
      "Une mesure n'a pas de valeur « en soi » : elle est recalculée pour chaque cellule, avec les filtres de cette cellule. En SQL, ce contexte s'écrit explicitement (WHERE + GROUP BY) ; en DAX, il est implicite et vient du visuel.",
    conceptIds: [C_MES, C_CTX],
  },
  {
    id: "bi-ex2-debug-divide",
    version: 1,
    language: "sql",
    kind: "debug",
    title: "Débogage : une marge qui plantera un jour",
    prompt:
      "Cette requête calcule la marge en % par catégorie (commandes non annulées). Elle fonctionne aujourd'hui… mais le jour où une catégorie n'a que des articles offerts (prix facturé 0), elle s'arrête sur une erreur. En DAX, `DIVIDE` renverrait une valeur vide. Corrige-la pour obtenir `NULL` dans ce cas.\n\nColonnes : `categorie`, `marge_pct` (arrondie à 1 décimale).",
    dataset: "pme",
    starterCode: `SELECT p.categorie,
       ROUND(100 * SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire))
             / SUM(l.quantite * l.prix_unitaire), 1) AS marge_pct
${VENTES}
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
GROUP BY p.categorie;`,
    referenceSolution: `SELECT p.categorie,
       ROUND(100 * SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire))
             / NULLIF(SUM(l.quantite * l.prix_unitaire), 0), 1) AS marge_pct
${VENTES}
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
GROUP BY p.categorie;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false },
      {
        id: "offerts",
        label: "Tous les thés offerts (prix facturé 0)",
        hidden: true,
        setup: "UPDATE lignes_commande SET prix_unitaire = 0 WHERE produit_id IN (SELECT produit_id FROM produits WHERE categorie = 'Thé');",
        misconception: "division-zero",
      },
    ],
    hints: [
      { level: 1, text: "Que vaut le dénominateur si toutes les lignes d'une catégorie ont un prix de 0 ?" },
      { level: 2, text: "PostgreSQL refuse de diviser par zéro, mais diviser par NULL donne NULL." },
      { level: 3, text: "`NULLIF(x, 0)` vaut NULL quand x = 0, sinon x. C'est l'équivalent SQL de DIVIDE." },
      { level: 4, text: "Remplace le dénominateur par `NULLIF(SUM(l.quantite * l.prix_unitaire), 0)`." },
    ],
    explanation:
      "`DIVIDE(a, b)` en DAX = `a / NULLIF(b, 0)` en SQL : une cellule vide plutôt qu'une erreur qui casse tout le rapport. Dans un tableau de bord, une valeur vide doit ensuite être expliquée (aucune vente facturée), pas affichée comme 0 %.",
    conceptIds: [C_DIV],
  },
  {
    id: "bi-ex3-part-ca",
    version: 1,
    language: "sql",
    kind: "autonomous",
    title: "Part de chaque catégorie dans le CA 2026",
    prompt:
      "Pour 2026 (commandes non annulées), calcule par catégorie le CA et sa **part du CA total 2026**, en % arrondi à 1 décimale. Le total doit être **calculé** dans le même contexte (2026, non annulées), pas recopié.\n\nColonnes : `categorie`, `ca`, `part_pct`.",
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT p.categorie,
       SUM(l.quantite * l.prix_unitaire) AS ca,
       ROUND(100 * SUM(l.quantite * l.prix_unitaire)
             / SUM(SUM(l.quantite * l.prix_unitaire)) OVER (), 1) AS part_pct
${VENTES}
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'
GROUP BY p.categorie;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "contexte-denominateur" },
      {
        id: "modif",
        label: "Des commandes 2026 annulées : le total change aussi",
        hidden: true,
        setup: "UPDATE commandes SET statut = 'annulee' WHERE commande_id IN (SELECT commande_id FROM commandes WHERE date_commande >= DATE '2026-06-01' ORDER BY commande_id LIMIT 15);",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Il faut deux nombres par ligne : le CA de la catégorie, et le CA de toutes les catégories (même année, mêmes statuts)." },
      { level: 2, text: "Une fonction de fenêtre calcule un total sur toutes les lignes du résultat, sans les regrouper : `SUM(...) OVER ()`." },
      { level: 3, text: "Après GROUP BY, on peut écrire `SUM(SUM(montant)) OVER ()` : la somme, sur tout le résultat, des sommes par catégorie." },
      {
        level: 4,
        text: "SELECT p.categorie,\n       SUM(l.quantite * l.prix_unitaire) AS ca,\n       ROUND(100 * SUM(l.quantite * l.prix_unitaire)\n             / SUM(SUM(l.quantite * l.prix_unitaire)) OVER (), 1) AS part_pct\nFROM lignes_commande l\nJOIN commandes c ON c.commande_id = l.commande_id\nJOIN produits p ON p.produit_id = l.produit_id\nWHERE c.statut <> 'annulee'\n  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'\nGROUP BY p.categorie;",
      },
    ],
    explanation:
      "`OVER ()` joue le rôle de `ALL(Produits[Catégorie])` : le dénominateur ignore le découpage par catégorie mais garde le reste du contexte (2026, non annulées). Une sous-requête sans le filtre d'année donnerait une part fausse sans aucune erreur visible.",
    conceptIds: [C_ALL, C_CTX],
  },
  {
    id: "bi-validation-part-segment",
    version: 1,
    language: "sql",
    kind: "validation",
    title: "Test de validation : part de chaque segment dans sa catégorie",
    prompt:
      "Pour 2026 (commandes non annulées), donne pour chaque couple catégorie × segment le CA et la **part du segment dans le CA de sa catégorie** (en %, 1 décimale). C'est la mesure `DIVIDE([CA], CALCULATE([CA], ALL(Clients[Segment])))`.\n\nColonnes : `categorie`, `segment`, `ca`, `part_pct`.",
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT p.categorie, cl.segment,
       SUM(l.quantite * l.prix_unitaire) AS ca,
       ROUND(100 * SUM(l.quantite * l.prix_unitaire)
             / NULLIF(SUM(SUM(l.quantite * l.prix_unitaire)) OVER (PARTITION BY p.categorie), 0), 1) AS part_pct
${VENTES}
JOIN produits p ON p.produit_id = l.produit_id
JOIN clients cl ON cl.client_id = c.client_id
WHERE c.statut <> 'annulee'
  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'
GROUP BY p.categorie, cl.segment;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "contexte-denominateur" },
      {
        id: "modif",
        label: "Un segment perd des commandes",
        hidden: true,
        setup: "UPDATE commandes SET statut = 'annulee' WHERE client_id IN (SELECT client_id FROM clients WHERE segment = 'entreprise') AND date_commande >= DATE '2026-03-01';",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "Le dénominateur garde le filtre de catégorie mais retire celui de segment." },
      { level: 2, text: "Une fenêtre peut être découpée : `OVER (PARTITION BY ...)` calcule un total par groupe." },
      { level: 3, text: "`SUM(SUM(montant)) OVER (PARTITION BY p.categorie)` = CA de la catégorie, tous segments confondus." },
      {
        level: 4,
        text: "SELECT p.categorie, cl.segment,\n       SUM(l.quantite * l.prix_unitaire) AS ca,\n       ROUND(100 * SUM(l.quantite * l.prix_unitaire)\n             / NULLIF(SUM(SUM(l.quantite * l.prix_unitaire)) OVER (PARTITION BY p.categorie), 0), 1) AS part_pct\nFROM lignes_commande l\nJOIN commandes c ON c.commande_id = l.commande_id\nJOIN produits p ON p.produit_id = l.produit_id\nJOIN clients cl ON cl.client_id = c.client_id\nWHERE c.statut <> 'annulee'\n  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'\nGROUP BY p.categorie, cl.segment;",
      },
    ],
    explanation:
      "`PARTITION BY p.categorie` garde le filtre de catégorie et retire celui de segment : c'est exactement `ALL(Clients[Segment])` dans CALCULATE. Les parts d'une même catégorie font 100 %.",
    conceptIds: [C_ALL, C_CTX, C_DIV],
  },
];

export const lessonBiMesures: Lesson = {
  id: "bi-mesures-contexte",
  version: 1,
  domain: "bi",
  moduleId: "bi.c",
  title: "Mesures et contexte de filtre : penser comme Power BI",
  summary: "Comprendre qu'une mesure est recalculée dans chaque cellule, reproduire DIVIDE et ALL en SQL, et calculer des parts sans se tromper de dénominateur.",
  estimatedMinutes: 50,
  conceptIds: [C_MES, C_CTX, C_DIV, C_ALL],
  prerequisites: ["GROUP BY et HAVING (SQL)", "INNER JOIN et LEFT JOIN (SQL)"],
  objectives: [
    "Lister les filtres qui s'appliquent à une cellule d'un visuel (slicer, ligne, colonne).",
    "Écrire en SQL la mesure évaluée dans ce contexte.",
    "Remplacer une division risquée par l'équivalent de DIVIDE.",
    "Calculer une part du total en retirant un seul filtre (ALL), et vérifier que le dénominateur est le bon.",
  ],
  glossary: [
    { term: "mesure", en: "measure", definition: "Calcul agrégé (somme, ratio…) évalué à la demande pour chaque cellule d'un visuel, selon ses filtres." },
    { term: "colonne calculée", en: "calculated column", definition: "Valeur calculée une fois par ligne de table, stockée dans le modèle. Ne dépend pas des filtres du visuel." },
    { term: "contexte de filtre", en: "filter context", definition: "Ensemble des filtres actifs au moment où une mesure est évaluée (slicers, axes, filtres de page)." },
    { term: "DIVIDE", definition: "Fonction DAX de division qui renvoie une valeur vide (BLANK) au lieu d'une erreur quand le dénominateur vaut 0." },
    { term: "CALCULATE", definition: "Fonction DAX qui évalue une expression dans un contexte de filtre modifié." },
    { term: "ALL", definition: "Fonction DAX qui retire les filtres d'une table ou d'une colonne (ici pour calculer un dénominateur)." },
    { term: "slicer", en: "slicer", definition: "Segment : contrôle visuel qui filtre toute la page (ex. l'année)." },
  ],
  validationExerciseId: "bi-validation-part-segment",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : « le café pèse combien ? »",
      blocks: [
        {
          type: "text",
          md: "La direction de la Torréfaction du Léman demande : « Quelle part de nos ventes fait le café ? ». Trois personnes répondent 24,7 %, 23,9 % et 18,3 %. Aucune ne s'est trompée de calcul : la première a pris toutes les ventes depuis mai 2025, la deuxième seulement 2026, la troisième 2026 et les clients entreprises. Elles n'ont pas utilisé le **même contexte de filtre**.\n\nDans Power BI, ce contexte est **invisible** : il vient des slicers, des axes et des filtres de page. Cette leçon le rend explicite, en le recalculant en SQL.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Ce qui est exécuté, ce qui ne l'est pas",
          md: "Tous les nombres de cette leçon sont calculés par **PostgreSQL** dans ton navigateur, sur les données synthétiques de la PME. Le **DAX** est montré comme équivalent, **sans être exécuté** : Power BI Desktop ne fonctionne pas dans un navigateur. Le projet propose un parcours guidé dans Power BI Desktop, en auto-évaluation.",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : une mesure, des contextes",
      blocks: [
        {
          type: "matching",
          id: "bi-sources-filtres",
          prompt: "Pour la cellule « Café × particulier » d'une matrice filtrée par un slicer 2026, d'où vient chaque filtre ?",
          pairs: [
            { id: "a", left: "Année = 2026", answer: "slicer" },
            { id: "b", left: "Catégorie = Café", answer: "ligne" },
            { id: "c", left: "Segment = particulier", answer: "colonne" },
            { id: "d", left: "Statut ≠ annulée", answer: "mesure" },
          ],
          options: [
            { id: "slicer", label: "Slicer de la page" },
            { id: "ligne", label: "En-tête de ligne de la matrice" },
            { id: "colonne", label: "En-tête de colonne de la matrice" },
            { id: "mesure", label: "Définition de la mesure elle-même" },
          ],
          explanation:
            "Les trois premiers filtres viennent du visuel et changent d'une cellule à l'autre. Le quatrième fait partie de la **définition** du CA : il s'applique partout, et doit être écrit dans la mesure (ou dans le modèle), jamais laissé au hasard d'un filtre de page.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Construire le contexte d'une cellule",
      blocks: [
        { type: "filter-context-viz", title: "Matrice CA par catégorie × segment, calculée par PostgreSQL" },
        {
          type: "text",
          md: "Choisis la mesure « Part du CA de la colonne », puis clique deux cellules d'une même colonne : le **dénominateur** est le même (le total de la colonne), parce que `ALL(Produits[Catégorie])` retire le filtre de ligne mais garde celui de colonne et le slicer.",
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : ALL en SQL",
      blocks: [
        { type: "text", md: "Une fonction de fenêtre calcule un total **sans** regrouper les lignes. `OVER ()` = tout le résultat ; `OVER (PARTITION BY x)` = un total par valeur de x." },
        {
          type: "code",
          language: "sql",
          runnable: true,
          code: `SELECT p.categorie,
       SUM(l.quantite * l.prix_unitaire) AS ca,
       SUM(SUM(l.quantite * l.prix_unitaire)) OVER () AS ca_toutes_categories
FROM lignes_commande l
JOIN commandes c ON c.commande_id = l.commande_id
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
GROUP BY p.categorie
ORDER BY ca DESC;`,
          caption: "Change le WHERE (ajoute une année) : les deux colonnes changent ensemble, car elles partagent le même contexte.",
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : la ligne Total",
      blocks: [
        {
          type: "prediction",
          id: "bi-pred-total-part",
          question: "Dans la matrice, avec la mesure « Part du CA de la colonne », que vaut la cellule « Total × particulier » ?",
          choices: [
            { id: "a", label: "La somme des parts des catégories, qui peut dépasser 100 %" },
            { id: "b", label: "100 %, car numérateur et dénominateur ont le même contexte" },
            { id: "c", label: "La part des particuliers dans le CA total" },
            { id: "d", label: "Une case vide" },
          ],
          answer: "b",
          explanation:
            "Sur la ligne Total, il n'y a pas de filtre de catégorie : retirer un filtre absent ne change rien. Numérateur = dénominateur = CA des particuliers, donc 100 %. Une mesure n'additionne pas les cellules du dessus : elle est **réévaluée** dans le contexte du total.",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "bi-ex1-ca-segment" }] },
    { id: "autonome", stage: "autonome", title: "Exercice autonome", blocks: [{ type: "exercise", exerciseId: "bi-ex3-part-ca" }] },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "bi-ex2-debug-divide" },
        {
          type: "explain",
          id: "explain-contexte",
          prompt: "Explique à la direction pourquoi trois collègues ont donné trois « parts du café » différentes, et comment éviter que cela se reproduise.",
          criteria: ["Je nomme les filtres qui différaient (année, segment, total de référence)", "Je propose une définition écrite de la mesure", "Je cite un exemple chiffré"],
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
          projectId: "bi-rapport",
          title: "Rapport ventes, marges et retours",
          md: "Le projet BI calcule en SQL les chiffres de référence d'un rapport (KPI mensuels, taux de retour, comparaison sur une période comparable), puis guide la construction du rapport dans Power BI Desktop.",
        },
      ],
    },
    { id: "revision", stage: "revision", title: "Révision", blocks: [{ type: "text", md: "La révision espacée reprendra le test de validation (part d'un segment dans sa catégorie)." }] },
  ],
};

export const exercisesProjetBi: SqlExerciseInput[] = [
  {
    id: "bi-rapport-p1-mensuel",
    version: 1,
    language: "sql",
    kind: "project",
    title: "KPI mensuels 2026",
    prompt:
      "La page exécutive du rapport affichera, pour chaque mois de 2026 : le CA, la marge en % et le nombre de commandes (commandes non annulées). Calcule ces chiffres de référence, du plus ancien au plus récent mois.\n\nColonnes : `mois` (texte `AAAA-MM`), `ca`, `marge_pct` (1 décimale), `nb_commandes`.",
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT to_char(c.date_commande, 'YYYY-MM') AS mois,
       SUM(l.quantite * l.prix_unitaire) AS ca,
       ROUND(100 * SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire))
             / NULLIF(SUM(l.quantite * l.prix_unitaire), 0), 1) AS marge_pct,
       COUNT(DISTINCT c.commande_id) AS nb_commandes
FROM lignes_commande l
JOIN commandes c ON c.commande_id = l.commande_id
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'
GROUP BY mois
ORDER BY mois;`,
    orderBy: ["mois"],
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "jointure-doublons" },
      {
        id: "annule",
        label: "Commandes annulées exclues",
        hidden: true,
        setup: "UPDATE commandes SET statut = 'annulee' WHERE commande_id IN (SELECT commande_id FROM commandes WHERE date_commande >= DATE '2026-04-01' ORDER BY commande_id LIMIT 10);",
        misconception: "statut-annule",
      },
    ],
    hints: [
      { level: 1, text: "Une ligne par mois : le mois devient l'axe (GROUP BY), les trois KPI sont trois mesures." },
      { level: 2, text: "Une commande a plusieurs lignes : `COUNT(*)` compterait des lignes, pas des commandes." },
      { level: 3, text: "`COUNT(DISTINCT c.commande_id)` ; marge avec `NULLIF(..., 0)` au dénominateur ; `to_char(date, 'YYYY-MM')` pour le mois." },
      {
        level: 4,
        text: "SELECT to_char(c.date_commande, 'YYYY-MM') AS mois,\n       SUM(l.quantite * l.prix_unitaire) AS ca,\n       ROUND(100 * SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire))\n             / NULLIF(SUM(l.quantite * l.prix_unitaire), 0), 1) AS marge_pct,\n       COUNT(DISTINCT c.commande_id) AS nb_commandes\nFROM lignes_commande l\nJOIN commandes c ON c.commande_id = l.commande_id\nJOIN produits p ON p.produit_id = l.produit_id\nWHERE c.statut <> 'annulee'\n  AND c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'\nGROUP BY mois\nORDER BY mois;",
      },
    ],
    explanation:
      "Ces chiffres sont la **référence** du rapport : une fois le rapport construit dans Power BI, chaque carte et chaque point de courbe doit retrouver ces valeurs. Octobre 2026 est incomplet (dernières commandes le 22) : à signaler sur le visuel.",
    conceptIds: [C_MES, C_DIV],
  },
  {
    id: "bi-rapport-p2-retours",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Taux de retour par catégorie",
    prompt:
      "Pour chaque catégorie de produits : unités vendues (commandes non annulées, toutes périodes), unités retournées (table `retours`), et taux de retour en % (1 décimale). Une catégorie **sans retour** doit apparaître avec 0 retour et un taux de 0.\n\nColonnes : `categorie`, `unites_vendues`, `unites_retournees`, `taux_retour_pct`.",
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `WITH vendu AS (
  SELECT p.categorie, SUM(l.quantite) AS unites
  FROM lignes_commande l
  JOIN commandes c ON c.commande_id = l.commande_id
  JOIN produits p ON p.produit_id = l.produit_id
  WHERE c.statut <> 'annulee'
  GROUP BY p.categorie
),
retourne AS (
  SELECT p.categorie, SUM(r.quantite) AS unites
  FROM retours r
  JOIN produits p ON p.produit_id = r.produit_id
  GROUP BY p.categorie
)
SELECT v.categorie,
       v.unites AS unites_vendues,
       COALESCE(r.unites, 0) AS unites_retournees,
       ROUND(100.0 * COALESCE(r.unites, 0) / NULLIF(v.unites, 0), 1) AS taux_retour_pct
FROM vendu v
LEFT JOIN retourne r ON r.categorie = v.categorie;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "jointure-doublons" },
      {
        id: "sans-retour",
        label: "Une catégorie sans aucun retour",
        hidden: true,
        setup: "DELETE FROM retours WHERE produit_id IN (SELECT produit_id FROM produits WHERE categorie = 'Café');",
        misconception: "inner-au-lieu-de-left",
      },
    ],
    hints: [
      { level: 1, text: "Vendu et retourné viennent de deux tables différentes : calcule chaque total séparément, par catégorie, avant de les réunir." },
      { level: 2, text: "Joindre lignes et retours sur la seule commande multiplie les lignes : chaque retour se répète pour chaque ligne de la commande." },
      { level: 3, text: "Deux sous-requêtes (WITH), puis un LEFT JOIN de « vendu » vers « retourné », avec COALESCE(..., 0) et NULLIF au dénominateur. Attention à la division entière : 100.0." },
      { level: 4, text: "Voir la structure : WITH vendu AS (...), retourne AS (...) SELECT ... FROM vendu v LEFT JOIN retourne r ON r.categorie = v.categorie;" },
    ],
    explanation:
      "Calculer chaque mesure à son propre grain, puis réunir, évite les doublons de jointure. Dans Power BI, le modèle en étoile fait ce travail : `Ventes` et `Retours` sont deux tables de faits reliées à la même dimension `Produits`.",
    conceptIds: [C_DIV, C_MES],
  },
  {
    id: "bi-rapport-p3-comparaison",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Évolution sur une période comparable",
    prompt:
      "La direction veut comparer 2026 à 2025. Problème : les données commencent le 1er mai 2025 et s'arrêtent le 22 octobre 2026. Compare donc la **même période** des deux années : du **1er mai au 22 octobre** inclus.\n\nPar catégorie (commandes non annulées) : `categorie`, `ca_2025`, `ca_2026`, `evolution_pct` (variation en %, 1 décimale, vide si `ca_2025` vaut 0).",
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT p.categorie,
       SUM(l.quantite * l.prix_unitaire) FILTER (WHERE c.date_commande BETWEEN DATE '2025-05-01' AND DATE '2025-10-22') AS ca_2025,
       SUM(l.quantite * l.prix_unitaire) FILTER (WHERE c.date_commande BETWEEN DATE '2026-05-01' AND DATE '2026-10-22') AS ca_2026,
       ROUND(100 * (SUM(l.quantite * l.prix_unitaire) FILTER (WHERE c.date_commande BETWEEN DATE '2026-05-01' AND DATE '2026-10-22')
                    - SUM(l.quantite * l.prix_unitaire) FILTER (WHERE c.date_commande BETWEEN DATE '2025-05-01' AND DATE '2025-10-22'))
             / NULLIF(SUM(l.quantite * l.prix_unitaire) FILTER (WHERE c.date_commande BETWEEN DATE '2025-05-01' AND DATE '2025-10-22'), 0), 1) AS evolution_pct
FROM lignes_commande l
JOIN commandes c ON c.commande_id = l.commande_id
JOIN produits p ON p.produit_id = l.produit_id
WHERE c.statut <> 'annulee'
GROUP BY p.categorie;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "colonnes" },
      {
        id: "hors-periode",
        label: "Une commande de décembre 2025 ne compte pas",
        hidden: true,
        setup: "UPDATE commandes SET date_commande = DATE '2025-12-15' WHERE commande_id = (SELECT min(commande_id) FROM commandes WHERE date_commande BETWEEN DATE '2025-05-01' AND DATE '2025-10-22' AND statut <> 'annulee');",
        misconception: "group-by-granularite",
      },
    ],
    hints: [
      { level: 1, text: "Deux contextes différents (deux périodes) dans la même ligne : il faut deux sommes filtrées." },
      { level: 2, text: "PostgreSQL permet `SUM(x) FILTER (WHERE condition)` : une somme qui ne prend que certaines lignes." },
      { level: 3, text: "`BETWEEN DATE '2025-05-01' AND DATE '2025-10-22'` inclut les deux bornes. Évolution = (2026 − 2025) / NULLIF(2025, 0) × 100." },
      { level: 4, text: "Une colonne par période avec FILTER, puis l'évolution calculée à partir des deux mêmes expressions, divisée par NULLIF(ca_2025, 0)." },
    ],
    explanation:
      "Comparer 2026 entier à 2025 entier aurait affiché une croissance artificielle (2025 ne commence qu'en mai). En DAX, `SAMEPERIODLASTYEAR` exige une table calendrier **complète** et des dates cohérentes : la question de la période comparable se pose de la même façon.",
    conceptIds: [C_PER, C_TPS],
  },
];

export const projetBi: Project = {
  id: "bi-rapport",
  version: 1,
  domain: "bi",
  title: "Rapport ventes, marges et retours",
  summary: "Chiffres de référence vérifiés en SQL (KPI mensuels, retours, période comparable), puis construction guidée du rapport dans Power BI Desktop.",
  brief: `La direction de la Torréfaction du Léman veut un rapport de deux pages : une **page exécutive** (CA, marge, commandes, tendance) et une **page d'analyse** (catégories, retours, comparaison avec l'an dernier), avec trois recommandations.

Tu commences par établir les **chiffres de référence** en SQL : ils sont vérifiés automatiquement et serviront à contrôler ton rapport. Puis tu construis le rapport dans Power BI Desktop en suivant le parcours guidé.`,
  data: "Base PME **synthétique** (mêmes tables que le projet SQL) : commandes du 1er mai 2025 au 22 octobre 2026, 5 catégories, 2 segments de clients, table `retours`.",
  deliverables: [
    "Trois requêtes de référence vérifiées : KPI mensuels, taux de retour, évolution sur période comparable.",
    "Un rapport Power BI Desktop (.pbix) de deux pages, réalisé hors de SkillForge.",
    "Un journal de décisions et un export Markdown.",
  ],
  acceptance: [
    "Chaque requête passe toutes les vérifications, y compris les cas cachés.",
    "Chaque carte KPI du rapport retrouve le chiffre de référence correspondant (à contrôler toi-même).",
    "Le rapport signale qu'octobre 2026 est incomplet et que 2025 commence en mai.",
  ],
  steps: [
    { id: "p1", title: "KPI mensuels", exerciseId: "bi-rapport-p1-mensuel", decisionPrompt: "Quelle définition du CA et de la marge as-tu retenue ? Comment signaleras-tu le mois incomplet ?" },
    { id: "p2", title: "Taux de retour", exerciseId: "bi-rapport-p2-retours", decisionPrompt: "Quelle catégorie surveiller ? Les retours sont-ils comptés à la date de commande ou de retour, et pourquoi ?" },
    { id: "p3", title: "Période comparable", exerciseId: "bi-rapport-p3-comparaison", decisionPrompt: "Pourquoi ne pas comparer les années entières ? Quelle évolution retiens-tu pour la direction ?" },
  ],
  selfCheck: {
    title: "Parcours Power BI Desktop",
    intro: `À faire dans **Power BI Desktop** (gratuit, Windows), hors de SkillForge. Exporte d'abord les tables depuis le bac à sable SQL (une requête \`SELECT * FROM table\` par table, puis copie du résultat), ou recrée-les à partir des requêtes de référence.

1. Importe les tables \`commandes\`, \`lignes_commande\`, \`produits\`, \`clients\`, \`retours\`.
2. Crée une **table calendrier** (\`CALENDAR(DATE(2025, 5, 1), DATE(2026, 12, 31))\` ; selon tes paramètres régionaux, le séparateur peut être « ; ») et marque-la comme table de dates.
3. Construis le **schéma en étoile** : relations un-à-plusieurs des dimensions (Produits, Clients, Calendrier) vers les faits.
4. Écris les mesures \`[CA]\`, \`[Coût]\`, \`[Marge %]\` (avec DIVIDE) et \`[Taux de retour]\`.
5. Page exécutive : cartes KPI + courbe mensuelle ; page d'analyse : matrice catégorie × segment, retours, comparaison.
6. Contrôle chaque nombre avec tes requêtes de référence.`,
    items: [
      { id: "import", label: "Les cinq tables sont importées avec les bons types (dates, décimaux)." },
      { id: "calendrier", label: "Une table calendrier est marquée comme table de dates et reliée aux commandes." },
      { id: "etoile", label: "Les relations forment un schéma en étoile (un-à-plusieurs, filtre dans un seul sens)." },
      { id: "mesures", label: "Les mesures CA, Marge % et Taux de retour utilisent DIVIDE et ne sont pas des colonnes calculées." },
      { id: "controle", label: "Les cartes KPI d'un mois retrouvent exactement les chiffres de l'étape « KPI mensuels »." },
      { id: "limites", label: "Le rapport signale le mois d'octobre 2026 incomplet et le début des données en mai 2025." },
      { id: "accessibilite", label: "Chaque visuel a un titre explicite ; aucune information n'est portée par la seule couleur." },
    ],
  },
};

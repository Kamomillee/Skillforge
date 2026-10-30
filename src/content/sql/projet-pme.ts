import type { Project, SqlExerciseInput } from "../types";

/**
 * Projet du domaine SQL : « Base de données d'une PME ».
 * Chaque étape est corrigée par comparaison de résultats (comme les exercices) et se sauvegarde séparément.
 */

const NONANNULE = "Commandes non annulées (livrées ou expédiées).";

export const exercisesProjetPme: SqlExerciseInput[] = [
  {
    id: "pme-p1-impayes",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Factures en attente de paiement",
    prompt:
      "La comptabilité veut la liste des commandes **non annulées** qui n'ont **aucun paiement**, avec le montant dû (somme quantité × prix facturé des lignes), de la plus ancienne à la plus récente (à date égale, par numéro de commande).\n\nColonnes attendues : `commande_id`, `client_id`, `date_commande`, `montant_du`.",
    dataset: "pme",
    starterCode: "-- Étape 1 : factures en attente\n",
    referenceSolution: `SELECT o.commande_id, o.client_id, o.date_commande, SUM(l.quantite * l.prix_unitaire) AS montant_du
FROM commandes AS o
JOIN lignes_commande AS l ON l.commande_id = o.commande_id
WHERE o.statut <> 'annulee'
  AND NOT EXISTS (SELECT 1 FROM paiements AS p WHERE p.commande_id = o.commande_id)
GROUP BY o.commande_id, o.client_id, o.date_commande
ORDER BY o.date_commande, o.commande_id;`,
    orderBy: ["date_commande", "commande_id"],
    checks: [
      { id: "base", label: "Données actuelles", hidden: false },
      {
        id: "paiement-recu",
        label: "Une facture payée disparaît de la liste",
        hidden: true,
        setup:
          "INSERT INTO paiements SELECT 990, commande_id, '2026-10-29', 1, 'facture' FROM commandes o WHERE statut <> 'annulee' AND NOT EXISTS (SELECT 1 FROM paiements p WHERE p.commande_id = o.commande_id) ORDER BY commande_id LIMIT 1;",
        misconception: "valeur-codee-en-dur",
      },
      {
        id: "annulee",
        label: "Une commande annulée sans paiement n'est pas une facture due",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (990, 5, '2026-10-28', 'annulee'); INSERT INTO lignes_commande VALUES (990, 1, 1, 2, 12.90);",
        misconception: "statut-annule",
      },
    ],
    hints: [
      { level: 1, text: "Comment exprimer « il n'existe aucun paiement pour cette commande » ?" },
      { level: 2, text: "NOT EXISTS (sous-requête corrélée) ou LEFT JOIN paiements … WHERE p.paiement_id IS NULL. Attention : joindre paiements ET lignes en même temps peut créer des doublons." },
      { level: 3, text: "Filtre les commandes sans paiement avec NOT EXISTS, joins les lignes pour calculer le montant, groupe par commande." },
      {
        level: 4,
        text: "SELECT o.commande_id, o.client_id, o.date_commande, SUM(l.quantite * l.prix_unitaire) AS montant_du\nFROM commandes AS o\nJOIN lignes_commande AS l ON l.commande_id = o.commande_id\nWHERE o.statut <> 'annulee'\n  AND NOT EXISTS (SELECT 1 FROM paiements AS p WHERE p.commande_id = o.commande_id)\nGROUP BY o.commande_id, o.client_id, o.date_commande\nORDER BY o.date_commande, o.commande_id;",
      },
    ],
    explanation: "NOT EXISTS exprime directement l'absence. Le montant dû se calcule à la granularité de la commande (GROUP BY commande).",
    conceptIds: ["sql.d.suivi-de-qualite"],
  },
  {
    id: "pme-p2-ca-mensuel",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Chiffre d'affaires mensuel 2026",
    prompt: `La direction veut le chiffre d'affaires de chaque mois de 2026 (quantité × prix facturé). ${NONANNULE} Le mois est un texte au format \`AAAA-MM\` (\`to_char(date_commande, 'YYYY-MM')\`), arrondis à 2 décimales, mois croissants.\n\nColonnes attendues : \`mois\`, \`ca\`.`,
    dataset: "pme",
    starterCode: "-- Étape 2 : chiffre d'affaires mensuel\n",
    referenceSolution: `SELECT to_char(o.date_commande, 'YYYY-MM') AS mois,
       ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca
FROM commandes AS o
JOIN lignes_commande AS l ON l.commande_id = o.commande_id
WHERE o.statut <> 'annulee'
  AND o.date_commande >= '2026-01-01' AND o.date_commande < '2027-01-01'
GROUP BY to_char(o.date_commande, 'YYYY-MM')
ORDER BY mois;`,
    orderBy: ["mois"],
    checks: [
      { id: "base", label: "Données actuelles", hidden: false },
      {
        id: "annulee",
        label: "Une grosse commande annulée ne change rien",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (991, 5, '2026-03-15', 'annulee'); INSERT INTO lignes_commande VALUES (991, 1, 16, 50, 79.00);",
        misconception: "statut-annule",
      },
      {
        id: "decembre-2025",
        label: "Les ventes de 2025 sont exclues",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (992, 5, '2025-12-31', 'livree'); INSERT INTO lignes_commande VALUES (992, 1, 16, 5, 79.00);",
      },
    ],
    hints: [
      { level: 1, text: "Quelle est la granularité du résultat ? Et quelles commandes doivent être exclues ?" },
      { level: 2, text: "Regroupe sur l'expression du mois ; le CA vient des lignes de commande, le statut et la date de la commande." },
      { level: 3, text: "Joins commandes et lignes, filtre statut et année dans WHERE, `GROUP BY to_char(o.date_commande, 'YYYY-MM')`." },
      {
        level: 4,
        text: "SELECT to_char(o.date_commande, 'YYYY-MM') AS mois,\n       ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca\nFROM commandes AS o\nJOIN lignes_commande AS l ON l.commande_id = o.commande_id\nWHERE o.statut <> 'annulee'\n  AND o.date_commande >= '2026-01-01' AND o.date_commande < '2027-01-01'\nGROUP BY to_char(o.date_commande, 'YYYY-MM')\nORDER BY mois;",
      },
    ],
    explanation: "Le choix « hors annulées » et « prix facturé (promotions comprises) » est une **définition** du chiffre d'affaires : elle doit figurer dans le journal de décisions.",
    conceptIds: ["sql.d.chiffre-d-affaires"],
  },
  {
    id: "pme-p3-marge-produits",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Les 5 produits les plus rentables",
    prompt: `Classe les produits par **marge brute totale** = somme de quantité × (prix facturé − coût unitaire du produit). ${NONANNULE} Garde les 5 premiers, marge décroissante (à égalité, par nom), marge arrondie à 2 décimales.\n\nColonnes attendues : \`produit_id\`, \`nom\`, \`marge\`.`,
    dataset: "pme",
    starterCode: "-- Étape 3 : marge par produit\n",
    referenceSolution: `SELECT p.produit_id, p.nom,
       ROUND(SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire)), 2) AS marge
FROM lignes_commande AS l
JOIN produits AS p ON p.produit_id = l.produit_id
JOIN commandes AS o ON o.commande_id = l.commande_id
WHERE o.statut <> 'annulee'
GROUP BY p.produit_id, p.nom
ORDER BY marge DESC, p.nom
LIMIT 5;`,
    orderBy: ["marge", "nom"],
    checks: [
      { id: "base", label: "Données actuelles", hidden: false },
      {
        id: "cout",
        label: "Une hausse de coût change le classement",
        hidden: true,
        setup: "UPDATE produits SET cout_unitaire = 75 WHERE produit_id = 16;",
        misconception: "valeur-codee-en-dur",
      },
    ],
    hints: [
      { level: 1, text: "La marge utilise deux prix différents : lesquels, et dans quelles tables ?" },
      { level: 2, text: "Prix facturé dans lignes_commande, coût dans produits, statut dans commandes : trois tables, une ligne par ligne de commande avant agrégation." },
      { level: 3, text: "Agrège `SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire))` par produit, trie, limite à 5." },
      {
        level: 4,
        text: "SELECT p.produit_id, p.nom,\n       ROUND(SUM(l.quantite * (l.prix_unitaire - p.cout_unitaire)), 2) AS marge\nFROM lignes_commande AS l\nJOIN produits AS p ON p.produit_id = l.produit_id\nJOIN commandes AS o ON o.commande_id = l.commande_id\nWHERE o.statut <> 'annulee'\nGROUP BY p.produit_id, p.nom\nORDER BY marge DESC, p.nom\nLIMIT 5;",
      },
    ],
    explanation: "La marge se calcule avec le prix réellement facturé (promotions), pas le prix catalogue : c'est une décision de définition à justifier.",
    conceptIds: ["sql.d.marge"],
  },
  {
    id: "pme-p4-panier-segment",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Panier moyen par segment",
    prompt: `Calcule le **panier moyen** (montant moyen d'une commande) pour chaque segment de clients. ${NONANNULE} Arrondi à 2 décimales.\n\nColonnes attendues : \`segment\`, \`panier_moyen\`.\n\nAttention : la moyenne doit porter sur des **commandes**, pas sur des lignes de commande.`,
    dataset: "pme",
    starterCode: "-- Étape 4 : panier moyen par segment\n",
    referenceSolution: `WITH montants AS (
  SELECT o.commande_id, o.client_id, SUM(l.quantite * l.prix_unitaire) AS montant
  FROM commandes AS o
  JOIN lignes_commande AS l ON l.commande_id = o.commande_id
  WHERE o.statut <> 'annulee'
  GROUP BY o.commande_id, o.client_id
)
SELECT c.segment, ROUND(AVG(m.montant), 2) AS panier_moyen
FROM montants AS m
JOIN clients AS c ON c.client_id = m.client_id
GROUP BY c.segment;`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "group-by-granularite" },
      {
        id: "grosse-commande",
        label: "Une commande de 4 lignes compte une seule fois dans la moyenne",
        hidden: true,
        setup:
          "INSERT INTO commandes VALUES (993, 38, '2026-10-20', 'livree'); INSERT INTO lignes_commande VALUES (993,1,1,10,12.90),(993,2,2,10,15.50),(993,3,3,10,13.90),(993,4,4,10,24.00);",
        misconception: "group-by-granularite",
      },
    ],
    hints: [
      { level: 1, text: "Si tu fais AVG(quantite × prix) directement sur les lignes, de quoi calcules-tu la moyenne ?" },
      { level: 2, text: "Il faut deux niveaux : d'abord le montant de chaque commande, puis la moyenne de ces montants par segment. Une sous-requête ou une CTE (WITH) permet d'enchaîner les deux." },
      { level: 3, text: "CTE `montants` : une ligne par commande avec son montant. Puis jointure avec clients et `AVG(montant)` par segment." },
      {
        level: 4,
        text: "WITH montants AS (\n  SELECT o.commande_id, o.client_id, SUM(l.quantite * l.prix_unitaire) AS montant\n  FROM commandes AS o\n  JOIN lignes_commande AS l ON l.commande_id = o.commande_id\n  WHERE o.statut <> 'annulee'\n  GROUP BY o.commande_id, o.client_id\n)\nSELECT c.segment, ROUND(AVG(m.montant), 2) AS panier_moyen\nFROM montants AS m\nJOIN clients AS c ON c.client_id = m.client_id\nGROUP BY c.segment;",
      },
    ],
    explanation: "Moyenne des lignes ≠ moyenne des commandes. Agréger d'abord à la bonne granularité, puis agréger à nouveau : c'est le schéma « agréger avant de joindre ».",
    conceptIds: ["sql.d.panier-moyen"],
  },
  {
    id: "pme-p5-retours-categorie",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Taux de retour par catégorie",
    prompt:
      "Pour chaque catégorie de produits vendue dans des commandes **livrées** : unités vendues, unités retournées (0 s'il n'y en a pas) et taux de retour = retournées / vendues, arrondi à 3 décimales.\n\nColonnes attendues : `categorie`, `unites_vendues`, `unites_retournees`, `taux_retour`.\n\nPiège : joindre ventes et retours ligne à ligne compte certaines unités plusieurs fois.",
    dataset: "pme",
    starterCode: "-- Étape 5 : taux de retour\n",
    referenceSolution: `WITH ventes AS (
  SELECT p.categorie, SUM(l.quantite) AS unites_vendues
  FROM lignes_commande AS l
  JOIN commandes AS o ON o.commande_id = l.commande_id
  JOIN produits AS p ON p.produit_id = l.produit_id
  WHERE o.statut = 'livree'
  GROUP BY p.categorie
), ret AS (
  SELECT p.categorie, SUM(r.quantite) AS unites_retournees
  FROM retours AS r
  JOIN produits AS p ON p.produit_id = r.produit_id
  GROUP BY p.categorie
)
SELECT v.categorie, v.unites_vendues,
       COALESCE(r.unites_retournees, 0) AS unites_retournees,
       ROUND(COALESCE(r.unites_retournees, 0)::numeric / v.unites_vendues, 3) AS taux_retour
FROM ventes AS v
LEFT JOIN ret AS r ON r.categorie = v.categorie;`,
    tolerance: 0.0005,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "jointure-doublons" },
      {
        id: "sans-retour",
        label: "Une catégorie sans aucun retour affiche 0",
        hidden: true,
        setup: "DELETE FROM retours WHERE produit_id IN (SELECT produit_id FROM produits WHERE categorie = 'Thé');",
        misconception: "inner-au-lieu-de-left",
      },
      {
        id: "division",
        label: "Le taux n'est pas tronqué par une division entière",
        hidden: true,
        setup: "INSERT INTO retours VALUES (900, 1, 1, 1, 'Test', '2026-10-29');",
        misconception: "division-entiere",
      },
    ],
    hints: [
      { level: 1, text: "Ventes et retours ont-ils la même granularité ? Que se passe-t-il si tu les joins directement ?" },
      { level: 2, text: "Agrège séparément les ventes par catégorie et les retours par catégorie, puis joins les deux résultats (une ligne par catégorie de chaque côté)." },
      { level: 3, text: "Deux CTE, un LEFT JOIN, COALESCE(…, 0) pour les catégories sans retour, et `::numeric` pour éviter la division entière." },
      {
        level: 4,
        text: "WITH ventes AS (\n  SELECT p.categorie, SUM(l.quantite) AS unites_vendues\n  FROM lignes_commande AS l\n  JOIN commandes AS o ON o.commande_id = l.commande_id\n  JOIN produits AS p ON p.produit_id = l.produit_id\n  WHERE o.statut = 'livree'\n  GROUP BY p.categorie\n), ret AS (\n  SELECT p.categorie, SUM(r.quantite) AS unites_retournees\n  FROM retours AS r\n  JOIN produits AS p ON p.produit_id = r.produit_id\n  GROUP BY p.categorie\n)\nSELECT v.categorie, v.unites_vendues,\n       COALESCE(r.unites_retournees, 0) AS unites_retournees,\n       ROUND(COALESCE(r.unites_retournees, 0)::numeric / v.unites_vendues, 3) AS taux_retour\nFROM ventes AS v\nLEFT JOIN ret AS r ON r.categorie = v.categorie;",
      },
    ],
    explanation: "Agréger avant de joindre évite les doublons ; `::numeric` évite que 3 / 120 vaille 0 en division entière ; COALESCE transforme l'absence de retour en 0.",
    conceptIds: ["sql.d.suivi-de-qualite"],
  },
];

export const projetPme: Project = {
  id: "sql-pme",
  version: 1,
  domain: "sql",
  title: "Base de données d'une PME",
  summary: "Répondre aux questions de la direction de la Torréfaction du Léman avec des requêtes vérifiées, documenter ses définitions et exporter un livrable.",
  brief: `La **Torréfaction du Léman** (PME fictive, 6 personnes, Genève) vend café, thé et accessoires en ligne. Les données de vente sont dans PostgreSQL. La directrice te confie un mandat de stage : produire des chiffres **fiables et justifiés** pour la réunion mensuelle.

Tu travailles comme en entreprise : chaque chiffre repose sur une **définition explicite** (qu'est-ce que le chiffre d'affaires ? quelles commandes comptent ?), notée dans le journal de décisions. Les requêtes sont vérifiées automatiquement sur les données actuelles et sur des données modifiées.`,
  deliverables: [
    "Une requête SQL vérifiée par question (5 questions).",
    "Un journal de décisions : définitions retenues, pièges évités, limites.",
    "Un export Markdown (requêtes, résultats, décisions) à joindre à un portfolio.",
  ],
  acceptance: [
    "Chaque requête passe toutes les vérifications, y compris les cas cachés.",
    "Chaque étape a une décision notée (au moins une phrase).",
    "Le bilan mentionne au moins une limite des données ou des définitions.",
  ],
  steps: [
    {
      id: "p1",
      title: "Factures en attente",
      exerciseId: "pme-p1-impayes",
      decisionPrompt: "Comment as-tu défini « facture en attente » ? Comment as-tu évité de compter un montant plusieurs fois ?",
    },
    {
      id: "p2",
      title: "Chiffre d'affaires mensuel",
      exerciseId: "pme-p2-ca-mensuel",
      decisionPrompt: "Quelle définition du chiffre d'affaires as-tu retenue (statuts inclus, prix catalogue ou facturé, retours) ? Quelle autre définition aurait été défendable ?",
    },
    {
      id: "p3",
      title: "Produits les plus rentables",
      exerciseId: "pme-p3-marge-produits",
      decisionPrompt: "Pourquoi la marge utilise-t-elle le prix facturé ? Quelle limite a ce calcul (coûts non inclus) ?",
    },
    {
      id: "p4",
      title: "Panier moyen par segment",
      exerciseId: "pme-p4-panier-segment",
      decisionPrompt: "À quelle granularité as-tu calculé la moyenne, et pourquoi ? Comment l'as-tu vérifié ?",
    },
    {
      id: "p5",
      title: "Taux de retour par catégorie",
      exerciseId: "pme-p5-retours-categorie",
      decisionPrompt: "Comment as-tu évité les doublons entre ventes et retours ? Le dénominateur (unités livrées) te semble-t-il le bon ?",
    },
  ],
};

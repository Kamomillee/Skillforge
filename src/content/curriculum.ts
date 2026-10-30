import type { ContentStatus, Domain, DomainId, Module, Notion } from "./types";

/**
 * Matrice de couverture : domaine → module → notion → objectif → activité → évaluation → projet.
 * Le statut de chaque notion est honnête : « disponible » uniquement si une leçon testée existe.
 * La source de vérité des statuts détaillés est ici ; docs/COUVERTURE.md en est un rendu.
 */

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function mod(domain: DomainId, letter: string, title: string, notions: string[]): Module {
  const id = `${domain}.${letter.toLowerCase()}`;
  return {
    id,
    domain,
    letter,
    title,
    notions: notions.map((t) => ({ id: `${id}.${slug(t)}`, title: t, status: "prevu" as ContentStatus })),
  };
}

/** Détails des notions réellement implémentées (écrase les valeurs par défaut). */
const implemented: Record<string, Partial<Notion>> = {
  "python.a.boucles": {
    status: "disponible",
    objective:
      "Écrire une boucle for qui parcourt une liste et met à jour un accumulateur, puis prédire sa valeur à chaque itération.",
    activities: [
      "Trace pas à pas d'une boucle",
      "Prédiction",
      "Code à compléter",
      "Exercice autonome avec tests cachés",
      "Débogage",
      "Explication avec ses propres mots",
    ],
    evaluation: "Tests déterministes (visibles + cachés) exécutés dans Pyodide ; validation possible pour sauter la leçon.",
    project: "Pipeline de données (Domaine 1) : calcul du chiffre d'affaires net et contrôle qualité du rapport.",
    prerequisites: ["python.a.variables-et-types", "python.a.conditions"],
    lessonIds: ["py-boucles-accumulateurs"],
  },
  "sql.b.select-from-et-where": {
    "status": "disponible",
    "objective": "Écrire une requête qui sélectionne des colonnes et filtre des lignes avec des conditions combinées (AND, OR, parenthèses), et prédire le nombre de lignes obtenues.",
    "activities": [
        "Ordre logique d'une requête pas à pas (résultats réels)",
        "Prédiction",
        "Exemple exécutable",
        "Exercice guidé",
        "Débogage (priorité AND/OR)",
        "Test de validation"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [],
    "lessonIds": [
        "sql-requetes-select"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.order-by-et-limit": {
    "status": "disponible",
    "objective": "Trier un résultat sur une ou plusieurs clés, gérer les égalités et limiter le nombre de lignes.",
    "activities": [
        "Exercice autonome avec cas cachés",
        "Test de validation (ordre vérifié)"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.select-from-et-where"
    ],
    "lessonIds": [
        "sql-requetes-select"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.logique-a-trois-valeurs-avec-null": {
    "status": "disponible",
    "objective": "Expliquer pourquoi « = NULL » ne trouve rien et utiliser IS NULL / IS NOT NULL / COALESCE à bon escient.",
    "activities": [
        "Prédiction",
        "Exercice autonome (fiches incomplètes) avec cas cachés"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.select-from-et-where"
    ],
    "lessonIds": [
        "sql-requetes-select"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.agregations": {
    "status": "disponible",
    "objective": "Calculer des totaux, moyennes et comptages (COUNT(*) vs COUNT(colonne)) et choisir la bonne granularité.",
    "activities": [
        "Ordre logique avec GROUP BY et HAVING (résultats réels)",
        "Prédiction",
        "Exemple exécutable",
        "Exercice guidé",
        "Exercice autonome",
        "Test de validation"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.select-from-et-where"
    ],
    "lessonIds": [
        "sql-requetes-agregations"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.group-by-et-having": {
    "status": "disponible",
    "objective": "Regrouper des lignes et filtrer des groupes avec HAVING, en distinguant WHERE (lignes) de HAVING (groupes).",
    "activities": [
        "Débogage (WHERE vs HAVING)",
        "Exercice autonome",
        "Test de validation"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.agregations"
    ],
    "lessonIds": [
        "sql-requetes-agregations"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.inner-join-et-left-join": {
    "status": "disponible",
    "objective": "Joindre deux à trois tables, choisir INNER ou LEFT JOIN et compter correctement les lignes sans correspondance.",
    "activities": [
        "Jointure pas à pas (INNER / LEFT)",
        "Prédiction",
        "Exemple exécutable",
        "Exercice guidé",
        "Exercice autonome",
        "Test de validation"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.group-by-et-having"
    ],
    "lessonIds": [
        "sql-requetes-jointures"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.b.doublons-crees-par-les-jointures": {
    "status": "disponible",
    "objective": "Repérer qu'une jointure multiplie des lignes avant une agrégation et corriger le calcul (agréger avant de joindre, ou sous-requête).",
    "activities": [
        "Débogage avec cas cachés",
        "Discussion dans le journal du projet"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.inner-join-et-left-join"
    ],
    "lessonIds": [
        "sql-requetes-jointures"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.d.chiffre-d-affaires": {
    "status": "teste",
    "objective": "Calculer un chiffre d'affaires mensuel selon une définition explicite (statuts inclus, prix facturé).",
    "activities": [
        "Étape du projet PME, corrigée par comparaison de résultats",
        "Décision notée dans le journal"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.inner-join-et-left-join",
        "sql.b.group-by-et-having"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.d.marge": {
    "status": "teste",
    "objective": "Calculer une marge brute par produit et la classer.",
    "activities": [
        "Étape du projet PME, corrigée par comparaison de résultats",
        "Décision notée dans le journal"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.inner-join-et-left-join",
        "sql.b.group-by-et-having"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.d.panier-moyen": {
    "status": "teste",
    "objective": "Calculer un panier moyen par segment à la bonne granularité (par commande).",
    "activities": [
        "Étape du projet PME, corrigée par comparaison de résultats",
        "Décision notée dans le journal"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.inner-join-et-left-join",
        "sql.b.group-by-et-having"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "sql.d.suivi-de-qualite": {
    "status": "teste",
    "objective": "Produire des indicateurs de suivi (factures en attente, taux de retour) sans doubles comptages.",
    "activities": [
        "Étape du projet PME, corrigée par comparaison de résultats",
        "Décision notée dans le journal"
    ],
    "evaluation": "Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé.",
    "prerequisites": [
        "sql.b.inner-join-et-left-join",
        "sql.b.group-by-et-having"
    ],
    "project": "Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown."
},
  "ml.d.matrice-de-confusion": {
    "status": "disponible",
    "objective": "Classer chaque prédiction en VP, FP, FN, VN et relier chaque case à sa conséquence métier.",
    "activities": [
        "Association situations → cases",
        "Visualisation du seuil",
        "Exercice guidé",
        "Base de comparaison (projet)"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur.",
    "prerequisites": [],
    "lessonIds": [
        "ml-evaluer-classifieur"
    ],
    "project": "Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût."
},
  "ml.d.precision-rappel-et-f1": {
    "status": "disponible",
    "objective": "Calculer précision, rappel et F1 à un seuil donné, cas limites compris, et les retrouver avec scikit-learn.",
    "activities": [
        "Démonstration scikit-learn exécutable",
        "Exercice autonome avec cas cachés",
        "Débogage (F1)"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur.",
    "prerequisites": [
        "ml.d.matrice-de-confusion"
    ],
    "lessonIds": [
        "ml-evaluer-classifieur"
    ],
    "project": "Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût."
},
  "ml.d.choix-d-un-seuil": {
    "status": "disponible",
    "objective": "Faire varier un seuil de décision et décrire l'arbitrage précision / rappel.",
    "activities": [
        "Visualisation du seuil (balayage animé, version texte)",
        "Exercice autonome",
        "Test de validation"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur.",
    "prerequisites": [
        "ml.d.precision-rappel-et-f1"
    ],
    "lessonIds": [
        "ml-evaluer-classifieur"
    ],
    "project": "Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût."
},
  "ml.d.cout-metier-des-erreurs": {
    "status": "disponible",
    "objective": "Choisir le seuil qui minimise un coût métier explicite et en exposer les limites.",
    "activities": [
        "Visualisation avec coûts modifiables",
        "Test de validation",
        "Recommandation chiffrée (projet)"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur.",
    "prerequisites": [
        "ml.d.choix-d-un-seuil"
    ],
    "lessonIds": [
        "ml-evaluer-classifieur"
    ],
    "project": "Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût."
},
  "llm.c.decoupage": {
    "status": "disponible",
    "objective": "Découper un document en morceaux avec chevauchement et expliquer l'effet de la taille des morceaux.",
    "activities": [
        "Visualisation du pipeline (taille modifiable)",
        "Exercice guidé",
        "Index du projet"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide), comparées au pipeline de la visualisation ; aucun modèle de langage appelé (modèle simulé annoncé).",
    "prerequisites": [],
    "lessonIds": [
        "llm-rag-citations"
    ],
    "project": "Assistant documentaire avec citations (projet LLM) : index, recherche, tableau d'évaluation sur 13 questions de référence."
},
  "llm.c.recherche-lexicale-et-hybride": {
    "status": "disponible",
    "objective": "Calculer un score lexical normalisé et reconnaître ce qu'il rate (synonymes, conjugaison), ce que la recherche hybride vise à corriger.",
    "activities": [
        "Démonstration exécutable",
        "Cartes de résultats avec termes surlignés",
        "Exercice autonome",
        "Recherche du projet"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide), comparées au pipeline de la visualisation ; aucun modèle de langage appelé (modèle simulé annoncé).",
    "prerequisites": [
        "llm.c.decoupage"
    ],
    "lessonIds": [
        "llm-rag-citations"
    ],
    "project": "Assistant documentaire avec citations (projet LLM) : index, recherche, tableau d'évaluation sur 13 questions de référence."
},
  "llm.c.construction-du-contexte": {
    "status": "disponible",
    "objective": "Assembler un contexte par ordre de pertinence sans dépasser un budget de mots.",
    "activities": [
        "Visualisation du budget de contexte",
        "Débogage"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide), comparées au pipeline de la visualisation ; aucun modèle de langage appelé (modèle simulé annoncé).",
    "prerequisites": [
        "llm.c.recherche-lexicale-et-hybride"
    ],
    "lessonIds": [
        "llm-rag-citations"
    ],
    "project": "Assistant documentaire avec citations (projet LLM) : index, recherche, tableau d'évaluation sur 13 questions de référence."
},
  "llm.c.citations": {
    "status": "disponible",
    "objective": "Citer les passages qui fondent une réponse et vérifier qu'ils contiennent bien la réponse.",
    "activities": [
        "Ordonner les étapes du pipeline",
        "Prédiction (question piège)",
        "Test de validation",
        "Tableau d'évaluation (projet)"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide), comparées au pipeline de la visualisation ; aucun modèle de langage appelé (modèle simulé annoncé).",
    "prerequisites": [
        "llm.c.construction-du-contexte"
    ],
    "lessonIds": [
        "llm-rag-citations"
    ],
    "project": "Assistant documentaire avec citations (projet LLM) : index, recherche, tableau d'évaluation sur 13 questions de référence."
},
  "llm.c.abstention": {
    "status": "disponible",
    "objective": "Décider de s'abstenir quand les sources sont insuffisantes et mesurer silences à tort et réponses sans appui.",
    "activities": [
        "Seuil de citation modifiable",
        "Explication avec ses propres mots",
        "Test de validation",
        "Tableau d'évaluation (projet)"
    ],
    "evaluation": "Fonctions Python vérifiées par tests visibles et cachés (Pyodide), comparées au pipeline de la visualisation ; aucun modèle de langage appelé (modèle simulé annoncé).",
    "prerequisites": [
        "llm.c.citations"
    ],
    "lessonIds": [
        "llm-rag-citations"
    ],
    "project": "Assistant documentaire avec citations (projet LLM) : index, recherche, tableau d'évaluation sur 13 questions de référence."
},
  "bi.c.mesures-et-colonnes-calculees": {
    "status": "disponible",
    "objective": "Expliquer qu'une mesure est réévaluée dans chaque cellule d'un visuel, et l'écrire en SQL pour un contexte donné.",
    "activities": [
        "Matrice calculée par PostgreSQL",
        "Exercice guidé",
        "KPI mensuels (projet)"
    ],
    "prerequisites": [],
    "lessonIds": [
        "bi-mesures-contexte"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
  "bi.c.contexte-de-filtre": {
    "status": "disponible",
    "objective": "Lister les filtres d'une cellule (slicer, ligne, colonne, définition de la mesure) et prédire leur effet.",
    "activities": [
        "Association filtres → sources",
        "Construction pas à pas du contexte",
        "Prédiction (ligne Total)",
        "Explication avec ses propres mots"
    ],
    "prerequisites": [
        "bi.c.mesures-et-colonnes-calculees"
    ],
    "lessonIds": [
        "bi-mesures-contexte"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
  "bi.c.divide": {
    "status": "disponible",
    "objective": "Remplacer une division risquée par l'équivalent de DIVIDE (NULLIF) et interpréter une valeur vide.",
    "activities": [
        "Débogage sur données modifiées",
        "Taux de retour (projet)"
    ],
    "prerequisites": [
        "bi.c.mesures-et-colonnes-calculees"
    ],
    "lessonIds": [
        "bi-mesures-contexte"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
  "bi.c.all-et-removefilters": {
    "status": "disponible",
    "objective": "Calculer une part en retirant un seul filtre du dénominateur (ALL), en SQL avec une fonction de fenêtre.",
    "activities": [
        "Matrice « part du CA »",
        "Démonstration exécutable",
        "Exercice autonome",
        "Test de validation"
    ],
    "prerequisites": [
        "bi.c.contexte-de-filtre"
    ],
    "lessonIds": [
        "bi-mesures-contexte"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
  "bi.a.numerateur-denominateur-periode-et-granularite": {
    "status": "teste",
    "objective": "Comparer deux années sur une période réellement comparable et le justifier.",
    "activities": [
        "Étape du projet BI corrigée par comparaison de résultats",
        "Décision notée dans le journal"
    ],
    "prerequisites": [
        "bi.c.mesures-et-colonnes-calculees"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
  "bi.c.comparaisons-temporelles": {
    "status": "teste",
    "objective": "Calculer une évolution d'une année sur l'autre à périmètre de dates identique.",
    "activities": [
        "Étape du projet BI corrigée par comparaison de résultats"
    ],
    "prerequisites": [
        "bi.c.divide"
    ],
    "evaluation": "Requêtes SQL comparées à une référence par PostgreSQL (PGlite), y compris sur données modifiées cachées ; le DAX est affiché sans être exécuté.",
    "project": "Rapport ventes, marges et retours (projet BI) : chiffres de référence vérifiés en SQL ; rapport Power BI Desktop en auto-évaluation."
},
};

const domains: Domain[] = [
  {
    id: "python",
    title: "Python pour les données et l'automatisation",
    short: "Python",
    description: "Écrire, lire et déboguer des programmes fiables, manipuler des données avec pandas, automatiser des appels d'API.",
    project: {
      title: "Pipeline d'import, nettoyage et contrôle qualité",
      summary:
        "Importer des fichiers et une API de démonstration, nettoyer, contrôler la qualité, générer un rapport. Fichiers mal formés, doublons, colonnes absentes et erreurs d'API volontaires.",
      status: "prevu",
    },
    plannedVisualizations: [
      "Évolution des variables pendant une boucle",
      "Références vers des listes",
      "Comparaison boucle / vectorisation",
      "DataFrame avant / après",
      "Chemin d'une requête HTTP",
      "Propagation d'une exception",
    ],
    modules: [
      mod("python", "A", "Fondations", [
        "Interpréteur et exécution",
        "Variables et types",
        "Conversions",
        "Opérateurs",
        "Chaînes et formatage",
        "Conditions",
        "Boucles",
        "Listes, tuples, dictionnaires et ensembles",
        "Mutabilité et références",
        "Fonctions, paramètres, valeurs de retour",
        "Portée des variables",
        "Compréhensions",
        "Imports et modules",
        "Lecture des messages d'erreur",
      ]),
      mod("python", "B", "Écrire un programme fiable", [
        "Découpage en fonctions",
        "Conventions de nommage",
        "Annotations de types",
        "Exceptions",
        "Validation des entrées",
        "Assertions et tests pertinents",
        "Logs",
        "Fichiers et chemins",
        "Gestionnaire de contexte",
        "Environnements virtuels",
        "Dépendances",
        "Variables d'environnement",
        "Dates, heures et fuseaux",
        "Bases de Git",
      ]),
      mod("python", "C", "NumPy et pandas", [
        "Tableaux NumPy, dimensions et types",
        "Opérations vectorisées",
        "Indexation",
        "Series et DataFrame",
        "Chargement CSV, Excel et JSON",
        "Sélection et filtrage",
        "Données manquantes",
        "Doublons",
        "Conversions de types",
        "Colonnes calculées",
        "groupby et agrégations",
        "merge, concat et jointures",
        "pivot et melt",
        "Données temporelles",
        "Statistiques descriptives",
        "Visualisation exploratoire",
        "Export et contrôles de qualité",
      ]),
      mod("python", "D", "API et automatisation", [
        "HTTP, méthodes et codes de statut",
        "JSON",
        "Paramètres",
        "Authentification",
        "Pagination",
        "Timeouts",
        "Limites de débit",
        "Nouvelles tentatives avec temporisation",
        "Idempotence",
        "Extraction de données",
        "Automatisation de traitements",
        "Planification et suivi d'exécution",
        "Séparation configuration, logique et secrets",
      ]),
    ],
  },
  {
    id: "sql",
    title: "SQL et conception de bases de données",
    short: "SQL",
    description: "Modéliser, interroger et modifier une base relationnelle ; répondre à des questions métier précises.",
    project: {
      title: "Base de données d'une PME",
      summary: "Clients, commandes, lignes de commande, produits, paiements et retours : 5 questions métier vérifiées, journal de décisions et export Markdown. La partie conception (modèle, 3FN) est prévue.",
      status: "disponible",
    },
    plannedVisualizations: [
      "Déplacement des lignes dans une jointure",
      "Résultat intermédiaire de chaque étape",
      "Ordre logique d'une requête",
      "Partitions d'une fonction de fenêtre",
      "Effets d'une transaction",
      "Parcours simplifié d'un index",
      "Diagramme relationnel manipulable",
    ],
    modules: [
      mod("sql", "A", "Modèle relationnel", [
        "Tables, lignes et colonnes",
        "Types",
        "Clés primaires et étrangères",
        "Cardinalités",
        "Contraintes",
        "Valeurs NULL",
        "Intégrité référentielle",
        "Modèles entité-association",
        "Normalisation jusqu'à la 3FN",
        "Arbitrages de dénormalisation",
      ]),
      mod("sql", "B", "Requêtes", [
        "SELECT, FROM et WHERE",
        "ORDER BY et LIMIT",
        "DISTINCT",
        "Expressions et alias",
        "CASE",
        "Agrégations",
        "GROUP BY et HAVING",
        "INNER JOIN et LEFT JOIN",
        "Autres jointures selon le moteur",
        "UNION et UNION ALL",
        "Sous-requêtes",
        "EXISTS",
        "CTE",
        "Fonctions de fenêtre",
        "Rangs, cumuls et période précédente",
        "Dates et chaînes",
        "Logique à trois valeurs avec NULL",
        "Doublons créés par les jointures",
      ]),
      mod("sql", "C", "Modifier et exploiter une base", [
        "CREATE et ALTER",
        "INSERT, UPDATE et DELETE",
        "Transactions",
        "COMMIT et ROLLBACK",
        "Principes ACID",
        "Vues",
        "Index",
        "Lecture élémentaire d'EXPLAIN",
        "Requêtes paramétrées",
        "Injection SQL",
        "Permissions",
        "Sauvegarde et restauration",
        "OLTP et OLAP",
      ]),
      mod("sql", "D", "SQL métier", [
        "Chiffre d'affaires",
        "Marge",
        "Panier moyen",
        "Rétention",
        "Cohortes",
        "Segmentation",
        "Classement des produits",
        "Suivi de qualité",
        "Questions ambiguës et définitions",
      ]),
    ],
  },
  {
    id: "llm",
    title: "Applications LLM : RAG, outils et évaluation",
    short: "LLM",
    description: "Construire des applications IA fiables : appels côté serveur, RAG avec citations, outils, sécurité et évaluation.",
    project: {
      title: "Assistant documentaire avec citations",
      summary: "Index, recherche lexicale, citations, abstention et tableau d'évaluation sur un jeu de questions connu. Sans modèle de langage réel (réponse simulée) ; l'appel côté serveur à un vrai modèle est prévu.",
      status: "disponible",
    },
    plannedVisualizations: [
      "Tokenisation illustrative (distincte d'un tokenizer réel)",
      "Budget de contexte",
      "Pipeline RAG",
      "Cartes de résultats de recherche",
      "Effets du découpage",
      "Déroulé d'un appel d'outil",
      "Historique d'un agent",
      "Comparaison de deux configurations",
    ],
    modules: [
      mod("llm", "A", "Fondations des LLM", [
        "Capacités et limites",
        "Tokens",
        "Fenêtre de contexte",
        "Génération probabiliste",
        "Paramètres selon le fournisseur",
        "Rôles des messages",
        "Instructions et exemples",
        "Sorties structurées",
        "Validation de schéma",
        "Coût et latence",
        "Streaming",
        "Erreurs et limites des API",
        "Données d'entraînement et contexte fourni",
      ]),
      mod("llm", "B", "Conception d'applications", [
        "Appels côté serveur",
        "Gestion des secrets",
        "Interface fournisseur interchangeable",
        "Conversation et gestion du contexte",
        "Mémoire explicite",
        "Journalisation",
        "Cache",
        "Budgets",
        "Gestion des erreurs",
        "Modèles simulés pour les exercices",
        "Simulation et appel réel",
      ]),
      mod("llm", "C", "RAG", [
        "Chargement des documents",
        "Extraction de texte",
        "Découpage",
        "Embeddings",
        "Similarité",
        "Recherche vectorielle",
        "Recherche lexicale et hybride",
        "Métadonnées et filtres",
        "Reranking",
        "Construction du contexte",
        "Citations",
        "Abstention",
        "Mise à jour d'un index",
        "Provenance",
        "Permissions d'accès",
        "OCR et tableaux",
        "RAG ou fine-tuning",
        "Quand une recherche simple suffit",
      ]),
      mod("llm", "D", "Outils et agents", [
        "Définition d'un outil",
        "Schémas d'entrée et de sortie",
        "Appels de fonctions",
        "Workflows déterministes",
        "Boucle d'agent",
        "États",
        "Limites d'itérations",
        "Timeouts",
        "Nouvelles tentatives",
        "Validation humaine des actions sensibles",
        "Idempotence",
        "Traçabilité",
        "Quand éviter un agent autonome",
        "Introduction à MCP",
      ]),
      mod("llm", "E", "Fiabilité et sécurité", [
        "Prompt injection",
        "Documents et sorties d'outils non fiables",
        "Séparation instructions / données",
        "Exposition de secrets",
        "Droits minimaux",
        "Isolation des utilisateurs",
        "Hallucinations",
        "Jeux de questions de référence",
        "Critères d'évaluation",
        "Tests de régression",
        "Qualité de récupération et de réponse",
        "Limites des évaluateurs LLM",
        "Coût et latence par exécution",
      ]),
    ],
  },
  {
    id: "bi",
    title: "Business Intelligence, Power BI et analyse métier",
    short: "BI",
    description:
      "Transformer une demande en question analytique, modéliser en étoile, raisonner en DAX et communiquer. Laboratoire natif + parcours Power BI Desktop (pas d'exécution de Power BI dans le navigateur).",
    project: {
      title: "Rapport ventes, marges et retours",
      summary: "Chiffres de référence vérifiés en SQL (KPI mensuels, retours, période comparable), puis rapport dans Power BI Desktop en auto-évaluation : le fichier Power BI n'est pas vérifié par SkillForge.",
      status: "disponible",
    },
    plannedVisualizations: [
      "Schéma en étoile",
      "Circulation des filtres",
      "Contexte de ligne et contexte de filtre",
      "Construction progressive d'une mesure",
      "Comparaison de graphiques",
      "Évolution d'un KPI quand sa définition change",
    ],
    modules: [
      mod("bi", "A", "Raisonnement métier", [
        "De la demande à la question analytique",
        "Choisir des KPI",
        "Numérateur, dénominateur, période et granularité",
        "Dimensions et mesures",
        "Biais de sélection",
        "Corrélation et causalité",
        "Statistiques descriptives",
        "Interprétation et communication",
        "Recommandations et limites",
      ]),
      mod("bi", "B", "Préparation et modélisation", [
        "ETL et ELT",
        "Nettoyage",
        "Fusion et ajout",
        "Types",
        "Qualité",
        "Schéma en étoile",
        "Tables de faits et dimensions",
        "Granularité",
        "Table calendrier",
        "Cardinalités",
        "Propagation des filtres",
        "Power Query et langage M",
      ]),
      mod("bi", "C", "DAX", [
        "Mesures et colonnes calculées",
        "SUM, AVERAGE, COUNTROWS, DISTINCTCOUNT",
        "DIVIDE",
        "IF et SWITCH",
        "Contexte de ligne",
        "Contexte de filtre",
        "CALCULATE",
        "FILTER",
        "ALL et REMOVEFILTERS",
        "Itérateurs (SUMX)",
        "Transition de contexte",
        "Comparaisons temporelles",
        "Cumuls",
        "Conditions des fonctions de temps",
      ]),
      mod("bi", "D", "Visualisation et publication", [
        "Choisir le bon graphique",
        "Axes et échelles trompeuses",
        "Filtres et segments",
        "Drill-down et drill-through",
        "Info-bulles",
        "Accessibilité",
        "Narration",
        "Performance",
        "Rafraîchissement",
        "Passerelle (concept)",
        "Workspaces",
        "Partage et licences",
        "Sécurité au niveau des lignes",
      ]),
    ],
  },
  {
    id: "ml",
    title: "Machine learning appliqué avec scikit-learn",
    short: "ML",
    description: "Préparer, entraîner, valider et évaluer des modèles avec rigueur : baseline, fuite de données, métriques adaptées au coût métier.",
    project: {
      title: "Prédiction du départ de clients",
      summary: "Comparaison à une baseline, régression logistique (scikit-learn), choix d'un seuil par le coût des erreurs. L'analyse détaillée des erreurs et la préparation des variables sont prévues.",
      status: "disponible",
    },
    plannedVisualizations: [
      "Droite de régression manipulable",
      "Frontière de décision",
      "Profondeur d'un arbre",
      "Surapprentissage",
      "Séparation des ensembles",
      "Fuite de données",
      "Matrice de confusion interactive",
      "Curseur de seuil et conséquences métier",
      "Centres K-means",
      "Projection PCA",
    ],
    modules: [
      mod("ml", "A", "Fondations", [
        "Supervisé et non supervisé",
        "Régression et classification",
        "Variables explicatives et cible",
        "Échantillons",
        "Distributions",
        "Moyenne, variance et écart-type",
        "Probabilités élémentaires",
        "Vecteurs et distances",
        "Limites des données",
        "Baseline",
      ]),
      mod("ml", "B", "Préparation et validation", [
        "Analyse exploratoire",
        "Valeurs manquantes",
        "Variables catégorielles",
        "Encodage",
        "Standardisation",
        "Entraînement / validation / test",
        "Stratification",
        "Validation croisée",
        "Séparation temporelle",
        "Fuite de données",
        "Pipeline et ColumnTransformer",
        "Déséquilibre des classes",
      ]),
      mod("ml", "C", "Modèles", [
        "Régression linéaire",
        "Régression logistique",
        "k plus proches voisins",
        "Arbres",
        "Forêts aléatoires",
        "Gradient boosting",
        "K-means",
        "PCA",
        "Régularisation",
        "Hyperparamètres",
        "Recherche d'hyperparamètres",
      ]),
      mod("ml", "D", "Évaluation", [
        "MAE, RMSE et R²",
        "Matrice de confusion",
        "Précision, rappel et F1",
        "ROC-AUC et précision-rappel",
        "Choix d'un seuil",
        "Coût métier des erreurs",
        "Surapprentissage",
        "Compromis biais-variance",
        "Courbes d'apprentissage",
        "Importance des variables",
        "Limites de l'interprétation",
        "Calibration",
      ]),
      mod("ml", "E", "Utilisation d'un modèle", [
        "Reproductibilité",
        "Sauvegarde et chargement",
        "API de prédiction",
        "Schéma des entrées",
        "Tests",
        "Dérive des données",
        "Surveillance",
        "Limites et biais",
        "Model card",
        "Fichiers de modèles non fiables",
      ]),
    ],
  },
];

for (const d of domains)
  for (const m of d.modules)
    for (const n of m.notions) if (implemented[n.id]) Object.assign(n, implemented[n.id]);

export const curriculum: readonly Domain[] = domains;

/**
 * Dépendances entre modules (« s'appuie sur ») : utilisées par la carte des compétences et pour
 * expliquer l'ordre du parcours. Les prérequis fins, notion par notion, sont dans `implemented`.
 */
export const moduleDependencies: readonly { from: string; to: string; reason: string }[] = [
  { from: "python.a", to: "python.b", reason: "Structurer un programme suppose de savoir écrire boucles, conditions et fonctions." },
  { from: "python.b", to: "python.c", reason: "pandas s'utilise dans des fonctions testables et gère les erreurs de données." },
  { from: "python.b", to: "python.d", reason: "Automatiser des appels d'API exige exceptions, fichiers et découpage en fonctions." },
  { from: "sql.b", to: "sql.c", reason: "Modifier une base suppose de savoir interroger et vérifier son contenu." },
  { from: "sql.a", to: "sql.c", reason: "Créer des tables demande le modèle relationnel (clés, contraintes)." },
  { from: "sql.b", to: "sql.d", reason: "Les indicateurs métier combinent filtres, agrégations et jointures." },
  { from: "llm.a", to: "llm.b", reason: "Concevoir une application demande de connaître tokens, contexte et limites des modèles." },
  { from: "python.d", to: "llm.b", reason: "Une application LLM appelle une API depuis du code serveur." },
  { from: "llm.b", to: "llm.c", reason: "Le RAG est une architecture d'application LLM." },
  { from: "llm.b", to: "llm.d", reason: "Les outils prolongent les appels de modèle structurés." },
  { from: "llm.c", to: "llm.e", reason: "Évaluer et sécuriser suppose un système RAG à tester." },
  { from: "llm.d", to: "llm.e", reason: "Les agents posent les risques de sécurité les plus importants." },
  { from: "bi.a", to: "bi.b", reason: "On modélise pour répondre à une question métier définie." },
  { from: "sql.b", to: "bi.b", reason: "Préparer et relier des tables reprend les jointures et agrégations SQL." },
  { from: "bi.b", to: "bi.c", reason: "DAX calcule sur un modèle en étoile." },
  { from: "bi.c", to: "bi.d", reason: "Les visuels affichent des mesures DAX." },
  { from: "ml.a", to: "ml.b", reason: "Préparer des données suppose de savoir ce qu'on cherche à prédire." },
  { from: "python.c", to: "ml.b", reason: "La préparation se fait avec pandas." },
  { from: "ml.b", to: "ml.c", reason: "Un modèle s'entraîne sur des données préparées et séparées." },
  { from: "ml.c", to: "ml.d", reason: "On évalue des modèles entraînés." },
  { from: "ml.d", to: "ml.e", reason: "On n'utilise qu'un modèle évalué." },
];

export const domainById = Object.fromEntries(domains.map((d) => [d.id, d])) as Record<DomainId, Domain>;

export function allNotions() {
  return domains.flatMap((d) => d.modules.flatMap((m) => m.notions.map((n) => ({ domain: d, module: m, notion: n }))));
}

export function moduleById(id: string): Module | undefined {
  for (const d of domains) for (const m of d.modules) if (m.id === id) return m;
  return undefined;
}

export function coverageStats(domainId?: DomainId) {
  const rows = allNotions().filter((r) => !domainId || r.domain.id === domainId);
  const counts = { prevu: 0, redige: 0, implemente: 0, teste: 0, disponible: 0 } as Record<ContentStatus, number>;
  for (const r of rows) counts[r.notion.status]++;
  return { total: rows.length, counts };
}

# Matrice de couverture pédagogique

> Fichier généré depuis `src/content/curriculum.ts` (source de vérité, également affichée dans l'application : page **Programme**). Régénérer avec `pnpm docs:couverture` ; `pnpm test` échoue si ce fichier n'est plus à jour.
> Statuts : Prévu → Rédigé → Implémenté → Testé → Disponible. Seul « Disponible » est jouable comme leçon ; « Testé » signifie qu'un exercice vérifié existe (par exemple une étape de projet) sans leçon dédiée.

## Synthèse

| Domaine | Notions | Prévu | Rédigé | Implémenté | Testé | Disponible | Projet |
|---|---|---|---|---|---|---|---|
| Python | 58 | 57 | 0 | 0 | 0 | 1 | Pipeline d'import, nettoyage et contrôle qualité (Prévu) |
| SQL | 50 | 39 | 0 | 0 | 4 | 7 | Base de données d'une PME (Disponible) |
| LLM | 69 | 69 | 0 | 0 | 0 | 0 | Assistant documentaire avec citations (Prévu) |
| BI | 48 | 48 | 0 | 0 | 0 | 0 | Rapport ventes, marges et retours (Prévu) |
| ML | 55 | 51 | 0 | 0 | 0 | 4 | Prédiction du départ de clients (Disponible) |
| **Total** | **280** | 264 | 0 | 0 | 4 | 12 | Projet transversal : copilote data PME (Prévu) |

## Python pour les données et l'automatisation

Visualisations prévues : Évolution des variables pendant une boucle · Références vers des listes · Comparaison boucle / vectorisation · DataFrame avant / après · Chemin d'une requête HTTP · Propagation d'une exception.

| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |
|---|---|---|---|---|---|---|
| A. Fondations | Interpréteur et exécution | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Variables et types | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Conversions | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Opérateurs | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Chaînes et formatage | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Conditions | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Boucles | Disponible | Écrire une boucle for qui parcourt une liste et met à jour un accumulateur, puis prédire sa valeur à chaque itération. | Trace pas à pas d'une boucle, Prédiction, Code à compléter, Exercice autonome avec tests cachés, Débogage, Explication avec ses propres mots | Tests déterministes (visibles + cachés) exécutés dans Pyodide ; validation possible pour sauter la leçon. | Pipeline de données (Domaine 1) : calcul du chiffre d'affaires net et contrôle qualité du rapport. |
| A. Fondations | Listes, tuples, dictionnaires et ensembles | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Mutabilité et références | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Fonctions, paramètres, valeurs de retour | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Portée des variables | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Compréhensions | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Imports et modules | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| A. Fondations | Lecture des messages d'erreur | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Découpage en fonctions | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Conventions de nommage | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Annotations de types | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Exceptions | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Validation des entrées | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Assertions et tests pertinents | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Logs | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Fichiers et chemins | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Gestionnaire de contexte | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Environnements virtuels | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Dépendances | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Variables d'environnement | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Dates, heures et fuseaux | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| B. Écrire un programme fiable | Bases de Git | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Tableaux NumPy, dimensions et types | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Opérations vectorisées | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Indexation | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Series et DataFrame | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Chargement CSV, Excel et JSON | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Sélection et filtrage | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Données manquantes | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Doublons | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Conversions de types | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Colonnes calculées | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | groupby et agrégations | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | merge, concat et jointures | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | pivot et melt | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Données temporelles | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Statistiques descriptives | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Visualisation exploratoire | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| C. NumPy et pandas | Export et contrôles de qualité | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | HTTP, méthodes et codes de statut | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | JSON | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Paramètres | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Authentification | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Pagination | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Timeouts | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Limites de débit | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Nouvelles tentatives avec temporisation | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Idempotence | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Extraction de données | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Automatisation de traitements | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Planification et suivi d'exécution | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |
| D. API et automatisation | Séparation configuration, logique et secrets | Prévu | — | — | — | Pipeline d'import, nettoyage et contrôle qualité |

## SQL et conception de bases de données

Visualisations prévues : Déplacement des lignes dans une jointure · Résultat intermédiaire de chaque étape · Ordre logique d'une requête · Partitions d'une fonction de fenêtre · Effets d'une transaction · Parcours simplifié d'un index · Diagramme relationnel manipulable.

| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |
|---|---|---|---|---|---|---|
| A. Modèle relationnel | Tables, lignes et colonnes | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Types | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Clés primaires et étrangères | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Cardinalités | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Contraintes | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Valeurs NULL | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Intégrité référentielle | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Modèles entité-association | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Normalisation jusqu'à la 3FN | Prévu | — | — | — | Base de données d'une PME |
| A. Modèle relationnel | Arbitrages de dénormalisation | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | SELECT, FROM et WHERE | Disponible | Écrire une requête qui sélectionne des colonnes et filtre des lignes avec des conditions combinées (AND, OR, parenthèses), et prédire le nombre de lignes obtenues. | Ordre logique d'une requête pas à pas (résultats réels), Prédiction, Exemple exécutable, Exercice guidé, Débogage (priorité AND/OR), Test de validation | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | ORDER BY et LIMIT | Disponible | Trier un résultat sur une ou plusieurs clés, gérer les égalités et limiter le nombre de lignes. | Exercice autonome avec cas cachés, Test de validation (ordre vérifié) | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | DISTINCT | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Expressions et alias | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | CASE | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Agrégations | Disponible | Calculer des totaux, moyennes et comptages (COUNT(*) vs COUNT(colonne)) et choisir la bonne granularité. | Ordre logique avec GROUP BY et HAVING (résultats réels), Prédiction, Exemple exécutable, Exercice guidé, Exercice autonome, Test de validation | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | GROUP BY et HAVING | Disponible | Regrouper des lignes et filtrer des groupes avec HAVING, en distinguant WHERE (lignes) de HAVING (groupes). | Débogage (WHERE vs HAVING), Exercice autonome, Test de validation | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | INNER JOIN et LEFT JOIN | Disponible | Joindre deux à trois tables, choisir INNER ou LEFT JOIN et compter correctement les lignes sans correspondance. | Jointure pas à pas (INNER / LEFT), Prédiction, Exemple exécutable, Exercice guidé, Exercice autonome, Test de validation | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | Autres jointures selon le moteur | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | UNION et UNION ALL | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Sous-requêtes | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | EXISTS | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | CTE | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Fonctions de fenêtre | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Rangs, cumuls et période précédente | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Dates et chaînes | Prévu | — | — | — | Base de données d'une PME |
| B. Requêtes | Logique à trois valeurs avec NULL | Disponible | Expliquer pourquoi « = NULL » ne trouve rien et utiliser IS NULL / IS NOT NULL / COALESCE à bon escient. | Prédiction, Exercice autonome (fiches incomplètes) avec cas cachés | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| B. Requêtes | Doublons créés par les jointures | Disponible | Repérer qu'une jointure multiplie des lignes avant une agrégation et corriger le calcul (agréger avant de joindre, ou sous-requête). | Débogage avec cas cachés, Discussion dans le journal du projet | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| C. Modifier et exploiter une base | CREATE et ALTER | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | INSERT, UPDATE et DELETE | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Transactions | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | COMMIT et ROLLBACK | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Principes ACID | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Vues | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Index | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Lecture élémentaire d'EXPLAIN | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Requêtes paramétrées | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Injection SQL | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Permissions | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | Sauvegarde et restauration | Prévu | — | — | — | Base de données d'une PME |
| C. Modifier et exploiter une base | OLTP et OLAP | Prévu | — | — | — | Base de données d'une PME |
| D. SQL métier | Chiffre d'affaires | Testé | Calculer un chiffre d'affaires mensuel selon une définition explicite (statuts inclus, prix facturé). | Étape du projet PME, corrigée par comparaison de résultats, Décision notée dans le journal | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| D. SQL métier | Marge | Testé | Calculer une marge brute par produit et la classer. | Étape du projet PME, corrigée par comparaison de résultats, Décision notée dans le journal | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| D. SQL métier | Panier moyen | Testé | Calculer un panier moyen par segment à la bonne granularité (par commande). | Étape du projet PME, corrigée par comparaison de résultats, Décision notée dans le journal | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| D. SQL métier | Rétention | Prévu | — | — | — | Base de données d'une PME |
| D. SQL métier | Cohortes | Prévu | — | — | — | Base de données d'une PME |
| D. SQL métier | Segmentation | Prévu | — | — | — | Base de données d'une PME |
| D. SQL métier | Classement des produits | Prévu | — | — | — | Base de données d'une PME |
| D. SQL métier | Suivi de qualité | Testé | Produire des indicateurs de suivi (factures en attente, taux de retour) sans doubles comptages. | Étape du projet PME, corrigée par comparaison de résultats, Décision notée dans le journal | Requête comparée à une référence par PostgreSQL (PGlite) sur les données actuelles et sur des données modifiées cachées ; l'ordre ne compte que s'il est demandé. | Base de données d'une PME (projet SQL) : réponses vérifiées aux questions de la direction, journal de décisions, export Markdown. |
| D. SQL métier | Questions ambiguës et définitions | Prévu | — | — | — | Base de données d'une PME |

## Applications LLM : RAG, outils et évaluation

Visualisations prévues : Tokenisation illustrative (distincte d'un tokenizer réel) · Budget de contexte · Pipeline RAG · Cartes de résultats de recherche · Effets du découpage · Déroulé d'un appel d'outil · Historique d'un agent · Comparaison de deux configurations.

| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |
|---|---|---|---|---|---|---|
| A. Fondations des LLM | Capacités et limites | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Tokens | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Fenêtre de contexte | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Génération probabiliste | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Paramètres selon le fournisseur | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Rôles des messages | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Instructions et exemples | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Sorties structurées | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Validation de schéma | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Coût et latence | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Streaming | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Erreurs et limites des API | Prévu | — | — | — | Assistant documentaire avec citations |
| A. Fondations des LLM | Données d'entraînement et contexte fourni | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Appels côté serveur | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Gestion des secrets | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Interface fournisseur interchangeable | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Conversation et gestion du contexte | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Mémoire explicite | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Journalisation | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Cache | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Budgets | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Gestion des erreurs | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Modèles simulés pour les exercices | Prévu | — | — | — | Assistant documentaire avec citations |
| B. Conception d'applications | Simulation et appel réel | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Chargement des documents | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Extraction de texte | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Découpage | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Embeddings | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Similarité | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Recherche vectorielle | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Recherche lexicale et hybride | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Métadonnées et filtres | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Reranking | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Construction du contexte | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Citations | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Abstention | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Mise à jour d'un index | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Provenance | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Permissions d'accès | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | OCR et tableaux | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | RAG ou fine-tuning | Prévu | — | — | — | Assistant documentaire avec citations |
| C. RAG | Quand une recherche simple suffit | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Définition d'un outil | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Schémas d'entrée et de sortie | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Appels de fonctions | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Workflows déterministes | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Boucle d'agent | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | États | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Limites d'itérations | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Timeouts | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Nouvelles tentatives | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Validation humaine des actions sensibles | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Idempotence | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Traçabilité | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Quand éviter un agent autonome | Prévu | — | — | — | Assistant documentaire avec citations |
| D. Outils et agents | Introduction à MCP | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Prompt injection | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Documents et sorties d'outils non fiables | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Séparation instructions / données | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Exposition de secrets | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Droits minimaux | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Isolation des utilisateurs | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Hallucinations | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Jeux de questions de référence | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Critères d'évaluation | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Tests de régression | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Qualité de récupération et de réponse | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Limites des évaluateurs LLM | Prévu | — | — | — | Assistant documentaire avec citations |
| E. Fiabilité et sécurité | Coût et latence par exécution | Prévu | — | — | — | Assistant documentaire avec citations |

## Business Intelligence, Power BI et analyse métier

Visualisations prévues : Schéma en étoile · Circulation des filtres · Contexte de ligne et contexte de filtre · Construction progressive d'une mesure · Comparaison de graphiques · Évolution d'un KPI quand sa définition change.

| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |
|---|---|---|---|---|---|---|
| A. Raisonnement métier | De la demande à la question analytique | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Choisir des KPI | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Numérateur, dénominateur, période et granularité | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Dimensions et mesures | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Biais de sélection | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Corrélation et causalité | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Statistiques descriptives | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Interprétation et communication | Prévu | — | — | — | Rapport ventes, marges et retours |
| A. Raisonnement métier | Recommandations et limites | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | ETL et ELT | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Nettoyage | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Fusion et ajout | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Types | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Qualité | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Schéma en étoile | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Tables de faits et dimensions | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Granularité | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Table calendrier | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Cardinalités | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Propagation des filtres | Prévu | — | — | — | Rapport ventes, marges et retours |
| B. Préparation et modélisation | Power Query et langage M | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Mesures et colonnes calculées | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | SUM, AVERAGE, COUNTROWS, DISTINCTCOUNT | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | DIVIDE | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | IF et SWITCH | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Contexte de ligne | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Contexte de filtre | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | CALCULATE | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | FILTER | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | ALL et REMOVEFILTERS | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Itérateurs (SUMX) | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Transition de contexte | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Comparaisons temporelles | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Cumuls | Prévu | — | — | — | Rapport ventes, marges et retours |
| C. DAX | Conditions des fonctions de temps | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Choisir le bon graphique | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Axes et échelles trompeuses | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Filtres et segments | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Drill-down et drill-through | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Info-bulles | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Accessibilité | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Narration | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Performance | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Rafraîchissement | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Passerelle (concept) | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Workspaces | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Partage et licences | Prévu | — | — | — | Rapport ventes, marges et retours |
| D. Visualisation et publication | Sécurité au niveau des lignes | Prévu | — | — | — | Rapport ventes, marges et retours |

## Machine learning appliqué avec scikit-learn

Visualisations prévues : Droite de régression manipulable · Frontière de décision · Profondeur d'un arbre · Surapprentissage · Séparation des ensembles · Fuite de données · Matrice de confusion interactive · Curseur de seuil et conséquences métier · Centres K-means · Projection PCA.

| Module | Notion | Statut | Objectif observable | Activités | Évaluation | Projet |
|---|---|---|---|---|---|---|
| A. Fondations | Supervisé et non supervisé | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Régression et classification | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Variables explicatives et cible | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Échantillons | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Distributions | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Moyenne, variance et écart-type | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Probabilités élémentaires | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Vecteurs et distances | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Limites des données | Prévu | — | — | — | Prédiction du départ de clients |
| A. Fondations | Baseline | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Analyse exploratoire | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Valeurs manquantes | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Variables catégorielles | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Encodage | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Standardisation | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Entraînement / validation / test | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Stratification | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Validation croisée | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Séparation temporelle | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Fuite de données | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Pipeline et ColumnTransformer | Prévu | — | — | — | Prédiction du départ de clients |
| B. Préparation et validation | Déséquilibre des classes | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Régression linéaire | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Régression logistique | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | k plus proches voisins | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Arbres | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Forêts aléatoires | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Gradient boosting | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | K-means | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | PCA | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Régularisation | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Hyperparamètres | Prévu | — | — | — | Prédiction du départ de clients |
| C. Modèles | Recherche d'hyperparamètres | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | MAE, RMSE et R² | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Matrice de confusion | Disponible | Classer chaque prédiction en VP, FP, FN, VN et relier chaque case à sa conséquence métier. | Association situations → cases, Visualisation du seuil, Exercice guidé, Base de comparaison (projet) | Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur. | Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût. |
| D. Évaluation | Précision, rappel et F1 | Disponible | Calculer précision, rappel et F1 à un seuil donné, cas limites compris, et les retrouver avec scikit-learn. | Démonstration scikit-learn exécutable, Exercice autonome avec cas cachés, Débogage (F1) | Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur. | Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût. |
| D. Évaluation | ROC-AUC et précision-rappel | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Choix d'un seuil | Disponible | Faire varier un seuil de décision et décrire l'arbitrage précision / rappel. | Visualisation du seuil (balayage animé, version texte), Exercice autonome, Test de validation | Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur. | Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût. |
| D. Évaluation | Coût métier des erreurs | Disponible | Choisir le seuil qui minimise un coût métier explicite et en exposer les limites. | Visualisation avec coûts modifiables, Test de validation, Recommandation chiffrée (projet) | Fonctions Python vérifiées par tests visibles et cachés (Pyodide) ; valeurs du projet recalculées avec scikit-learn 1.8 dans le navigateur. | Prédiction du départ de clients (projet ML) : base de comparaison, régression logistique, seuil chiffré par le coût. |
| D. Évaluation | Surapprentissage | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Compromis biais-variance | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Courbes d'apprentissage | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Importance des variables | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Limites de l'interprétation | Prévu | — | — | — | Prédiction du départ de clients |
| D. Évaluation | Calibration | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Reproductibilité | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Sauvegarde et chargement | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | API de prédiction | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Schéma des entrées | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Tests | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Dérive des données | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Surveillance | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Limites et biais | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Model card | Prévu | — | — | — | Prédiction du départ de clients |
| E. Utilisation d'un modèle | Fichiers de modèles non fiables | Prévu | — | — | — | Prédiction du départ de clients |

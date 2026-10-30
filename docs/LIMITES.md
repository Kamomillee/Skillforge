# Limites connues (étapes 1 à 7)

## Contenu
- **21 notions sont disponibles** sur 280 (Python 1, SQL 7, LLM 5, BI 4, ML 4), 10 autres sont « testées » via les projets. La matrice de couverture l'indique honnêtement.
- Quatre projets sont jouables (SQL, ML, LLM, BI). La partie conception du projet PME est prévue ; le projet Python de domaine n'est pas encore implémenté (le projet transversal en couvre l'import et le nettoyage) ; l'interface l'indique là où ils apparaissent.

## Laboratoires de l'étape 4
- **LLM** : aucun modèle de langage n'est appelé. La « réponse » est produite par un **modèle simulé** (extraction de la phrase la plus pertinente), signalé partout où il apparaît. Découpage, recherche, contexte, citations, abstention et évaluation sont réels. La recherche est **lexicale** (pas d'embeddings) : elle rate les synonymes et la conjugaison, ce que la leçon montre et mesure (4 silences à tort sur 13 questions).
- **BI** : Power BI ne s'exécute pas dans un navigateur. Les mesures sont calculées en SQL (PostgreSQL) et le DAX est **affiché sans être exécuté** ; l'équivalence est expliquée (DIVIDE ↔ NULLIF, ALL ↔ fonction de fenêtre) mais n'est pas prouvée par un moteur DAX. Le rapport Power BI du projet est en **auto-évaluation** : SkillForge ne lit pas le fichier .pbix et ne compte pas ces cases dans la maîtrise.
- **ML** : scikit-learn 1.8 tourne dans Pyodide (~30 Mo au premier usage). Les probabilités du projet sont recalculées par les tests ; une autre version de scikit-learn pourrait donner des écarts au-delà de la tolérance (0,002). Le calcul de coût suppose que l'offre retient chaque abonné détecté : la leçon l'écrit explicitement.
- Le mini-diagnostic de l'onboarding ne couvre que Python.

## Tuteur et révision (étape 5)
- **Tuteur local** : il n'invente rien, mais il ne « comprend » pas ton code ; il s'appuie sur les tests, les étiquettes d'erreur et des textes rédigés. Quand aucun test ne pose d'étiquette, il ne peut que pointer le cas échoué et poser une question générale.
- **Tuteur IA** : disponible seulement avec le serveur SkillForge et une clé configurée côté serveur (`ANTHROPIC_API_KEY`) ; la version statique n'en a pas. Il peut se tromper : ses réponses sont étiquetées, placées sous les résultats testés, et signalables. Il n'a pas été essayé avec une vraie clé pendant le développement (requête vérifiée par tests, pas la qualité des réponses). Les fallbacks côté serveur sont activés : une demande refusée par le modèle principal peut être traitée par un modèle de repli.
- Les limites de débit par minute sont en mémoire et par adresse IP ; le budget quotidien du tuteur IA est, lui, par compte et persistant (étape 7).
- **Variantes** : 4 tests de validation sur 7 en ont ; les autres révisions reprennent l'exercice d'origine.
- Mini-test de rappel et cases de fiches : auto-évaluation, jamais comptée comme preuve.
- Signalements : envoyés à l'équipe pédagogique quand l'étudiant est connecté (étape 7) ; sinon stockés dans le navigateur et inclus dans l'export.

## Projet transversal, entretien, portfolio (étape 6)
- Les étapes 8 à 10 du projet transversal sont **rédigées**, pas corrigées : elles sont « rédigées » quand leurs champs sont remplis, jamais « vérifiées ».
- Le tableau de bord se construit dans un outil externe (Power BI, Excel…) : SkillForge vérifie les indicateurs source en SQL, pas l'affichage.
- Mode entretien : les réponses écrites sont relues par **repères textuels** (mots ou expressions attendus). C'est une aide à la relecture : une idée formulée autrement peut ne pas être repérée. Les critères ne produisent aucune note.
- Les sessions d'entretien, le portfolio et les rédactions restent dans le navigateur (inclus dans l'export des données) ; synchronisés avec le compte quand l'étudiant en a un, jamais publiés.
- L'attestation est interne au parcours : elle n'a aucune valeur de certification.

## Comptes, serveur et administration (étape 7)
- Le serveur est **mono-instance** (SQLite, compteurs de débit et métriques en mémoire). Plusieurs instances demanderaient une base partagée (PostgreSQL) et un stockage commun des limites ; l'interface `Db` est isolée pour ce changement.
- Pas de réinitialisation de mot de passe par e-mail (aucun envoi d'e-mail configuré) ni de vérification de l'adresse ; pas d'authentification à deux facteurs.
- La synchronisation transfère toute la progression (instantané JSON, 2 Mo maximum) ; au-delà, il faudra une synchronisation par enregistrement.
- Le choix « Prendre le compte » remplace la progression locale après téléchargement d'une copie : il n'y a pas de fusion automatique des deux versions.
- Administration : les contenus se modifient dans le code (relus et testés), pas depuis l'interface ; l'inventaire et les signalements disent quoi corriger. Une seule notion de rôle (étudiant / administration) ; pas d'enseignant limité à une classe.
- Consommation IA : réelle (jetons renvoyés par l'API) avec Claude, **estimée** (≈ 4 caractères par jeton) avec le tuteur simulé, et affichée comme telle. Aucune facturation n'existe ; le budget est un plafond technique.
- Les journaux vont sur la sortie standard (JSON) ; pas de collecte centralisée ni d'alertes configurées.
- Aucun test sur un hébergement réel (HTTPS, proxy) : le serveur a été testé en local, en HTTP.

## Exécution Python (navigateur)
- **Mémoire** : pas de limite fine ; seule celle du navigateur s'applique (WebAssembly 32 bits, 4 Go max). Un programme qui alloue énormément peut faire planter le worker ; il est alors recréé.
- **Réseau** : `pyodide.http` est retiré, mais un code déterminé peut encore appeler `fetch` via le module `js`. Aucun secret n'est présent dans le navigateur, le risque est donc limité à l'étudiant lui-même. Servi par le serveur SkillForge, la CSP `connect-src 'self'` bloque les requêtes vers d'autres sites ; les requêtes vers le serveur lui-même portent le cookie de l'étudiant connecté (son propre compte, et les modifications exigent un en-tête que le code peut ajouter : c'est le compte de l'étudiant qui exécute son propre code).
- **Interruption** : douce seulement avec COOP/COEP ; sinon redémarrage du moteur (état Python perdu, ≈ 2 s).
- **Premier chargement** : ~10 Mo pour le noyau Python ; scikit-learn et ses dépendances (~30 Mo) ne sont chargés que par les contenus qui les déclarent (démonstration ML, étape 2 du projet churn). La limite de temps est suspendue pendant ce chargement.

## Exécution SQL (navigateur)
- **Taille** : ~17 Mo (wasm + données) téléchargés à la première ouverture d'un contenu SQL ; moteur prêt en ~3 s mesurées sur Chromium headless local, davantage sur un ordinateur lent ou un réseau mobile.
- **Interruption** : PGlite n'applique pas `statement_timeout` ; le dépassement de la limite de temps (8 s) termine le worker et recrée la base (~3 s). Aucune perte de travail : la base de formation est en lecture seule.
- **Lecture seule** : chaque requête est annulée (`ROLLBACK`). Les instructions `INSERT/UPDATE/DELETE` s'exécutent mais n'ont aucun effet durable ; le module C (transactions, modifications) demandera un mode d'exercice dédié.
- **Résultats** : 500 lignes maximum renvoyées en exécution libre (5 000 pendant la correction), 200 affichées.
- **Dialecte** : PostgreSQL 18.6. Ce qui est appris est transposable, mais quelques fonctions (`to_char`, `::` pour les conversions) diffèrent dans d'autres moteurs (SQL Server, MySQL) ; les leçons le signalent quand c'est le cas.
- Le jeu de données est **synthétique** (voir [DONNEES.md](DONNEES.md)) : les ordres de grandeur sont plausibles, pas réalistes au sens statistique.

## Carte des compétences
- Les prérequis fins ne sont renseignés que pour les notions jouables ; pour les autres, seules les dépendances entre modules sont montrées.
- La vue d'ensemble a une largeur fixe (~1 100 px) : sur téléphone elle défile horizontalement dans son cadre ; la version liste est plus confortable.

## Correction
- La correction s'exécute dans le navigateur : un étudiant peut lire les tests cachés dans les outils de développement. C'est acceptable pour s'entraîner ; une **attestation** de parcours devra être recorrigée côté serveur (étape 7).
- Le code de l'étudiant et le harnais partagent l'interpréteur : un code malveillant pourrait altérer le harnais. Même conclusion que ci-dessus.
- Les comparaisons de flottants sont exactes sauf mention `approx` ; les énoncés demandent explicitement l'arrondi.
- SQL : les requêtes de référence et les données des cas cachés sont dans le bundle ; même conclusion (entraînement oui, attestation non).
- Activités : la réponse attendue est dans le bundle ; les essais sont illimités. C'est pourquoi elles ne comptent pas pour le niveau de maîtrise.
- SQL : les pistes d'erreurs fréquentes sont des indications heuristiques (vérification échouée + motifs lus dans la requête) ; elles peuvent manquer ou être imprécises, la réussite elle-même ne dépend que des résultats.

## Progression et données
- Sans compte, stockée uniquement dans ce navigateur, perdue si les données du site sont effacées (export JSON disponible). Avec un compte, synchronisée **à la demande** (bouton) : pas de synchronisation automatique en arrière-plan.
- Le temps actif est une **mesure locale** (page visible + interaction dans la dernière minute), pas une durée d'apprentissage exacte.
- Journal de décisions du projet : sauvegardé par étape ; si la même étape est modifiée dans deux onglets en même temps, le dernier enregistrement gagne (pas de détection de conflit, contrairement au code des exercices).

## Interface
- Testée dans Chromium (desktop 1440×900 et Pixel 7). Firefox et Safari non testés automatiquement à cette étape.
- Accessibilité : audit automatique axe-core (WCAG 2.1 A/AA) sur 15 pages en thème clair et 4 en sombre, sans violation ; navigation clavier testée (lien d'évitement, dialogues). Un audit automatique ne couvre qu'une partie des critères : pas de test avec un vrai lecteur d'écran (NVDA, VoiceOver), éditeur CodeMirror exclu de l'audit (accessibilité propre à la bibliothèque), nœuds de la carte SVG nommés par leur texte visible, parfois tronqué (la version liste donne les titres complets).
- Le bundle JavaScript principal fait ~1 Mo (non gzippé, 320 Ko gzip), à découper par route ; le moteur SQL est déjà chargé à part (worker).

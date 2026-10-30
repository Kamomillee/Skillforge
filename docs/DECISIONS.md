# Décisions techniques

Format court : contexte → décision → conséquences. Les décisions sont réversibles sauf mention contraire.

## D1 — Vite + React + TypeScript, sans Next.js pour l'instant
- **Contexte** : l'étape 1 est entièrement côté client (exécution Python dans le navigateur, progression locale).
- **Décision** : SPA Vite + React 19 + TypeScript strict, routage par hash.
- **Conséquences** : déploiement statique simple, démarrage rapide. Un serveur (Node, probablement Hono ou Fastify) sera ajouté à l'étape 5 pour les appels IA, et à l'étape 7 pour les comptes. Next.js reste envisageable si le rendu serveur devient utile ; ce n'est pas le cas pour une application d'exercices.

## D2 — Pyodide auto-hébergé, version 314.0.7
- **Contexte** : exécuter du vrai Python sans backend, avec pandas, NumPy et scikit-learn.
- **Vérification réelle** (Node, 30/10/2026) : Python 3.14.2, NumPy 2.4.6, pandas 3.0.2, scikit-learn 1.8.0 chargés ; régression logistique entraînée et prédite ; `isna()` fonctionnel. Chargement à froid ~2 s pour le noyau, ~18 s supplémentaires pour les trois paquets (Node, sans cache).
- **Décision** : fichiers servis depuis `public/pyodide/` (noyau + 9 paquets, ~39 Mo), extraits de l'archive officielle GitHub par `scripts/fetch-pyodide.mjs`. Paquets chargés à la demande par exercice.
- **Conséquences** : aucun CDN ni tiers à l'exécution ; isolation cross-origin possible (`require-corp`).

## D3 — Exécution dans un Web Worker, interruption par SharedArrayBuffer
- **Décision** : jamais d'exécution dans le thread principal ni sur un serveur applicatif. Limite de temps par exercice ; interruption douce via `setInterruptBuffer`, puis `terminate()` en dernier recours.
- **Conséquences** : nécessite COOP/COEP pour l'interruption douce ; sans eux, l'arrêt redémarre le moteur (≈ 2 s).

## D4 — CodeMirror 6 plutôt que Monaco
- **Décision** : CodeMirror 6 (coloration, numéros de ligne, indentation, raccourcis, accessibilité clavier avec Échap puis Tab).
- **Conséquences** : bundle bien plus léger que Monaco, meilleur support mobile. Pas d'IntelliSense.

## D5 — Correction par comportement, harnais Python unique
- **Décision** : un seul harnais (`grading/harness.ts`) utilisé par le navigateur et par les tests Node. Les tests appellent la fonction et comparent les valeurs, jamais le texte du code.
- **Conséquences** : les solutions alternatives sont acceptées ; chaque exercice est vérifié automatiquement (référence réussit, départ échoue, erreurs typiques détectées).

## D6 — Progression locale (IndexedDB) derrière une interface `Store`
- **Contexte** : utile sans compte ni serveur ; données personnelles minimales.
- **Décision** : IndexedDB, export/import JSON, suppression totale depuis les paramètres. Concurrence optimiste par numéro de révision.
- **Conséquences** : la progression ne suit pas l'étudiant d'un appareil à l'autre avant l'étape 7. La correction côté client peut être contournée par un étudiant qui inspecte le code : acceptable pour l'entraînement, pas pour une attestation (voir LIMITES).

## D7 — CSS natif avec jetons, sans bibliothèque de composants
- **Décision** : variables CSS (thèmes clair/sombre, couleurs sémantiques), éléments natifs accessibles (`<dialog>`, `<details>`, boutons radio stylés), pas de framework CSS.
- **Conséquences** : moins de dépendances ; les composants complexes (palette de commandes, combobox) pourront justifier Radix ou React Aria plus tard.

## D8 — Contenus en TypeScript validés par zod
- **Décision** : leçons et exercices sont des modules TS (typage, relecture en revue de code), validés par zod au chargement et testés par exécution.
- **Conséquences** : un outil d'administration des contenus (étape 7) pourra exporter vers ce format ou vers une base.

## D9 — SQL : PGlite (PostgreSQL 18.6 en WebAssembly), dans un Web Worker
- **Choix** : `@electric-sql/pglite` 0.5.10, vrai PostgreSQL (dialecte, messages d'erreur, codes SQLSTATE et positions, fonctions de fenêtre, `EXPLAIN`, `to_char`, `NOT EXISTS`…). L'étudiant apprend le SQL qu'il retrouvera en entreprise, pas un dialecte simplifié.
- **Mesures** (30/10/2026) : ~11 Mo de WebAssembly + 6 Mo de données (3,7 Mo gzip pour le wasm), chargés seulement à l'ouverture d'un contenu SQL ; moteur prêt en ~3 s (Chromium headless, initialisation + chargement du jeu de données) ; ensemencement ~60 ms ; correction d'un exercice (3 à 4 cas) 20 à 70 ms.
- **Limite trouvée** : `statement_timeout` n'interrompt pas une requête dans PGlite (une CTE récursive infinie bloque). D'où le **worker** : la limite de temps termine le worker et en recrée un (base réensemencée). Testé de bout en bout.
- **Isolation des données** : chaque requête s'exécute dans `BEGIN … ROLLBACK` ; les mots-clés de contrôle de transaction (`COMMIT`, `ROLLBACK`, `BEGIN`…) sont refusés avec un message (code interne `SF001`). Une requête `DELETE` ne laisse aucune trace (testé).
- **Repli écarté** : SQLite (sql.js) est plus léger mais n'a ni les mêmes types, ni les mêmes messages, ni `to_char` ; il aurait fallu signaler partout les différences de dialecte.

## D10 — Correction SQL par comparaison de résultats
- La requête de l'étudiant et la requête de référence sont exécutées sur **le même état des données**, pour chaque vérification : les données actuelles (visible) puis des états modifiés par un `setup` (cachés : nouvelle ligne, égalité de tri, homonymes, commande annulée…). Une requête qui « code en dur » les identifiants attendus échoue ainsi sur les cas cachés.
- Comparaison en **multiensemble** (les doublons comptent), colonnes par nom (ou par position si l'énoncé le dit), nombres comparés avec une tolérance d'arrondi déclarée par exercice. L'**ordre** n'est vérifié que si l'énoncé l'exige (`orderBy`) : on vérifie alors la séquence des clés de tri, en acceptant tout ordre entre lignes à égalité.
- Les cas cachés n'affichent jamais leurs lignes : seulement le nombre de lignes attendues et obtenues.
- Les **pistes** (erreurs fréquentes) viennent d'abord de la vérification échouée, puis sont précisées par des indices lus dans la requête (`= NULL`, `COUNT(*)` après `LEFT JOIN`) ; elles n'influencent jamais la réussite.

## D11 — Projet : étapes = exercices versionnés + journal de décisions
- Chaque étape de projet est un exercice SQL ordinaire (`kind: "project"`) : même correction, mêmes tentatives versionnées, même sauvegarde. Une étape réussie sans solution affichée compte comme preuve « Démontré » pour sa notion.
- Le journal de décisions est sauvegardé par étape (clé `journal:<projet>:<étape>`) : deux onglets ne peuvent s'écraser qu'au niveau d'un même champ, et c'est le dernier enregistrement qui gagne (voir LIMITES).
- L'export Markdown recalcule les résultats au moment de l'export avec la dernière requête **vérifiée** (sinon le brouillon, signalé comme tel). Aucune note globale n'est inventée : les critères d'acceptation sont listés pour relecture.

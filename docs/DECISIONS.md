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

## D12 — Activités : preuves, pas niveaux
- Une activité réussie (classement, association, lecture de graphique, code à compléter) est une preuve **vérifiée** mais légère : elle apparaît dans « Pourquoi ce statut ? » et ne fait jamais passer une notion à « Démontré ». Raison : une réponse à choix se devine ; un exercice avec cas cachés beaucoup moins.
- Les essais sont illimités (on apprend en se trompant) ; seule la première réussite compte, avec son numéro d'essai.

## D13 — Carte des compétences calculée depuis le programme
- Pas de bibliothèque de graphes : la mise en page est une grille (un rang par domaine, une colonne par module) dans un ordre de rangs fixe choisi pour que les dépendances entre domaines relient des rangs voisins. Lisible, stable d'une visite à l'autre, et testable.
- Le zoom est **sémantique** (domaines → module → notion) et adressable par URL, plutôt qu'un zoom géométrique : chaque niveau a un contenu accessible au clavier et un équivalent liste.

## D11 — Projet : étapes = exercices versionnés + journal de décisions
- Chaque étape de projet est un exercice SQL ordinaire (`kind: "project"`) : même correction, mêmes tentatives versionnées, même sauvegarde. Une étape réussie sans solution affichée compte comme preuve « Démontré » pour sa notion.
- Le journal de décisions est sauvegardé par étape (clé `journal:<projet>:<étape>`) : deux onglets ne peuvent s'écraser qu'au niveau d'un même champ, et c'est le dernier enregistrement qui gagne (voir LIMITES).
- L'export Markdown recalcule les résultats au moment de l'export avec la dernière requête **vérifiée** (sinon le brouillon, signalé comme tel). Aucune note globale n'est inventée : les critères d'acceptation sont listés pour relecture.

## D14 — ML : exercices en Python pur, scikit-learn pour la démonstration et le projet
Les exercices de la leçon demandent d'écrire matrice de confusion, précision, rappel et F1 sans bibliothèque : c'est ce qui se corrige finement (cas limites, erreurs typiques) et ce qu'un entretien demande d'expliquer. scikit-learn sert ensuite à **retrouver** ces valeurs (démonstration) et à entraîner le modèle du projet. Les paquets sont déclarés par contenu (`packages`) et chargés à la demande ; la limite de temps est suspendue pendant le chargement. Les 40 probabilités du projet sont figées dans le contenu **et** recalculées par scikit-learn dans les tests. Le coût affiché par la visualisation est exactement celui de `rapport_seuil` (test dédié) : une incohérence entre les deux a été trouvée et corrigée pendant l'étape.

## D15 — LLM : pipeline réel, génération simulée, référence unique
Le laboratoire n'appelle aucun modèle et n'a besoin d'aucune clé : tout ce qui entoure le modèle (découpage, recherche, budget de contexte, citations, abstention, évaluation) est réel et testé ; seule la génération est remplacée par une extraction déterministe, nommée « modèle simulé » partout. Un pipeline TypeScript unique (`content/llm/rag-core.ts`) alimente la visualisation, les valeurs attendues et le jeu d'évaluation ; les tests vérifient qu'il donne exactement les résultats des solutions Python (3 tailles de morceaux × 13 questions). L'appel à un vrai modèle viendra avec le serveur (étape 5), jamais depuis le navigateur.

## D16 — BI : laboratoire natif en SQL, DAX affiché, Power BI en auto-évaluation
Power BI Desktop ne tourne pas dans un navigateur et aucun moteur DAX libre n'est utilisable ici. Le contexte de filtre est donc rendu **explicite** en SQL : chaque cellule de la matrice a sa requête, exécutable, et un test vérifie qu'elle redonne la valeur de la cellule (3 mesures × 3 années × 18 cellules). Le DAX est montré comme équivalent, étiqueté « non exécuté ». Le projet sépare ce qui est vérifié (chiffres de référence en SQL) de ce qui ne l'est pas (rapport Power BI : cases d'auto-évaluation, exportées comme telles, jamais comptées comme preuve).


## D17 — Tuteur : local par défaut, IA en option, toujours séparé des résultats testés
Le tuteur **local** ne génère rien : il assemble des textes rédigés et relus (une fiche par leçon, un guide par étiquette d'erreur, les indices de l'exercice) avec le contexte réel (code, résultats de la dernière vérification, dernière erreur d'exécution, tentatives, aide déjà vue, erreurs récurrentes). Il fonctionne sans clé ni réseau, et les tests vérifient que ses 7 modes ne contiennent jamais la solution de référence. Le mode « Aide-moi à déboguer » suit les 4 niveaux : question d'orientation d'abord, explication de la notion à partir du niveau 2 ; si plusieurs vérifications pointent des erreurs différentes, il les cite toutes (deux au plus) au lieu de trancher. « Donne un indice » **est** l'aide progressive (il débloque le niveau suivant, jusqu'au 3) : la solution (niveau 4) se demande toujours explicitement, avec confirmation. Chaque réponse est étiquetée « avis du tuteur, non testé », placée sous les résultats testés, avec « Voir les preuves d'exécution » et « Signaler une erreur du tuteur ».
Le tuteur **IA** (Claude) n'est proposé que si le serveur SkillForge répond avec une clé configurée ; il reçoit un contexte compact (`tutorPayload`) sans les valeurs des tests cachés, et la solution de référence seulement si l'étudiant l'a déjà débloquée. En cas d'échec, l'interface le dit et affiche la réponse locale.

## D18 — Serveur minimal, clé côté serveur uniquement
`server/main.ts` (Node, TypeScript exécuté sans compilation) sert `dist/` avec les en-têtes d'isolation et expose `/api/sante` et `/api/tuteur`. La clé n'existe que dans l'environnement du serveur (`ANTHROPIC_API_KEY`) : le SDK n'est jamais importé par le code navigateur (vérifié dans le bundle). Le corps des requêtes est validé (zod, tailles maximales), limité à 64 Ko, et la route applique une limite par minute et par adresse plus un plafond quotidien. Les journaux ne contiennent que méthode, chemin, statut et durée. Appel au modèle : SDK officiel `@anthropic-ai/sdk`, modèle `claude-opus-5-5`, effort `low` (réponses courtes), **fallbacks côté serveur activés** (`fallbacks: "default"`, bêta `server-side-fallback-2026-07-01`) : si le modèle refuse, l'API peut réessayer avec un modèle de repli ; un refus final (`stop_reason: "refusal"`) est renvoyé comme tel et l'interface repasse au tuteur local. Les erreurs typées du SDK sont traduites (clé refusée → 503, limite → 429). Un fournisseur **simulé** (`SKILLFORGE_TUTEUR=simule`) permet de tester et de démontrer sans clé ni facturation ; les tests du fournisseur Claude utilisent un `fetch` simulé et vérifient la requête envoyée.

## D19 — Variantes : modèles relus et paramètres contrôlés, vérifiés par exécution
La révision espacée ne repropose pas indéfiniment l'exercice déjà réussi : la n-ième révision utilise la variante n (n = nombre de révisions déjà faites ; 0 = l'original). Une variante vient d'un **modèle écrit à la main** (`src/content/variants.ts`) et de paramètres tirés par un générateur déterministe : seuil, données et sens de la borne (Python) ; année, sens du tri, statut, nombre de lignes (SQL/BI). Les cas limites de l'original sont conservés. Pour Python, les valeurs attendues sont calculées par une fonction TypeScript, et `tests/content/variants.test.ts` exécute la solution de référence de chaque variante dans Pyodide (10 graines) ; pour SQL, la correction compare toujours au résultat réel de PostgreSQL, et les tests vérifient que chaque variante renvoie des lignes et que la requête de l'original **échoue** (la variante demande vraiment autre chose). Aucune variante n'est générée par IA ; des exercices générés par IA, s'ils arrivent, resteront des brouillons isolés de la progression certifiée.

## D20 — Carnet, favoris, notes, fiches : utiles, mais jamais des preuves
Le carnet d'erreurs ne contient que des erreurs **observées** (étiquettes posées par des tests échoués) ; une erreur est « surmontée » quand chaque exercice où elle est apparue a été réussi ensuite. Les exercices proposés le sont avec la raison observée (« proposé car « Inclure les commandes annulées » est apparu dans 2 exercices »). Le mini-test de rappel des fiches est une **auto-évaluation** : il sert à choisir quoi revoir et n'entre pas dans la maîtrise. Les notes suivent la même règle que les brouillons : une note modifiée dans un autre onglet n'est jamais écrasée sans choix explicite. Favoris et notes sont inclus dans l'export des données.

## D21 — Projet transversal : dix étapes indépendantes, vérifiées ou rédigées
Le « Copilote data pour une PME » relie les cinq domaines sur les mêmes données synthétiques (export de boutique, base PME, abonnés, documents). Les étapes 1 à 7 sont des exercices ordinaires (Python dans Pyodide, SQL dans PostgreSQL) : même correction, mêmes tentatives, même sauvegarde, chacune réalisable seule. Les étapes 8 à 10 (évaluer, documenter les limites, présenter) sont des **rédactions** : enregistrées et exportées, jamais notées. Le tableau d'évaluation de l'étape 8 n'affiche une valeur qu'une fois l'étape correspondante vérifiée ; les chiffres viennent de miroirs TypeScript dont l'égalité avec les solutions Python est prouvée par exécution. Ils sont honnêtes même quand ils déçoivent : la règle apprise bat à peine la base (75,0 % contre 72,5 % en test) et l'assistant invente une réponse sur 13. Pour la table d'import, un exercice SQL peut déclarer un `setup` exécuté dans la transaction annulée, avant « Exécuter » comme avant chaque vérification.

## D22 — Mode entretien : correction après la session, cinq critères, aucune note
Une session = quatre questions choisies pour un profil de stage (data analyst, BI, IA, automatisation), couvrant les huit formats demandés. Pendant la session : ni indice ni tuteur ; le code s'exécute mais n'est corrigé qu'à la fin. La correction sépare **exactitude** (tests réellement exécutés pour le code ; « non mesurable automatiquement » pour l'écrit), **raisonnement** (éléments attendus repérés par des repères textuels, avec la phrase de l'étudiant qui les contient), **communication** (longueur visée, présence d'un chiffre), **autonomie observée** (aucune aide, exécutions, temps, questions vides) et **limites reconnues**. Les repères sont approximatifs et présentés comme tels (« non repéré » n'est pas « absent ») ; un test garantit que chaque réponse modèle contient ses propres repères. La session en cours survit à un rechargement ; les sessions terminées s'exportent en Markdown.

## D23 — Portfolio : uniquement des preuves enregistrées
Le portfolio est **calculé** à chaque ouverture depuis les tentatives, le journal et les rédactions : projets ayant au moins une étape vérifiée (avec « après consultation de la solution » quand c'est le cas), technologies déduites des exercices réellement faits, décisions et limites rédigées par l'étudiant, résultats mesurés du tableau d'évaluation, ligne de CV formulée comme « projet de formation … données synthétiques … n/N étapes vérifiées par des tests automatisés ». L'attestation liste les notions au niveau « Démontré » ou plus et précise qu'elle est **interne** au parcours, sans valeur de certification. Aucun gain, score ou expérience n'est généré ; un test vérifie l'absence de ces formulations.

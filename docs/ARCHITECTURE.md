# Architecture

## Vue d'ensemble (étapes 1 et 2)

Application web statique (Vite + React + TypeScript). Python s'exécute **dans le navigateur de l'étudiant**, dans un Web Worker Pyodide ; SQL dans un second Web Worker PGlite (PostgreSQL 18.6). La progression est stockée localement (IndexedDB). Il n'y a pas encore de serveur : il arrivera avec le tuteur IA (étape 5) et les comptes (étape 7).

```
┌────────────── Thread principal (React) ──────────────┐        ┌──── Web Worker « python » ────┐
│ ui/  pages, atelier, visualisations                   │ post   │ Pyodide 314.0.7 (Python 3.14) │
│   │                                                   │ Message│ harnais grading/harness.ts    │
│   ├─ runtime/python/client.ts ── limite de temps ─────┼───────►│  sf_run   : exécution libre    │
│   │        SharedArrayBuffer (SIGINT) ou terminate()  │◄───────┼─ sf_grade : tests de comportement│
│   ├─ grading/evaluate.ts  rapport, étiquettes d'erreur│ stdout │  sf_trace : trace sys.settrace │
│   ├─ domain/  maîtrise, recommandations, révisions    │        └────────────────────────────────┘
│   └─ storage/store.ts ── IndexedDB (navigateur)       │
└───────────────────────────────────────────────────────┘
content/ : données versionnées, importées par l'UI et par les tests

┌─ ui/ (atelier SQL, visualisations) ─┐  query / checks / schema  ┌── Web Worker « sql » ─────────────┐
│ runtime/sql/client.ts               │──────────────────────────►│ PGlite (PostgreSQL 18.6)          │
│  file d'attente, limite de temps →  │◄──────────────────────────│ runtime/sql/engine.ts :           │
│  terminate() + nouvelle base        │  résultats normalisés     │  BEGIN … ROLLBACK, setup des cas, │
│ grading/sql-compare.ts (comparaison)│                           │  base PME ensemencée (graine 42)  │
└─────────────────────────────────────┘                           └───────────────────────────────────┘
```

### Séparation des responsabilités

| Couche | Rôle | Dépend de |
|---|---|---|
| `content/` | Leçons, exercices (avec version), matrice de couverture. Données pures, validées par zod. | — |
| `grading/` | Harnais Python (exécuté dans Pyodide), construction du rapport, traduction pédagogique des erreurs. | `content/types` |
| `runtime/python/` | Cycle de vie du worker, file d'exécution unique, limite de temps, interruption, redémarrage. | `grading/` |
| `runtime/sql/` | `engine.ts` (pur, partagé navigateur/tests Node) : exécution isolée, cas de vérification, schéma. `worker.ts`/`client.ts` : file d'attente sérialisée, limite de temps par terminaison du worker. | `content/datasets` |
| `storage/` | Persistance locale ; interface `Store` destinée à recevoir une synchronisation serveur. | — |
| `domain/` | Logique pure et testée : maîtrise explicable, recommandations justifiées, révisions espacées, parcours. | `content/`, types de `storage/` |
| `ui/` | Interface. | tout le reste |

## Exécution du code de l'étudiant

1. L'atelier envoie `{code, packages}` (exécution) ou `{code, spec}` (vérification) au worker. **La solution de référence n'est jamais envoyée.**
2. Le worker exécute dans un espace de noms neuf (`exec(compile(code, "<exercice>", "exec"), ns)`).
3. Limite de temps par exercice (5 s ici) : le client écrit `2` (SIGINT) dans un `SharedArrayBuffer` partagé avec Pyodide → `KeyboardInterrupt` côté Python. Si Python ne rend pas la main en 1,5 s, ou si l'isolation cross-origin est absente, le worker est **terminé et recréé**.
4. Sortie limitée à 50 000 caractères diffusés (puis troncature signalée) ; sortie capturée limitée à 20 000 caractères pendant la correction.
5. Le module `pyodide.http` est retiré ; voir [LIMITES](LIMITES.md) pour ce que cela ne couvre pas.

## Correction

- Chaque test appelle la fonction de l'étudiant avec une **copie profonde** des arguments et compare la valeur retournée (`exact` ou `approx` avec tolérance). Seul le comportement compte : les solutions alternatives sont acceptées (testé).
- Tests visibles (appel, attendu, obtenu affichés) et **tests cachés** (seuls le libellé et une piste sont montrés).
- `checkNoMutation` vérifie que les arguments ne sont pas modifiés.
- Un test échoué peut porter une étiquette d'**erreur fréquente** (`misconception`) qui alimente le carnet d'erreurs et les recommandations.
- Diagnostic supplémentaire : `print` au lieu de `return`, `___` restants, fonction absente, erreur de syntaxe avec ligne.
- Le rapport distingue « résultat testé » ; l'avis du tuteur IA (étape 5) sera affiché séparément.

## Cinq domaines : ce qui est commun, ce qui est propre à un domaine

| Élément | Commun à tous les domaines | Propre au domaine |
|---|---|---|
| Programme | `content/curriculum.ts` : domaine → module → notion, statuts, `moduleDependencies` (« s'appuie sur ») | liste des notions |
| Leçon | boucle en 10 temps, blocs `text`, `callout`, `prediction`, `explain`, `exercise`, `project` et **activités** (`ordering`, `matching`, `chart-question`, `fill-code`) | visualisations spécifiques (`trace`, `sql-steps`, `join-viz`, `threshold-viz`, `rag-viz`, `filter-context-viz`) |
| Exercice | `id`, `version`, `kind`, `hints` (4 niveaux), `explanation`, `conceptIds` ; tentatives versionnées, brouillons, historique | `language` + champs du moteur (`tests` pour Python, `checks`/`referenceSolution` pour SQL) |
| Exécution | interface de moteur : `init`, `subscribe(state)`, `isBusy`, `stop`, limite de temps | `runtime/python` (Pyodide), `runtime/sql` (PGlite) |
| Correction | `GradeReport` unique : statut, cas visibles/cachés, pistes (`misconceptions`) | construction du rapport (`buildReport`, `buildSqlReport`) |
| Progression | maîtrise explicable, révisions espacées, recommandations, carte | — |

**Brancher un nouveau domaine** (étape 4) : ajouter une valeur à l'union `Exercise` (schéma zod avec `language` littéral), un moteur dans `runtime/<moteur>/` qui expose le même état (`RunnerState`), une fonction qui produit un `GradeReport`, puis une branche dans `Workbench` (exécution + vue du résultat). Le reste (historique, maîtrise, révisions, carte, tableau de bord) fonctionne sans modification. Les laboratoires sans code (BI, choix de configuration LLM) utilisent les activités réutilisables.

**Ce que l'étape 4 a confirmé** : aucun nouveau moteur n'a été nécessaire. ML et LLM sont des exercices **Python** (paquets déclarés par contenu, ex. `packages: ["scikit-learn"]`) ; BI est un ensemble d'exercices **SQL** dont le domaine est `bi`. Chaque laboratoire a une implémentation de référence en TypeScript pour sa visualisation (`ui/viz/threshold.ts`, `content/llm/rag-core.ts`, `ui/viz/filterContext.ts`), et un test de contenu vérifie qu'elle donne les mêmes nombres que le moteur réel (scikit-learn, solutions Python, PostgreSQL). Un projet peut porter un parcours hors plateforme (`selfCheck`) : déclaratif, exporté comme tel, jamais compté comme preuve.

## Carte des compétences

`ui/pages/SkillMap.tsx` est calculée, pas dessinée à la main : nœuds = modules et notions du programme, flèches = `moduleDependencies` et prérequis des notions, maîtrise = `estimateMastery` sur les tentatives et événements réels. Trois niveaux de zoom adressables (`#/carte`, `#/carte/<module>`, `#/carte/<module>/<notion>`), filtres (domaines, maîtrise, recherche) et version liste équivalente. La maîtrise est montrée par une icône de remplissage **et** un libellé ; le statut par un cadre plein ou pointillé **et** un libellé.

## Activités réutilisables

`ui/components/Activities.tsx` : classement (boutons Monter/Descendre, annonce vocale), association (listes déroulantes), lecture de graphique (barres + tableau équivalent ; données calculées en direct par une requête quand `sql` est fourni), code à compléter (réponses courtes normalisées par `domain/answers.ts`). Chaque validation est un événement `activity` ; seule la **première réussite** devient une preuve vérifiée (avec le numéro de l'essai). Les activités enrichissent les preuves mais ne font pas changer de niveau de maîtrise à elles seules : seuls les exercices corrigés par tests le peuvent.

## Correction SQL

1. `SqlRunner.grade` envoie la requête de l'étudiant, la requête de référence et la liste des cas (`checks`, avec `setup` SQL éventuel).
2. Pour chaque cas, `engine.runChecks` ouvre une transaction, applique le `setup`, exécute la référence puis la requête de l'étudiant, et annule tout (`ROLLBACK`). Les valeurs sont normalisées (dates en `AAAA-MM-JJ`, `numeric` en nombre).
3. `grading/sql-compare.ts` compare : colonnes (nom ou position), multiensemble de lignes avec tolérance d'arrondi, puis ordre des clés de tri si l'énoncé l'exige. `describeDiff` produit l'explication (lignes manquantes / en trop, colonnes, ordre).
4. `grading/evaluate.ts#buildSqlReport` construit le même `GradeReport` que pour Python : l'atelier, l'historique, la maîtrise et les recommandations n'ont pas de cas particulier SQL. Les erreurs PostgreSQL sont expliquées par `grading/sql-errors.ts` (SQLSTATE → titre et conseil, position → ligne/colonne).

Les **visualisations SQL** n'inventent pas de lignes : `viz/SqlSteps.tsx` exécute chaque étape (FROM, WHERE, GROUP BY…) dans PostgreSQL ; `viz/JoinViz.tsx` déroule une boucle imbriquée (`viz/joinSteps.ts`, pur) dont le résultat final est comparé à PostgreSQL dans les tests.

## Tuteur, carnet, variantes (étape 5)

- `domain/tutor.ts` : contexte du tuteur (`TutorContext`), résumé affiché (« Ce que le tuteur sait »), tuteur local `localTutor(mode, ctx)` et contexte compact envoyé au serveur (`tutorPayload`, sans valeurs cachées, solution seulement au niveau 4).
- `content/guides.ts` : fiches par leçon et guides par étiquette d'erreur (textes relus ; tests de couverture).
- `domain/notebook.ts` : carnet d'erreurs calculé depuis les tentatives ; `practiceFor` propose des exercices avec la raison observée.
- `content/variants.ts` : modèles de variantes et générateur déterministe ; `ReviewPage` choisit la variante selon le nombre de révisions faites.
- `ui/components/TutorPanel.tsx`, `ui/components/Personal.tsx` (favori, notes, fiche), `ui/pages/Notebook.tsx` (`#/carnet/erreurs|favoris|notes|fiches`).
- `server/` : `tuteur.ts` (validation, prompts, limites, fournisseur simulé — sans réseau), `claude.ts` (SDK officiel), `main.ts` (HTTP, fichiers statiques). Le navigateur détecte le serveur via `/api/sante`.

## Projet transversal, entretien, portfolio (étape 6)

- `content/transversal/copilote.ts` (exercices, projet, miroirs TypeScript), `content/datasets/import-boutique.ts` (export CSV et table d'import).
- `domain/projects.ts` : statut d'une étape (vérifiée / rédigée), clés du journal et des rédactions, tableau d'évaluation calculé depuis les tentatives.
- `content/entretien.ts` (banque de questions, profils), `domain/interview.ts` (correction en 5 critères, export Markdown), `ui/pages/Interview.tsx` (`#/entretien`, `#/entretien/session`, `#/entretien/bilan/<id>` ; session en cours dans `kv` `entretien:en-cours`, sessions terminées dans `entretien:sessions`).
- `domain/portfolio.ts` + `ui/pages/Portfolio.tsx` (`#/portfolio`) : portfolio recalculé à chaque ouverture, exports README et JSON.

## Modèle de données (IndexedDB `skillforge`, version 1)

| Magasin | Clé | Contenu |
|---|---|---|
| `kv` | chaîne | `profile`, `path`, `resume` (leçon/section/exercice), `resume:project` (projet/étape), `activity` (secondes actives par jour), `hints:<exercice>`, `explain:<bloc>`, `sandbox`, `sandbox:sql`, `journal:<projet>:<étape>` |
| `drafts` | `exerciseId` | code, `exerciseVersion`, `revision` (compteur optimiste), `updatedAt`, `tabId` |
| `attempts` | auto | exercice + **version**, code soumis, statut, tests réussis (dont cachés), erreurs fréquentes, niveau d'aide consulté, solution vue, durée |
| `events` | auto | ouverture de leçon, prédiction, indice, exécution, explication, diagnostic, signalement, révision |
| `reviews` | `conceptId` | échéance, palier, raison, historique |

### Sauvegarde sans écrasement

`saveDraft(id, version, code, baseRevision)` écrit seulement si la révision stockée est celle sur laquelle l'onglet travaillait. Sinon il renvoie un **conflit** que l'interface présente (« Charger la plus récente » / « Garder la mienne »). Un `BroadcastChannel` prévient les autres onglets ; un onglet sans modification en cours se met à jour silencieusement. Les erreurs d'écriture déclenchent de nouvelles tentatives (1, 2, 4, 8, 15 s), un avertissement visible et une reprise à l'événement `online`.

### Maîtrise explicable (`domain/mastery.ts`)

| Niveau | Condition |
|---|---|
| Découvert | leçon ouverte (explicitement « ne prouve pas la maîtrise ») |
| En pratique | au moins une tentative |
| Démontré | exercice autonome, test de validation ou étape de projet réussi, tests cachés compris, sans solution affichée ni aide ciblée (niveau 3). Pour une notion travaillée **uniquement** par un débogage (ex. doublons créés par les jointures), ce débogage en tient lieu. |
| Consolidé | Démontré + débogage réussi + révision espacée réussie (révision seule si le débogage a déjà servi de preuve) |

Chaque niveau est accompagné de ses raisons et de la liste des preuves (vérifiées ou auto-déclarées).

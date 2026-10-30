# Ajouter du contenu

## Un exercice Python
1. Dans le fichier de la leçon (ex. `src/content/python/boucles.ts`), ajouter un objet `Exercise` :
   - `id` stable, `version` (incrémenter à **chaque** modification d'énoncé ou de tests : les tentatives restent rattachées à leur version) ;
   - `functionName`, `starterCode`, `referenceSolution` ;
   - `tests` : au moins un visible et un caché ; `misconception` pour relier un échec à une erreur fréquente (`misconceptionLabels` dans `content/types.ts`) ; `checkNoMutation` si la fonction reçoit une liste ou un dictionnaire ; `display` si l'attendu est un flottant entier (`75.0`) ;
   - `hints` : exactement 4 niveaux (orientation, concept, aide ciblée, solution expliquée) ;
   - `explanation` : correction expliquée, idéalement avec une solution alternative.
2. Le référencer dans une section (`{ type: "exercise", exerciseId }`) et l'exporter via `src/content/index.ts`.
3. `pnpm test:content` vérifie automatiquement : la référence réussit tout, le code de départ échoue, il existe des tests visibles et cachés. **Ajouter** au moins un test d'erreur typique et une solution alternative dans `tests/content/`.

## Un exercice SQL
1. Dans `src/content/sql/<leçon>.ts`, ajouter un objet `language: "sql"` : `starterCode`, `referenceSolution`, `checks` (au moins un visible sur les données actuelles et un caché avec `setup` qui modifie les données pour déjouer une réponse codée en dur), `orderBy` **seulement** si l'énoncé exige un ordre, `tolerance` si l'énoncé demande un arrondi, `columnMode: "position"` si les noms de colonnes sont libres.
2. Ajouter dans `tests/content/sql.test.ts` : au moins une **erreur typique** (`WRONG`) et une **solution alternative** (`ALTERNATIVES`). Le test vérifie aussi que chaque cas caché fait échouer au moins une erreur typique (sinon il ne sert à rien).
3. Les requêtes de `sql-steps` et les exemples exécutables (`code` avec `language: "sql"`, `runnable: true`) sont exécutés par les tests.

## Une leçon
- Respecter la boucle en 10 temps (`loopStages`) : problème, intuition, schéma, démonstration, prédiction, guidé, autonome, débogage/correction, projet, révision.
- Introduire chaque terme anglais utile via le glossaire (`[[terme]]` dans le texte) avec sa définition française.
- Renseigner `validationExerciseId` pour permettre de passer la notion par un test.
- Mettre à jour le statut de la notion dans `src/content/curriculum.ts` **uniquement** quand la leçon est testée, puis `pnpm docs:couverture`. `tests/unit/content.test.ts` refuse une notion « Disponible » sans leçon ni exercice.

## Une activité (tous domaines)
- Blocs `ordering`, `matching`, `chart-question`, `fill-code` (`src/content/types.ts`), avec un `id` unique dans tout le contenu.
- `chart-question` : préférer `sql` (données calculées en direct) à `data` fixe ; si l'explication affirme un fait sur les données, l'ajouter dans « faits affirmés par les activités » de `tests/content/activities.test.ts`.
- `fill-code` en SQL : chaque réponse acceptée est substituée et exécutée par les tests.

## Une visualisation
- Composant React dans `src/ui/viz/`, avec : lecture/pause, pas à pas avant/arrière, réinitialisation, vitesse, **version texte équivalente**, respect de `prefers-reduced-motion`, information jamais portée par la seule couleur (icône ou libellé en plus).
- Si la visualisation décrit une exécution, ajouter un test qui compare les étapes rédigées à une exécution réelle (voir le test de `LoopTracer` dans `tests/content/python-boucles.test.ts`).

## Un projet
- Objet `Project` (`src/content/types.ts`) : mandat, livrables, critères d'acceptation, étapes → `exerciseId` (`kind: "project"`) + question du journal de décisions. L'enregistrer dans `projects` (`src/content/index.ts`) ; la page `#/projet/<id>` et l'export Markdown sont génériques.
- Étape de **rédaction** : `kind: "redaction"` et `fields` (pas d'`exerciseId`) ; enregistrée, exportée, reprise dans le portfolio, jamais notée. `evaluation: true` affiche le tableau d'évaluation calculé depuis les preuves (`src/domain/projects.ts`).
- Projet **transversal** : `domains` liste les domaines ; un exercice SQL peut déclarer `setup` (SQL exécuté avant chaque exécution et vérification, par exemple une table temporaire d'import).

## Une question d'entretien
- `src/content/entretien.ts` : question écrite (`kind: "texte"`, éléments attendus avec leurs repères, longueur visée, réponse modèle) ou de code (`kind: "code"`, un exercice complet avec tests cachés). Le test `tests/unit/entretien-portfolio.test.ts` exige que la réponse modèle contienne tous ses propres repères ; `tests/content/transversal.test.ts` exécute la réponse modèle des questions de code.

## Jeux de données
- Générés de façon déterministe dans `src/content/datasets/` (graine fixe), documentés dans [DONNEES.md](DONNEES.md) avec leur provenance et leurs anomalies volontaires. `tests/content/sql.test.ts` vérifie les invariants dont dépendent les exercices (clients sans commande, NULL, produit jamais vendu…).

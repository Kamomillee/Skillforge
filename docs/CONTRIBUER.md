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

## Une leçon
- Respecter la boucle en 10 temps (`loopStages`) : problème, intuition, schéma, démonstration, prédiction, guidé, autonome, débogage/correction, projet, révision.
- Introduire chaque terme anglais utile via le glossaire (`[[terme]]` dans le texte) avec sa définition française.
- Renseigner `validationExerciseId` pour permettre de passer la notion par un test.
- Mettre à jour le statut de la notion dans `src/content/curriculum.ts` **uniquement** quand la leçon est testée.

## Une visualisation
- Composant React dans `src/ui/viz/`, avec : lecture/pause, pas à pas avant/arrière, réinitialisation, vitesse, **version texte équivalente**, respect de `prefers-reduced-motion`, information jamais portée par la seule couleur (icône ou libellé en plus).
- Si la visualisation décrit une exécution, ajouter un test qui compare les étapes rédigées à une exécution réelle (voir le test de `LoopTracer` dans `tests/content/python-boucles.test.ts`).

## Jeux de données
- Étape 1 : uniquement de petites données synthétiques écrites dans les énoncés. Les jeux de données (ventes, clients, tickets, documents, données dégradées) seront ajoutés dans `public/datasets/` avec leur provenance et leurs conditions d'usage à partir de l'étape 2.

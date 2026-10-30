# Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations et tranche verticale Python | **Terminée** (30/10/2026) |
| 2 | SQL : moteur réel, module B complet, visualisations (jointure ligne par ligne, ordre logique), correction par résultats, projet PME | À faire |
| 3 | Architecture des cinq domaines : carte des compétences (zoom, filtres, vue locale), composants pédagogiques réutilisables (classement, association, code à compléter, interprétation de graphique) | À faire |
| 4 | Laboratoires LLM (modèle simulé + fournisseur réel optionnel), BI (labo natif + parcours Power BI Desktop), ML (scikit-learn dans Pyodide) et leurs projets | À faire |
| 5 | Serveur, tuteur IA contextuel (7 modes, 4 niveaux d'aide), carnet d'erreurs, variantes d'exercices paramétrées | À faire |
| 6 | Projet transversal « copilote data PME », mode entretien, portfolio exportable | À faire |
| 7 | Comptes, isolation, quotas, administration des contenus, audit d'accessibilité, observabilité, CSP | À faire |

## État de reprise

Pour reprendre le travail :
1. `pnpm install && pnpm setup:pyodide && pnpm test && pnpm build && pnpm test:e2e` doit être vert.
2. Prochaine tâche : étape 2. Commencer par mesurer PGlite dans le navigateur (taille, démarrage, compatibilité Worker + COEP), décider (voir DECISIONS D9), puis créer `src/runtime/sql/` sur le modèle de `runtime/python/`.
3. Fichiers à étendre : `src/content/curriculum.ts` (statuts), `src/content/index.ts` (enregistrer leçons/exercices), `src/grading/` (comparateur de résultats SQL : colonnes, multiensembles, ordre seulement si `ORDER BY` exigé).

## Dette identifiée à l'étape 1
- Découper le bundle par route (`React.lazy`).
- `lesson-open` est enregistré à chaque affichage de leçon : agréger si le volume devient gênant.
- La page Révision réutilise le test de validation ; prévoir des variantes paramétrées (étape 5) pour éviter la mémorisation de la réponse.

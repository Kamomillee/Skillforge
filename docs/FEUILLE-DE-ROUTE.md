# Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations et tranche verticale Python | **Terminée** (30/10/2026) |
| 2 | SQL : moteur réel (PGlite), 3 leçons du module B, visualisations (ordre logique, jointure ligne par ligne), correction par résultats, projet PME en 5 étapes | **Terminée** (30/10/2026) |
| 3 | Architecture des cinq domaines : carte des compétences (zoom, filtres, vue locale), composants pédagogiques réutilisables (classement, association, code à compléter, interprétation de graphique) | **Terminée** (30/10/2026) |
| 4 | Laboratoires ML (scikit-learn dans Pyodide, seuil et coût métier), LLM (RAG avec citations et abstention, modèle **simulé** annoncé), BI (contexte de filtre calculé en SQL, DAX affiché, parcours Power BI Desktop en auto-évaluation) et leurs trois projets | **Terminée** (30/10/2026) — fournisseur LLM réel reporté à l'étape 5 (nécessite le serveur) |
| 5 | Serveur, tuteur IA contextuel (7 modes, 4 niveaux d'aide), carnet d'erreurs, variantes d'exercices paramétrées | À faire |
| 6 | Projet transversal « copilote data PME », mode entretien, portfolio exportable | À faire |
| 7 | Comptes, isolation, quotas, administration des contenus, audit d'accessibilité, observabilité, CSP | À faire |

## État de reprise

Pour reprendre le travail :
1. `pnpm install && pnpm setup:pyodide && pnpm test && pnpm build && pnpm test:e2e` doit être vert.
2. Prochaine tâche : étape 5. Serveur minimal (appels LLM côté serveur, clé jamais dans le bundle), tuteur contextuel (4 niveaux d'aide, jamais la solution d'office), carnet d'erreurs alimenté par les étiquettes `misconception`, variantes d'exercices paramétrées pour la révision.
3. Le contenu SQL restant du module B (DISTINCT, CASE, sous-requêtes, CTE, fenêtres) et le module A (modélisation, 3FN) se rédigent sur le modèle de `src/content/sql/*.ts` ; le moteur et le comparateur sont prêts.

## Dette identifiée à l'étape 4
- LLM : aucun appel à un vrai modèle (prévu avec le serveur, étape 5) ; recherche lexicale seulement (pas d'embeddings dans le navigateur).
- BI : le rapport Power BI n'est pas vérifiable par SkillForge (auto-évaluation déclarative) ; les tables doivent être copiées à la main depuis le bac à sable SQL (un export CSV par table serait utile).
- ML : un seul module (D, évaluation) ; préparation des variables, validation croisée et fuite de données sont prévues.
- Le premier chargement de scikit-learn (~30 Mo) prend plusieurs secondes ; la limite de temps de l'exercice est suspendue pendant ce chargement (120 s max).

## Dette identifiée à l'étape 2
- La partie « conception » du projet PME (modèle entité-association, normalisation) n'est pas encore jouable : seules les 5 questions métier le sont.
- Notions SQL marquées « Testé » (module D) : pratiquées dans le projet, sans leçon dédiée.
- Le moteur SQL est recréé après chaque dépassement de temps (~3 s) : acceptable, mais à surveiller si les étudiants écrivent souvent des produits cartésiens.

## Dette identifiée à l'étape 1
- Découper le bundle par route (`React.lazy`).
- `lesson-open` est enregistré à chaque affichage de leçon : agréger si le volume devient gênant.
- La page Révision réutilise le test de validation ; prévoir des variantes paramétrées (étape 5) pour éviter la mémorisation de la réponse.

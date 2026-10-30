# Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations et tranche verticale Python | **Terminée** (30/10/2026) |
| 2 | SQL : moteur réel (PGlite), 3 leçons du module B, visualisations (ordre logique, jointure ligne par ligne), correction par résultats, projet PME en 5 étapes | **Terminée** (30/10/2026) |
| 3 | Architecture des cinq domaines : carte des compétences (zoom, filtres, vue locale), composants pédagogiques réutilisables (classement, association, code à compléter, interprétation de graphique) | **Terminée** (30/10/2026) |
| 4 | Laboratoires ML (scikit-learn dans Pyodide, seuil et coût métier), LLM (RAG avec citations et abstention, modèle **simulé** annoncé), BI (contexte de filtre calculé en SQL, DAX affiché, parcours Power BI Desktop en auto-évaluation) et leurs trois projets | **Terminée** (30/10/2026) — fournisseur LLM réel reporté à l'étape 5 (nécessite le serveur) |
| 5 | Tuteur contextuel (7 modes, 4 niveaux, local sans IA + Claude en option via un serveur minimal), carnet d'erreurs, favoris, notes, fiches avec mini-test de rappel, variantes paramétrées des tests de validation pour la révision | **Terminée** (30/10/2026) — génération du laboratoire RAG par un vrai modèle encore simulée |
| 6 | Projet transversal « Copilote data pour une PME » (10 étapes : 7 vérifiées, 3 rédigées, tableau d'évaluation mesuré), mode entretien (4 profils, 8 formats, correction en 5 critères après la session), portfolio généré depuis les preuves (README, JSON, ligne de CV, attestation interne) | **Terminée** (30/10/2026) |
| 7 | Qualité SaaS : comptes facultatifs (serveur, SQLite), isolation par compte, synchronisation sans écrasement, budget IA par compte et consommation réelle, export et suppression des données, administration (signalements, inventaire, statistiques, métriques), journaux structurés, CSP, audit d'accessibilité | **Terminée** (30/10/2026) |

## État de reprise

Pour reprendre le travail :
1. `pnpm install && pnpm setup:pyodide && pnpm test && pnpm build && pnpm test:e2e` doit être vert (les tests e2e lancent aussi le vrai serveur sur le port 8788).
2. Les 7 étapes du plan sont livrées. La suite est surtout du **contenu** : le curriculum compte 280 notions, dont 21 disponibles et 10 testées via les projets (voir `docs/COUVERTURE.md`). Priorités suggérées : module SQL B restant (DISTINCT, CASE, sous-requêtes, CTE, fenêtres), Python A–C, puis ML (préparation, validation croisée, fuite).
3. Pour essayer le serveur : `pnpm build && SKILLFORGE_TUTEUR=simule SKILLFORGE_ADMINS=moi@example.ch pnpm serve`, puis http://localhost:8787 → Paramètres → Créer un compte.
4. Avant une mise en ligne : HTTPS + `SKILLFORGE_COOKIE_SECURE=1`, sauvegarde du fichier SQLite, collecte des journaux ; voir la dette de l'étape 7.

## Dette identifiée à l'étape 7
- Réinitialisation du mot de passe (envoi d'e-mail), vérification d'adresse, 2FA.
- Serveur mono-instance (SQLite, limites en mémoire) ; synchronisation par instantané complet (2 Mo max) et à la demande.
- Rôle enseignant par classe, tableau de bord de classe (agrégats seulement).
- Éditeur de contenus dans l'interface : volontairement absent (les contenus restent relus et testés dans le code).
- Accessibilité : tests avec lecteurs d'écran réels ; Firefox et Safari non testés automatiquement.
- Découper le bundle par route (~1 Mo non compressé).

## Dette identifiée à l'étape 6
- Entretien : l'écrit est relu par repères textuels (approximatif, annoncé) ; un retour du tuteur IA sur les réponses écrites serait utile, toujours séparé de la mesure.
- Le tableau de bord du projet transversal reste en auto-évaluation (outil de BI externe).
- Le portfolio ne contient pas encore de fichiers de code par projet (l'export Markdown de chaque projet les contient).
- Projet Python de domaine (« pipeline d'import ») : le projet transversal en couvre l'essentiel, sans projet dédié.

## Dette identifiée à l'étape 5
- Le laboratoire RAG utilise toujours le modèle simulé : brancher la génération sur `/api` (même serveur, même règles) est simple mais doit rester optionnel.
- Variantes : 4 tests de validation sur 7 (Python boucles, SQL agrégations, SQL requêtes, BI). Les validations ML, LLM et jointures n'en ont pas encore.
- Le tuteur IA n'a pas été essayé avec une vraie clé dans cet environnement : la requête envoyée est vérifiée par des tests (fetch simulé), pas la qualité des réponses.
- ~~Signalements sans circuit de relecture ; pas de comptes~~ : traité à l'étape 7.

## Dette identifiée à l'étape 4
- LLM : aucun appel à un vrai modèle dans le laboratoire (le serveur existe depuis l'étape 5, voir sa dette) ; recherche lexicale seulement (pas d'embeddings dans le navigateur).
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

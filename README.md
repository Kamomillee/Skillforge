# SkillForge AI

Plateforme de formation interactive en français : Python pour les données, SQL, applications LLM (RAG, outils, évaluation), BI / Power BI et machine learning appliqué. Public : étudiant·e de bachelor en systèmes d'information et business analytics qui veut comprendre, modifier et expliquer le code qu'il ou elle produit.

> **État : étape 1 sur 7 — tranche verticale.** Une leçon Python complète est jouable de bout en bout (onboarding → leçon → visualisation → exercice exécuté réellement → correction par tests → sauvegarde → reprise). Le reste du programme est listé dans la [matrice de couverture](docs/COUVERTURE.md) avec son statut réel.

## Démarrage

Prérequis : Node.js ≥ 20, `pnpm` (ou npm), `curl` et `tar` (pour récupérer Pyodide une seule fois).

```bash
pnpm install
pnpm setup:pyodide   # télécharge Pyodide 314.0.7 (~330 Mo, mis en cache) et en extrait ~39 Mo dans public/pyodide/
pnpm dev             # http://localhost:5173
```

Production locale :

```bash
pnpm build && pnpm preview   # http://localhost:4173
```

Aucune variable d'environnement, aucun compte et aucune clé API ne sont nécessaires à cette étape (voir `.env.example`).

### Hébergement

L'application est un site statique (`dist/`). Le serveur **doit** envoyer ces en-têtes pour activer l'interruption douce des programmes Python (sinon l'arrêt redémarre le moteur, ce qui fonctionne mais est plus lent) :

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`vite dev` et `vite preview` les envoient déjà (voir `vite.config.ts`).

## Vérifications

```bash
pnpm typecheck        # TypeScript strict
pnpm test             # 48 tests : contenus exécutés dans Pyodide (Node) + logique + stockage
pnpm build && pnpm test:e2e   # 8 tests Playwright dans Chromium (desktop + mobile)
```

Les tests de contenu exécutent **réellement** chaque solution de référence, chaque code de départ, des solutions alternatives et des erreurs typiques avec le même harnais et la même version de Pyodide que le navigateur. La trace pas à pas de la visualisation est comparée à une trace réelle `sys.settrace`.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Couches, flux d'exécution et de correction, modèle de données |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Décisions techniques et leurs justifications |
| [docs/COUVERTURE.md](docs/COUVERTURE.md) | Matrice domaine → module → notion → objectif → activité → évaluation → projet |
| [docs/FEUILLE-DE-ROUTE.md](docs/FEUILLE-DE-ROUTE.md) | Étapes 1 à 7, état et reprise |
| [docs/LIMITES.md](docs/LIMITES.md) | Limites connues, honnêtement |
| [docs/CONTRIBUER.md](docs/CONTRIBUER.md) | Ajouter une leçon, un exercice, une visualisation |

## Arborescence

```
src/
  content/       contenus pédagogiques versionnés (leçons, exercices, matrice de couverture)
  grading/       harnais Python de correction, rapport, explications d'erreurs en français
  runtime/python Web Worker Pyodide + client (limite de temps, interruption, redémarrage)
  storage/       IndexedDB : profil, parcours, brouillons, tentatives, événements, révisions
  domain/        logique pure : maîtrise explicable, recommandations, révisions, parcours
  ui/            interface React (pages, composants, visualisations)
tests/           tests unitaires et tests de contenu (Vitest)
e2e/             tests navigateur (Playwright)
scripts/         récupération de Pyodide
```

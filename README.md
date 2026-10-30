# SkillForge AI

Plateforme de formation interactive en français : Python pour les données, SQL, applications LLM (RAG, outils, évaluation), BI / Power BI et machine learning appliqué. Public : étudiant·e de bachelor en systèmes d'information et business analytics qui veut comprendre, modifier et expliquer le code qu'il ou elle produit.

> **État : les 7 étapes du plan sont livrées.** Étape 7 (qualité SaaS) : **comptes** facultatifs sur le serveur SkillForge (sessions sécurisées, isolation stricte des données par compte, export et suppression), **synchronisation** de la progression entre appareils sans écrasement silencieux, **budget IA par compte** avec consommation réelle affichée (aucune facturation), **administration** (signalements traités et réponse visible par l'étudiant, inventaire des contenus avec contrôles automatiques, statistiques agrégées, métriques), **observabilité** (journaux JSON sans contenu ni secret, erreurs du navigateur), **CSP stricte** et **audit d'accessibilité** automatisé (WCAG 2.1 AA). Étape 6 : le **projet transversal** « Copilote data pour une PME » relie les cinq domaines en 10 étapes (import et nettoyage en Python, base et questions en SQL, indicateurs de tableau de bord, modèle simple, assistant avec citations, évaluation mesurée, limites, présentation) ; un **mode entretien** (4 profils de stage, 8 formats, sans indices, correction après la session sur 5 critères, sans note) ; un **portfolio** généré uniquement depuis les preuves enregistrées (README, JSON, ligne de CV factuelle, attestation interne de parcours). Étape 5 : un **tuteur** dans chaque atelier (7 modes : expliquer, exemple, indice, déboguer, question, pratiquer, entretien), qui s'appuie sur tes résultats testés sans jamais donner la solution d'office ; il fonctionne sans IA, et Claude peut s'y ajouter via le serveur SkillForge (clé côté serveur uniquement). Un **carnet** regroupe les erreurs réellement détectées (avec exercices proposés et la raison), les favoris, les notes et une fiche par notion avec mini-test de rappel. La révision espacée propose des **variantes paramétrées** des tests de validation. Étape 4 : trois laboratoires et leurs projets. **ML** : évaluer un classifieur (matrice de confusion, précision/rappel, seuil choisi par le coût métier) avec scikit-learn exécuté dans le navigateur, projet « Prédiction du départ de clients ». **LLM** : RAG avec citations et abstention sur 8 documents synthétiques, modèle simulé annoncé comme tel, projet « Assistant documentaire » avec tableau d'évaluation. **BI** : mesures et contexte de filtre, matrice calculée par PostgreSQL avec le DAX équivalent affiché, projet « Rapport ventes, marges et retours » et parcours Power BI Desktop en auto-évaluation. Étape 3 : Nouveau : carte des compétences (zoom, filtres, vue locale) et activités réutilisables (classement, association, lecture de graphique, code à compléter). Jouables de bout en bout : une leçon Python (boucles) et trois leçons SQL (SELECT/WHERE/NULL, agrégations, jointures) sur un vrai PostgreSQL exécuté dans le navigateur, plus le projet SQL « Base de données d'une PME » (5 questions métier vérifiées, journal de décisions, export Markdown). Le reste du programme est listé dans la [matrice de couverture](docs/COUVERTURE.md) avec son statut réel.

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

Aucune variable d'environnement, aucun compte et aucune clé API ne sont nécessaires (voir `.env.example`) : sans serveur, l'application fonctionne entièrement dans le navigateur (tuteur local, progression locale).

Serveur SkillForge (optionnel, Node ≥ 22.13 pour `node:sqlite`) : sert `dist/` avec les en-têtes de sécurité (isolation, CSP) et ajoute comptes, synchronisation, tuteur IA avec budget par compte, signalements et administration. Base SQLite dans `data/skillforge.db` (configurable).

```bash
pnpm build
ANTHROPIC_API_KEY=… pnpm serve          # http://localhost:8787, tuteur IA Claude (fallbacks côté serveur activés)
SKILLFORGE_TUTEUR=simule pnpm serve     # démo sans clé : réponses simulées
SKILLFORGE_ADMINS=prof@example.ch pnpm serve   # ce compte reçoit le rôle administrateur à l'inscription
```

Toutes les variables (budget IA par compte, cookie `Secure`, chemin de la base) sont décrites dans `.env.example`. Derrière HTTPS, activer `SKILLFORGE_COOKIE_SECURE=1`.

La clé reste dans l'environnement du serveur : elle n'est ni dans le bundle, ni dans les journaux. `pnpm dev` et `pnpm preview` relaient `/api` vers ce serveur s'il tourne.

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
pnpm test             # 373 tests : contenus Python (Pyodide) et SQL (PGlite) exécutés réellement, logique, stockage, couverture
pnpm build && pnpm test:e2e   # 36 tests Playwright dans Chromium (desktop, mobile, accessibilité, et 3 parcours contre le vrai serveur)
pnpm docs:couverture  # régénère docs/COUVERTURE.md depuis src/content/curriculum.ts
```

Les tests de contenu exécutent **réellement** chaque solution de référence, chaque code de départ, des solutions alternatives et des erreurs typiques avec le même harnais et le même moteur que le navigateur (Pyodide pour Python, PGlite pour SQL). La trace de la boucle est comparée à `sys.settrace` ; les étapes des visualisations SQL et le résultat de la jointure pas à pas sont comparés à PostgreSQL.

## Documentation

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Couches, flux d'exécution et de correction, modèle de données |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Décisions techniques et leurs justifications |
| [docs/COUVERTURE.md](docs/COUVERTURE.md) | Matrice domaine → module → notion → objectif → activité → évaluation → projet |
| [docs/FEUILLE-DE-ROUTE.md](docs/FEUILLE-DE-ROUTE.md) | Étapes 1 à 7, état et reprise |
| [docs/LIMITES.md](docs/LIMITES.md) | Limites connues, honnêtement |
| [docs/CONTRIBUER.md](docs/CONTRIBUER.md) | Ajouter une leçon, un exercice (Python ou SQL), un projet, une visualisation |
| [docs/DONNEES.md](docs/DONNEES.md) | Jeux de données : provenance, schéma, anomalies volontaires |
| [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md) | Données détenues, conservation, export, suppression, ce qui part au fournisseur d'IA |

## Arborescence

```
src/
  content/       contenus pédagogiques versionnés (leçons, exercices, projets, jeux de données, matrice)
  grading/       harnais Python, comparaison de résultats SQL, rapport, explications d'erreurs en français
  runtime/python Web Worker Pyodide + client (limite de temps, interruption, redémarrage)
  runtime/sql    Web Worker PGlite + moteur partagé avec les tests (isolation, cas cachés, schéma)
  storage/       IndexedDB : profil, parcours, brouillons, tentatives, événements, révisions
  domain/        logique pure : maîtrise explicable, recommandations, révisions, parcours
  ui/            interface React (pages, composants, visualisations)
  services/      client du serveur (compte, synchronisation), journal des erreurs du navigateur
server/          serveur optionnel : HTTP, comptes, quotas IA, signalements, administration, journaux (node:sqlite)
tests/           tests unitaires et tests de contenu (Vitest), dont le serveur testé en HTTP réel
e2e/             tests navigateur (Playwright)
scripts/         récupération de Pyodide, génération de la matrice de couverture
```

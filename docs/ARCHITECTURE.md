# Architecture

## Vue d'ensemble (étape 1)

Application web statique (Vite + React + TypeScript). Python s'exécute **dans le navigateur de l'étudiant**, dans un Web Worker Pyodide. La progression est stockée localement (IndexedDB). Il n'y a pas encore de serveur : il arrivera avec le tuteur IA (étape 5) et les comptes (étape 7).

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
```

### Séparation des responsabilités

| Couche | Rôle | Dépend de |
|---|---|---|
| `content/` | Leçons, exercices (avec version), matrice de couverture. Données pures, validées par zod. | — |
| `grading/` | Harnais Python (exécuté dans Pyodide), construction du rapport, traduction pédagogique des erreurs. | `content/types` |
| `runtime/python/` | Cycle de vie du worker, file d'exécution unique, limite de temps, interruption, redémarrage. | `grading/` |
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

## Modèle de données (IndexedDB `skillforge`, version 1)

| Magasin | Clé | Contenu |
|---|---|---|
| `kv` | chaîne | `profile`, `path`, `resume` (leçon/section/exercice), `activity` (secondes actives par jour), `hints:<exercice>`, `explain:<bloc>`, `sandbox` |
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
| Démontré | exercice autonome ou test de validation réussi, tests cachés compris, sans solution affichée ni aide ciblée (niveau 3) |
| Consolidé | Démontré + débogage réussi + révision espacée réussie |

Chaque niveau est accompagné de ses raisons et de la liste des preuves (vérifiées ou auto-déclarées).

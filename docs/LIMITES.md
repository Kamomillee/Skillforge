# Limites connues (étape 1)

## Contenu
- **Une seule notion est disponible** (Python A — boucles et accumulateurs) sur 280 prévues. La matrice de couverture l'indique honnêtement.
- Les projets, le projet transversal, le mode entretien et le tuteur IA ne sont pas encore implémentés ; l'interface l'indique là où ils apparaissent.
- Le mini-diagnostic de l'onboarding ne couvre que Python.

## Exécution Python (navigateur)
- **Mémoire** : pas de limite fine ; seule celle du navigateur s'applique (WebAssembly 32 bits, 4 Go max). Un programme qui alloue énormément peut faire planter le worker ; il est alors recréé.
- **Réseau** : `pyodide.http` est retiré, mais un code déterminé peut encore appeler `fetch` via le module `js`. Aucun secret n'est présent dans le navigateur, le risque est donc limité à l'étudiant lui-même. À l'étape 7, une politique CSP `connect-src 'self'` sera ajoutée aux en-têtes d'hébergement.
- **Interruption** : douce seulement avec COOP/COEP ; sinon redémarrage du moteur (état Python perdu, ≈ 2 s).
- **Premier chargement** : ~10 Mo pour le noyau Python ; pandas/scikit-learn (~30 Mo) ne seront chargés que par les exercices qui en ont besoin (aucun à cette étape).

## Correction
- La correction s'exécute dans le navigateur : un étudiant peut lire les tests cachés dans les outils de développement. C'est acceptable pour s'entraîner ; une **attestation** de parcours devra être recorrigée côté serveur (étape 7).
- Le code de l'étudiant et le harnais partagent l'interpréteur : un code malveillant pourrait altérer le harnais. Même conclusion que ci-dessus.
- Les comparaisons de flottants sont exactes sauf mention `approx` ; les énoncés demandent explicitement l'arrondi.

## Progression et données
- Stockée uniquement dans ce navigateur : pas de synchronisation entre appareils, perdue si les données du site sont effacées (export JSON disponible).
- Le temps actif est une **mesure locale** (page visible + interaction dans la dernière minute), pas une durée d'apprentissage exacte.
- Les signalements d'erreur pédagogique sont enregistrés localement (inclus dans l'export), pas encore transmis.

## Interface
- Testée dans Chromium (desktop 1440×900 et Pixel 7). Firefox et Safari non testés automatiquement à cette étape.
- Contrastes choisis pour WCAG AA mais pas encore audités avec un outil (prévu à l'étape 7).
- Le bundle JavaScript principal fait ~880 Ko (non gzippé), à découper par route.

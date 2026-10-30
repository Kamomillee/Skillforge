# Limites connues (étapes 1 et 2)

## Contenu
- **8 notions sont disponibles** sur 280 (1 Python, 7 SQL), 4 autres sont « testées » via le projet PME. La matrice de couverture l'indique honnêtement.
- Un seul projet est jouable (SQL, base de données d'une PME, 5 questions métier) ; sa partie conception de schéma est prévue. Le projet transversal, le mode entretien et le tuteur IA ne sont pas encore implémentés ; l'interface l'indique là où ils apparaissent.
- Le mini-diagnostic de l'onboarding ne couvre que Python.

## Exécution Python (navigateur)
- **Mémoire** : pas de limite fine ; seule celle du navigateur s'applique (WebAssembly 32 bits, 4 Go max). Un programme qui alloue énormément peut faire planter le worker ; il est alors recréé.
- **Réseau** : `pyodide.http` est retiré, mais un code déterminé peut encore appeler `fetch` via le module `js`. Aucun secret n'est présent dans le navigateur, le risque est donc limité à l'étudiant lui-même. À l'étape 7, une politique CSP `connect-src 'self'` sera ajoutée aux en-têtes d'hébergement.
- **Interruption** : douce seulement avec COOP/COEP ; sinon redémarrage du moteur (état Python perdu, ≈ 2 s).
- **Premier chargement** : ~10 Mo pour le noyau Python ; pandas/scikit-learn (~30 Mo) ne seront chargés que par les exercices qui en ont besoin (aucun à cette étape).

## Exécution SQL (navigateur)
- **Taille** : ~17 Mo (wasm + données) téléchargés à la première ouverture d'un contenu SQL ; moteur prêt en ~3 s mesurées sur Chromium headless local, davantage sur un ordinateur lent ou un réseau mobile.
- **Interruption** : PGlite n'applique pas `statement_timeout` ; le dépassement de la limite de temps (8 s) termine le worker et recrée la base (~3 s). Aucune perte de travail : la base de formation est en lecture seule.
- **Lecture seule** : chaque requête est annulée (`ROLLBACK`). Les instructions `INSERT/UPDATE/DELETE` s'exécutent mais n'ont aucun effet durable ; le module C (transactions, modifications) demandera un mode d'exercice dédié.
- **Résultats** : 500 lignes maximum renvoyées en exécution libre (5 000 pendant la correction), 200 affichées.
- **Dialecte** : PostgreSQL 18.6. Ce qui est appris est transposable, mais quelques fonctions (`to_char`, `::` pour les conversions) diffèrent dans d'autres moteurs (SQL Server, MySQL) ; les leçons le signalent quand c'est le cas.
- Le jeu de données est **synthétique** (voir [DONNEES.md](DONNEES.md)) : les ordres de grandeur sont plausibles, pas réalistes au sens statistique.

## Carte des compétences
- Les prérequis fins ne sont renseignés que pour les notions jouables ; pour les autres, seules les dépendances entre modules sont montrées.
- La vue d'ensemble a une largeur fixe (~1 100 px) : sur téléphone elle défile horizontalement dans son cadre ; la version liste est plus confortable.

## Correction
- La correction s'exécute dans le navigateur : un étudiant peut lire les tests cachés dans les outils de développement. C'est acceptable pour s'entraîner ; une **attestation** de parcours devra être recorrigée côté serveur (étape 7).
- Le code de l'étudiant et le harnais partagent l'interpréteur : un code malveillant pourrait altérer le harnais. Même conclusion que ci-dessus.
- Les comparaisons de flottants sont exactes sauf mention `approx` ; les énoncés demandent explicitement l'arrondi.
- SQL : les requêtes de référence et les données des cas cachés sont dans le bundle ; même conclusion (entraînement oui, attestation non).
- Activités : la réponse attendue est dans le bundle ; les essais sont illimités. C'est pourquoi elles ne comptent pas pour le niveau de maîtrise.
- SQL : les pistes d'erreurs fréquentes sont des indications heuristiques (vérification échouée + motifs lus dans la requête) ; elles peuvent manquer ou être imprécises, la réussite elle-même ne dépend que des résultats.

## Progression et données
- Stockée uniquement dans ce navigateur : pas de synchronisation entre appareils, perdue si les données du site sont effacées (export JSON disponible).
- Le temps actif est une **mesure locale** (page visible + interaction dans la dernière minute), pas une durée d'apprentissage exacte.
- Les signalements d'erreur pédagogique sont enregistrés localement (inclus dans l'export), pas encore transmis.
- Journal de décisions du projet : sauvegardé par étape ; si la même étape est modifiée dans deux onglets en même temps, le dernier enregistrement gagne (pas de détection de conflit, contrairement au code des exercices).

## Interface
- Testée dans Chromium (desktop 1440×900 et Pixel 7). Firefox et Safari non testés automatiquement à cette étape.
- Contrastes choisis pour WCAG AA mais pas encore audités avec un outil (prévu à l'étape 7).
- Le bundle JavaScript principal fait ~1 Mo (non gzippé, 320 Ko gzip), à découper par route ; le moteur SQL est déjà chargé à part (worker).

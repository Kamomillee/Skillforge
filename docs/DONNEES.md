# Jeux de données

## Torréfaction du Léman (`pme`)

- **Provenance** : entièrement **synthétique**, généré de façon déterministe par `src/content/datasets/pme.ts` (générateur pseudo-aléatoire `mulberry32`, graine 42). Aucune personne, entreprise ni transaction réelle ; les noms sont inventés. Libre de réutilisation dans le cadre de la formation.
- **Usage** : leçons et exercices SQL du module B, projet « Base de données d'une PME ». La base est recréée à chaque démarrage du moteur et chaque requête d'exercice est annulée : l'étudiant ne peut pas l'altérer.
- **Période** : commandes du 1er mai 2025 au 22 octobre 2026.

| Table | Lignes | Contenu |
|---|---|---|
| `clients` | 44 | particuliers et entreprises ; `ville` et `email` peuvent être NULL |
| `produits` | 24 | café, thé, accessoires ; prix de vente et coût unitaire (marge) |
| `commandes` | 280 | statut `livree` (238), `expediee` (31) ou `annulee` (11) |
| `lignes_commande` | 683 | produit, quantité, prix réellement facturé (promotions possibles) |
| `paiements` | 249 | carte, TWINT ou facture ; certaines commandes n'ont pas encore de paiement |
| `retours` | 30 | produit retourné après livraison, motif parfois NULL |

Clés : `commandes.client_id → clients`, `lignes_commande.commande_id → commandes`, `lignes_commande.produit_id → produits`, `paiements.commande_id → commandes`, `retours.commande_id → commandes`, `retours.produit_id → produits`.

### Particularités volontaires (pédagogiques)

Elles existent pour que les erreurs fréquentes produisent un résultat **différent** et donc détectable :

- 7 clients sans ville et 2 sans e-mail (logique à trois valeurs, `= NULL`).
- 2 clients sans aucune commande (INNER vs LEFT JOIN, `COUNT(*)` après LEFT JOIN).
- Un produit jamais vendu (« Sucre de canne ») : anti-jointure.
- Des commandes annulées qui gardent leurs lignes (sans paiement) : toute définition du chiffre d'affaires doit décider de les exclure.
- Des commandes à plusieurs lignes et un paiement : joindre `paiements` et `lignes_commande` répète le montant payé une fois par ligne (doublons créés par les jointures).
- Deux clients portent le même nom (et les cas cachés en ajoutent) : il faut regrouper par identifiant, pas par nom.

### Anomalie non voulue, conservée et documentée
- 2 retours sont datés **après** la dernière commande (jusqu'au 8 novembre 2026, alors que les commandes s'arrêtent le 22 octobre 2026) : le générateur ajoute un délai au jour de commande sans le borner. Découvert à l'étape 4. Conservé pour ne pas changer les résultats des exercices existants ; le projet BI demande de choisir explicitement la date de rattachement des retours.

Ces invariants sont vérifiés par `tests/content/sql.test.ts` (« jeu de données ») : si le générateur change, les tests indiquent quel exercice perdrait son sens.

## Python (étape 1)

Petites listes synthétiques écrites directement dans les énoncés et les tests (`src/content/python/boucles.ts`).

## Départ de clients (`churn`, étape 4)

`src/content/datasets/churn.ts` — **synthétique**, aucune personne réelle. 160 abonnés générés de façon déterministe (graine 7) par un modèle logistique **connu** plus du bruit : ancienneté (mois), commandes sur 6 mois, réclamations sur 12 mois ; étiquette = résiliation dans les 3 mois. 120 abonnés d'entraînement (30 départs, 25 %), 40 de test (11 départs, 27,5 %). Les probabilités de test de la régression logistique (scikit-learn 1.8, `max_iter=1000`) sont figées dans `content/ml/evaluation.ts` et recalculées par `tests/content/ml.test.ts`.

## Base documentaire (`documents`, étape 4)

`src/content/datasets/documents.ts` — 8 textes **rédigés pour l'exercice** (politique de retour, livraison, abonnement, garantie, boutique, fidélité, allergènes, paiement) ; aucune politique réelle. Chaque fait n'apparaît que dans un document, pour que la source attendue soit sans ambiguïté. 13 questions de référence, dont 4 sans réponse dans la base (dont une « piège » : le prix d'une machine, proche du document garantie qui ne contient aucun prix). Avec les réglages de la leçon : 5 bonnes sources, 3 abstentions justifiées, 4 silences à tort, 1 réponse sans appui (vérifié par `tests/content/llm.test.ts`).

## BI (étape 4)

Le laboratoire BI réutilise la base PME. Chiffres cités dans la leçon et vérifiés par `tests/content/bi.test.ts` : part du café dans le CA = 24,7 % (toutes périodes), 23,9 % (2026), 18,3 % (clients entreprises en 2026) ; commandes du 1er mai 2025 au 22 octobre 2026 (d'où la comparaison sur « 1er mai – 22 octobre »).


## Export de la boutique (`import-boutique`, étape 6)
- 11 lignes **écrites à la main** (`src/content/datasets/import-boutique.ts`), format d'un export de tableur suisse : séparateur `;`, décimales à virgule. Clients, produits et prix sont ceux de la base PME.
- Anomalies volontaires : un doublon exact (commande 5002), une date au format suisse (5003), une quantité nulle (5004) et une négative (5005), des espaces autour d'une quantité (5006), un client inconnu (5009, client 999). Après nettoyage : 7 lignes, rejets 1 date / 2 quantités / 1 doublon (test dédié).
- Pour l'étape SQL, les 7 lignes propres sont chargées dans une table **temporaire** `import_ventes`, recréée avant chaque exécution et chaque vérification (champ `setup` de l'exercice), puis annulée avec la transaction.

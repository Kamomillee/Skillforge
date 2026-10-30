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

Ces invariants sont vérifiés par `tests/content/sql.test.ts` (« jeu de données ») : si le générateur change, les tests indiquent quel exercice perdrait son sens.

## Python (étape 1)

Petites listes synthétiques écrites directement dans les énoncés et les tests (`src/content/python/boucles.ts`).

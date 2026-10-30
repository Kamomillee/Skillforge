# Données personnelles et conservation

SkillForge AI fonctionne **sans compte** : la progression reste alors dans le navigateur (IndexedDB) et rien n'est envoyé à un serveur. Ce document décrit ce qui change avec le serveur SkillForge et un compte.

## Ce que le serveur détient (par compte)

| Donnée | Pourquoi | Conservation |
|---|---|---|
| E-mail, prénom facultatif, rôle | Se connecter, distinguer l'administration | Jusqu'à la suppression du compte |
| Hachage du mot de passe (scrypt, sel aléatoire) | Vérifier la connexion ; le mot de passe n'est jamais stocké | Jusqu'à la suppression du compte |
| Sessions (hachage du jeton, dates) | Rester connecté | 30 jours, puis purgées |
| Progression synchronisée (instantané JSON) | Retrouver son travail sur un autre appareil | Jusqu'à la suppression du compte ; remplacée à chaque synchronisation |
| Demandes au tuteur IA : date, mode, jetons, statut | Budget quotidien et affichage de la consommation ; **jamais le texte** | 90 jours, puis purgées |
| Signalements (texte, exercice, version, statut, réponse) | Corriger les contenus | Tant qu'ils ne sont pas traités ; 365 jours après traitement |

La purge tourne au plus une fois par heure, au fil des requêtes (`purge` dans `server/db.ts`, testée).

## Ce que le serveur ne détient pas
- Le code des exercices n'est pas envoyé au serveur, sauf dans l'instantané de progression si tu synchronises, ou dans le contexte d'une demande au tuteur IA (transmis au fournisseur, non conservé par SkillForge).
- Les journaux du serveur ne contiennent ni mot de passe, ni jeton, ni e-mail, ni code, ni question (test automatique).
- Les statistiques d'administration sont des agrégats ; la liste des signalements n'affiche pas leur auteur.

## Fournisseur d'IA
Quand tu interroges le tuteur IA, le serveur envoie à Anthropic (Claude) uniquement le contexte de l'exercice en cours : énoncé, ton code actuel, résultats de la dernière vérification (sans les valeurs des tests cachés), nombre de tentatives, niveau d'aide et ta question. Jamais tes autres exercices, ta progression, ton e-mail ni ton nom. La clé API reste sur le serveur.

## Tes droits, en pratique
- **Exporter** : Paramètres → « Exporter mes données du serveur (JSON) » (tout ce qui est listé plus haut, sans le hachage du mot de passe) ; « Exporter (JSON) » pour les données du navigateur.
- **Supprimer** : Paramètres → « Supprimer mon compte » (mot de passe demandé). Compte, sessions, progression et historique IA sont effacés immédiatement ; les signalements restent, détachés de toute personne. Les données du navigateur se suppriment séparément (« Supprimer toutes mes données »).
- **Rectifier** : la progression se corrige en local puis se resynchronise.

## Fichiers importés
Un fichier d'export importé est traité comme une entrée non fiable : taille limitée (20 Mo), format et structure vérifiés avant d'effacer quoi que ce soit. Le serveur valide de même chaque instantané (schéma, 2 Mo).

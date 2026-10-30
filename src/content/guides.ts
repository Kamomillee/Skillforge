/**
 * Contenu rédigé du tuteur local (sans IA) : une fiche par leçon et un guide par erreur fréquente.
 * Le tuteur ne fait qu'assembler ces textes avec le contexte réel de l'étudiant (code, tests, tentatives) :
 * aucune affirmation n'est générée. tests/unit/guides.test.ts vérifie que chaque leçon a sa fiche et
 * que chaque étiquette d'erreur a son guide.
 */

export interface MisconceptionGuide {
  /** Ce qui se passe, en une ou deux phrases. */
  explication: string;
  /** Question d'orientation : l'étudiant vérifie lui-même. */
  question: string;
  /** Petit exemple qui montre l'erreur et sa correction (hors exercice). */
  exemple?: { language: "python" | "sql"; faux: string; juste: string };
}

export const misconceptionGuides: Record<string, MisconceptionGuide> = {
  "liste-vide": {
    explication: "Une liste vide n'a ni premier élément ni moyenne : un code qui suppose au moins un élément plante ou divise par zéro.",
    question: "Que renvoie ta fonction si on lui passe [] ? Exécute-la avec cette valeur.",
    exemple: { language: "python", faux: "def moyenne(xs):\n    return sum(xs) / len(xs)", juste: "def moyenne(xs):\n    if not xs:\n        return 0.0\n    return sum(xs) / len(xs)" },
  },
  "accumulateur-reinitialise": {
    explication: "Si l'accumulateur est remis à zéro dans la boucle, il oublie tout ce qui précède : seul le dernier tour compte.",
    question: "Sur quelle ligne ton accumulateur reçoit-il sa valeur de départ, et cette ligne est-elle exécutée une fois ou à chaque tour ?",
    exemple: { language: "python", faux: "for x in xs:\n    total = 0\n    total += x", juste: "total = 0\nfor x in xs:\n    total += x" },
  },
  "statut-ignore": {
    explication: "Toutes les lignes ne doivent pas compter : l'énoncé précise un statut ou un type à prendre en compte.",
    question: "Relis l'énoncé : quelles lignes doivent être exclues, et où ton code les écarte-t-il ?",
  },
  "signe-remboursement": {
    explication: "Un remboursement diminue le chiffre d'affaires : il faut le soustraire, pas l'ajouter.",
    question: "Avec une vente de 100 et un remboursement de 30, quel total attends-tu ? Et ton code ?",
  },
  "arrondi-flottant": {
    explication: "Les nombres à virgule sont stockés de façon approchée : 0.1 + 0.2 ne vaut pas exactement 0.3. L'énoncé demande un arrondi.",
    question: "Affiche le résultat brut de ton calcul : combien de décimales a-t-il ? Combien en demande l'énoncé ?",
    exemple: { language: "python", faux: "return total", juste: "return round(total, 2)" },
  },
  "division-zero": {
    explication: "Diviser par zéro est une erreur en Python comme en SQL. Il faut décider à l'avance ce que vaut le résultat quand le dénominateur est nul.",
    question: "Dans quel cas ton dénominateur peut-il valoir 0 ? Que demande l'énoncé dans ce cas ?",
    exemple: { language: "sql", faux: "SUM(a) / SUM(b)", juste: "SUM(a) / NULLIF(SUM(b), 0)" },
  },
  "mutation-argument": {
    explication: "Modifier la liste reçue en argument change aussi la liste de l'appelant : un effet de bord souvent invisible.",
    question: "Ta fonction appelle-t-elle .append, .sort ou une affectation sur la liste reçue ? Pourrait-elle travailler sur une copie ?",
  },
  "condition-inversee": {
    explication: "Le sens de la comparaison ou l'inclusion de la borne change le résultat : > n'est pas >=.",
    question: "Prends une valeur exactement égale à la borne : doit-elle être gardée selon l'énoncé ? Et dans ton code ?",
  },
  "valeur-retour": {
    explication: "print affiche une valeur, mais la fonction renvoie None. Les tests lisent la valeur retournée.",
    question: "Ta fonction contient-elle une instruction return avec le résultat ?",
    exemple: { language: "python", faux: "def double(x):\n    print(x * 2)", juste: "def double(x):\n    return x * 2" },
  },
  "null-egalite": {
    explication: "En SQL, NULL signifie « inconnu » : NULL = NULL n'est pas vrai. On teste l'absence avec IS NULL.",
    question: "Combien de lignes ta condition = NULL renvoie-t-elle ? Essaie IS NULL.",
    exemple: { language: "sql", faux: "WHERE ville = NULL", juste: "WHERE ville IS NULL" },
  },
  "where-having": {
    explication: "WHERE filtre les lignes avant le regroupement ; HAVING filtre les groupes après le calcul des agrégats.",
    question: "Ta condition porte-t-elle sur une ligne (une commande) ou sur un résultat de groupe (un total) ?",
    exemple: { language: "sql", faux: "WHERE COUNT(*) >= 10", juste: "GROUP BY client_id\nHAVING COUNT(*) >= 10" },
  },
  "jointure-doublons": {
    explication: "Joindre une table de détail répète chaque ligne de l'autre table autant de fois qu'il y a de détails : les sommes sont gonflées.",
    question: "Combien de lignes compte ta jointure pour une seule commande ? Le montant que tu additionnes est-il répété ?",
  },
  "inner-au-lieu-de-left": {
    explication: "INNER JOIN ne garde que les lignes qui ont une correspondance : les clients sans commande (ou les catégories sans retour) disparaissent.",
    question: "L'énoncé demande-t-il de garder les lignes sans correspondance ? Combien de lignes attends-tu ?",
    exemple: { language: "sql", faux: "FROM clients c JOIN commandes o ON ...", juste: "FROM clients c LEFT JOIN commandes o ON ..." },
  },
  "count-etoile-left": {
    explication: "Après un LEFT JOIN, une ligne sans correspondance existe quand même : COUNT(*) la compte 1. COUNT(colonne) ignore les NULL et donne 0.",
    question: "Pour un client sans commande, que compte COUNT(*) ? Et COUNT(o.commande_id) ?",
  },
  "statut-annule": {
    explication: "Une commande annulée n'a pas généré de chiffre d'affaires : elle doit être exclue de la définition.",
    question: "Où ta requête écarte-t-elle les commandes annulées ?",
    exemple: { language: "sql", faux: "WHERE date_commande >= ...", juste: "WHERE statut <> 'annulee'\n  AND date_commande >= ..." },
  },
  "ordre-tri": {
    explication: "Quand l'énoncé impose un ordre, le tri fait partie de la réponse : sens (ASC/DESC) et départage des égalités compris.",
    question: "Quel est l'ordre demandé ? Deux lignes à égalité sortent-elles toujours dans le même ordre ?",
  },
  colonnes: {
    explication: "Les colonnes attendues ont des noms précis (alias) : une bonne valeur sous un autre nom n'est pas reconnue.",
    question: "Compare les noms de tes colonnes avec ceux de l'énoncé, un par un.",
  },
  "valeur-codee-en-dur": {
    explication: "Recopier un résultat vu dans les données marche une fois : les vérifications cachées changent les données et le résultat doit suivre.",
    question: "Si une ligne était ajoutée ou modifiée, ton code donnerait-il encore la bonne réponse ?",
  },
  "group-by-granularite": {
    explication: "Le niveau de détail (par jour, par mois, par client…) ou la période choisie ne correspond pas à la question.",
    question: "Une ligne de ton résultat représente quoi exactement ? Et sur quelle période ?",
  },
  "division-entiere": {
    explication: "En SQL, diviser deux entiers donne un entier : 3 / 4 vaut 0. Il faut un décimal (100.0 * …).",
    question: "Les deux termes de ta division sont-ils des entiers ?",
    exemple: { language: "sql", faux: "100 * a / b", juste: "100.0 * a / b" },
  },
  "seuil-strict": {
    explication: "L'énoncé précise si une valeur égale au seuil compte (>=) ou non (>).",
    question: "Avec un score exactement égal au seuil, quelle décision demande l'énoncé ?",
  },
  "vp-fp-inverses": {
    explication: "Faux positif = alerte à tort (prédit 1, réel 0) ; faux négatif = cas manqué (prédit 0, réel 1).",
    question: "Pour un client qui reste mais que le modèle annonce partant : quelle case ?",
  },
  "moyenne-arithmetique": {
    explication: "Le F1 est une moyenne harmonique : il reste bas dès qu'une des deux mesures est basse, contrairement à la moyenne simple.",
    question: "Avec précision 1,0 et rappel 0,1, que donne ta formule ? Est-ce honnête pour un modèle qui rate 90 % des cas ?",
  },
  "exactitude-trompeuse": {
    explication: "Quand une classe est rare, prédire toujours la classe majoritaire donne une exactitude élevée sans aucune utilité.",
    question: "Quelle exactitude obtient un modèle qui prédit toujours « reste » ? Et son rappel ?",
  },
  "egalite-de-cout": {
    explication: "Deux seuils peuvent avoir le même coût ; l'énoncé dit lequel garder.",
    question: "Que fait ton code quand deux seuils ont exactement le même coût ?",
  },
  chevauchement: {
    explication: "Chaque morceau commence taille − chevauchement mots après le précédent : ses premiers mots répètent la fin du morceau d'avant.",
    question: "Sur « a b c d e f » avec taille 4 et chevauchement 1, quels sont les deux morceaux attendus ?",
  },
  "dernier-morceau": {
    explication: "Le dernier morceau peut être plus court que les autres ; l'oublier fait disparaître la fin du document.",
    question: "Le dernier mot du texte apparaît-il dans un de tes morceaux ?",
  },
  "budget-depasse": {
    explication: "Le contexte a une taille limitée : il faut vérifier qu'un passage rentre avant de l'ajouter.",
    question: "Ton code vérifie-t-il le budget avant ou après avoir ajouté le passage ?",
  },
  "ordre-pertinence": {
    explication: "Les passages doivent être pris du plus pertinent au moins pertinent, avec un départage stable des égalités.",
    question: "Si deux passages ont les scores 1 puis 3, lequel ton code prend-il en premier ?",
  },
  "abstention-absente": {
    explication: "Quand aucune source n'est assez pertinente, l'assistant doit le dire au lieu de répondre quand même.",
    question: "Que renvoie ton code quand la liste de résultats est vide, ou que tous les scores sont sous le seuil ?",
  },
  "casse-ponctuation": {
    explication: "« Livraison? » et « livraison. » sont le même mot une fois la casse et la ponctuation normalisées.",
    question: "Que donne ton découpage en mots sur « Livraison gratuite ? » ?",
  },
  "contexte-denominateur": {
    explication: "Le dénominateur d'une part doit être calculé avec les mêmes filtres que le numérateur, sauf celui qu'on retire volontairement (ALL).",
    question: "Quels filtres (année, statut, segment) s'appliquent à ton dénominateur ? Lesquels devraient s'appliquer ?",
  },
};

export interface Fiche {
  /** Résumé de la notion en quelques phrases (Markdown). */
  resume: string;
  pointsCles: string[];
  /** Exemple différent de ceux des exercices. */
  exemple: { language: "python" | "sql"; code: string; explication: string };
  /** Questions de rappel (mini-test) : réponse courte attendue. */
  questions: { question: string; reponse: string }[];
  /** Questions d'entretien et éléments attendus dans une bonne réponse. */
  entretien: { question: string; attendus: string[] }[];
}

export const fiches: Record<string, Fiche> = {
  "py-boucles-accumulateurs": {
    resume: "Une **boucle for** répète un bloc pour chaque élément d'une liste. Un **accumulateur** est une variable initialisée *avant* la boucle et mise à jour à chaque tour (somme, compteur, maximum).",
    pointsCles: [
      "Initialiser l'accumulateur avant la boucle, jamais dedans.",
      "Prévoir la liste vide (division par zéro, maximum indéfini).",
      "Retourner le résultat avec return ; print ne sert qu'à observer.",
      "Arrondir explicitement les nombres à virgule quand l'énoncé le demande.",
    ],
    exemple: {
      language: "python",
      code: "temperatures = [12.5, 14.0, 9.5]\nmaximum = temperatures[0]\nfor t in temperatures:\n    if t > maximum:\n        maximum = t\nprint(maximum)  # 14.0",
      explication: "Ici l'accumulateur garde le plus grand élément vu jusqu'ici. Il part du premier élément : il faudrait donc traiter à part une liste vide.",
    },
    questions: [
      { question: "Où place-t-on `total = 0` pour additionner une liste ?", reponse: "Avant la boucle." },
      { question: "Que renvoie une fonction sans return ?", reponse: "None." },
      { question: "Combien de tours fait `for x in []` ?", reponse: "Aucun." },
    ],
    entretien: [
      { question: "Comment calculeriez-vous le chiffre d'affaires net d'une liste de transactions, remboursements compris ?", attendus: ["accumulateur initialisé avant la boucle", "soustraction des remboursements", "cas de la liste vide", "arrondi"] },
      { question: "Comment testez-vous une telle fonction ?", attendus: ["cas nominal", "cas limites (vide, un élément)", "valeurs à virgule"] },
    ],
  },
  "sql-requetes-select": {
    resume: "Une requête **SELECT** choisit des colonnes, **WHERE** filtre les lignes, **ORDER BY** trie, **LIMIT** coupe. L'ordre logique d'exécution est FROM → WHERE → SELECT → ORDER BY → LIMIT. NULL signifie « inconnu » : on le teste avec IS NULL.",
    pointsCles: [
      "AND est évalué avant OR : mettre des parenthèses.",
      "= NULL n'est jamais vrai ; utiliser IS NULL / IS NOT NULL.",
      "Un classement avec LIMIT doit départager les égalités pour être reproductible.",
    ],
    exemple: {
      language: "sql",
      code: "SELECT nom, ville\nFROM clients\nWHERE segment = 'entreprise'\n  AND (ville = 'Genève' OR ville IS NULL)\nORDER BY nom, client_id;",
      explication: "Les parenthèses gardent le filtre sur le segment pour les deux villes ; le second critère de tri rend l'ordre stable.",
    },
    questions: [
      { question: "Quelle clause est évaluée en premier : WHERE ou SELECT ?", reponse: "WHERE." },
      { question: "Comment trouver les clients sans e-mail ?", reponse: "WHERE email IS NULL." },
    ],
    entretien: [{ question: "Pourquoi une requête « top 5 » peut-elle donner des résultats différents d'une exécution à l'autre ?", attendus: ["égalités sur le critère de tri", "ordre non garanti sans ORDER BY complet", "départage par identifiant"] }],
  },
  "sql-requetes-agregations": {
    resume: "Les **agrégats** (COUNT, SUM, AVG, MIN, MAX) résument plusieurs lignes en une valeur. **GROUP BY** calcule un agrégat par groupe ; **HAVING** filtre les groupes, **WHERE** filtre les lignes avant.",
    pointsCles: [
      "Chaque colonne non agrégée du SELECT doit être dans le GROUP BY.",
      "COUNT(*) compte les lignes ; COUNT(colonne) ignore les NULL.",
      "WHERE avant le regroupement, HAVING après.",
    ],
    exemple: {
      language: "sql",
      code: "SELECT moyen, COUNT(*) AS nb, SUM(montant) AS total\nFROM paiements\nWHERE date_paiement >= DATE '2026-01-01'\nGROUP BY moyen\nHAVING SUM(montant) > 1000;",
      explication: "Le filtre sur la date porte sur chaque paiement (WHERE) ; le seuil de 1 000 porte sur le total du groupe (HAVING).",
    },
    questions: [
      { question: "Peut-on écrire WHERE SUM(montant) > 100 ?", reponse: "Non, il faut HAVING." },
      { question: "COUNT(email) compte-t-il les e-mails manquants ?", reponse: "Non, il ignore les NULL." },
    ],
    entretien: [{ question: "Expliquez la différence entre WHERE et HAVING avec un exemple métier.", attendus: ["WHERE sur les lignes", "HAVING sur les agrégats", "ordre d'exécution", "exemple chiffré"] }],
  },
  "sql-requetes-jointures": {
    resume: "Une **jointure** associe les lignes de deux tables par une clé. **INNER JOIN** ne garde que les correspondances ; **LEFT JOIN** garde toutes les lignes de gauche, avec des NULL à droite. Joindre une table de détail multiplie les lignes.",
    pointsCles: [
      "Joindre sur la clé étrangère (ex. commandes.client_id = clients.client_id).",
      "LEFT JOIN quand l'énoncé dit « y compris ceux qui n'ont pas… ».",
      "Après un LEFT JOIN, compter une colonne de droite (COUNT(o.commande_id)).",
      "Vérifier le nombre de lignes avant d'additionner des montants.",
    ],
    exemple: {
      language: "sql",
      code: "SELECT p.nom, COUNT(l.commande_id) AS nb_lignes\nFROM produits p\nLEFT JOIN lignes_commande l ON l.produit_id = p.produit_id\nGROUP BY p.produit_id, p.nom\nORDER BY nb_lignes;",
      explication: "Les produits jamais vendus restent dans le résultat avec 0, grâce au LEFT JOIN et à COUNT sur une colonne de droite.",
    },
    questions: [
      { question: "Un client sans commande apparaît-il avec INNER JOIN ?", reponse: "Non." },
      { question: "Après un LEFT JOIN, que vaut COUNT(*) pour un client sans commande ?", reponse: "1 (il faut COUNT(colonne) pour obtenir 0)." },
    ],
    entretien: [{ question: "Un total de ventes vous semble trop élevé après une jointure. Que vérifiez-vous ?", attendus: ["cardinalité de la jointure", "table de détail qui répète les lignes", "compter les lignes avant/après", "agréger avant de joindre"] }],
  },
  "ml-evaluer-classifieur": {
    resume: "Un classifieur se juge avec la **matrice de confusion** (VP, FP, FN, VN). La **précision** mesure la part d'alertes justes, le **rappel** la part de cas réels détectés. Le **seuil** règle l'arbitrage entre les deux ; on le choisit d'après le **coût** des erreurs, pas à 0,5 par défaut.",
    pointsCles: [
      "Toujours comparer à une base naïve (classe majoritaire).",
      "L'exactitude trompe quand une classe est rare.",
      "Précision = VP / (VP + FP) ; rappel = VP / (VP + FN) ; traiter les divisions par zéro.",
      "Évaluer sur des données qui n'ont pas servi à l'entraînement.",
    ],
    exemple: {
      language: "python",
      code: "y_vrai = [1, 0, 1, 0, 0]\ny_pred = [1, 1, 0, 0, 0]\nvp = sum(1 for v, p in zip(y_vrai, y_pred) if v == 1 and p == 1)\nfp = sum(1 for v, p in zip(y_vrai, y_pred) if v == 0 and p == 1)\nprint(vp / (vp + fp))  # précision 0.5",
      explication: "Une alerte sur deux est juste. Le rappel serait aussi 0,5 : un départ détecté sur deux.",
    },
    questions: [
      { question: "Un faux négatif, c'est…", reponse: "Un cas réel (1) que le modèle n'a pas détecté (0)." },
      { question: "Baisser le seuil fait en général monter quelle mesure ?", reponse: "Le rappel." },
    ],
    entretien: [
      { question: "Votre modèle a 95 % d'exactitude. Est-il bon ?", attendus: ["comparer à la classe majoritaire", "classes déséquilibrées", "regarder rappel/précision", "coût métier"] },
      { question: "Comment choisiriez-vous le seuil d'un modèle de détection de départs ?", attendus: ["coût d'un départ manqué", "coût d'une action inutile", "courbe sur plusieurs seuils", "hypothèses explicites"] },
    ],
  },
  "llm-rag-citations": {
    resume: "Le **RAG** cherche des passages dans ses propres documents, les place dans le **contexte** du modèle et lui demande de répondre à partir d'eux, en **citant** ses sources. Sans source suffisante, l'assistant doit **s'abstenir**.",
    pointsCles: [
      "Découper en morceaux qui se chevauchent pour ne pas couper une information.",
      "La recherche lexicale rate les synonymes ; les embeddings visent le sens.",
      "Le contexte a un budget : y mettre d'abord les passages les plus pertinents.",
      "Un passage proche de la question ne contient pas forcément la réponse : vérifier les citations.",
      "Mesurer sur un jeu de questions connu, y compris des questions sans réponse.",
    ],
    exemple: {
      language: "python",
      code: "resultats = [{\"id\": \"livraison#0\", \"score\": 1}]\nseuil = 2\ncites = [r[\"id\"] for r in resultats if r[\"score\"] >= seuil]\nprint(cites or \"Je ne trouve pas cette information dans les documents.\")",
      explication: "Un seul terme commun ne suffit pas à fonder une réponse : l'assistant s'abstient.",
    },
    questions: [
      { question: "À quoi sert le chevauchement entre morceaux ?", reponse: "À ne pas couper une information à la frontière de deux morceaux." },
      { question: "Que doit faire l'assistant si aucun passage n'atteint le seuil ?", reponse: "S'abstenir (dire qu'il ne trouve pas)." },
    ],
    entretien: [
      { question: "Comment évalueriez-vous un assistant documentaire avant de le mettre en production ?", attendus: ["jeu de questions de référence", "questions sans réponse", "bonne source citée", "silences à tort vs réponses inventées"] },
      { question: "Où placer la clé d'API d'un modèle de langage dans une application web ?", attendus: ["côté serveur uniquement", "jamais dans le navigateur", "variables d'environnement", "budget et journalisation sans secret"] },
    ],
  },
  "bi-mesures-contexte": {
    resume: "Une **mesure** est recalculée dans chaque cellule d'un visuel, avec les filtres de cette cellule : c'est le **contexte de filtre** (slicers, lignes, colonnes). **DIVIDE** évite l'erreur de division par zéro ; **CALCULATE + ALL** retire un filtre, par exemple pour un dénominateur de part.",
    pointsCles: [
      "Lister les filtres d'une cellule avant de lire sa valeur.",
      "La ligne Total réévalue la mesure : elle n'additionne pas les cellules.",
      "DIVIDE(a, b) ≈ a / NULLIF(b, 0) en SQL.",
      "ALL(colonne) ≈ fonction de fenêtre qui ignore ce découpage en SQL.",
    ],
    exemple: {
      language: "sql",
      code: "SELECT cl.segment,\n       SUM(l.quantite * l.prix_unitaire) AS ca,\n       ROUND(100 * SUM(l.quantite * l.prix_unitaire)\n             / SUM(SUM(l.quantite * l.prix_unitaire)) OVER (), 1) AS part_pct\nFROM lignes_commande l\nJOIN commandes c ON c.commande_id = l.commande_id\nJOIN clients cl ON cl.client_id = c.client_id\nWHERE c.statut <> 'annulee'\nGROUP BY cl.segment;",
      explication: "Part de chaque segment dans le CA total : le dénominateur ignore le découpage par segment, mais garde le filtre sur le statut.",
    },
    questions: [
      { question: "Dans une matrice, d'où viennent les filtres d'une cellule ?", reponse: "Des slicers/filtres de page, de l'en-tête de ligne et de l'en-tête de colonne." },
      { question: "Quel est l'équivalent SQL de DIVIDE ?", reponse: "Diviser par NULLIF(dénominateur, 0)." },
    ],
    entretien: [{ question: "Deux rapports donnent deux « parts du café » différentes. Comment trancher ?", attendus: ["comparer les contextes de filtre", "définition écrite de la mesure", "même période", "même dénominateur"] }],
  },
};

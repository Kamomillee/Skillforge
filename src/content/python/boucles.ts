import type { Exercise, Lesson } from "../types";

/**
 * Leçon Python A — Boucles et accumulateurs.
 * Contenu rédigé, versionné, utilisable sans IA.
 * Les traces et les exercices sont vérifiés par tests/content/*.test.ts (exécution réelle Pyodide).
 */

const CONCEPT = "python.a.boucles";

export const exercisesBoucles: Exercise[] = [
  {
    id: "py-boucles-ex1-remboursements",
    version: 1,
    kind: "guided",
    title: "Compter les remboursements",
    prompt:
      "Complète la fonction `compter_remboursements(montants)` : elle reçoit une liste de montants et **retourne** le nombre de montants strictement négatifs (les remboursements).\n\nRemplace chaque `___` par le bon code.",
    functionName: "compter_remboursements",
    starterCode: `def compter_remboursements(montants):
    nombre = ___
    for m in montants:
        if ___:
            nombre = nombre + 1
    return nombre
`,
    referenceSolution: `def compter_remboursements(montants):
    nombre = 0
    for m in montants:
        if m < 0:
            nombre = nombre + 1
    return nombre
`,
    tests: [
      { id: "t1", label: "Deux remboursements", args: [[120, -30, 45, -10]], expected: 2, compare: "exact", hidden: false },
      { id: "t2", label: "Aucun remboursement", args: [[5, 10]], expected: 0, compare: "exact", hidden: false },
      { id: "t3", label: "Liste vide", args: [[]], expected: 0, compare: "exact", hidden: true, misconception: "liste-vide" },
      {
        id: "t4",
        label: "Un montant nul n'est pas un remboursement",
        args: [[0, -0.5, 3]],
        expected: 1,
        compare: "exact",
        hidden: true,
        misconception: "condition-inversee",
      },
      { id: "t5", label: "Uniquement des remboursements", args: [[-1, -2, -3]], expected: 3, compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Avant la boucle, combien de remboursements as-tu déjà comptés ?" },
      { level: 2, text: "Un accumulateur commence à une valeur neutre. Pour compter, la valeur neutre est 0. La condition doit être vraie seulement pour un montant négatif." },
      { level: 3, text: "Première ligne à compléter : `nombre = 0`. Pour la condition, compare `m` à 0 avec l'opérateur « strictement inférieur »." },
      {
        level: 4,
        text: "`nombre = 0` puis `if m < 0:`. Le 0 n'est pas négatif : `m <= 0` compterait à tort un montant nul.",
      },
    ],
    explanation:
      "On initialise le compteur à 0 **avant** la boucle, on l'incrémente quand `m < 0`, et on le retourne **après** la boucle. Attention à `<=` : un montant de 0 n'est pas un remboursement.",
    conceptIds: [CONCEPT],
    packages: [],
    timeLimitMs: 5000,
  },
  {
    id: "py-boucles-ex2-ca-net",
    version: 1,
    kind: "autonomous",
    title: "Chiffre d'affaires net",
    prompt: `Une boutique enregistre des transactions sous forme de dictionnaires :

\`{"type": "vente", "montant": 100}\`

- \`"vente"\` : le montant s'ajoute au chiffre d'affaires ;
- \`"remboursement"\` : le montant (toujours positif dans les données) se **soustrait** ;
- \`"annulation"\` : commande annulée avant paiement, elle ne compte pas.

Écris \`chiffre_affaires_net(transactions)\` qui retourne le chiffre d'affaires net **arrondi à 2 décimales** avec \`round(valeur, 2)\`. La fonction ne doit pas modifier la liste reçue.`,
    functionName: "chiffre_affaires_net",
    starterCode: `def chiffre_affaires_net(transactions):
    # Ton code ici
    pass
`,
    referenceSolution: `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] == "vente":
            total += t["montant"]
        elif t["type"] == "remboursement":
            total -= t["montant"]
    return round(total, 2)
`,
    tests: [
      {
        id: "t1",
        label: "Ventes et un remboursement",
        args: [
          [
            { type: "vente", montant: 100 },
            { type: "remboursement", montant: 30 },
            { type: "vente", montant: 50 },
          ],
        ],
        expected: 120,
        compare: "exact",
        hidden: false,
      },
      { id: "t2", label: "Aucune transaction", args: [[]], expected: 0, compare: "exact", hidden: true, misconception: "liste-vide" },
      {
        id: "t3",
        label: "Une annulation ne compte pas",
        args: [
          [
            { type: "annulation", montant: 80 },
            { type: "vente", montant: 20 },
          ],
        ],
        expected: 20,
        compare: "exact",
        hidden: true,
        misconception: "statut-ignore",
      },
      {
        id: "t4",
        label: "Uniquement un remboursement",
        args: [[{ type: "remboursement", montant: 40 }]],
        expected: -40,
        compare: "exact",
        hidden: true,
        misconception: "signe-remboursement",
      },
      {
        id: "t5",
        label: "Nombres à virgule",
        args: [
          [
            { type: "vente", montant: 0.1 },
            { type: "vente", montant: 0.2 },
          ],
        ],
        expected: 0.3,
        compare: "exact",
        hidden: true,
        misconception: "arrondi-flottant",
      },
      {
        id: "t6",
        label: "Journée complète (la liste ne doit pas être modifiée)",
        args: [
          [
            { type: "vente", montant: 250.5 },
            { type: "remboursement", montant: 20.25 },
            { type: "annulation", montant: 99 },
            { type: "vente", montant: 12.4 },
            { type: "vente", montant: 7.35 },
            { type: "remboursement", montant: 7.35 },
          ],
        ],
        expected: 242.65,
        compare: "exact",
        hidden: true,
        checkNoMutation: true,
        misconception: "mutation-argument",
      },
    ],
    hints: [
      { level: 1, text: "Quelle valeur doit avoir ton total avant d'avoir regardé la moindre transaction ? Et que fais-tu d'une transaction selon son type ?" },
      {
        level: 2,
        text: "C'est un accumulateur avec trois cas : ajouter, soustraire, ou ne rien faire. `if / elif` permet de distinguer les cas ; on lit le type avec `t[\"type\"]`.",
      },
      {
        level: 3,
        text: "Structure : `total = 0` avant la boucle ; dans la boucle, `if t[\"type\"] == \"vente\": total += t[\"montant\"]`, puis un `elif` pour le remboursement avec `-=`. Après la boucle : `return round(total, 2)`.",
      },
      {
        level: 4,
        text: `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] == "vente":
            total += t["montant"]
        elif t["type"] == "remboursement":
            total -= t["montant"]
    return round(total, 2)`,
      },
    ],
    explanation:
      "L'accumulateur `total` part de 0. Chaque transaction modifie `total` selon son type ; l'annulation n'a pas de branche, donc elle est ignorée. `round(…, 2)` corrige l'imprécision des nombres à virgule flottante : `0.1 + 0.2` vaut `0.30000000000000004` en Python. Solution alternative valable : `sum(t[\"montant\"] for t in transactions if t[\"type\"] == \"vente\") - sum(…)` — la correction teste le comportement, pas la forme du code.",
    conceptIds: [CONCEPT],
    packages: [],
    timeLimitMs: 5000,
  },
  {
    id: "py-boucles-ex3-debug-panier",
    version: 1,
    kind: "debug",
    title: "Débogage : le panier moyen faux",
    prompt:
      "Un collègue a écrit `panier_moyen(montants)` : elle doit retourner la moyenne des montants **de ventes** (montants strictement positifs), arrondie à 2 décimales, et `0.0` s'il n'y a aucune vente.\n\nLe code contient **deux** problèmes. Exécute-le, observe, puis corrige-le.",
    functionName: "panier_moyen",
    starterCode: `def panier_moyen(montants):
    for m in montants:
        total = 0
        nombre = 0
        if m > 0:
            total = total + m
            nombre = nombre + 1
    return round(total / nombre, 2)


print(panier_moyen([100, -20, 50]))  # attendu : 75.0
`,
    referenceSolution: `def panier_moyen(montants):
    total = 0
    nombre = 0
    for m in montants:
        if m > 0:
            total = total + m
            nombre = nombre + 1
    if nombre == 0:
        return 0.0
    return round(total / nombre, 2)
`,
    tests: [
      {
        id: "t1",
        label: "Deux ventes et un remboursement",
        args: [[100, -20, 50]],
        expected: 75.0,
        display: "75.0",
        compare: "exact",
        hidden: false,
        misconception: "accumulateur-reinitialise",
      },
      { id: "t2", label: "Une seule vente", args: [[40]], expected: 40.0, display: "40.0", compare: "exact", hidden: false },
      { id: "t3", label: "Liste vide", args: [[]], expected: 0.0, compare: "exact", hidden: true, misconception: "liste-vide" },
      {
        id: "t4",
        label: "Uniquement des remboursements",
        args: [[-5, -10]],
        expected: 0.0,
        compare: "exact",
        hidden: true,
        misconception: "division-zero",
      },
      { id: "t5", label: "Moyenne non entière", args: [[10, 20, 25]], expected: 18.33, compare: "exact", hidden: true, misconception: "arrondi-flottant" },
      {
        id: "t6",
        label: "Un montant nul n'est pas une vente",
        args: [[0, 30]],
        expected: 30.0,
        compare: "exact",
        hidden: true,
        misconception: "condition-inversee",
      },
    ],
    hints: [
      { level: 1, text: "Le programme affiche 50.0 au lieu de 75.0. Quelle est la valeur de `total` au début de **chaque** tour de boucle ?" },
      {
        level: 2,
        text: "Une variable affectée à l'intérieur de la boucle est remise à zéro à chaque itération. Et que se passe-t-il quand `nombre` vaut 0 au moment de la division ?",
      },
      {
        level: 3,
        text: "Déplace `total = 0` et `nombre = 0` avant le `for`. Puis, avant le `return`, ajoute un test `if nombre == 0:` qui retourne `0.0`.",
      },
      {
        level: 4,
        text: `def panier_moyen(montants):
    total = 0
    nombre = 0
    for m in montants:
        if m > 0:
            total = total + m
            nombre = nombre + 1
    if nombre == 0:
        return 0.0
    return round(total / nombre, 2)`,
      },
    ],
    explanation:
      "Bug 1 : les accumulateurs étaient réinitialisés à chaque tour, donc seule la dernière vente comptait. Bug 2 : sans vente, `nombre` vaut 0 et la division lève `ZeroDivisionError` (et avec une liste vide, `total` n'existe même pas : `UnboundLocalError`). On initialise avant la boucle et on traite le cas limite explicitement.",
    conceptIds: [CONCEPT],
    packages: [],
    timeLimitMs: 5000,
  },
  {
    id: "py-boucles-validation",
    version: 1,
    kind: "validation",
    title: "Test de validation : somme au-dessus d'un seuil",
    prompt:
      "Écris `somme_au_dessus(montants, seuil)` qui retourne la somme des montants **strictement supérieurs** à `seuil`. Si aucun montant ne dépasse le seuil, la fonction retourne 0.\n\nRéussir tous les tests (visibles et cachés) sans indice valide la notion et te permet de passer la leçon.",
    functionName: "somme_au_dessus",
    starterCode: `def somme_au_dessus(montants, seuil):
    # Ton code ici
    pass
`,
    referenceSolution: `def somme_au_dessus(montants, seuil):
    total = 0
    for m in montants:
        if m > seuil:
            total += m
    return total
`,
    tests: [
      { id: "t1", label: "Seuil à 50", args: [[120, -30, 45, 80], 50], expected: 200, compare: "exact", hidden: false },
      { id: "t2", label: "Liste vide", args: [[], 10], expected: 0, compare: "exact", hidden: true, misconception: "liste-vide" },
      {
        id: "t3",
        label: "Valeurs égales au seuil exclues",
        args: [[10, 10, 20], 10],
        expected: 20,
        compare: "exact",
        hidden: true,
        misconception: "condition-inversee",
      },
      { id: "t4", label: "Seuil négatif", args: [[-5, -1], -3], expected: -1, compare: "exact", hidden: true },
      { id: "t5", label: "Nombres à virgule", args: [[1.5, 2.5], 0], expected: 4.0, compare: "approx", tolerance: 1e-9, hidden: true },
    ],
    hints: [
      { level: 1, text: "Quel accumulateur te faut-il, et quelle est sa valeur de départ ?" },
      { level: 2, text: "Ajoute un montant seulement si la condition « strictement supérieur au seuil » est vraie." },
      { level: 3, text: "`total = 0`, une boucle `for m in montants:`, un `if m > seuil:` puis `return total` après la boucle." },
      {
        level: 4,
        text: `def somme_au_dessus(montants, seuil):
    total = 0
    for m in montants:
        if m > seuil:
            total += m
    return total`,
      },
    ],
    explanation: "Même structure que le chiffre d'affaires : un accumulateur initialisé avant la boucle, une condition, un retour après la boucle.",
    conceptIds: [CONCEPT],
    packages: [],
    timeLimitMs: 5000,
  },
];

export const traceCode = `montants = [120, -30, 45, 80]
total = 0
for m in montants:
    if m > 0:
        total = total + m
print(total)`;

const L = "[120, -30, 45, 80]";

export const lessonBoucles: Lesson = {
  id: "py-boucles-accumulateurs",
  version: 1,
  domain: "python",
  moduleId: "python.a",
  title: "Boucles et accumulateurs : calculer un chiffre d'affaires",
  summary: "Parcourir une liste avec for, accumuler un total, gérer les cas limites et déboguer une boucle.",
  estimatedMinutes: 35,
  conceptIds: [CONCEPT],
  prerequisites: ["Variables et types", "Conditions (if / else)"],
  objectives: [
    "Prédire la valeur d'un accumulateur à chaque itération d'une boucle for.",
    "Écrire une fonction qui parcourt une liste et retourne un total filtré.",
    "Traiter les cas limites : liste vide, division par zéro, nombres à virgule.",
    "Diagnostiquer un accumulateur réinitialisé dans la boucle.",
  ],
  glossary: [
    { term: "boucle for", en: "for loop", definition: "Instruction qui répète un bloc de code une fois pour chaque élément d'une séquence (liste, chaîne…)." },
    { term: "itération", en: "iteration", definition: "Un passage dans le corps de la boucle, avec un élément précis." },
    {
      term: "accumulateur",
      en: "accumulator",
      definition: "Variable initialisée avant une boucle et mise à jour à chaque itération pour construire un résultat (somme, compteur…).",
    },
    { term: "valeur de retour", en: "return value", definition: "Résultat renvoyé par une fonction avec return ; différent d'un affichage avec print." },
    { term: "cas limite", en: "edge case", definition: "Entrée inhabituelle mais possible (liste vide, zéro, valeur négative) qui casse souvent un programme naïf." },
  ],
  validationExerciseId: "py-boucles-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : le CA du jour",
      blocks: [
        {
          type: "text",
          md: "Tu fais un stage dans une boutique en ligne genevoise. Chaque soir, le système exporte la liste des montants de la journée, en CHF. Les montants négatifs sont des **remboursements**.\n\nLa responsable te demande : « Quel est le chiffre d'affaires brut, c'est-à-dire la somme des ventes uniquement ? »",
        },
        { type: "code", code: "montants = [120, -30, 45, 80]", caption: "Export d'une journée (exemple réduit)" },
        {
          type: "text",
          md: "Avec 4 montants, tu calcules de tête : 120 + 45 + 80 = 245. Avec 4 000 montants, il faut que le programme fasse ce calcul **élément par élément**. C'est le rôle d'une [[boucle for]].",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : une caisse enregistreuse",
      blocks: [
        {
          type: "text",
          md: "Imagine une caisse enregistreuse. Le matin, l'affichage est à **0**. À chaque vente, la caissière **ajoute** le montant au total affiché. Le soir, elle **lit** le total.\n\nEn Python, cette caisse est un [[accumulateur]] :\n\n- on le crée **avant** la boucle avec une valeur neutre (0 pour une somme) ;\n- on le met à jour **dans** la boucle, à chaque [[itération]] ;\n- on lit le résultat **après** la boucle.",
        },
        {
          type: "callout",
          tone: "info",
          title: "À retenir",
          md: "`for m in montants:` donne à `m` la valeur du premier élément, exécute le bloc indenté, puis passe à l'élément suivant, jusqu'à la fin de la liste.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Visualiser la boucle pas à pas",
      blocks: [
        {
          type: "text",
          md: "Avance ligne par ligne et observe les variables. Repère le moment où `total` **ne change pas**.",
        },
        {
          type: "trace",
          title: "Exécution de la boucle",
          code: traceCode,
          steps: [
            { line: 1, vars: {}, note: "Python va créer la liste montants." },
            { line: 2, vars: { montants: L }, note: "La liste existe. Python va créer l'accumulateur total à 0." },
            { line: 3, vars: { montants: L, total: "0" }, note: "Début de la boucle : m va prendre le premier élément, 120." },
            { line: 4, vars: { montants: L, total: "0", m: "120" }, note: "Test : 120 > 0 est vrai, on entre dans le if." },
            { line: 5, vars: { montants: L, total: "0", m: "120" }, note: "total devient 0 + 120 = 120." },
            { line: 3, vars: { montants: L, total: "120", m: "120" }, note: "Retour en haut de la boucle : m va prendre l'élément suivant, -30." },
            { line: 4, vars: { montants: L, total: "120", m: "-30" }, note: "Test : -30 > 0 est faux. La ligne 5 est sautée, total ne change pas." },
            { line: 3, vars: { montants: L, total: "120", m: "-30" }, note: "Élément suivant : m va prendre 45." },
            { line: 4, vars: { montants: L, total: "120", m: "45" }, note: "Test : 45 > 0 est vrai." },
            { line: 5, vars: { montants: L, total: "120", m: "45" }, note: "total devient 120 + 45 = 165." },
            { line: 3, vars: { montants: L, total: "165", m: "45" }, note: "Élément suivant : m va prendre 80." },
            { line: 4, vars: { montants: L, total: "165", m: "80" }, note: "Test : 80 > 0 est vrai." },
            { line: 5, vars: { montants: L, total: "165", m: "80" }, note: "total devient 165 + 80 = 245." },
            { line: 3, vars: { montants: L, total: "245", m: "80" }, note: "Il n'y a plus d'élément : la boucle se termine. m garde sa dernière valeur." },
            { line: 6, vars: { montants: L, total: "245", m: "80" }, note: "Après la boucle, on affiche le total." },
            { line: 0, vars: { montants: L, total: "245", m: "80" }, note: "Fin du programme. Sortie : 245.", output: "245" },
          ],
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : deux accumulateurs",
      blocks: [
        {
          type: "text",
          md: "On peut tenir plusieurs accumulateurs dans la même boucle. Ici on calcule le CA brut **et** le nombre de remboursements. `total += m` est un raccourci pour `total = total + m`.\n\nExécute le code, puis modifie la liste pour vérifier ton intuition.",
        },
        {
          type: "code",
          runnable: true,
          code: `montants = [120, -30, 45, 80]
total = 0
remboursements = 0
for m in montants:
    if m > 0:
        total += m
    else:
        remboursements += 1
print(f"CA brut : {total} CHF")
print(f"Remboursements : {remboursements}")`,
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire",
      blocks: [
        {
          type: "prediction",
          id: "pred-sans-condition",
          question: "Sans la condition, que vaut total après la boucle ?",
          code: `total = 0
for m in [120, -30, 45, 80]:
    total = total + m`,
          choices: [
            { id: "a", label: "245" },
            { id: "b", label: "215" },
            { id: "c", label: "275" },
            { id: "d", label: "Une erreur" },
          ],
          answer: "b",
          explanation: "Sans if, chaque montant est ajouté, y compris -30 : 120 − 30 + 45 + 80 = 215. C'est le chiffre d'affaires net, pas le brut.",
        },
        {
          type: "prediction",
          id: "pred-init-dans-boucle",
          question: "Et si total = 0 est placé dans la boucle ?",
          code: `for m in [120, -30, 45, 80]:
    total = 0
    total = total + m
print(total)`,
          choices: [
            { id: "a", label: "215" },
            { id: "b", label: "0" },
            { id: "c", label: "80" },
            { id: "d", label: "NameError" },
          ],
          answer: "c",
          explanation: "total est remis à 0 à chaque itération. À la dernière, total = 0 + 80 = 80. C'est un bug très fréquent, tu vas le retrouver dans l'exercice de débogage.",
        },
      ],
    },
    {
      id: "guide",
      stage: "guide",
      title: "Exercice guidé",
      blocks: [{ type: "exercise", exerciseId: "py-boucles-ex1-remboursements" }],
    },
    {
      id: "autonome",
      stage: "autonome",
      title: "Exercice autonome",
      blocks: [
        {
          type: "text",
          md: "Les données réelles sont rarement une simple liste de nombres. Ici, chaque transaction est un dictionnaire. Des [[cas limite|cas limites]] sont testés en caché.",
        },
        { type: "exercise", exerciseId: "py-boucles-ex2-ca-net" },
      ],
    },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "py-boucles-ex3-debug-panier" },
        {
          type: "explain",
          id: "explain-accumulateur",
          prompt: "Explique avec tes propres mots, comme à un collègue, pourquoi un accumulateur doit être initialisé avant la boucle.",
          criteria: [
            "Je dis où l'accumulateur est créé et avec quelle valeur.",
            "J'explique ce qui se passe à chaque itération.",
            "Je décris la conséquence d'une initialisation dans la boucle.",
            "Je donne un exemple concret (montants, résultat attendu).",
          ],
        },
      ],
    },
    {
      id: "projet",
      stage: "projet",
      title: "Dans le projet",
      blocks: [
        {
          type: "project",
          title: "Pipeline de données — rapport journalier",
          md: "Dans le projet du domaine Python, tu importes des exports de ventes (CSV et API de démonstration). La fonction `chiffre_affaires_net` devient un **contrôle qualité** : le total calculé ligne par ligne doit correspondre au total annoncé par l'API. Un écart signale des doublons ou des lignes manquantes.\n\nCe projet sera ouvert dans une prochaine étape ; ton code réussi est conservé et pourra y être réutilisé.",
        },
      ],
    },
    {
      id: "revision",
      stage: "revision",
      title: "Révision",
      blocks: [
        {
          type: "text",
          md: "Une notion se consolide quand on la retrouve **après** un délai. Quand tu réussis l'exercice autonome sans voir la solution, une révision est planifiée (1 jour, puis 3, puis 7). Elle apparaîtra dans ton tableau de bord avec sa raison.",
        },
      ],
    },
  ],
};

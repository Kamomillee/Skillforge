import type { Lesson, Project, PythonExerciseInput } from "../types";
import { generateChurn } from "../datasets/churn";

/**
 * ML — Module D : évaluer un classifieur (matrice de confusion, précision/rappel, seuil, coût métier).
 * Les exercices sont en Python pur (logique d'évaluation explicite) ; scikit-learn est utilisé dans la
 * démonstration et dans le projet. Tout est vérifié par exécution réelle dans Pyodide (tests/content).
 */

const C_MAT = "ml.d.matrice-de-confusion";
const C_PR = "ml.d.precision-rappel-et-f1";
const C_SEUIL = "ml.d.choix-d-un-seuil";
const C_COUT = "ml.d.cout-metier-des-erreurs";

export const churn = generateChurn();

/**
 * Probabilités de départ des 40 clients de test, données par LogisticRegression(max_iter=1000)
 * entraînée sur les 120 clients d'entraînement (arrondies à 3 décimales). Recalculées et comparées
 * par tests/content/ml.test.ts.
 */
export const churnTestProbas = [
  0.04, 0.251, 0.197, 0.489, 0.045, 0.869, 0.032, 0.309, 0.832, 0.321, 0.138, 0.166, 0.105, 0.073, 0.229, 0.221, 0.21, 0.538, 0.299, 0.704, 0.04, 0.038, 0.04,
  0.064, 0.025, 0.25, 0.033, 0.092, 0.087, 0.082, 0.334, 0.134, 0.007, 0.584, 0.17, 0.125, 0.364, 0.011, 0.013, 0.115,
];

const MATRICE_REF = `def matrice_confusion(y_vrai, y_pred):
    m = {"VP": 0, "FP": 0, "FN": 0, "VN": 0}
    for vrai, pred in zip(y_vrai, y_pred):
        if pred == 1 and vrai == 1:
            m["VP"] += 1
        elif pred == 1 and vrai == 0:
            m["FP"] += 1
        elif pred == 0 and vrai == 1:
            m["FN"] += 1
        else:
            m["VN"] += 1
    return m
`;

export const exercisesMlEvaluation: PythonExerciseInput[] = [
  {
    id: "ml-eval-ex1-matrice",
    version: 1,
    kind: "guided",
    title: "Remplir une matrice de confusion",
    prompt:
      "Complète `matrice_confusion(y_vrai, y_pred)` : deux listes de 0 et 1 de même longueur (1 = « le client part »). Retourne un dictionnaire avec le nombre de **VP** (vrais positifs), **FP** (faux positifs), **FN** (faux négatifs) et **VN** (vrais négatifs).\n\nRemplace les deux `___`.",
    functionName: "matrice_confusion",
    starterCode: MATRICE_REF.replace('m["FP"] += 1', "m[___] += 1").replace('m["FN"] += 1', "m[___] += 1"),
    referenceSolution: MATRICE_REF,
    tests: [
      { id: "t1", label: "Six clients", args: [[1, 0, 1, 1, 0, 0], [1, 1, 0, 1, 1, 0]], expected: { VP: 2, FP: 2, FN: 1, VN: 1 }, compare: "exact", hidden: false, misconception: "vp-fp-inverses" },
      { id: "t2", label: "Aucun client", args: [[], []], expected: { VP: 0, FP: 0, FN: 0, VN: 0 }, compare: "exact", hidden: true },
      { id: "t3", label: "Le modèle annonce un départ pour tout le monde", args: [[0, 0, 1], [1, 1, 1]], expected: { VP: 1, FP: 2, FN: 0, VN: 0 }, compare: "exact", hidden: true, misconception: "vp-fp-inverses" },
      { id: "t4", label: "Le modèle n'annonce aucun départ", args: [[1, 1, 0], [0, 0, 0]], expected: { VP: 0, FP: 0, FN: 2, VN: 1 }, compare: "exact", hidden: true, misconception: "vp-fp-inverses" },
    ],
    hints: [
      { level: 1, text: "Un « faux positif » : le modèle a dit quoi, et la réalité était quoi ?" },
      { level: 2, text: "Positif/négatif = ce que le **modèle** a prédit. Vrai/faux = la prédiction était-elle juste ?" },
      { level: 3, text: "pred == 1 et vrai == 0 : le modèle a annoncé un départ à tort. pred == 0 et vrai == 1 : il a raté un départ." },
      { level: 4, text: 'Premier trou : `"FP"`. Second trou : `"FN"`.' },
    ],
    explanation:
      "Le **second mot** (positif/négatif) décrit la prédiction ; le **premier** (vrai/faux) dit si elle était juste. Un FN est un client parti sans qu'on l'ait vu venir ; un FP, un client fidèle à qui on a fait une offre pour rien.",
    conceptIds: [C_MAT],
  },
  {
    id: "ml-eval-ex2-precision-rappel",
    version: 1,
    kind: "autonomous",
    title: "Précision et rappel à un seuil donné",
    prompt:
      "Écris `precision_rappel(y_vrai, scores, seuil)` : `scores` sont des probabilités de départ. Un client est prédit « part » si son score est **supérieur ou égal** au seuil.\n\nRetourne `{\"precision\": …, \"rappel\": …}` arrondis à 3 décimales. Si le modèle ne prédit aucun départ, la précision vaut `0.0` ; s'il n'y a aucun départ réel, le rappel vaut `0.0`.",
    functionName: "precision_rappel",
    starterCode: "def precision_rappel(y_vrai, scores, seuil):\n    # Prédire, compter VP, FP, FN, puis calculer les deux taux\n    pass\n",
    referenceSolution: `def precision_rappel(y_vrai, scores, seuil):
    vp = fp = fn = 0
    for vrai, score in zip(y_vrai, scores):
        pred = 1 if score >= seuil else 0
        if pred == 1 and vrai == 1:
            vp += 1
        elif pred == 1:
            fp += 1
        elif vrai == 1:
            fn += 1
    precision = vp / (vp + fp) if vp + fp > 0 else 0.0
    rappel = vp / (vp + fn) if vp + fn > 0 else 0.0
    return {"precision": round(precision, 3), "rappel": round(rappel, 3)}
`,
    tests: [
      {
        id: "t1",
        label: "Six clients, seuil 0,5",
        args: [[1, 0, 1, 0, 1, 0], [0.9, 0.8, 0.4, 0.3, 0.6, 0.7], 0.5],
        expected: { precision: 0.5, rappel: 0.667 },
        compare: "exact",
        hidden: false,
        misconception: "vp-fp-inverses",
      },
      { id: "t2", label: "Score exactement égal au seuil", args: [[1, 0, 1], [0.5, 0.2, 0.7], 0.5], expected: { precision: 1.0, rappel: 1.0 }, compare: "exact", hidden: true, misconception: "seuil-strict" },
      { id: "t3", label: "Aucun départ prédit", args: [[1, 0], [0.1, 0.2], 0.9], expected: { precision: 0.0, rappel: 0.0 }, compare: "exact", hidden: true, misconception: "division-zero" },
      { id: "t4", label: "Aucun départ réel", args: [[0, 0], [0.9, 0.1], 0.5], expected: { precision: 0.0, rappel: 0.0 }, compare: "exact", hidden: true, misconception: "division-zero" },
      { id: "t5", label: "Les 40 clients de test, seuil 0,3", args: [churn.y_test, churnTestProbas, 0.3], expected: { precision: 0.7, rappel: 0.636 }, compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Parmi les clients que le modèle signale, quelle part part vraiment ? Parmi ceux qui partent vraiment, quelle part le modèle signale-t-il ?" },
      { level: 2, text: "Précision = VP / (VP + FP). Rappel = VP / (VP + FN). Attention aux dénominateurs nuls et au seuil inclus (>=)." },
      { level: 3, text: "Parcours `zip(y_vrai, scores)`, calcule `pred = 1 if score >= seuil else 0`, compte VP, FP, FN, puis protège chaque division avec un `if … > 0 else 0.0`." },
      {
        level: 4,
        text: "def precision_rappel(y_vrai, scores, seuil):\n    vp = fp = fn = 0\n    for vrai, score in zip(y_vrai, scores):\n        pred = 1 if score >= seuil else 0\n        if pred == 1 and vrai == 1:\n            vp += 1\n        elif pred == 1:\n            fp += 1\n        elif vrai == 1:\n            fn += 1\n    precision = vp / (vp + fp) if vp + fp > 0 else 0.0\n    rappel = vp / (vp + fn) if vp + fn > 0 else 0.0\n    return {\"precision\": round(precision, 3), \"rappel\": round(rappel, 3)}",
      },
    ],
    explanation:
      "La **précision** répond à « quand le modèle alerte, a-t-il raison ? » ; le **rappel** à « parmi les départs, combien en voit-il ? ». Baisser le seuil augmente en général le rappel et diminue la précision. Avec scikit-learn : `precision_score(y, pred, zero_division=0)` et `recall_score(...)` donnent les mêmes valeurs.",
    conceptIds: [C_PR, C_SEUIL, C_MAT],
  },
  {
    id: "ml-eval-ex3-debug-f1",
    version: 1,
    kind: "debug",
    title: "Débogage : un F1 trop optimiste",
    prompt:
      "Une collègue a écrit `f1(precision, rappel)`, mais le score obtenu semble trop flatteur pour un modèle qui rate la moitié des départs. Trouve et corrige l'erreur. Le F1 est arrondi à 3 décimales et vaut `0.0` si précision et rappel sont nuls.",
    functionName: "f1",
    starterCode: "def f1(precision, rappel):\n    return round((precision + rappel) / 2, 3)\n",
    referenceSolution: "def f1(precision, rappel):\n    if precision + rappel == 0:\n        return 0.0\n    return round(2 * precision * rappel / (precision + rappel), 3)\n",
    tests: [
      { id: "t1", label: "Précision 1,0 et rappel 0,5", args: [1.0, 0.5], expected: 0.667, compare: "exact", hidden: false, misconception: "moyenne-arithmetique" },
      { id: "t2", label: "Tout à zéro", args: [0.0, 0.0], expected: 0.0, compare: "exact", hidden: true, misconception: "division-zero" },
      { id: "t3", label: "Très déséquilibré", args: [0.9, 0.1], expected: 0.18, compare: "exact", hidden: true, misconception: "moyenne-arithmetique" },
      { id: "t4", label: "Équilibré", args: [0.5, 0.5], expected: 0.5, compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Avec précision 1,0 et rappel 0,5, le modèle rate la moitié des départs. Un score de 0,75 te semble-t-il juste ?" },
      { level: 2, text: "Le F1 est une moyenne **harmonique** : elle est tirée vers la plus petite des deux valeurs." },
      { level: 3, text: "F1 = 2 × p × r / (p + r). Que se passe-t-il si p + r vaut 0 ?" },
      { level: 4, text: "def f1(precision, rappel):\n    if precision + rappel == 0:\n        return 0.0\n    return round(2 * precision * rappel / (precision + rappel), 3)" },
    ],
    explanation:
      "La moyenne arithmétique masque un rappel faible : (1,0 + 0,1)/2 = 0,55 alors que le modèle rate 90 % des départs. La moyenne harmonique donne 0,18, plus honnête. Le cas p + r = 0 doit être traité avant la division.",
    conceptIds: [C_PR],
  },
  {
    id: "ml-eval-validation",
    version: 1,
    kind: "validation",
    title: "Test de validation : le seuil le moins coûteux",
    prompt:
      "Écris `meilleur_seuil(y_vrai, scores, seuils, cout_fn, cout_fp)` : pour chaque seuil candidat (client prédit « part » si score ≥ seuil), le coût vaut `FN × cout_fn + FP × cout_fp`. Retourne le seuil de **coût minimal** ; en cas d'égalité, le **plus grand** seuil (moins d'offres envoyées).",
    functionName: "meilleur_seuil",
    starterCode: "def meilleur_seuil(y_vrai, scores, seuils, cout_fn, cout_fp):\n    pass\n",
    referenceSolution: `def meilleur_seuil(y_vrai, scores, seuils, cout_fn, cout_fp):
    meilleur, cout_min = None, None
    for s in seuils:
        fn = sum(1 for v, sc in zip(y_vrai, scores) if v == 1 and sc < s)
        fp = sum(1 for v, sc in zip(y_vrai, scores) if v == 0 and sc >= s)
        cout = fn * cout_fn + fp * cout_fp
        if cout_min is None or cout < cout_min or (cout == cout_min and s > meilleur):
            meilleur, cout_min = s, cout
    return meilleur
`,
    tests: [
      { id: "t1", label: "Départ coûteux, offre bon marché", args: [[1, 0, 1, 0], [0.9, 0.6, 0.4, 0.2], [0.3, 0.5, 0.7], 100, 10], expected: 0.3, compare: "exact", hidden: false },
      { id: "t2", label: "Offre coûteuse", args: [[1, 0, 1, 0], [0.9, 0.6, 0.4, 0.2], [0.3, 0.5, 0.7], 10, 100], expected: 0.7, compare: "exact", hidden: true, misconception: "vp-fp-inverses" },
      { id: "t3", label: "Égalité de coût", args: [[1, 0], [0.8, 0.4], [0.3, 0.5, 0.6], 50, 50], expected: 0.6, compare: "exact", hidden: true, misconception: "egalite-de-cout" },
      { id: "t4", label: "Score égal au seuil", args: [[1, 0], [0.5, 0.3], [0.5, 0.6], 100, 1], expected: 0.5, compare: "exact", hidden: true, misconception: "seuil-strict" },
      { id: "t5", label: "Les 40 clients de test (coût FN 400, coût FP 30)", args: [churn.y_test, churnTestProbas, [0.2, 0.3, 0.5], 400, 30], expected: 0.2, compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Pour un seuil donné, quelles erreurs coûtent de l'argent, et combien ?" },
      { level: 2, text: "Calcule FN et FP pour chaque seuil, puis le coût. Garde le minimum ; départage les égalités." },
      { level: 3, text: "FN : vrai départ avec score < seuil. FP : client fidèle avec score ≥ seuil. Mets à jour le meilleur si le coût est plus petit, ou égal avec un seuil plus grand." },
      {
        level: 4,
        text: "def meilleur_seuil(y_vrai, scores, seuils, cout_fn, cout_fp):\n    meilleur, cout_min = None, None\n    for s in seuils:\n        fn = sum(1 for v, sc in zip(y_vrai, scores) if v == 1 and sc < s)\n        fp = sum(1 for v, sc in zip(y_vrai, scores) if v == 0 and sc >= s)\n        cout = fn * cout_fn + fp * cout_fp\n        if cout_min is None or cout < cout_min or (cout == cout_min and s > meilleur):\n            meilleur, cout_min = s, cout\n    return meilleur",
      },
    ],
    explanation:
      "Le « bon » seuil n'est pas 0,5 par défaut : il dépend du **coût** de chaque erreur. Ici, perdre un client (400 CHF) coûte bien plus qu'une offre (30 CHF) : on accepte davantage de faux positifs pour rattraper des départs.",
    conceptIds: [C_COUT, C_SEUIL],
  },
];

export const lessonMlEvaluation: Lesson = {
  id: "ml-evaluer-classifieur",
  version: 1,
  domain: "ml",
  moduleId: "ml.d",
  title: "Évaluer un classifieur : erreurs, seuil et coût métier",
  summary: "Lire une matrice de confusion, calculer précision et rappel, choisir un seuil selon le coût des erreurs.",
  estimatedMinutes: 45,
  conceptIds: [C_MAT, C_PR, C_SEUIL, C_COUT],
  prerequisites: ["Boucles et accumulateurs (Python)", "Notion de probabilité"],
  objectives: [
    "Classer chaque prédiction en VP, FP, FN ou VN et expliquer ce que chacun coûte.",
    "Calculer précision, rappel et F1 sans bibliothèque, puis les retrouver avec scikit-learn.",
    "Expliquer pourquoi l'exactitude peut tromper sur des classes déséquilibrées.",
    "Choisir un seuil de décision à partir du coût métier des erreurs.",
  ],
  glossary: [
    { term: "classifieur", en: "classifier", definition: "Modèle qui attribue une classe (ici : part / reste) à chaque exemple, souvent via une probabilité." },
    { term: "matrice de confusion", en: "confusion matrix", definition: "Tableau croisant classes réelles et classes prédites : VP, FP, FN, VN." },
    { term: "précision", en: "precision", definition: "Part des alertes justes : VP / (VP + FP)." },
    { term: "rappel", en: "recall", definition: "Part des cas réels détectés : VP / (VP + FN). Aussi appelé sensibilité." },
    { term: "seuil", en: "threshold", definition: "Probabilité à partir de laquelle on prédit la classe positive." },
    { term: "exactitude", en: "accuracy", definition: "Part des prédictions justes, toutes classes confondues. Trompeuse si une classe est rare." },
  ],
  validationExerciseId: "ml-eval-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : quels abonnés appeler ?",
      blocks: [
        {
          type: "text",
          md: "La Torréfaction du Léman vend des abonnements café. Environ **un abonné sur quatre** résilie dans les trois mois. Un modèle donne pour chaque abonné une probabilité de départ. L'équipe peut appeler les abonnés à risque et leur offrir un mois (coût : **30 CHF**). Un abonné perdu coûte environ **400 CHF** de marge.\n\nQuestion : le modèle est-il bon ? Et à qui faire l'offre ?",
        },
        {
          type: "callout",
          tone: "info",
          title: "Les données",
          md: "160 abonnés **synthétiques** (120 pour l'entraînement, 40 pour le test), générés à partir d'un modèle connu : l'ancienneté et les commandes réduisent le risque, les réclamations l'augmentent. Voir `docs/DONNEES.md`.",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : quatre sortes de réponses",
      blocks: [
        {
          type: "text",
          md: "Pour chaque abonné, le modèle dit « part » (positif) ou « reste » (négatif), et la réalité tranche. Cela donne quatre cases : la [[matrice de confusion]].\n\n| | Réellement parti | Réellement resté |\n|---|---|---|\n| **Prédit « part »** | VP : offre utile | FP : offre pour rien (30 CHF) |\n| **Prédit « reste »** | FN : client perdu (400 CHF) | VN : rien à faire |\n\nLe [[seuil]] décide qui est « prédit part » : en le baissant, on appelle plus de monde.",
        },
        {
          type: "matching",
          id: "ml-cases-confusion",
          prompt: "Associe chaque situation à sa case de la matrice de confusion.",
          pairs: [
            { id: "a", left: "Le modèle alerte, l'abonné résilie quand même le mois suivant", answer: "vp" },
            { id: "b", left: "Le modèle alerte, l'abonné était très fidèle", answer: "fp" },
            { id: "c", left: "Le modèle ne dit rien, l'abonné résilie", answer: "fn" },
            { id: "d", left: "Le modèle ne dit rien, l'abonné reste", answer: "vn" },
          ],
          options: [
            { id: "vp", label: "Vrai positif (VP)" },
            { id: "fp", label: "Faux positif (FP)" },
            { id: "fn", label: "Faux négatif (FN)" },
            { id: "vn", label: "Vrai négatif (VN)" },
          ],
          explanation: "Le second mot reprend la **prédiction** (positif = alerte), le premier dit si elle était **juste**.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Déplacer le seuil",
      blocks: [
        { type: "threshold-viz", title: "40 abonnés de test : probabilités de départ du modèle" },
        { type: "text", md: "Fais varier le seuil et observe : quand le rappel monte, la précision baisse souvent. Le **coût total** additionne les départs ratés (FN × 400 CHF) et **toutes** les offres envoyées (contactés × 30 CHF) : même un abonné bien détecté (VP) coûte une offre." },
        {
          type: "callout",
          tone: "info",
          title: "Lis l'hypothèse cachée",
          md: "Avec 400 CHF par départ et 30 CHF par offre, le minimum tombe sur un seuil **très bas** : on appellerait presque tout le monde. C'est la conséquence d'une hypothèse forte de ce calcul : l'offre **retiendrait chaque abonné détecté**. Monte le coût d'une offre à 300 CHF : la recommandation bascule vers 4 appels seulement. Un seuil se défend toujours avec ses hypothèses écrites.",
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : la même chose avec scikit-learn",
      blocks: [
        {
          type: "text",
          md: "`X_train`, `y_train`, `X_test` et `y_test` sont préchargés. Exécute : le premier lancement télécharge scikit-learn (~30 Mo, une seule fois). Puis change le seuil `0.5` en `0.3`.",
        },
        {
          type: "code",
          language: "python",
          runnable: true,
          packages: ["scikit-learn"],
          prelude: `X_train = ${JSON.stringify(churn.X_train)}; y_train = ${JSON.stringify(churn.y_train)}; X_test = ${JSON.stringify(churn.X_test)}; y_test = ${JSON.stringify(churn.y_test)}`,
          code: `from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, precision_score, recall_score

modele = LogisticRegression(max_iter=1000).fit(X_train, y_train)
probas = modele.predict_proba(X_test)[:, 1]
seuil = 0.5
pred = (probas >= seuil).astype(int)

vn, fp, fn, vp = confusion_matrix(y_test, pred).ravel()
print("VP", vp, "FP", fp, "FN", fn, "VN", vn)
print("précision", round(precision_score(y_test, pred, zero_division=0), 3))
print("rappel", round(recall_score(y_test, pred), 3))`,
          caption: "Attention : scikit-learn range la matrice dans l'ordre [[VN, FP], [FN, VP]].",
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : un modèle paresseux",
      blocks: [
        {
          type: "prediction",
          id: "ml-pred-exactitude",
          question: "Sur les 40 abonnés de test, 11 partent. Un « modèle » qui prédit toujours « reste » a quelle exactitude ?",
          choices: [
            { id: "a", label: "0 %" },
            { id: "b", label: "27,5 %" },
            { id: "c", label: "50 %" },
            { id: "d", label: "72,5 %" },
          ],
          answer: "d",
          explanation: "Il a raison pour les 29 abonnés qui restent : 29/40 = 72,5 %. Pourtant son rappel est de 0 : il ne détecte aucun départ. L'exactitude seule ne dit pas si un modèle est utile.",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "ml-eval-ex1-matrice" }] },
    { id: "autonome", stage: "autonome", title: "Exercice autonome", blocks: [{ type: "exercise", exerciseId: "ml-eval-ex2-precision-rappel" }] },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "ml-eval-ex3-debug-f1" },
        {
          type: "explain",
          id: "explain-seuil",
          prompt: "Explique à la responsable marketing, sans jargon, pourquoi on ne garde pas le seuil de 0,5 proposé par défaut.",
          criteria: ["Je parle du coût des deux erreurs (offre inutile, client perdu)", "Je dis ce qui change quand on baisse le seuil", "Je donne un ordre de grandeur chiffré"],
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
          projectId: "ml-churn",
          title: "Prédiction du départ de clients",
          md: "Le projet ML reprend ces abonnés : mesurer une base de comparaison honnête, entraîner une régression logistique avec scikit-learn, puis recommander un seuil chiffré à la direction.",
        },
      ],
    },
    { id: "revision", stage: "revision", title: "Révision", blocks: [{ type: "text", md: "La révision espacée reprendra le test de validation (seuil le moins coûteux)." }] },
  ],
};

export const exercisesProjetChurn: PythonExerciseInput[] = [
  {
    id: "ml-churn-p1-baseline",
    version: 1,
    kind: "project",
    title: "Une base de comparaison honnête",
    prompt:
      "Avant tout modèle, mesure ce que donne la stratégie la plus naïve. Écris `exactitude_majoritaire(y)` : l'exactitude obtenue en prédisant **toujours la classe la plus fréquente** de `y` (arrondie à 3 décimales ; `0.0` si `y` est vide ; en cas d'égalité, peu importe la classe).",
    functionName: "exactitude_majoritaire",
    starterCode: "def exactitude_majoritaire(y):\n    pass\n",
    referenceSolution: "def exactitude_majoritaire(y):\n    if not y:\n        return 0.0\n    uns = sum(y)\n    return round(max(uns, len(y) - uns) / len(y), 3)\n",
    tests: [
      { id: "t1", label: "Les 40 abonnés de test", args: [churn.y_test], expected: 0.725, compare: "exact", hidden: false },
      { id: "t2", label: "Majorité de départs", args: [[1, 1, 0]], expected: 0.667, compare: "exact", hidden: true },
      { id: "t3", label: "Liste vide", args: [[]], expected: 0.0, compare: "exact", hidden: true, misconception: "liste-vide" },
    ],
    hints: [
      { level: 1, text: "Quelle classe est la plus fréquente ? Combien de prédictions seraient justes si on la prédisait partout ?" },
      { level: 2, text: "Compte les 1 avec sum(y) ; les 0 sont len(y) − sum(y)." },
      { level: 3, text: "Exactitude = max(nombre de 1, nombre de 0) / len(y), avec un cas particulier pour la liste vide." },
      { level: 4, text: "def exactitude_majoritaire(y):\n    if not y:\n        return 0.0\n    uns = sum(y)\n    return round(max(uns, len(y) - uns) / len(y), 3)" },
    ],
    explanation: "72,5 % sans aucun modèle : tout modèle doit être comparé à cette base, et sur des mesures qui comptent pour le métier (rappel des départs), pas seulement l'exactitude.",
    conceptIds: [C_MAT],
  },
  {
    id: "ml-churn-p2-modele",
    version: 1,
    kind: "project",
    title: "Entraîner une régression logistique",
    prompt:
      "Écris `probas_depart(X_train, y_train, X_test)` avec scikit-learn : entraîne `LogisticRegression(max_iter=1000)` (paramètres par défaut sinon) et retourne la **liste** des probabilités de départ (classe 1) des clients de `X_test`, arrondies à 3 décimales.\n\nColonnes de X : ancienneté (mois), commandes sur 6 mois, réclamations.",
    functionName: "probas_depart",
    packages: ["scikit-learn"],
    timeLimitMs: 15000,
    starterCode: "from sklearn.linear_model import LogisticRegression\n\ndef probas_depart(X_train, y_train, X_test):\n    pass\n",
    referenceSolution: `from sklearn.linear_model import LogisticRegression

def probas_depart(X_train, y_train, X_test):
    modele = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    return [round(float(p), 3) for p in modele.predict_proba(X_test)[:, 1]]
`,
    tests: [
      { id: "t1", label: "120 abonnés d'entraînement, 40 de test", args: [churn.X_train, churn.y_train, churn.X_test], expected: churnTestProbas, compare: "approx", tolerance: 0.002, hidden: false },
      {
        id: "t2",
        label: "Entraînement sur 60 abonnés seulement",
        args: [churn.X_train.slice(0, 60), churn.y_train.slice(0, 60), churn.X_test.slice(0, 10)],
        expected: [0.056, 0.384, 0.21, 0.675, 0.064, 0.879, 0.08, 0.36, 0.716, 0.323],
        compare: "approx",
        tolerance: 0.002,
        hidden: true,
      },
    ],
    hints: [
      { level: 1, text: "Deux étapes : apprendre (`fit`), puis estimer des probabilités (`predict_proba`)." },
      { level: 2, text: "`predict_proba` renvoie deux colonnes : P(classe 0) et P(classe 1). Il faut la seconde." },
      { level: 3, text: "`modele.predict_proba(X_test)[:, 1]` donne un tableau NumPy ; convertis chaque valeur avec `round(float(p), 3)`." },
      {
        level: 4,
        text: "from sklearn.linear_model import LogisticRegression\n\ndef probas_depart(X_train, y_train, X_test):\n    modele = LogisticRegression(max_iter=1000).fit(X_train, y_train)\n    return [round(float(p), 3) for p in modele.predict_proba(X_test)[:, 1]]",
      },
    ],
    explanation:
      "On n'évalue **jamais** sur les données d'entraînement : `X_test` n'a pas servi à apprendre. Les coefficients appris retrouvent le sens du modèle qui a généré les données (ancienneté et commandes réduisent le risque, réclamations l'augmentent).",
    conceptIds: [C_PR],
  },
  {
    id: "ml-churn-p3-rapport",
    version: 1,
    kind: "project",
    title: "Recommander un seuil chiffré",
    prompt:
      "Écris `rapport_seuil(y_vrai, probas, seuil, cout_depart, cout_offre)`. Les abonnés prédits « part » (proba ≥ seuil) reçoivent une offre (`cout_offre` chacun) ; chaque départ non détecté coûte `cout_depart`.\n\nComme dans la visualisation de la leçon, **toutes** les offres envoyées coûtent, y compris celles faites aux abonnés qui allaient partir (VP).\n\nRetourne `{\"contactes\": …, \"precision\": …, \"rappel\": …, \"cout_total\": …}` (précision et rappel arrondis à 3 décimales, `0.0` si non définis).",
    functionName: "rapport_seuil",
    starterCode: "def rapport_seuil(y_vrai, probas, seuil, cout_depart, cout_offre):\n    pass\n",
    referenceSolution: `def rapport_seuil(y_vrai, probas, seuil, cout_depart, cout_offre):
    vp = fp = fn = 0
    for v, p in zip(y_vrai, probas):
        if p >= seuil:
            if v == 1:
                vp += 1
            else:
                fp += 1
        elif v == 1:
            fn += 1
    contactes = vp + fp
    return {
        "contactes": contactes,
        "precision": round(vp / contactes, 3) if contactes else 0.0,
        "rappel": round(vp / (vp + fn), 3) if vp + fn else 0.0,
        "cout_total": fn * cout_depart + contactes * cout_offre,
    }
`,
    tests: [
      {
        id: "t1",
        label: "Seuil 0,3 (départ 400 CHF, offre 30 CHF)",
        args: [churn.y_test, churnTestProbas, 0.3, 400, 30],
        expected: { contactes: 10, precision: 0.7, rappel: 0.636, cout_total: 1900 },
        compare: "exact",
        hidden: false,
      },
      {
        id: "t2",
        label: "Seuil 0,5",
        args: [churn.y_test, churnTestProbas, 0.5, 400, 30],
        expected: { contactes: 5, precision: 0.8, rappel: 0.364, cout_total: 2950 },
        compare: "exact",
        hidden: true,
      },
      {
        id: "t3",
        label: "Seuil 0,2",
        args: [churn.y_test, churnTestProbas, 0.2, 400, 30],
        expected: { contactes: 16, precision: 0.5, rappel: 0.727, cout_total: 1680 },
        compare: "exact",
        hidden: true,
        misconception: "vp-fp-inverses",
      },
      { id: "t4", label: "Personne n'est contacté", args: [[1, 0], [0.1, 0.2], 0.9, 400, 30], expected: { contactes: 0, precision: 0.0, rappel: 0.0, cout_total: 400 }, compare: "exact", hidden: true, misconception: "division-zero" },
    ],
    hints: [
      { level: 1, text: "Qui reçoit une offre ? Qu'est-ce qui coûte quand on n'appelle pas un client qui part ?" },
      { level: 2, text: "Toutes les offres coûtent (VP et FP). Seuls les FN coûtent un départ." },
      { level: 3, text: "Compte VP, FP, FN comme avant ; contactes = VP + FP ; cout_total = FN × cout_depart + contactes × cout_offre." },
      {
        level: 4,
        text: 'def rapport_seuil(y_vrai, probas, seuil, cout_depart, cout_offre):\n    vp = fp = fn = 0\n    for v, p in zip(y_vrai, probas):\n        if p >= seuil:\n            if v == 1:\n                vp += 1\n            else:\n                fp += 1\n        elif v == 1:\n            fn += 1\n    contactes = vp + fp\n    return {"contactes": contactes, "precision": round(vp / contactes, 3) if contactes else 0.0, "rappel": round(vp / (vp + fn), 3) if vp + fn else 0.0, "cout_total": fn * cout_depart + contactes * cout_offre}',
      },
    ],
    explanation:
      "À 0,5 : 5 appels, 7 départs ratés, 2 950 CHF. À 0,2 : 16 appels, 3 départs ratés, 1 680 CHF. Le seuil bas est moins cher **sous ces hypothèses de coût** : c'est ce qu'il faut écrire dans la recommandation, avec ses limites (40 abonnés seulement, coûts estimés).",
    conceptIds: [C_COUT, C_SEUIL],
  },
];

export const projetChurn: Project = {
  id: "ml-churn",
  version: 1,
  domain: "ml",
  title: "Prédiction du départ de clients",
  summary: "Mesurer une base honnête, entraîner une régression logistique (scikit-learn) et recommander un seuil chiffré par le coût des erreurs.",
  brief: `La Torréfaction du Léman perd environ un abonné sur quatre. La responsable marketing veut savoir **qui appeler** avec une offre (30 CHF), sachant qu'un abonné perdu coûte environ 400 CHF de marge.

Tu livres un modèle évalué honnêtement et une **recommandation de seuil** chiffrée, avec ses limites. Les calculs sont vérifiés automatiquement ; tes choix et leurs justifications vont dans le journal de décisions.`,
  data: "160 abonnés **synthétiques** (120 entraînement, 40 test), générés par un modèle logistique connu avec bruit (graine 7). Colonnes : ancienneté (mois), commandes sur 6 mois, réclamations sur 12 mois ; étiquette : résiliation dans les 3 mois. 25 % de départs en entraînement, 27,5 % en test. Les données sont fournies en arguments des fonctions ; scikit-learn 1.8 s'exécute dans ton navigateur.",
  deliverables: [
    "Trois fonctions vérifiées : base de comparaison, modèle, rapport chiffré par seuil.",
    "Un journal de décisions : pourquoi pas l'exactitude, quel seuil, quelles limites.",
    "Un export Markdown à joindre à un portfolio.",
  ],
  acceptance: [
    "Chaque fonction passe toutes les vérifications, y compris les cas cachés.",
    "La recommandation cite un seuil, le nombre d'appels et le coût estimé.",
    "Le bilan mentionne au moins deux limites (taille du test, hypothèses de coût, données synthétiques…).",
  ],
  steps: [
    { id: "p1", title: "Base de comparaison", exerciseId: "ml-churn-p1-baseline", decisionPrompt: "Pourquoi une exactitude de 72,5 % ne prouve-t-elle pas qu'un modèle est utile ici ? Quelle mesure vas-tu suivre ?" },
    { id: "p2", title: "Régression logistique", exerciseId: "ml-churn-p2-modele", decisionPrompt: "Pourquoi évaluer sur X_test et pas sur X_train ? Les coefficients ont-ils un sens métier ?" },
    { id: "p3", title: "Seuil et coût", exerciseId: "ml-churn-p3-rapport", decisionPrompt: "Quel seuil recommandes-tu, pour combien d'appels et quel coût ? Qu'est-ce qui changerait ta recommandation ?" },
  ],
};

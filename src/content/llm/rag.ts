import type { Lesson, Project, PythonExerciseInput } from "../types";
import { documentsPme, motsVides, questionsReference } from "../datasets/documents";
import { decouper, docsCites, indexer, pipeline, rechercher, REGLAGES, scoreLexical, tableauEvaluation } from "./rag-core";

/**
 * LLM — Module C : RAG avec citations (découpage, recherche lexicale, contexte, citations, abstention).
 * Aucun appel à un modèle : la génération est remplacée par un MODÈLE SIMULÉ (extraction), annoncé comme tel.
 * Les fonctions Python des exercices sont comparées au pipeline TypeScript (rag-core.ts) par tests/content/llm.test.ts.
 */

const C_DEC = "llm.c.decoupage";
const C_LEX = "llm.c.recherche-lexicale-et-hybride";
const C_CTX = "llm.c.construction-du-contexte";
const C_CIT = "llm.c.citations";
const C_ABS = "llm.c.abstention";

const { taille, chevauchement, k } = REGLAGES;
const docRetours = documentsPme.find((d) => d.id === "retours")!.texte;
const docGarantie = documentsPme.find((d) => d.id === "garantie")!.texte;
const indexPme = indexer(documentsPme, taille, chevauchement);

const TERMES_PY = `import re

def termes(texte, mots_vides):
    resultat = []
    for mot in re.findall(r"\\w+", texte.lower()):
        if mot in mots_vides:
            continue
        if len(mot) > 3 and mot[-1] in "sx":
            mot = mot[:-1]
        resultat.append(mot)
    return resultat
`;

const SCORE_REF = `${TERMES_PY}
def score_lexical(question, passage, mots_vides):
    dans_passage = set(termes(passage, mots_vides))
    return len(set(t for t in termes(question, mots_vides) if t in dans_passage))
`;

const DECOUPER_REF = `def decouper(texte, taille, chevauchement):
    mots = texte.split()
    if not mots:
        return []
    pas = taille - chevauchement
    morceaux = []
    i = 0
    while True:
        morceaux.append(" ".join(mots[i:i + taille]))
        if i + taille >= len(mots):
            break
        i += pas
    return morceaux
`;

/** Résultats du pipeline de référence sur le jeu de questions (pour le projet, étape 3). */
export const casReference = questionsReference.map((q) => ({ attendu: q.attendu, cites: docsCites(pipeline(q.question, documentsPme, motsVides).citations) }));

export const exercisesRag: PythonExerciseInput[] = [
  {
    id: "llm-rag-ex1-decouper",
    version: 1,
    kind: "guided",
    title: "Découper un document en morceaux qui se chevauchent",
    prompt:
      "Complète `decouper(texte, taille, chevauchement)` : elle retourne la liste des morceaux de `taille` mots (séparés par des espaces). Chaque morceau commence `taille - chevauchement` mots après le précédent ; le **dernier** peut être plus court. On s'arrête dès qu'un morceau atteint la fin du texte. Texte vide → `[]`.\n\nRemplace la ligne `___`.",
    functionName: "decouper",
    starterCode: `def decouper(texte, taille, chevauchement):
    mots = texte.split()
    if not mots:
        return []
    pas = taille - chevauchement
    morceaux = []
    i = 0
    while True:
        ___  # ajoute le morceau qui commence au mot i
        if i + taille >= len(mots):
            break
        i += pas
    return morceaux
`,
    referenceSolution: DECOUPER_REF,
    tests: [
      { id: "t1", label: "10 mots, taille 4, chevauchement 1", args: ["a b c d e f g h i j", 4, 1], expected: ["a b c d", "d e f g", "g h i j"], compare: "exact", hidden: false, misconception: "chevauchement" },
      { id: "t2", label: "9 mots : dernier morceau plus court", args: ["a b c d e f g h i", 4, 1], expected: ["a b c d", "d e f g", "g h i"], compare: "exact", hidden: true, misconception: "dernier-morceau" },
      { id: "t3", label: "Sans chevauchement", args: ["un deux trois quatre cinq", 2, 0], expected: ["un deux", "trois quatre", "cinq"], compare: "exact", hidden: true },
      { id: "t4", label: "Texte plus court qu'un morceau", args: ["café du Léman", 25, 5], expected: ["café du Léman"], compare: "exact", hidden: true },
      { id: "t5", label: "Texte vide", args: ["", 4, 1], expected: [], compare: "exact", hidden: true },
      { id: "t6", label: "Politique de retour (25 mots, chevauchement 5)", args: [docRetours, taille, chevauchement], expected: decouper(docRetours, taille, chevauchement), compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Le morceau qui commence au mot i contient les mots i, i+1, …, jusqu'à i+taille (exclu)." },
      { level: 2, text: "Une tranche de liste fait exactement cela : mots[i:i + taille], même si la fin dépasse." },
      { level: 3, text: "Recolle les mots de la tranche avec \" \".join(...) puis ajoute le résultat à morceaux." },
      { level: 4, text: "morceaux.append(\" \".join(mots[i:i + taille]))" },
    ],
    explanation:
      "Le chevauchement évite de couper une information en deux : la fin d'un morceau est répétée au début du suivant. Le prix : des mots dupliqués, donc un index plus gros et des passages qui se ressemblent.",
    conceptIds: [C_DEC],
  },
  {
    id: "llm-rag-ex2-score",
    version: 1,
    kind: "autonomous",
    title: "Un score de recherche lexicale",
    prompt: `Écris \`score_lexical(question, passage, mots_vides)\` : le nombre de **termes distincts** de la question présents dans le passage.

Pour obtenir les termes d'un texte :
1. mettre en minuscules, puis extraire les mots avec \`re.findall(r"\\w+", texte)\` (la ponctuation disparaît) ;
2. retirer les mots de \`mots_vides\` ;
3. retirer un \`s\` ou un \`x\` final aux mots de **plus de 3 lettres** (pluriel simplifié : « cafés » → « café »).`,
    functionName: "score_lexical",
    starterCode: "import re\n\ndef score_lexical(question, passage, mots_vides):\n    pass\n",
    referenceSolution: SCORE_REF,
    tests: [
      { id: "t1", label: "Majuscules et ponctuation", args: ["Livraison gratuite ?", "La livraison est offerte.", ["la", "est"]], expected: 1, compare: "exact", hidden: false, misconception: "casse-ponctuation" },
      { id: "t2", label: "Pluriel simplifié", args: ["Les cafés moulus", "Un café moulu", ["les", "un"]], expected: 2, compare: "exact", hidden: true },
      { id: "t3", label: "Un terme répété compte une fois", args: ["machine machine garantie", "La machine est garantie", ["la", "est"]], expected: 2, compare: "exact", hidden: true },
      { id: "t4", label: "Les mots vides ne comptent pas", args: ["Quel est le prix ?", "Le prix est de 7 CHF", ["quel", "est", "le", "de"]], expected: 1, compare: "exact", hidden: true },
      { id: "t5", label: "Aucun terme commun", args: ["horaires", "Livraison en Suisse", []], expected: 0, compare: "exact", hidden: true },
      { id: "t6", label: "Question réelle sur la garantie", args: ["Combien de temps dure la garantie de ma machine à espresso ?", docGarantie, motsVides], expected: scoreLexical("Combien de temps dure la garantie de ma machine à espresso ?", docGarantie, motsVides), compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Écris d'abord une fonction auxiliaire termes(texte, mots_vides) qui applique les trois règles, puis compare deux ensembles." },
      { level: 2, text: "re.findall(r\"\\w+\", texte.lower()) donne les mots sans ponctuation. Un set élimine les doublons." },
      { level: 3, text: "Pluriel : if len(mot) > 3 and mot[-1] in \"sx\": mot = mot[:-1]. Le score est len(termes_question & termes_passage) avec deux sets." },
      { level: 4, text: SCORE_REF },
    ],
    explanation:
      "La recherche lexicale ne voit que des mots identiques : « gratuite » ne trouve pas « offerte », « résilier » ne trouve pas « résilié ». Les embeddings (recherche sémantique) comblent une partie de ce manque ; une recherche hybride combine les deux.",
    conceptIds: [C_LEX],
  },
  {
    id: "llm-rag-ex3-debug-contexte",
    version: 1,
    kind: "debug",
    title: "Débogage : un contexte trop long et mal ordonné",
    prompt:
      "`construire_contexte(passages, budget_mots)` doit retourner les `id` des passages à envoyer au modèle : seulement ceux de score > 0, du **plus pertinent au moins pertinent** (égalité : `id` croissant), en s'arrêtant au **premier passage qui ferait dépasser** le budget de mots. Le code actuel a deux défauts. Corrige-les.",
    functionName: "construire_contexte",
    starterCode: `def construire_contexte(passages, budget_mots):
    ids = []
    total = 0
    for p in passages:
        if p["score"] > 0:
            ids.append(p["id"])
            total += len(p["texte"].split())
            if total > budget_mots:
                break
    return ids
`,
    referenceSolution: `def construire_contexte(passages, budget_mots):
    tries = sorted((p for p in passages if p["score"] > 0), key=lambda p: (-p["score"], p["id"]))
    ids = []
    total = 0
    for p in tries:
        n = len(p["texte"].split())
        if total + n > budget_mots:
            break
        ids.append(p["id"])
        total += n
    return ids
`,
    tests: [
      {
        id: "t1",
        label: "Le plus pertinent d'abord",
        args: [[{ id: "a", texte: "un deux", score: 1 }, { id: "b", texte: "trois quatre", score: 3 }], 10],
        expected: ["b", "a"],
        compare: "exact",
        hidden: false,
        misconception: "ordre-pertinence",
      },
      {
        id: "t2",
        label: "Budget respecté",
        args: [[{ id: "a", texte: "un deux trois", score: 2 }, { id: "b", texte: "quatre cinq six", score: 1 }], 4],
        expected: ["a"],
        compare: "exact",
        hidden: true,
        misconception: "budget-depasse",
      },
      {
        id: "t3",
        label: "Scores nuls exclus, égalités par id",
        args: [[{ id: "c", texte: "x", score: 2 }, { id: "a", texte: "y", score: 2 }, { id: "b", texte: "z", score: 0 }], 10],
        expected: ["a", "c"],
        compare: "exact",
        hidden: true,
        misconception: "ordre-pertinence",
      },
      { id: "t4", label: "Budget exactement atteint", args: [[{ id: "a", texte: "un deux", score: 1 }, { id: "b", texte: "trois quatre", score: 1 }], 4], expected: ["a", "b"], compare: "exact", hidden: true },
      { id: "t5", label: "Premier passage trop long", args: [[{ id: "a", texte: "un deux trois", score: 1 }], 2], expected: [], compare: "exact", hidden: true, misconception: "budget-depasse" },
    ],
    hints: [
      { level: 1, text: "Teste mentalement : deux passages de scores 1 puis 3. Lequel le code met-il en premier ? Et avec un budget de 4 mots pour deux passages de 3 mots ?" },
      { level: 2, text: "Défaut 1 : l'ordre d'entrée est conservé. Défaut 2 : on ajoute le passage avant de vérifier le budget." },
      { level: 3, text: "Trie avec sorted(..., key=lambda p: (-p[\"score\"], p[\"id\"])) ; calcule n = nombre de mots et teste total + n > budget_mots avant d'ajouter." },
      {
        level: 4,
        text: "def construire_contexte(passages, budget_mots):\n    tries = sorted((p for p in passages if p[\"score\"] > 0), key=lambda p: (-p[\"score\"], p[\"id\"]))\n    ids = []\n    total = 0\n    for p in tries:\n        n = len(p[\"texte\"].split())\n        if total + n > budget_mots:\n            break\n        ids.append(p[\"id\"])\n        total += n\n    return ids",
      },
    ],
    explanation:
      "Le contexte d'un modèle est limité et payé au token. Mettre d'abord les passages les plus pertinents garantit que, si on coupe, on coupe le moins utile. Vérifier le budget **avant** d'ajouter évite de dépasser la limite d'un passage entier.",
    conceptIds: [C_CTX],
  },
  {
    id: "llm-rag-validation",
    version: 1,
    kind: "validation",
    title: "Test de validation : citer ou s'abstenir",
    prompt:
      "Écris `repondre_ou_abstenir(resultats, seuil)`. `resultats` est une liste de `{\"id\": …, \"score\": …}`. Les **citations** sont les ids de score ≥ `seuil`, du plus pertinent au moins pertinent (égalité : id croissant), **2 au maximum**. Retourne `{\"abstention\": …, \"citations\": […]}` : abstention vaut `True` exactement quand il n'y a aucune citation.",
    functionName: "repondre_ou_abstenir",
    starterCode: "def repondre_ou_abstenir(resultats, seuil):\n    pass\n",
    referenceSolution: `def repondre_ou_abstenir(resultats, seuil):
    retenus = sorted((r for r in resultats if r["score"] >= seuil), key=lambda r: (-r["score"], r["id"]))
    citations = [r["id"] for r in retenus[:2]]
    return {"abstention": len(citations) == 0, "citations": citations}
`,
    tests: [
      { id: "t1", label: "Deux passages solides", args: [[{ id: "livraison#0", score: 3 }, { id: "retours#0", score: 2 }], 2], expected: { abstention: false, citations: ["livraison#0", "retours#0"] }, compare: "exact", hidden: false },
      { id: "t2", label: "Rien d'assez pertinent", args: [[{ id: "garantie#1", score: 1 }], 2], expected: { abstention: true, citations: [] }, compare: "exact", hidden: true, misconception: "abstention-absente" },
      { id: "t3", label: "Aucun résultat", args: [[], 2], expected: { abstention: true, citations: [] }, compare: "exact", hidden: true, misconception: "abstention-absente" },
      { id: "t4", label: "Score égal au seuil", args: [[{ id: "a#0", score: 2 }], 2], expected: { abstention: false, citations: ["a#0"] }, compare: "exact", hidden: true, misconception: "seuil-strict" },
      {
        id: "t5",
        label: "Trois candidats : les deux meilleurs, triés",
        args: [[{ id: "b#0", score: 2 }, { id: "c#0", score: 4 }, { id: "a#0", score: 2 }], 2],
        expected: { abstention: false, citations: ["c#0", "a#0"] },
        compare: "exact",
        hidden: true,
        misconception: "ordre-pertinence",
      },
    ],
    hints: [
      { level: 1, text: "Trois étapes : filtrer (score ≥ seuil), trier, garder deux ids au plus." },
      { level: 2, text: "Tri par score décroissant puis id croissant : key=lambda r: (-r[\"score\"], r[\"id\"])." },
      { level: 3, text: "Une tranche [:2] garde au plus deux éléments ; abstention = (len(citations) == 0)." },
      {
        level: 4,
        text: "def repondre_ou_abstenir(resultats, seuil):\n    retenus = sorted((r for r in resultats if r[\"score\"] >= seuil), key=lambda r: (-r[\"score\"], r[\"id\"]))\n    citations = [r[\"id\"] for r in retenus[:2]]\n    return {\"abstention\": len(citations) == 0, \"citations\": citations}",
      },
    ],
    explanation:
      "Un assistant qui s'abstient quand ses sources sont faibles est plus fiable qu'un assistant qui répond toujours : une réponse sans source vérifiable peut être inventée. Le seuil règle l'arbitrage, comme en classification : plus bas, moins de silences mais plus de réponses mal fondées.",
    conceptIds: [C_CIT, C_ABS],
  },
];

export const lessonRag: Lesson = {
  id: "llm-rag-citations",
  version: 1,
  domain: "llm",
  moduleId: "llm.c",
  title: "RAG : répondre avec des sources, ou s'abstenir",
  summary: "Découper des documents, rechercher les passages utiles, construire un contexte limité, citer ses sources et refuser de répondre sans elles.",
  estimatedMinutes: 50,
  conceptIds: [C_DEC, C_LEX, C_CTX, C_CIT, C_ABS],
  prerequisites: ["Boucles et accumulateurs (Python)", "Listes et dictionnaires (Python)"],
  objectives: [
    "Expliquer les étapes d'un pipeline RAG et ce que chacune peut rater.",
    "Découper un texte en morceaux avec chevauchement.",
    "Calculer un score de recherche lexicale et en reconnaître les limites (synonymes, conjugaison).",
    "Construire un contexte qui respecte un budget et l'ordre de pertinence.",
    "Décider de citer ou de s'abstenir, et évaluer ce choix sur un jeu de questions connu.",
  ],
  glossary: [
    { term: "RAG", en: "retrieval-augmented generation", definition: "Génération augmentée par récupération : on cherche des passages dans ses documents, puis on les donne au modèle pour qu'il réponde à partir d'eux." },
    { term: "morceau", en: "chunk", definition: "Portion de document indexée séparément (ici : 25 mots)." },
    { term: "chevauchement", en: "overlap", definition: "Mots répétés entre deux morceaux consécutifs pour ne pas couper une information." },
    { term: "recherche lexicale", en: "lexical search", definition: "Recherche par mots identiques (après normalisation). Rapide et explicable, aveugle aux synonymes." },
    { term: "embedding", en: "embedding", definition: "Vecteur de nombres qui représente le sens d'un texte ; permet une recherche par similarité de sens. Non utilisé dans ce laboratoire." },
    { term: "contexte", en: "context window", definition: "Texte envoyé au modèle avec la question. Sa taille est limitée et coûte à chaque appel." },
    { term: "abstention", en: "abstention", definition: "Refus explicite de répondre quand les sources ne suffisent pas." },
    { term: "hallucination", en: "hallucination", definition: "Affirmation produite par un modèle sans appui dans ses sources, souvent formulée avec assurance." },
  ],
  validationExerciseId: "llm-rag-validation",
  sections: [
    {
      id: "probleme",
      stage: "probleme",
      title: "Le problème : un assistant qui ne doit pas inventer",
      blocks: [
        {
          type: "text",
          md: "La Torréfaction du Léman veut un assistant pour répondre aux clients : retours, livraison, abonnement, garantie… Un modèle de langage seul répond avec assurance, **même quand il ne sait pas** : il pourrait annoncer une garantie de trois ans ou une livraison en France.\n\nL'idée du RAG : chercher d'abord les passages utiles dans les **documents de l'entreprise**, répondre à partir d'eux, **citer** la source, et **refuser** quand rien ne justifie une réponse.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Modèle simulé, annoncé comme tel",
          md: "Ce laboratoire n'appelle **aucun** modèle de langage et n'utilise aucune clé d'API. L'étape « réponse » est remplacée par un **modèle simulé** qui recopie la phrase la plus pertinente du meilleur passage. Tout le reste (découpage, recherche, contexte, citations, abstention, évaluation) est réel et identique à ce qu'on code autour d'un vrai modèle. Dans une vraie application, l'appel au modèle se fait **côté serveur**, jamais depuis le navigateur avec une clé exposée.",
        },
      ],
    },
    {
      id: "intuition",
      stage: "intuition",
      title: "L'idée : cinq étapes dans l'ordre",
      blocks: [
        {
          type: "ordering",
          id: "llm-ordre-pipeline",
          prompt: "Remets les étapes d'un assistant RAG dans l'ordre où elles s'exécutent.",
          items: [
            { id: "contexte", label: "Assembler les meilleurs passages dans un contexte limité" },
            { id: "decouper", label: "Découper les documents en morceaux" },
            { id: "repondre", label: "Répondre en citant les passages, ou s'abstenir" },
            { id: "rechercher", label: "Chercher les morceaux proches de la question" },
            { id: "indexer", label: "Indexer les morceaux (ici : leurs termes)" },
          ],
          answer: ["decouper", "indexer", "rechercher", "contexte", "repondre"],
          explanation: "Découpage et indexation se font une fois, à l'avance. Recherche, contexte et réponse se font à chaque question.",
        },
      ],
    },
    {
      id: "schema",
      stage: "schema",
      title: "Suivre une question dans le pipeline",
      blocks: [
        { type: "rag-viz", title: "Pipeline RAG sur 8 documents synthétiques" },
        {
          type: "text",
          md: "Essaie « La livraison est-elle gratuite ? » : le document dit « offerte », pas « gratuite ». La recherche lexicale ne trouve qu'un mot commun, sous le seuil : l'assistant s'abstient alors que la réponse existe. C'est un **silence à tort**. Baisse le seuil à 1 et observe ce qui change, en bien et en mal.",
        },
      ],
    },
    {
      id: "demonstration",
      stage: "demonstration",
      title: "Démonstration : la recherche en Python",
      blocks: [
        {
          type: "text",
          md: "`documents` (liste de `{\"id\", \"titre\", \"texte\"}`) et `mots_vides` sont préchargés. Exécute, puis change la question.",
        },
        {
          type: "code",
          language: "python",
          runnable: true,
          prelude: `documents = ${JSON.stringify(documentsPme)}; mots_vides = ${JSON.stringify(motsVides)}`,
          code: `import re

def termes(texte):
    mots = re.findall(r"\\w+", texte.lower())
    return {m[:-1] if len(m) > 3 and m[-1] in "sx" else m for m in mots if m not in mots_vides}

question = "Combien de jours pour retourner un produit ?"
q = termes(question)
print("Termes de la question :", sorted(q))
for d in documents:
    communs = q & termes(d["texte"])
    if communs:
        print(len(communs), d["id"], sorted(communs))`,
          caption: "Recherche par document entier. Le pipeline de la leçon cherche dans des morceaux de 25 mots, plus précis.",
        },
      ],
    },
    {
      id: "prediction",
      stage: "prediction",
      title: "À toi de prédire : une question piège",
      blocks: [
        {
          type: "prediction",
          id: "llm-pred-prix-machine",
          question:
            "Un client demande « Quel est le prix d'une machine à espresso ? ». Aucun document ne donne de prix. Que fait le pipeline (seuil 2) ?",
          choices: [
            { id: "a", label: "Il s'abstient : aucun passage ne parle de prix." },
            { id: "b", label: "Il cite le document « Garantie des machines », qui contient « machine » et « espresso »." },
            { id: "c", label: "Il invente un prix." },
            { id: "d", label: "Il cite le document « Moyens de paiement »." },
          ],
          answer: "b",
          explanation:
            "Deux termes communs (« machine », « espresso ») suffisent à passer le seuil : le passage est **proche** de la question mais ne contient **pas** la réponse. Un vrai modèle pourrait alors inventer un prix en s'appuyant sur ce contexte. Le jeu d'évaluation compte ce cas comme une « réponse inventée » : la recherche ne garantit pas la réponse, d'où l'intérêt de vérifier les citations.",
        },
      ],
    },
    { id: "guide", stage: "guide", title: "Exercice guidé", blocks: [{ type: "exercise", exerciseId: "llm-rag-ex1-decouper" }] },
    { id: "autonome", stage: "autonome", title: "Exercice autonome", blocks: [{ type: "exercise", exerciseId: "llm-rag-ex2-score" }] },
    {
      id: "correction",
      stage: "correction",
      title: "Débogage",
      blocks: [
        { type: "exercise", exerciseId: "llm-rag-ex3-debug-contexte" },
        {
          type: "explain",
          id: "explain-abstention",
          prompt: "Explique au responsable du service client pourquoi un assistant qui dit parfois « je ne sais pas » est préférable à un assistant qui répond toujours.",
          criteria: ["Je parle du risque d'une réponse inventée (hallucination)", "Je cite le rôle des sources vérifiables", "Je reconnais le coût des silences à tort"],
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
          projectId: "llm-assistant",
          title: "Assistant documentaire avec citations",
          md: "Le projet LLM assemble l'index, la recherche et un **tableau d'évaluation** sur 13 questions de référence, dont 4 sans réponse dans les documents.",
        },
      ],
    },
    { id: "revision", stage: "revision", title: "Révision", blocks: [{ type: "text", md: "La révision espacée reprendra le test de validation (citer ou s'abstenir)." }] },
  ],
};

const RECHERCHER_REF = `${TERMES_PY}
def rechercher(question, index, mots_vides, k):
    q = set(termes(question, mots_vides))
    resultats = []
    for m in index:
        score = len(q & set(termes(m["texte"], mots_vides)))
        if score > 0:
            resultats.append({"id": m["id"], "score": score})
    resultats.sort(key=lambda r: (-r["score"], r["id"]))
    return resultats[:k]
`;

const TABLEAU_REF = `def tableau_evaluation(cas):
    t = {"questions": len(cas), "citation_correcte": 0, "mauvaise_source": 0,
         "silence_a_tort": 0, "abstention_correcte": 0, "reponse_inventee": 0}
    for c in cas:
        if c["attendu"] is None:
            if c["cites"]:
                t["reponse_inventee"] += 1
            else:
                t["abstention_correcte"] += 1
        elif not c["cites"]:
            t["silence_a_tort"] += 1
        elif c["attendu"] in c["cites"]:
            t["citation_correcte"] += 1
        else:
            t["mauvaise_source"] += 1
    return t
`;

const miniDocs = [
  { id: "a", titre: "A", texte: "un deux trois quatre cinq six" },
  { id: "b", titre: "B", texte: "sept huit" },
];
const miniIndex = [
  { id: "x#0", doc: "x", texte: "La livraison est offerte dès 60 CHF." },
  { id: "x#1", doc: "x", texte: "Livraison en Suisse en deux jours." },
  { id: "y#0", doc: "y", texte: "La boutique est ouverte le samedi." },
];

export const exercisesProjetRag: PythonExerciseInput[] = [
  {
    id: "llm-assist-p1-index",
    version: 1,
    kind: "project",
    title: "Indexer la base documentaire",
    prompt: `Écris \`indexer(documents, taille, chevauchement)\`. \`documents\` est une liste de \`{"id", "titre", "texte"}\`. Retourne la liste des morceaux de **tous** les documents, dans l'ordre, chacun sous la forme \`{"id": "<id du document>#<numéro>", "doc": "<id du document>", "texte": "<morceau>"}\` (numéros à partir de 0 dans chaque document).

Le découpage est celui de la leçon (morceaux de \`taille\` mots, chevauchement, dernier morceau éventuellement plus court) : recopie ta fonction \`decouper\`.`,
    functionName: "indexer",
    starterCode: `def decouper(texte, taille, chevauchement):
    pass  # recopie ta version de la leçon


def indexer(documents, taille, chevauchement):
    pass
`,
    referenceSolution: `${DECOUPER_REF}

def indexer(documents, taille, chevauchement):
    index = []
    for d in documents:
        for numero, texte in enumerate(decouper(d["texte"], taille, chevauchement)):
            index.append({"id": f"{d['id']}#{numero}", "doc": d["id"], "texte": texte})
    return index
`,
    tests: [
      {
        id: "t1",
        label: "Deux petits documents (taille 4, chevauchement 1)",
        args: [miniDocs, 4, 1],
        expected: indexer(miniDocs, 4, 1),
        compare: "exact",
        hidden: false,
      },
      { id: "t2", label: "Les 8 documents de la Torréfaction (25 mots, chevauchement 5)", args: [documentsPme, taille, chevauchement], expected: indexPme, compare: "exact", hidden: true, misconception: "chevauchement" },
      { id: "t3", label: "Aucun document", args: [[], 25, 5], expected: [], compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Deux boucles imbriquées : sur les documents, puis sur les morceaux de chaque document." },
      { level: 2, text: "enumerate(liste) donne le numéro et l'élément : for numero, texte in enumerate(...)." },
      { level: 3, text: "L'id d'un morceau se construit avec f\"{d['id']}#{numero}\"." },
      {
        level: 4,
        text: "def indexer(documents, taille, chevauchement):\n    index = []\n    for d in documents:\n        for numero, texte in enumerate(decouper(d[\"texte\"], taille, chevauchement)):\n            index.append({\"id\": f\"{d['id']}#{numero}\", \"doc\": d[\"id\"], \"texte\": texte})\n    return index",
      },
    ],
    explanation: `Les 8 documents donnent ${indexPme.length} morceaux. Garder l'id du document dans chaque morceau permet de citer la source exacte, et de retrouver le document complet si un lecteur veut vérifier.`,
    conceptIds: [C_DEC, C_CIT],
  },
  {
    id: "llm-assist-p2-recherche",
    version: 1,
    kind: "project",
    title: "Rechercher les k meilleurs morceaux",
    prompt:
      "Écris `rechercher(question, index, mots_vides, k)` : pour chaque morceau de l'index, le score est le nombre de termes distincts communs avec la question (mêmes règles que `score_lexical`). Retourne au plus `k` résultats `{\"id\": …, \"score\": …}`, **score > 0 uniquement**, du plus haut score au plus bas (égalité : id croissant).",
    functionName: "rechercher",
    starterCode: "import re\n\n\ndef rechercher(question, index, mots_vides, k):\n    pass\n",
    referenceSolution: RECHERCHER_REF,
    tests: [
      {
        id: "t1",
        label: "Petit index",
        args: ["Livraison offerte ?", miniIndex, ["la", "est"], 2],
        expected: rechercher("Livraison offerte ?", miniIndex, ["la", "est"], 2),
        compare: "exact",
        hidden: false,
      },
      {
        id: "t2",
        label: "Question sur la garantie, base complète",
        args: ["Combien de temps dure la garantie de ma machine à espresso ?", indexPme, motsVides, k],
        expected: rechercher("Combien de temps dure la garantie de ma machine à espresso ?", indexPme, motsVides, k),
        compare: "exact",
        hidden: true,
        misconception: "ordre-pertinence",
      },
      { id: "t3", label: "Question hors sujet : aucun résultat", args: ["Acceptez-vous les bitcoins ?", indexPme, motsVides, k], expected: [], compare: "exact", hidden: true },
      {
        id: "t4",
        label: "Majuscules et pluriels",
        args: ["HORAIRES de la BOUTIQUE", indexPme, motsVides, 1],
        expected: rechercher("HORAIRES de la BOUTIQUE", indexPme, motsVides, 1),
        compare: "exact",
        hidden: true,
        misconception: "casse-ponctuation",
      },
    ],
    hints: [
      { level: 1, text: "Réutilise ta fonction termes de la leçon : calcule une fois les termes de la question, puis ceux de chaque morceau." },
      { level: 2, text: "Garde seulement les scores > 0, trie, puis coupe à k." },
      { level: 3, text: "resultats.sort(key=lambda r: (-r[\"score\"], r[\"id\"])) puis return resultats[:k]." },
      { level: 4, text: RECHERCHER_REF },
    ],
    explanation:
      "Le tri par id en cas d'égalité rend la recherche **déterministe** : les mêmes questions donnent toujours les mêmes résultats, ce qui est indispensable pour comparer deux versions du système.",
    conceptIds: [C_LEX],
  },
  {
    id: "llm-assist-p3-evaluation",
    version: 1,
    kind: "project",
    title: "Tableau d'évaluation sur les questions de référence",
    prompt: `Écris \`tableau_evaluation(cas)\`. Chaque cas est \`{"attendu": <id du document ou None>, "cites": [<ids de documents cités>]}\`. Classe chaque cas dans **une seule** case et retourne les compteurs :

- \`attendu\` vaut \`None\` (la base ne contient pas la réponse) : \`abstention_correcte\` si rien n'est cité, sinon \`reponse_inventee\` ;
- sinon : \`silence_a_tort\` si rien n'est cité, \`citation_correcte\` si \`attendu\` est parmi les cités, sinon \`mauvaise_source\`.

Le dictionnaire contient aussi \`"questions"\` (nombre de cas). Le test final utilise les vraies sorties du pipeline sur les 13 questions de référence.`,
    functionName: "tableau_evaluation",
    starterCode: "def tableau_evaluation(cas):\n    pass\n",
    referenceSolution: TABLEAU_REF,
    tests: [
      {
        id: "t1",
        label: "Un cas de chaque sorte",
        args: [
          [
            { attendu: "a", cites: ["a"] },
            { attendu: "a", cites: ["b"] },
            { attendu: "a", cites: [] },
            { attendu: null, cites: [] },
            { attendu: null, cites: ["c"] },
          ],
        ],
        expected: { questions: 5, citation_correcte: 1, mauvaise_source: 1, silence_a_tort: 1, abstention_correcte: 1, reponse_inventee: 1 },
        compare: "exact",
        hidden: false,
      },
      {
        id: "t2",
        label: "La bonne source parmi plusieurs citées",
        args: [[{ attendu: "a", cites: ["b", "a"] }]],
        expected: { questions: 1, citation_correcte: 1, mauvaise_source: 0, silence_a_tort: 0, abstention_correcte: 0, reponse_inventee: 0 },
        compare: "exact",
        hidden: true,
      },
      {
        id: "t3",
        label: "Les 13 questions de référence (pipeline de la leçon)",
        args: [casReference],
        expected: tableauEvaluation(casReference),
        compare: "exact",
        hidden: true,
        misconception: "abstention-absente",
      },
      { id: "t4", label: "Aucun cas", args: [[]], expected: { questions: 0, citation_correcte: 0, mauvaise_source: 0, silence_a_tort: 0, abstention_correcte: 0, reponse_inventee: 0 }, compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Commence par séparer deux familles : la base contient-elle la réponse (attendu non None) ou pas ?" },
      { level: 2, text: "Une liste vide est fausse en Python : if c[\"cites\"]: teste s'il y a au moins une citation." },
      { level: 3, text: "Initialise un dictionnaire avec les six clés, puis une chaîne if / elif / else par cas." },
      { level: 4, text: TABLEAU_REF },
    ],
    explanation:
      "Sur les 13 questions, le pipeline lexical cite 5 fois la bonne source, s'abstient à raison 3 fois… mais se tait 4 fois alors que la réponse existe (« gratuite » ≠ « offerte ») et cite une source sans la réponse pour le prix des machines. Ce tableau est la base de toute amélioration : on change une chose (seuil, découpage, recherche hybride) et on compare.",
    conceptIds: [C_ABS, C_CIT],
  },
];

export const projetAssistant: Project = {
  id: "llm-assistant",
  version: 1,
  domain: "llm",
  title: "Assistant documentaire avec citations",
  summary: "Indexer une base documentaire, rechercher les passages utiles et évaluer citations et abstentions sur un jeu de questions connu.",
  brief: `Le service client de la Torréfaction du Léman veut un assistant qui réponde à partir de **ses** documents (retours, livraison, abonnement, garantie…), cite toujours sa source et refuse quand l'information n'y est pas.

Avant de brancher un vrai modèle de langage, tu construis la partie qui ne dépend pas de lui : l'index, la recherche et surtout **l'évaluation**. Les calculs sont vérifiés automatiquement ; tes choix (seuil, taille des morceaux, limites) vont dans le journal de décisions.`,
  data: `8 documents **synthétiques** rédigés pour l'exercice (aucune politique réelle), ${indexPme.length} morceaux de 25 mots avec 5 mots de chevauchement, et 13 questions de référence dont 4 sans réponse dans la base. Aucun modèle de langage n'est appelé : la réponse finale est simulée (extraction), ce qui est indiqué partout où elle apparaît.`,
  deliverables: [
    "Trois fonctions vérifiées : index, recherche, tableau d'évaluation.",
    "Un journal de décisions : réglages choisis, erreurs observées, piste d'amélioration.",
    "Un export Markdown à joindre à un portfolio.",
  ],
  acceptance: [
    "Chaque fonction passe toutes les vérifications, y compris les cas cachés.",
    "Le journal explique au moins un silence à tort et une réponse inventée du tableau.",
    "Le bilan propose une amélioration et dit comment la mesurer avec le même jeu de questions.",
  ],
  steps: [
    { id: "p1", title: "Index", exerciseId: "llm-assist-p1-index", decisionPrompt: "Pourquoi 25 mots avec 5 de chevauchement ? Que se passerait-il avec des morceaux de 200 mots ?" },
    { id: "p2", title: "Recherche", exerciseId: "llm-assist-p2-recherche", decisionPrompt: "Donne une question réaliste que cette recherche ratera, et pourquoi." },
    { id: "p3", title: "Évaluation", exerciseId: "llm-assist-p3-evaluation", decisionPrompt: "Quelle erreur est la plus grave pour le service client : un silence à tort ou une réponse inventée ? Quel seuil recommandes-tu ?" },
  ],
};

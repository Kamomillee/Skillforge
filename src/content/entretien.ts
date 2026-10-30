import { pythonExerciseSchema, sqlExerciseSchema, type Exercise } from "./types";

/**
 * Mode entretien : banque de questions par format, sessions par profil de stage.
 * Les questions de code sont de vrais exercices (tests cachés, exécution réelle), corrigés APRÈS la session.
 * Les questions orales/écrites ont des « éléments attendus » rédigés et des repères (mots-clés) pour aider la
 * relecture : la détection est approximative et annoncée comme telle, jamais présentée comme une note.
 */

export type InterviewFormat =
  | "expliquer-projet"
  | "modifier-fonction"
  | "corriger-requete"
  | "interpreter-metrique"
  | "justifier-architecture"
  | "fuite-de-donnees"
  | "diagnostiquer-rag"
  | "expliquer-metier";

export const formatLabels: Record<InterviewFormat, string> = {
  "expliquer-projet": "Expliquer son projet",
  "modifier-fonction": "Modifier une fonction",
  "corriger-requete": "Corriger une requête",
  "interpreter-metrique": "Interpréter une métrique",
  "justifier-architecture": "Justifier une architecture",
  "fuite-de-donnees": "Identifier une fuite de données",
  "diagnostiquer-rag": "Diagnostiquer un assistant RAG",
  "expliquer-metier": "Expliquer un résultat à un responsable métier",
};

export interface Attendu {
  id: string;
  label: string;
  /** Repères cherchés dans la réponse (minuscules, sans accents) ; un seul suffit. */
  reperes: string[];
}

export interface TextQuestion {
  id: string;
  format: InterviewFormat;
  kind: "texte";
  question: string;
  contexte?: string;
  attendus: Attendu[];
  /** Longueur visée, en mots (communication). */
  mots: [number, number];
  reponseModele: string;
}

export interface CodeQuestion {
  id: string;
  format: InterviewFormat;
  kind: "code";
  question: string;
  exercise: Exercise;
  /** Ce que le recruteur observe en plus du résultat. */
  attendus: Attendu[];
  reponseModele: string;
}

export type InterviewQuestion = TextQuestion | CodeQuestion;

const exPanier = pythonExerciseSchema.parse({
  id: "entretien-panier-moyen",
  version: 1,
  kind: "autonomous",
  title: "Corriger panier_moyen",
  prompt: "",
  functionName: "panier_moyen",
  starterCode: "def panier_moyen(montants):\n    return sum(montants) / len(montants)\n",
  referenceSolution: `def panier_moyen(montants):
    paniers = [m for m in montants if m > 0]
    if not paniers:
        return 0.0
    return round(sum(paniers) / len(paniers), 2)
`,
  tests: [
    { id: "t1", label: "Deux paniers", args: [[10, 20]], expected: 15.0, hidden: false },
    { id: "t2", label: "Liste vide", args: [[]], expected: 0.0, hidden: true, misconception: "liste-vide" },
    { id: "t3", label: "Un remboursement n'est pas un panier", args: [[-5, 10, 20]], expected: 15.0, hidden: true, misconception: "condition-inversee" },
    { id: "t4", label: "Seulement un montant nul", args: [[0]], expected: 0.0, hidden: true, misconception: "division-zero" },
    { id: "t5", label: "Arrondi à 2 décimales", args: [[10, 20, 31]], expected: 20.33, hidden: true, misconception: "arrondi-flottant" },
  ],
  hints: [
    { level: 1, text: "—" },
    { level: 2, text: "—" },
    { level: 3, text: "—" },
    { level: 4, text: "—" },
  ],
  explanation: "Filtrer d'abord, traiter le cas vide, arrondir à la fin.",
  conceptIds: ["python.a.boucles"],
});

const exClientsFideles = sqlExerciseSchema.parse({
  id: "entretien-clients-fideles",
  version: 1,
  language: "sql",
  kind: "autonomous",
  title: "Corriger la requête des clients fidèles",
  prompt: "",
  dataset: "pme",
  starterCode: `SELECT client_id, COUNT(*) AS nb_commandes
FROM commandes
WHERE COUNT(*) >= 3 AND statut <> 'annulee'
GROUP BY client_id;`,
  referenceSolution: `SELECT client_id, COUNT(*) AS nb_commandes
FROM commandes
WHERE statut <> 'annulee'
GROUP BY client_id
HAVING COUNT(*) >= 3;`,
  checks: [
    { id: "base", label: "Données actuelles", hidden: false, misconception: "where-having" },
    {
      id: "annulees",
      label: "Des commandes annulées ne rendent pas un client fidèle",
      hidden: true,
      setup: "INSERT INTO commandes VALUES (970, 44, '2026-10-01', 'annulee'), (971, 44, '2026-10-02', 'annulee'), (972, 44, '2026-10-03', 'annulee');",
      misconception: "statut-annule",
    },
  ],
  hints: [
    { level: 1, text: "—" },
    { level: 2, text: "—" },
    { level: 3, text: "—" },
    { level: 4, text: "—" },
  ],
  explanation: "WHERE filtre les lignes avant le regroupement ; une condition sur un agrégat va dans HAVING.",
  conceptIds: ["sql.b.group-by-et-having"],
});

const LIMITES: Attendu = { id: "limite", label: "Reconnaît une limite ou une incertitude", reperes: ["limite", "synthetique", "biais", "hypothese", "je ne sais pas", "incertain", "depend", "pas verifie", "petit echantillon", "seulement"] };

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: "q-projet",
    format: "expliquer-projet",
    kind: "texte",
    question: "Présente-moi ton projet « Copilote data pour une PME » en deux minutes.",
    attendus: [
      { id: "probleme", label: "Le problème métier", reperes: ["pme", "torrefaction", "direction", "besoin", "probleme", "boutique"] },
      { id: "donnees", label: "Les données et leur provenance", reperes: ["donnees", "export", "csv", "synthetique", "base", "postgresql"] },
      { id: "approche", label: "L'approche (étapes, outils)", reperes: ["python", "sql", "nettoy", "modele", "assistant", "tableau de bord", "pipeline"] },
      { id: "resultat", label: "Un résultat mesuré, chiffré", reperes: ["%", "lignes", "rejet", "exactitude", "questions", "commandes"] },
      LIMITES,
      { id: "suite", label: "La prochaine étape", reperes: ["ensuite", "prochaine", "ameliorer", "ajouter", "si j'avais"] },
    ],
    mots: [120, 300],
    reponseModele:
      "La Torréfaction du Léman voulait intégrer chaque jour les ventes de sa boutique en ligne et répondre plus vite aux questions de la direction. J'ai importé l'export CSV en Python, rejeté 4 lignes sur 11 avec un motif chacune, préparé un import rejouable dans PostgreSQL, calculé le CA mensuel et les indicateurs du tableau de bord, entraîné une règle simple sur les réclamations (75 % d'exactitude en test, contre 72,5 % pour la base) et un assistant qui cite ses sources ou s'abstient. Limites : données synthétiques et petites, recherche lexicale, et le modèle bat à peine la base. Ensuite, j'ajouterais des embeddings et davantage de variables.",
  },
  {
    id: "q-panier",
    format: "modifier-fonction",
    kind: "code",
    question:
      "Cette fonction plante sur une liste vide et compte les remboursements (montants négatifs) comme des paniers. Modifie-la : ignore les montants ≤ 0, retourne 0.0 s'il ne reste rien, arrondis à 2 décimales.",
    exercise: exPanier,
    attendus: [
      { id: "cas-vide", label: "Traite le cas vide avant de diviser", reperes: ["if not", "len(", "== 0"] },
      { id: "filtre", label: "Filtre les montants ≤ 0", reperes: ["> 0", "<= 0"] },
      { id: "arrondi", label: "Arrondit le résultat", reperes: ["round("] },
    ],
    reponseModele: exPanier.referenceSolution,
  },
  {
    id: "q-requete",
    format: "corriger-requete",
    kind: "code",
    question: "Cette requête doit lister les clients ayant au moins 3 commandes non annulées (colonnes client_id, nb_commandes). Elle échoue. Corrige-la.",
    exercise: exClientsFideles,
    attendus: [
      { id: "having", label: "Déplace la condition sur l'agrégat dans HAVING", reperes: ["having"] },
      { id: "statut", label: "Garde le filtre de statut dans WHERE", reperes: ["where statut", "where c.statut"] },
    ],
    reponseModele: exClientsFideles.referenceSolution,
  },
  {
    id: "q-metrique",
    format: "interpreter-metrique",
    kind: "texte",
    question: "Un modèle de départ des clients affiche 92 % d'exactitude. Dans ces données, 90 % des clients ne partent pas. Qu'en penses-tu ?",
    attendus: [
      { id: "base", label: "Compare à la base « classe majoritaire » (90 %)", reperes: ["90", "majoritaire", "base", "toujours", "personne ne part"] },
      { id: "desequilibre", label: "Parle du déséquilibre des classes", reperes: ["desequilibr", "rare", "minoritaire", "10 %"] },
      { id: "rappel", label: "Propose une mesure adaptée (rappel, précision, matrice)", reperes: ["rappel", "precision", "matrice", "faux negatif", "f1"] },
      { id: "metier", label: "Relie au coût métier", reperes: ["cout", "metier", "offre", "chf", "perdu"] },
      LIMITES,
    ],
    mots: [60, 200],
    reponseModele:
      "92 % semble bon, mais prédire « personne ne part » donne déjà 90 % : le modèle ne gagne que 2 points. Avec des classes déséquilibrées, je regarderais la matrice de confusion, le rappel des départs et la précision, puis je choisirais un seuil selon le coût d'un départ raté et d'une offre inutile. Je vérifierais aussi que l'évaluation est faite sur un jeu de test. Sans connaître le coût des erreurs, je ne peux pas dire si 92 % suffit : c'est la limite de l'information donnée.",
  },
  {
    id: "q-architecture-cle",
    format: "justifier-architecture",
    kind: "texte",
    question: "Dans ton application, pourquoi l'appel au modèle de langage passe-t-il par un serveur plutôt que directement depuis le navigateur ?",
    attendus: [
      { id: "secret", label: "La clé API resterait visible dans le navigateur", reperes: ["cle", "secret", "visible", "bundle", "navigateur"] },
      { id: "controle", label: "Contrôle des coûts et des abus (limites, quotas)", reperes: ["limite", "quota", "abus", "cout", "budget", "debit"] },
      { id: "validation", label: "Validation et journalisation côté serveur", reperes: ["valid", "journal", "log", "filtr"] },
      { id: "repli", label: "Fonctionnement sans IA ou en cas de panne", reperes: ["sans ia", "local", "panne", "repli", "fallback", "indisponible"] },
    ],
    mots: [50, 180],
    reponseModele:
      "Une clé dans le navigateur est lisible par n'importe qui : elle doit rester sur le serveur. Le serveur valide aussi ce qui est envoyé, limite le débit et le budget quotidien, et ne journalise ni la clé ni le code des étudiants. Enfin, si le serveur ou le modèle est indisponible, l'application revient au tuteur local au lieu de bloquer.",
  },
  {
    id: "q-architecture-import",
    format: "justifier-architecture",
    kind: "texte",
    question: "Ton import quotidien des ventes doit pouvoir être relancé sans risque. Comment l'as-tu conçu, et pourquoi ?",
    attendus: [
      { id: "rejouable", label: "Import rejouable (idempotent) : ignore ce qui existe déjà", reperes: ["rejou", "idempot", "not exists", "deja", "doublon", "relanc"] },
      { id: "integrite", label: "Intégrité : écarte et signale les références inconnues", reperes: ["integrite", "cle etrangere", "client inconnu", "orphelin", "rejet"] },
      { id: "etapes", label: "Étapes séparées (lire, contrôler, charger)", reperes: ["etape", "separ", "nettoy", "controle", "charg"] },
      { id: "trace", label: "Trace des rejets par motif", reperes: ["motif", "rapport", "compt", "trace"] },
    ],
    mots: [50, 180],
    reponseModele:
      "Je sépare lecture, contrôle et chargement. Le contrôle rejette les lignes invalides et compte les rejets par motif pour le rapport. Le chargement ignore les commandes déjà présentes (NOT EXISTS), ce qui rend l'import rejouable, et écarte les commandes dont le client est inconnu au lieu de faire échouer tout le lot.",
  },
  {
    id: "q-fuite",
    format: "fuite-de-donnees",
    kind: "texte",
    question:
      "Un collègue prédit la résiliation avec ces variables : ancienneté, commandes sur 6 mois, réclamations, et « date d'envoi du courrier de résiliation ». Il a standardisé toutes les données avant de séparer entraînement et test, et obtient 99 % d'exactitude. Que lui dis-tu ?",
    attendus: [
      { id: "variable", label: "Repère la variable qui contient la réponse (courrier de résiliation)", reperes: ["courrier", "date d'envoi", "resiliation", "connue apres", "futur"] },
      { id: "split", label: "Séparer avant toute préparation (standardisation sur l'entraînement seulement)", reperes: ["avant", "separ", "standardis", "entrainement seulement", "fit", "pipeline"] },
      { id: "suspect", label: "99 % est suspect et doit être vérifié", reperes: ["99", "trop beau", "suspect", "irrealiste"] },
      { id: "temps", label: "Penser au temps : seules les infos disponibles au moment de prédire", reperes: ["moment", "temps", "disponible", "au moment de", "temporel"] },
    ],
    mots: [60, 200],
    reponseModele:
      "99 % est trop beau pour être vrai. La date d'envoi du courrier de résiliation n'existe qu'après la décision du client : c'est une fuite, elle doit sortir des variables. Ensuite, la standardisation doit être apprise sur l'entraînement seulement, après la séparation (idéalement dans un pipeline). Règle générale : n'utiliser que ce qui est disponible au moment où l'on prédit.",
  },
  {
    id: "q-rag",
    format: "diagnostiquer-rag",
    kind: "texte",
    question:
      "À la question « Quel est le prix d'une machine à espresso ? », l'assistant documentaire répond en citant la politique de garantie, alors qu'aucun document ne donne de prix. Comment diagnostiques-tu le problème, et que changes-tu ?",
    attendus: [
      { id: "recherche", label: "Regarde ce que la recherche a retrouvé (passages, scores)", reperes: ["score", "passage", "recherche", "retrouv", "mots communs"] },
      { id: "lexical", label: "Explique le recouvrement de mots (machine, espresso) sans le sens", reperes: ["lexical", "mot", "machine", "espresso", "sens", "semantique"] },
      { id: "seuil", label: "Ajuste le seuil d'abstention, avec son coût (silences)", reperes: ["seuil", "abstention", "abstenir", "silence"] },
      { id: "evaluation", label: "Mesure sur un jeu de questions de référence avant/après", reperes: ["evaluation", "jeu de questions", "reference", "mesur", "13"] },
    ],
    mots: [60, 200],
    reponseModele:
      "Je regarde d'abord les passages retrouvés et leurs scores : la garantie partage « machine » et « espresso » avec la question, d'où un score de 2 alors que le sens est différent. C'est une limite de la recherche lexicale. Je peux relever le seuil d'abstention, mais je risque plus de silences à tort ; je le mesure sur les 13 questions de référence avant et après. À terme, une recherche sémantique ou hybride réduirait ce cas.",
  },
  {
    id: "q-metier",
    format: "expliquer-metier",
    kind: "texte",
    question: "La responsable commerciale voit que le chiffre d'affaires de mars a augmenté mais que le panier moyen a baissé. Elle te demande si c'est grave. Que lui réponds-tu ?",
    attendus: [
      { id: "definition", label: "Rappelle la définition (CA ÷ nombre de commandes)", reperes: ["divis", "nombre de commandes", "par commande", "definition", "moyenne"] },
      { id: "mecanisme", label: "Explique le mécanisme : plus de commandes, plus petites", reperes: ["plus de commandes", "plus petites", "petites commandes", "petits paniers", "nouveaux clients", "volume"] },
      { id: "verifier", label: "Propose de vérifier avec les données (par segment, par produit)", reperes: ["verifi", "segment", "produit", "detail", "regarder"] },
      { id: "simple", label: "Parle simplement, sans jargon", reperes: ["donc", "concretement", "en clair", "autrement dit"] },
      LIMITES,
    ],
    mots: [50, 180],
    reponseModele:
      "Pas forcément. Le panier moyen, c'est le CA divisé par le nombre de commandes : si beaucoup de nouvelles petites commandes arrivent, le CA monte et le panier baisse. Concrètement, je vérifierais par segment et par produit d'où viennent ces commandes, par exemple une promotion sur un petit article. C'est une hypothèse à confirmer avec les chiffres, pas une conclusion.",
  },
];

export type InterviewProfile = "data-analyst" | "bi" | "ia" | "automatisation";

export const interviewProfiles: { id: InterviewProfile; label: string; description: string; questions: string[] }[] = [
  { id: "data-analyst", label: "Stage data analyst", description: "Projet, SQL, métrique, communication métier.", questions: ["q-projet", "q-requete", "q-metrique", "q-metier"] },
  { id: "bi", label: "Stage BI", description: "Projet, requête de rapport, explication à un responsable, import fiable.", questions: ["q-projet", "q-requete", "q-metier", "q-architecture-import"] },
  { id: "ia", label: "Stage développement IA", description: "Projet, diagnostic RAG, fuite de données, architecture d'un appel LLM.", questions: ["q-projet", "q-rag", "q-fuite", "q-architecture-cle"] },
  { id: "automatisation", label: "Stage automatisation", description: "Projet, fonction à corriger, import rejouable, métrique.", questions: ["q-projet", "q-panier", "q-architecture-import", "q-metrique"] },
];

export const questionById = new Map(interviewQuestions.map((q) => [q.id, q]));

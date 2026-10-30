import type { Project, PythonExerciseInput, SqlExerciseInput } from "../types";
import { chargerVentes, EXPORT_BOUTIQUE, importSql, nettoyerVentes, type LigneImport } from "../datasets/import-boutique";
import { generateChurn } from "../datasets/churn";
import { documentsPme, motsVides } from "../datasets/documents";
import { indexer, rechercher } from "../llm/rag-core";

/**
 * Projet transversal « Copilote data pour une PME » : les cinq domaines dans un même mandat.
 * Étapes 1 à 7 : exercices vérifiés (Python dans Pyodide, SQL dans PostgreSQL). Étapes 8 à 10 : rédaction,
 * appuyée sur les résultats mesurés (tableau d'évaluation calculé depuis tes preuves), jamais notée automatiquement.
 * Les valeurs attendues Python viennent de miroirs TypeScript vérifiés par l'exécution des solutions de référence
 * (tests/content/transversal.test.ts).
 */

const C_CSV = "python.c.chargement-csv-excel-et-json";
const C_DOUBLONS = "python.c.doublons";
const C_INTEGRITE = "sql.a.integrite-referentielle";
const C_CA = "sql.d.chiffre-d-affaires";
const C_PANIER = "sql.d.panier-moyen";
const C_ARBRE = "ml.c.arbres";
const C_CITATIONS = "llm.c.citations";

const lignesBrutes = chargerVentes(EXPORT_BOUTIQUE);
const nettoyage = nettoyerVentes(lignesBrutes);
export const IMPORT_SQL = importSql(nettoyage.lignes);

// ---------- Étape 6 : un modèle simple, entraîné ----------

/** Miroir TypeScript de la solution de référence de l'étape 6 : « souche de décision » (arbre de profondeur 1). */
export function entrainerSeuil(valeurs: number[], etiquettes: number[]) {
  if (!valeurs.length) return null;
  const n = etiquettes.length;
  const uns = etiquettes.reduce((a, b) => a + b, 0);
  const base = Math.round((Math.max(uns, n - uns) / n) * 1000) / 1000;
  let seuil: number | null = null;
  let best = -1;
  for (const s of [...new Set(valeurs)].sort((a, b) => a - b)) {
    const justes = valeurs.filter((v, i) => (v >= s ? 1 : 0) === etiquettes[i]).length;
    if (justes / n > best) {
      best = justes / n;
      seuil = s;
    }
  }
  return { seuil, exactitude: Math.round(best * 1000) / 1000, base };
}

export const churn = generateChurn();
/** Variable utilisée par le modèle : nombre de réclamations sur 12 mois (colonne 2). */
export const RECLAMATIONS = 2;
const col = (X: number[][], j: number) => X.map((r) => r[j]);

/** Exactitude, sur le jeu de test, d'une règle « départ si valeur ≥ seuil » (étape 8, tableau d'évaluation). */
export function exactitudeTest(seuil: number, j = RECLAMATIONS) {
  const v = col(churn.X_test, j);
  return Math.round((v.filter((x, i) => (x >= seuil ? 1 : 0) === churn.y_test[i]).length / v.length) * 1000) / 1000;
}

// ---------- Étape 7 : réponse citée ou abstention ----------

export interface Passage {
  doc: string;
  texte: string;
  score: number;
}

/** Miroir TypeScript de la solution de référence de l'étape 7. */
export function repondreAvecSources(passages: Passage[], seuil: number) {
  const retenus = passages.filter((p) => p.score >= seuil).sort((a, b) => b.score - a.score).slice(0, 2);
  if (!retenus.length) return { reponse: null, sources: [] as string[], abstention: true };
  return { reponse: retenus[0].texte, sources: [...new Set(retenus.map((p) => p.doc))], abstention: false };
}

const INDEX = indexer(documentsPme, 25, 5);
/** Passages réellement retrouvés par la recherche lexicale du laboratoire RAG (k = 4). */
export function passagesPour(question: string): Passage[] {
  return rechercher(question, INDEX, motsVides, 4).map((r) => {
    const m = INDEX.find((x) => x.id === r.id)!;
    return { doc: m.doc, texte: m.texte, score: r.score };
  });
}
const Q_RETOUR = "Combien de jours pour retourner un produit ?";
const Q_ABONNEMENT = "Comment résilier mon abonnement ?";

const exemple = (lignes: LigneImport[]) => lignes.map((l) => ({ ...l }));
const csv = (...lignes: string[]) => ["commande;date;client;produit;quantite;prix_unitaire", ...lignes].join("\n") + "\n";
const PETIT_CSV = csv("7001;2026-10-01;4;1;2;12,90", "7002;2026-10-02;5;11;1;59,00");

export const exercisesCopilotePy: PythonExerciseInput[] = [
  {
    id: "cp-1-import",
    version: 1,
    kind: "project",
    title: "Importer l'export de la boutique",
    prompt: `La boutique en ligne exporte ses ventes dans un fichier texte (export de tableur suisse : séparateur \`;\`, décimales à virgule). Écris \`charger_ventes(texte)\` qui reçoit **le contenu du fichier** et retourne une liste de dictionnaires, un par ligne de données, avec les clés \`commande\`, \`date\`, \`client\`, \`produit\`, \`quantite\`, \`prix_unitaire\`.

- \`commande\`, \`client\`, \`produit\` et \`quantite\` sont des **entiers**, \`prix_unitaire\` un **nombre à virgule** (\`float\`), \`date\` reste un texte ;
- la première ligne est l'en-tête ; les lignes vides sont ignorées ; les espaces autour des valeurs sont retirés.

Ne corrige rien d'autre ici : le contrôle qualité est l'étape suivante. Le module \`csv\` est permis, pas obligatoire.`,
    functionName: "charger_ventes",
    starterCode: "def charger_ventes(texte):\n    ventes = []\n    # Ton code ici\n    return ventes\n",
    referenceSolution: `def charger_ventes(texte):
    ventes = []
    lignes = [l.strip() for l in texte.splitlines() if l.strip()]
    for ligne in lignes[1:]:
        commande, date, client, produit, quantite, prix = [v.strip() for v in ligne.split(";")]
        ventes.append({
            "commande": int(commande),
            "date": date,
            "client": int(client),
            "produit": int(produit),
            "quantite": int(quantite),
            "prix_unitaire": float(prix.replace(",", ".")),
        })
    return ventes
`,
    tests: [
      { id: "t1", label: "Deux lignes simples", args: [PETIT_CSV], expected: chargerVentes(PETIT_CSV), compare: "exact", hidden: false, misconception: "type-non-converti" },
      { id: "t2", label: "L'export complet de la boutique (11 lignes)", args: [EXPORT_BOUTIQUE], expected: exemple(lignesBrutes), compare: "exact", hidden: true, misconception: "type-non-converti" },
      { id: "t3", label: "Fichier avec l'en-tête seulement", args: [csv()], expected: [], compare: "exact", hidden: true, misconception: "liste-vide" },
      { id: "t4", label: "Lignes vides et espaces", args: [csv("", " 7003 ; 2026-10-03 ; 6 ; 2 ; 3 ; 15,50 ", "")], expected: chargerVentes(csv("7003;2026-10-03;6;2;3;15,50")), compare: "exact", hidden: true },
    ],
    hints: [
      { level: 1, text: "Que contient `texte.splitlines()` ? Quelle ligne faut-il sauter, et lesquelles ignorer ?" },
      { level: 2, text: "`ligne.split(\";\")` donne des **textes** : `\"2\"` n'est pas `2`. Convertis avec `int()` et `float()` ; `float` n'accepte pas la virgule." },
      { level: 3, text: "Pour chaque ligne non vide après l'en-tête : découpe, `strip()` chaque valeur, puis `float(prix.replace(\",\", \".\"))`." },
      { level: 4, text: "" },
    ],
    explanation:
      "Un import fiable sépare **lire** et **corriger** : ici on convertit les types et on retire les espaces, sans rien jeter. Les anomalies (doublon, date au format suisse, quantités nulles ou négatives) passent volontairement : elles seront comptées à l'étape 2, ce qui permet d'en rendre compte.",
    conceptIds: [C_CSV],
  },
  {
    id: "cp-2-nettoyage",
    version: 1,
    kind: "project",
    title: "Contrôler et nettoyer",
    prompt: `Écris \`nettoyer(lignes)\` qui reçoit la liste produite à l'étape 1 et retourne un dictionnaire :

\`\`\`
{"lignes": [...lignes conservées, dans l'ordre...],
 "rejets": {"date_invalide": n1, "quantite_invalide": n2, "doublon": n3}}
\`\`\`

Une ligne est rejetée, **pour la première règle qu'elle enfreint, dans cet ordre** :
1. \`date_invalide\` : la date n'est pas une vraie date au format \`AAAA-MM-JJ\` (\`datetime.strptime(d, "%Y-%m-%d")\` échoue) ;
2. \`quantite_invalide\` : quantité nulle ou négative ;
3. \`doublon\` : ligne identique (toutes les clés) à une ligne **déjà conservée**.

La liste reçue ne doit pas être modifiée.`,
    functionName: "nettoyer",
    starterCode: "from datetime import datetime\n\ndef nettoyer(lignes):\n    rejets = {\"date_invalide\": 0, \"quantite_invalide\": 0, \"doublon\": 0}\n    propres = []\n    # Ton code ici\n    return {\"lignes\": propres, \"rejets\": rejets}\n",
    referenceSolution: `from datetime import datetime

def date_valide(d):
    try:
        datetime.strptime(d, "%Y-%m-%d")
        return len(d) == 10
    except ValueError:
        return False

def nettoyer(lignes):
    rejets = {"date_invalide": 0, "quantite_invalide": 0, "doublon": 0}
    propres = []
    vues = set()
    for l in lignes:
        cle = (l["commande"], l["date"], l["client"], l["produit"], l["quantite"], l["prix_unitaire"])
        if not date_valide(l["date"]):
            rejets["date_invalide"] += 1
        elif l["quantite"] <= 0:
            rejets["quantite_invalide"] += 1
        elif cle in vues:
            rejets["doublon"] += 1
        else:
            vues.add(cle)
            propres.append(l)
    return {"lignes": propres, "rejets": rejets}
`,
    tests: [
      { id: "t1", label: "L'export de la boutique", args: [exemple(lignesBrutes)], expected: nettoyage, compare: "exact", hidden: false },
      {
        id: "t2",
        label: "Une ligne présente trois fois",
        args: [[lignesBrutes[2], lignesBrutes[2], lignesBrutes[2]]],
        expected: nettoyerVentes([lignesBrutes[2], lignesBrutes[2], lignesBrutes[2]]),
        compare: "exact",
        hidden: true,
        misconception: "doublon-garde",
      },
      {
        id: "t3",
        label: "Date impossible (31 avril)",
        args: [[{ ...lignesBrutes[0], date: "2026-04-31" }]],
        expected: { lignes: [], rejets: { date_invalide: 1, quantite_invalide: 0, doublon: 0 } },
        compare: "exact",
        hidden: true,
        misconception: "date-non-validee",
      },
      {
        id: "t4",
        label: "Quantité négative ET date invalide : comptée une seule fois",
        args: [[{ ...lignesBrutes[0], date: "24.10.2026", quantite: -2 }]],
        expected: { lignes: [], rejets: { date_invalide: 1, quantite_invalide: 0, doublon: 0 } },
        compare: "exact",
        hidden: true,
      },
      { id: "t5", label: "La liste reçue n'est pas modifiée", args: [exemple(lignesBrutes)], expected: nettoyage, compare: "exact", hidden: true, checkNoMutation: true, misconception: "mutation-argument" },
      { id: "t6", label: "Liste vide", args: [[]], expected: { lignes: [], rejets: { date_invalide: 0, quantite_invalide: 0, doublon: 0 } }, compare: "exact", hidden: true, misconception: "liste-vide" },
    ],
    hints: [
      { level: 1, text: "Pour chaque ligne, quelle question poses-tu en premier, en deuxième, en troisième ? Une ligne rejetée est-elle comptée plusieurs fois ?" },
      { level: 2, text: "Une chaîne `if / elif / elif / else` applique « la première règle enfreinte ». Pour les doublons, garde un ensemble des lignes déjà conservées (un tuple de leurs valeurs)." },
      { level: 3, text: "`datetime.strptime(d, \"%Y-%m-%d\")` lève `ValueError` si la date est fausse : entoure-le d'un `try / except ValueError`." },
      { level: 4, text: "" },
    ],
    explanation:
      "Compter les rejets par motif transforme un nettoyage silencieux en **contrôle qualité** dont on peut rendre compte : sur l'export, 1 date invalide, 2 quantités invalides et 1 doublon, soit 4 lignes sur 11. C'est ce chiffre qui va dans le rapport, pas seulement les lignes propres.",
    conceptIds: [C_DOUBLONS],
  },
  {
    id: "cp-6-modele",
    version: 1,
    kind: "project",
    title: "Entraîner un modèle simple",
    prompt: `Le modèle le plus simple qui **apprend** quelque chose : une règle « départ si \`valeur ≥ seuil\` », dont le seuil est choisi sur les données d'entraînement (une « souche de décision », c'est-à-dire un arbre de profondeur 1).

Écris \`entrainer_seuil(valeurs, etiquettes)\` qui essaie comme seuil chaque valeur distincte (de la plus petite à la plus grande), garde celle qui donne la **meilleure exactitude** (en cas d'égalité, la plus petite) et retourne :

\`\`\`
{"seuil": s, "exactitude": e, "base": b}
\`\`\`

où \`e\` est l'exactitude de la règle sur ces données et \`b\` celle de la stratégie « toujours la classe majoritaire », toutes deux arrondies à 3 décimales. Retourne \`None\` si la liste est vide.`,
    functionName: "entrainer_seuil",
    starterCode: "def entrainer_seuil(valeurs, etiquettes):\n    pass\n",
    referenceSolution: `def entrainer_seuil(valeurs, etiquettes):
    if not valeurs:
        return None
    n = len(etiquettes)
    uns = sum(etiquettes)
    base = round(max(uns, n - uns) / n, 3)
    meilleur, meilleure = None, -1
    for s in sorted(set(valeurs)):
        justes = sum(1 for v, y in zip(valeurs, etiquettes) if (1 if v >= s else 0) == y)
        if justes / n > meilleure:
            meilleur, meilleure = s, justes / n
    return {"seuil": meilleur, "exactitude": round(meilleure, 3), "base": base}
`,
    tests: [
      {
        id: "t1",
        label: "Réclamations des 120 abonnés d'entraînement",
        args: [col(churn.X_train, RECLAMATIONS), churn.y_train],
        expected: entrainerSeuil(col(churn.X_train, RECLAMATIONS), churn.y_train),
        compare: "exact",
        hidden: false,
      },
      { id: "t2", label: "Égalité d'exactitude : le plus petit seuil", args: [[1, 2, 3, 4], [0, 1, 0, 1]], expected: entrainerSeuil([1, 2, 3, 4], [0, 1, 0, 1]), compare: "exact", hidden: true, misconception: "egalite-de-cout" },
      { id: "t3", label: "Le seuil lui-même prédit un départ (≥)", args: [[0, 2, 2, 5], [0, 1, 1, 1]], expected: entrainerSeuil([0, 2, 2, 5], [0, 1, 1, 1]), compare: "exact", hidden: true, misconception: "seuil-strict" },
      { id: "t4", label: "Liste vide", args: [[], []], expected: null, compare: "exact", hidden: true, misconception: "liste-vide" },
    ],
    hints: [
      { level: 1, text: "Pour un seuil donné, combien de prédictions sont justes ? Fais-le à la main sur `[0, 2, 2, 5]` / `[0, 1, 1, 1]` avec le seuil 2." },
      { level: 2, text: "Boucle sur `sorted(set(valeurs))` ; pour chaque seuil, compte les cas où `(1 if v >= s else 0) == y`. Ne remplace le meilleur que si c'est **strictement** mieux." },
      { level: 3, text: "La base : `max(nombre de 1, nombre de 0) / n`. Compare-la à l'exactitude de ta règle : un modèle qui ne bat pas la base n'apporte rien." },
      { level: 4, text: "" },
    ],
    explanation:
      "Sur les réclamations, la meilleure règle atteint une exactitude à peine supérieure à la base « personne ne part » : un modèle « entraîné » n'est utile que s'il bat une base honnête, et l'étape 8 le vérifie sur des données **qu'il n'a pas vues** (le jeu de test).",
    conceptIds: [C_ARBRE],
  },
  {
    id: "cp-7-assistant",
    version: 1,
    kind: "project",
    title: "Assistant documentaire avec citations",
    prompt: `L'assistant interne répond aux questions de l'équipe à partir des documents de la boutique. La recherche (celle du laboratoire RAG) a déjà retrouvé des passages, chacun avec son document et son score.

Écris \`repondre_avec_sources(passages, seuil)\` :
- garde les passages dont le score est **au moins** \`seuil\`, du plus pertinent au moins pertinent, **deux au plus** ;
- s'il n'en reste aucun, retourne \`{"reponse": None, "sources": [], "abstention": True}\` ;
- sinon retourne \`{"reponse": <texte du meilleur passage>, "sources": <documents des passages gardés, sans doublon, dans l'ordre>, "abstention": False}\`.

Chaque passage est un dictionnaire \`{"doc": ..., "texte": ..., "score": ...}\`. Ne cite jamais un document que tu n'as pas gardé.`,
    functionName: "repondre_avec_sources",
    starterCode: "def repondre_avec_sources(passages, seuil):\n    pass\n",
    referenceSolution: `def repondre_avec_sources(passages, seuil):
    retenus = sorted([p for p in passages if p["score"] >= seuil], key=lambda p: p["score"], reverse=True)[:2]
    if not retenus:
        return {"reponse": None, "sources": [], "abstention": True}
    sources = []
    for p in retenus:
        if p["doc"] not in sources:
            sources.append(p["doc"])
    return {"reponse": retenus[0]["texte"], "sources": sources, "abstention": False}
`,
    tests: [
      { id: "t1", label: `« ${Q_RETOUR} »`, args: [passagesPour(Q_RETOUR), 2], expected: repondreAvecSources(passagesPour(Q_RETOUR), 2), compare: "exact", hidden: false },
      {
        id: "t2",
        label: `« ${Q_ABONNEMENT} » : aucun passage n'atteint le seuil`,
        args: [passagesPour(Q_ABONNEMENT), 2],
        expected: { reponse: null, sources: [], abstention: true },
        compare: "exact",
        hidden: true,
        misconception: "abstention-absente",
      },
      {
        id: "t3",
        label: "Passages non triés",
        args: [[{ doc: "a", texte: "A", score: 2 }, { doc: "b", texte: "B", score: 5 }, { doc: "c", texte: "C", score: 3 }], 2],
        expected: { reponse: "B", sources: ["b", "c"], abstention: false },
        compare: "exact",
        hidden: true,
        misconception: "ordre-pertinence",
      },
      {
        id: "t4",
        label: "Deux passages du même document",
        args: [[{ doc: "a", texte: "A1", score: 4 }, { doc: "a", texte: "A2", score: 3 }], 3],
        expected: { reponse: "A1", sources: ["a"], abstention: false },
        compare: "exact",
        hidden: true,
      },
      { id: "t5", label: "Aucun passage", args: [[], 1], expected: { reponse: null, sources: [], abstention: true }, compare: "exact", hidden: true, misconception: "liste-vide" },
    ],
    hints: [
      { level: 1, text: "Trois opérations : filtrer, trier, couper. Dans quel ordre ? Et que faire s'il ne reste rien ?" },
      { level: 2, text: "`sorted(..., key=lambda p: p[\"score\"], reverse=True)[:2]` trie et coupe. Les sources se déduisent des passages **gardés**." },
      { level: 3, text: "Pour retirer les doublons en gardant l'ordre, ajoute un document à `sources` seulement s'il n'y est pas déjà." },
      { level: 4, text: "" },
    ],
    explanation:
      "La réponse ne vient que des passages gardés, et chaque source citée a été gardée : c'est ce qui rend l'assistant vérifiable. Quand rien ne dépasse le seuil, s'abstenir vaut mieux qu'inventer, et le tableau d'évaluation de l'étape 8 compte précisément ces deux cas.",
    conceptIds: [C_CITATIONS],
  },
];

const NON_ANNULEE = "c.statut <> 'annulee'";
const ANNEE_2026 = "c.date_commande >= DATE '2026-01-01' AND c.date_commande < DATE '2027-01-01'";

export const exercisesCopiloteSql: SqlExerciseInput[] = [
  {
    id: "cp-3-base",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Organiser dans la base relationnelle",
    prompt: `Les lignes propres de l'étape 2 ont été chargées dans une table temporaire \`import_ventes(commande, date_commande, client_id, produit_id, quantite, prix_unitaire)\`, une ligne par produit commandé.

Avant de les insérer dans \`commandes\`, prépare **une ligne par commande à créer**, avec \`commande_id\`, \`client_id\`, \`date_commande\`, \`nb_lignes\` (lignes de produits) et \`montant\` (somme quantité × prix), triées par \`commande_id\`. Deux règles d'intégrité :
- une commande dont le client **n'existe pas** dans \`clients\` n'est pas insérable ;
- une commande **déjà présente** dans \`commandes\` (export relancé) ne doit pas être créée une seconde fois.

\`import_ventes\` existe pendant l'exécution et la vérification de ta requête (pas dans le schéma affiché).`,
    dataset: "pme",
    setup: IMPORT_SQL,
    starterCode: "SELECT *\nFROM import_ventes;\n",
    referenceSolution: `SELECT i.commande AS commande_id, i.client_id, MIN(i.date_commande) AS date_commande,
       COUNT(*) AS nb_lignes, SUM(i.quantite * i.prix_unitaire) AS montant
FROM import_ventes AS i
JOIN clients AS cl ON cl.client_id = i.client_id
WHERE NOT EXISTS (SELECT 1 FROM commandes AS c WHERE c.commande_id = i.commande)
GROUP BY i.commande, i.client_id
ORDER BY commande_id;`,
    orderBy: ["commande_id"],
    checks: [
      { id: "base", label: "Import du 24 au 27 octobre", hidden: false, misconception: "ligne-orpheline" },
      {
        id: "reimport",
        label: "Export relancé : une commande est déjà en base",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (5002, 8, '2026-10-24', 'livree')",
        misconception: "reimport",
      },
      {
        id: "client-supprime",
        label: "Un client de l'import n'existe plus",
        hidden: true,
        setup: "DELETE FROM paiements WHERE commande_id IN (SELECT commande_id FROM commandes WHERE client_id = 9); DELETE FROM retours WHERE commande_id IN (SELECT commande_id FROM commandes WHERE client_id = 9); DELETE FROM lignes_commande WHERE commande_id IN (SELECT commande_id FROM commandes WHERE client_id = 9); DELETE FROM commandes WHERE client_id = 9; DELETE FROM clients WHERE client_id = 9",
        misconception: "ligne-orpheline",
      },
    ],
    hints: [
      { level: 1, text: "Une ligne par commande : quelle clause regroupe ? Et comment savoir si un client existe, ou si une commande est déjà en base ?" },
      { level: 2, text: "Une jointure **interne** avec `clients` écarte les clients inconnus. `NOT EXISTS (SELECT 1 FROM commandes …)` écarte les commandes déjà présentes." },
      { level: 3, text: "`GROUP BY i.commande, i.client_id`, `COUNT(*) AS nb_lignes`, `SUM(i.quantite * i.prix_unitaire) AS montant`, puis le filtre `NOT EXISTS` dans le WHERE." },
      { level: 4, text: "" },
    ],
    explanation:
      "La base refuserait une commande au client inconnu (clé étrangère) : mieux vaut l'écarter **et la signaler** que faire échouer tout l'import. Le filtre `NOT EXISTS` rend l'import **rejouable** sans doublon, ce qu'un pipeline quotidien exige.",
    conceptIds: [C_INTEGRITE],
  },
  {
    id: "cp-4-questions",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Répondre aux questions de la direction",
    prompt: `La direction demande, **pour chaque mois de 2026**, le chiffre d'affaires et le nombre de **clients distincts** ayant commandé (commandes non annulées, CA = quantité × prix facturé).

Colonnes : \`mois\` (texte \`AAAA-MM\`, par exemple avec \`to_char(date_commande, 'YYYY-MM')\`), \`ca\`, \`clients\`, triées par mois.`,
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT to_char(c.date_commande, 'YYYY-MM') AS mois,
       SUM(l.quantite * l.prix_unitaire) AS ca,
       COUNT(DISTINCT c.client_id) AS clients
FROM commandes AS c
JOIN lignes_commande AS l ON l.commande_id = c.commande_id
WHERE ${NON_ANNULEE} AND ${ANNEE_2026}
GROUP BY mois
ORDER BY mois;`,
    orderBy: ["mois"],
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "jointure-doublons" },
      {
        id: "annulee",
        label: "Une grosse commande annulée",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (950, 1, '2026-06-10', 'annulee'); INSERT INTO lignes_commande VALUES (950, 1, 16, 20, 79.00);",
        misconception: "statut-annule",
      },
      {
        id: "fidele",
        label: "Un client commande deux fois le même mois",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (951, 2, '2026-02-03', 'livree'), (952, 2, '2026-02-20', 'livree'); INSERT INTO lignes_commande VALUES (951, 1, 1, 1, 12.90), (952, 1, 2, 1, 15.50);",
        misconception: "jointure-doublons",
      },
    ],
    hints: [
      { level: 1, text: "Le CA est dans `lignes_commande`, la date, le statut et le client dans `commandes`. Que compte `COUNT(client_id)` après la jointure ?" },
      { level: 2, text: "Après la jointure, il y a **une ligne par produit commandé** : un client y apparaît plusieurs fois. `COUNT(DISTINCT c.client_id)` les compte une seule fois." },
      { level: 3, text: "`to_char(c.date_commande, 'YYYY-MM') AS mois`, filtre sur le statut et sur 2026, `GROUP BY mois ORDER BY mois`." },
      { level: 4, text: "" },
    ],
    explanation: "Après une jointure, chaque ligne est un produit commandé : compter des clients exige `DISTINCT`. Le filtre d'année se fait sur une plage de dates, ce qui reste juste si l'heure s'ajoute un jour à la colonne.",
    conceptIds: [C_CA],
  },
  {
    id: "cp-5-tableau",
    version: 1,
    language: "sql",
    kind: "project",
    title: "Les indicateurs du tableau de bord",
    prompt: `Le tableau de bord affiche trois indicateurs pour 2026 (commandes non annulées). Écris la requête qui les calcule, en **une seule ligne** :
- \`ca\` : chiffre d'affaires (quantité × prix facturé) ;
- \`commandes\` : nombre de commandes ;
- \`panier_moyen\` : CA ÷ nombre de commandes, arrondi à 2 décimales.

C'est la requête « source » d'un visuel : le même chiffre doit sortir du tableau de bord que tu construis ensuite (Power BI, Excel ou autre, en auto-évaluation).`,
    dataset: "pme",
    starterCode: "SELECT\n",
    referenceSolution: `SELECT SUM(l.quantite * l.prix_unitaire) AS ca,
       COUNT(DISTINCT c.commande_id) AS commandes,
       ROUND(SUM(l.quantite * l.prix_unitaire) / NULLIF(COUNT(DISTINCT c.commande_id), 0), 2) AS panier_moyen
FROM commandes AS c
JOIN lignes_commande AS l ON l.commande_id = c.commande_id
WHERE ${NON_ANNULEE} AND ${ANNEE_2026};`,
    checks: [
      { id: "base", label: "Données actuelles", hidden: false, misconception: "jointure-doublons" },
      {
        id: "multi",
        label: "Une commande de trois produits",
        hidden: true,
        setup: "INSERT INTO commandes VALUES (960, 3, '2026-05-05', 'livree'); INSERT INTO lignes_commande VALUES (960, 1, 1, 1, 12.90), (960, 2, 7, 2, 11.00), (960, 3, 13, 1, 18.00);",
        misconception: "jointure-doublons",
      },
      { id: "vide", label: "Aucune commande en 2026", hidden: true, setup: "UPDATE commandes SET statut = 'annulee' WHERE date_commande >= DATE '2026-01-01'" },
    ],
    hints: [
      { level: 1, text: "Un panier, c'est une **commande**. Après la jointure avec les lignes, combien de lignes une commande de trois produits occupe-t-elle ?" },
      { level: 2, text: "`COUNT(DISTINCT c.commande_id)` compte les commandes. Le panier moyen se divise par ce nombre, pas par `COUNT(*)`." },
      { level: 3, text: "`ROUND(SUM(...) / NULLIF(COUNT(DISTINCT c.commande_id), 0), 2)` : sans commande, le panier vaut NULL au lieu d'une erreur." },
      { level: 4, text: "" },
    ],
    explanation:
      "Diviser par `COUNT(*)` après la jointure donnerait un « panier » par ligne de produit, nettement plus petit : l'erreur classique des tableaux de bord. `NULLIF` garde un visuel vide plutôt qu'une erreur quand le filtre ne laisse rien.",
    conceptIds: [C_PANIER],
  },
];

export const projetCopilote: Project = {
  id: "copilote-pme",
  version: 1,
  domain: "python",
  domains: ["python", "sql", "bi", "ml", "llm"],
  title: "Copilote data pour une PME",
  summary: "Les cinq domaines dans un même mandat : importer, nettoyer, organiser, interroger, visualiser, prédire, documenter, évaluer, présenter.",
  brief: `La Torréfaction du Léman veut un **copilote data** : un petit pipeline qui intègre chaque jour les ventes de la boutique en ligne, répond aux questions de la direction, alimente un tableau de bord, signale les abonnés à risque et répond aux questions de l'équipe en citant ses sources.

Tu le construis en **10 étapes** indépendantes : chacune se fait et s'enregistre séparément. Les étapes 1 à 7 sont vérifiées par exécution (Python dans ton navigateur, PostgreSQL) ; les étapes 8 à 10 sont rédigées, à partir des résultats **mesurés**, et servent à ton portfolio et à ton entretien.`,
  data: `- **Export de la boutique** (11 lignes, synthétique, écrit à la main) : anomalies volontaires à trouver.
- **Base PME** (PostgreSQL) : clients, produits, commandes, lignes, paiements, retours (synthétiques, graine 42).
- **Abonnés** (160, synthétiques, graine 7) : ancienneté, commandes sur 6 mois, réclamations, départ.
- **Documents internes** (8, synthétiques) : retours, livraison, abonnement, garantie…

Aucune donnée réelle ; les provenances sont détaillées dans docs/DONNEES.md.`,
  deliverables: [
    "Sept étapes vérifiées par des tests (import, nettoyage, base, questions, indicateurs, modèle, assistant).",
    "Un tableau d'évaluation des composants, calculé depuis tes résultats, et ton interprétation.",
    "Les limites du copilote, rédigées.",
    "Une présentation de deux minutes, à rejouer en mode entretien.",
    "Un export Markdown et l'entrée correspondante du portfolio.",
  ],
  acceptance: [
    "Chaque étape 1 à 7 passe toutes ses vérifications, cas cachés compris.",
    "Le rapport de nettoyage chiffre les rejets par motif.",
    "L'évaluation compare le modèle à la base « classe majoritaire » sur le jeu de test et l'assistant sur les 13 questions de référence.",
    "Les limites citent au moins : données synthétiques, taille des échantillons, recherche lexicale, indicateurs non vérifiés dans l'outil de BI.",
    "La présentation tient en deux minutes : problème, données, approche, résultats mesurés, limites, prochaine étape.",
  ],
  steps: [
    { id: "s1", title: "Importer les données (Python)", exerciseId: "cp-1-import", decisionPrompt: "Pourquoi ne rien corriger dès l'import ? Quelles anomalies as-tu repérées en lisant le fichier ?" },
    { id: "s2", title: "Contrôler et nettoyer (Python)", exerciseId: "cp-2-nettoyage", decisionPrompt: "Quelle règle de rejet est discutable ? Que ferais-tu de la ligne au format de date suisse ?" },
    { id: "s3", title: "Organiser dans la base (SQL)", exerciseId: "cp-3-base", decisionPrompt: "Que faire de la commande au client inconnu : rejeter, créer le client, mettre en attente ?" },
    { id: "s4", title: "Questions métier (SQL)", exerciseId: "cp-4-questions", decisionPrompt: "Quelle définition du CA as-tu retenue (statuts, prix, retours) ? Que répondrais-tu à « pourquoi mars est-il si fort ? »" },
    { id: "s5", title: "Tableau de bord (BI)", exerciseId: "cp-5-tableau", decisionPrompt: "Quels visuels pour ces indicateurs, et pourquoi ? Comment vérifies-tu que l'outil affiche les mêmes chiffres ?" },
    { id: "s6", title: "Modèle prédictif simple (ML)", exerciseId: "cp-6-modele", decisionPrompt: "Le modèle bat-il la base ? Le recommanderais-tu, et pour quelle décision ?" },
    { id: "s7", title: "Assistant documentaire (LLM)", exerciseId: "cp-7-assistant", decisionPrompt: "Quel seuil d'abstention choisis-tu, et quel risque prends-tu en le baissant ?" },
    {
      id: "s8",
      title: "Évaluer les composants",
      kind: "redaction",
      evaluation: true,
      decisionPrompt: "Interprète le tableau : quel composant est fiable, lequel ne l'est pas encore, et sur quelle preuve ?",
      fields: [{ id: "interpretation", label: "Ton interprétation du tableau d'évaluation (au moins trois phrases, chiffres à l'appui)" }],
    },
    {
      id: "s9",
      title: "Documenter les limites",
      kind: "redaction",
      decisionPrompt: "Quelles limites un responsable doit-il connaître avant d'utiliser le copilote ?",
      fields: [
        { id: "donnees", label: "Limites des données (provenance, taille, période)" },
        { id: "methodes", label: "Limites des méthodes (règles de nettoyage, modèle, recherche lexicale)" },
        { id: "usage", label: "Ce que le copilote ne doit pas servir à décider" },
      ],
    },
    {
      id: "s10",
      title: "Présenter comme en entretien",
      kind: "redaction",
      decisionPrompt: "Présente le projet en deux minutes, comme à un recruteur.",
      fields: [
        { id: "pitch", label: "Ta présentation (problème, données, approche, résultats mesurés, limites, prochaine étape)" },
        { id: "question", label: "La question difficile que tu crains, et ta réponse" },
      ],
    },
  ],
  selfCheck: {
    title: "Tableau de bord dans ton outil de BI",
    intro: "Construis le tableau de bord dans Power BI Desktop, Excel ou un autre outil, à partir des tables de la base (bac à sable SQL). SkillForge ne lit pas ton fichier : coche ce que tu as fait, c'est une **auto-évaluation**.",
    items: [
      { id: "kpi", label: "Les trois indicateurs affichent exactement les chiffres de l'étape 5." },
      { id: "mensuel", label: "Un graphique en courbes ou en barres montre le CA mensuel 2026 (étape 4)." },
      { id: "filtre", label: "Un segment (catégorie ou segment client) filtre les visuels." },
      { id: "titre", label: "Chaque visuel a un titre qui dit ce qu'il montre et sur quelle période." },
      { id: "accessible", label: "Les couleurs ne portent pas seules l'information (étiquettes de données ou motifs)." },
    ],
  },
};

// Le niveau 4 d'aide (solution expliquée sur demande) est la solution de référence elle-même.
for (const e of [...exercisesCopilotePy, ...exercisesCopiloteSql]) if (e.hints[3] && !e.hints[3].text) e.hints[3] = { level: 4, text: e.referenceSolution.trim() };

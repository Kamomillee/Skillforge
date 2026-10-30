/**
 * Base documentaire SYNTHÉTIQUE de la Torréfaction du Léman (entreprise fictive), utilisée par le
 * laboratoire LLM / RAG. Textes rédigés pour l'exercice : aucune politique réelle, aucune personne réelle.
 * Chaque fait n'apparaît que dans un seul document, pour que la « bonne source » d'une question soit
 * sans ambiguïté dans le jeu d'évaluation.
 */
export interface DocumentSource {
  id: string;
  titre: string;
  texte: string;
}

export const documentsPme: DocumentSource[] = [
  {
    id: "retours",
    titre: "Politique de retour",
    texte:
      "Un produit non ouvert peut être retourné dans les 30 jours suivant la livraison. Le remboursement est versé sur le moyen de paiement d'origine sous 10 jours ouvrables. Les cafés moulus ouverts ne sont ni repris ni échangés pour des raisons d'hygiène. Les frais de renvoi sont à la charge du client, sauf si le produit est arrivé endommagé.",
  },
  {
    id: "livraison",
    titre: "Livraison",
    texte:
      "Les commandes passées avant 14 heures sont expédiées le jour même, du lundi au vendredi. La livraison en Suisse prend un à deux jours ouvrables. Elle est offerte dès 60 CHF d'achat ; en dessous, elle coûte 7 CHF. Nous ne livrons pas encore hors de Suisse et du Liechtenstein.",
  },
  {
    id: "abonnement",
    titre: "Abonnement café",
    texte:
      "L'abonnement envoie un paquet de café fraîchement torréfié toutes les deux ou quatre semaines. Il peut être suspendu ou résilié à tout moment depuis l'espace client, sans frais, au plus tard trois jours avant le prochain envoi. Les abonnés bénéficient de 10 % de réduction sur les accessoires.",
  },
  {
    id: "garantie",
    titre: "Garantie des machines",
    texte:
      "Les machines à espresso vendues en boutique sont garanties deux ans, pièces et main-d'œuvre. La garantie ne couvre pas l'entartrage : un détartrage tous les trois mois est recommandé. En cas de panne, la réparation est effectuée dans notre atelier de Vevey ; une machine de prêt est proposée si la réparation dure plus d'une semaine.",
  },
  {
    id: "boutique",
    titre: "Boutique de Vevey",
    texte:
      "La boutique de Vevey est ouverte du mardi au samedi, de 9 heures à 18 heures 30. Elle est fermée le dimanche et le lundi. On peut y goûter les cafés du moment et retirer gratuitement une commande passée en ligne, dès le lendemain de la confirmation.",
  },
  {
    id: "fidelite",
    titre: "Programme de fidélité",
    texte:
      "Chaque franc dépensé rapporte un point. À 200 points, le client reçoit un bon de 15 CHF valable six mois. Les points expirent après douze mois sans achat. Les achats de cartes cadeaux ne rapportent pas de points.",
  },
  {
    id: "allergenes",
    titre: "Allergènes et production",
    texte:
      "Nos cafés ne contiennent aucun ingrédient ajouté. Les cafés aromatisés et les coffrets gourmands sont préparés dans un atelier qui manipule aussi des noisettes et du lait : des traces sont possibles. La liste complète des allergènes figure sur chaque fiche produit.",
  },
  {
    id: "paiement",
    titre: "Moyens de paiement",
    texte:
      "Le paiement en ligne accepte les cartes Visa et Mastercard, TWINT et la facture pour les clients enregistrés depuis plus de six mois. La facture est payable à 30 jours. En boutique, les espèces sont aussi acceptées.",
  },
];

/** Mots vides français (articles, prépositions, mots interrogatifs…) ignorés par la recherche lexicale. */
export const motsVides = [
  "a", "à", "au", "aux", "avec", "c", "ce", "ces", "cette", "combien", "comment", "d", "dans", "de", "des", "du", "elle", "en", "est", "et", "faut", "il", "j", "je",
  "l", "la", "le", "les", "leur", "lui", "ma", "mes", "mon", "n", "ne", "nous", "on", "ou", "où", "par", "pas", "peut", "peux", "pour", "qu", "quand", "que", "quel",
  "quelle", "quels", "qui", "s", "sa", "se", "ses", "si", "son", "sont", "sur", "t", "un", "une", "vos", "votre", "vous", "y",
];

/**
 * Jeu de questions de référence : la source attendue, ou null si la base ne contient pas la réponse
 * (le système doit alors s'abstenir). Utilisé par la leçon, le projet et les tests.
 */
export const questionsReference: { question: string; attendu: string | null }[] = [
  { question: "Combien de jours pour retourner un produit ?", attendu: "retours" },
  { question: "La livraison est-elle gratuite ?", attendu: "livraison" },
  { question: "Comment résilier mon abonnement ?", attendu: "abonnement" },
  { question: "Combien de temps dure la garantie de ma machine à espresso ?", attendu: "garantie" },
  { question: "Quels sont les horaires de la boutique de Vevey ?", attendu: "boutique" },
  { question: "Quand mes points de fidélité expirent-ils ?", attendu: "fidelite" },
  { question: "Le café aromatisé peut-il contenir des noisettes ?", attendu: "allergenes" },
  { question: "Puis-je payer avec TWINT ?", attendu: "paiement" },
  { question: "Livrez-vous en France ?", attendu: "livraison" },
  { question: "Proposez-vous des cours de barista ?", attendu: null },
  { question: "Quel est le prix d'une machine à espresso ?", attendu: null },
  { question: "Quel est le salaire des employés ?", attendu: null },
  { question: "Acceptez-vous les bitcoins ?", attendu: null },
];

/** Informations d'erreur produites par le harnais Python. */
export interface PyErrorInfo {
  type: string;
  message: string;
  line: number | null;
  text: string | null;
  offset?: number | null;
  summary: string;
  frames: { line: number; name: string; text: string }[];
}

interface Explanation {
  title: string;
  /** Explication en français, orientée vers l'action. */
  hint: string;
}

/** Traduction pédagogique des erreurs fréquentes. Le message original reste toujours affiché. */
export function explainError(err: PyErrorInfo): Explanation {
  const m = err.message;
  switch (err.type) {
    case "SyntaxError":
      if (/expected ':'/.test(m)) return { title: "Erreur de syntaxe", hint: "Il manque probablement « : » à la fin d'une ligne for, if, def ou while." };
      if (/was never closed|unmatched/.test(m))
        return { title: "Erreur de syntaxe", hint: "Une parenthèse, un crochet ou une accolade n'est pas fermé (ou fermé en trop)." };
      if (/unterminated string/.test(m)) return { title: "Erreur de syntaxe", hint: "Une chaîne de caractères n'est pas fermée : vérifie les guillemets." };
      return { title: "Erreur de syntaxe", hint: "Python ne peut pas lire le code tel qu'il est écrit. Regarde la ligne indiquée et celle juste avant." };
    case "IndentationError":
    case "TabError":
      return {
        title: "Erreur d'indentation",
        hint: "En Python, l'indentation (le décalage en début de ligne) définit les blocs. Le corps d'un for, if ou def doit être décalé de 4 espaces, de façon cohérente.",
      };
    case "NameError": {
      const name = /name '([^']+)'/.exec(m)?.[1];
      if (name === "___") return { title: "Code à compléter", hint: "Il reste des « ___ » à remplacer par ton propre code." };
      return {
        title: "Nom inconnu",
        hint: name
          ? `Python ne connaît pas « ${name} » à ce moment-là. Faute de frappe ? Variable utilisée avant d'être créée ? Variable créée dans une autre fonction ?`
          : "Une variable ou une fonction est utilisée avant d'avoir été définie.",
      };
    }
    case "UnboundLocalError":
      return {
        title: "Variable locale non initialisée",
        hint: "La variable est lue avant d'avoir reçu une valeur dans la fonction. C'est souvent un accumulateur créé dans une boucle qui ne s'est jamais exécutée (liste vide).",
      };
    case "TypeError":
      if (/unsupported operand|can only concatenate|must be str/.test(m))
        return { title: "Types incompatibles", hint: "Tu combines deux valeurs de types différents (par exemple un nombre et du texte). Vérifie le type de chaque valeur avec type(x)." };
      if (/not subscriptable/.test(m)) return { title: "Accès par index impossible", hint: "Tu utilises [ ] sur une valeur qui n'est ni une liste, ni un dictionnaire, ni une chaîne." };
      if (/positional argument|required/.test(m))
        return { title: "Mauvais nombre d'arguments", hint: "La fonction est appelée avec un nombre d'arguments différent de celui de sa définition." };
      if (/not iterable/.test(m)) return { title: "Valeur non parcourable", hint: "for … in … attend une séquence (liste, chaîne, dictionnaire…). Vérifie ce que tu parcours." };
      return { title: "Erreur de type", hint: "Une opération reçoit une valeur d'un type inattendu." };
    case "ZeroDivisionError":
      return { title: "Division par zéro", hint: "Le dénominateur vaut 0. Quel cas limite produit ce zéro (liste vide, aucun élément retenu) ? Traite-le avant de diviser." };
    case "KeyError":
      return { title: "Clé absente", hint: `Le dictionnaire ne contient pas la clé ${m}. Vérifie l'orthographe exacte de la clé (accents, majuscules).` };
    case "IndexError":
      return { title: "Index hors limites", hint: "Tu accèdes à une position qui n'existe pas. Une liste de n éléments a des index de 0 à n − 1." };
    case "AttributeError":
      return { title: "Attribut ou méthode inexistant", hint: "Cette valeur n'a pas l'attribut ou la méthode demandé. Vérifie son type et l'orthographe." };
    case "ValueError":
      return { title: "Valeur invalide", hint: "Le type est correct mais la valeur ne convient pas (par exemple int(\"abc\"))." };
    case "RecursionError":
      return { title: "Récursion trop profonde", hint: "Une fonction s'appelle elle-même sans condition d'arrêt atteignable." };
    case "MemoryError":
      return { title: "Mémoire insuffisante", hint: "Le programme crée des données trop volumineuses pour le navigateur." };
    case "ModuleNotFoundError":
      return { title: "Module indisponible", hint: "Ce module n'est pas disponible dans l'environnement d'exercice du navigateur." };
    default:
      return { title: err.type, hint: "Lis le message d'erreur : il indique le type d'erreur et la ligne concernée." };
  }
}

import { describe, expect, it } from "vitest";
import { exerciseById, exercises, lessonBoucles } from "./fixtures";
import { grade, trace } from "./pyodide";

/**
 * Vérification de chaque exercice par exécution réelle :
 * - la solution de référence réussit tous les tests ;
 * - le code de départ échoue ;
 * - des solutions alternatives correctes réussissent (on teste le comportement, pas le texte) ;
 * - des erreurs typiques échouent sur le bon cas et produisent la bonne étiquette d'erreur.
 */

describe("exercices Python — boucles", () => {
  for (const ex of exercises) {
    it(`${ex.id} : la solution de référence réussit tous les tests`, async () => {
      const r = await grade(ex, ex.referenceSolution);
      expect(r.tests.filter((t) => !t.passed)).toEqual([]);
      expect(r.status).toBe("passed");
    });
    it(`${ex.id} : le code de départ ne réussit pas`, async () => {
      const r = await grade(ex, ex.starterCode);
      expect(r.status).not.toBe("passed");
    });
    it(`${ex.id} : au moins un test caché et un test visible`, () => {
      expect(ex.tests.some((t) => t.hidden)).toBe(true);
      expect(ex.tests.some((t) => !t.hidden)).toBe(true);
    });
  }

  it("CA net : solution alternative avec sum() acceptée", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `def chiffre_affaires_net(transactions):
    ventes = sum(t["montant"] for t in transactions if t["type"] == "vente")
    rembourse = sum(t["montant"] for t in transactions if t["type"] == "remboursement")
    return round(ventes - rembourse, 2)`;
    expect((await grade(ex, code)).status).toBe("passed");
  });

  it("CA net : solution alternative avec match/case et dictionnaire de signes acceptée", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `SIGNE = {"vente": 1, "remboursement": -1}
def chiffre_affaires_net(transactions):
    total = 0.0
    for t in transactions:
        total += SIGNE.get(t["type"], 0) * t["montant"]
    return round(total, 2)`;
    expect((await grade(ex, code)).status).toBe("passed");
  });

  it("CA net : additionner les remboursements est détecté", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] != "annulation":
            total += t["montant"]
    return round(total, 2)`;
    const r = await grade(ex, code);
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("signe-remboursement");
  });

  it("CA net : oublier l'arrondi est détecté", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `def chiffre_affaires_net(transactions):
    total = 0
    for t in transactions:
        if t["type"] == "vente":
            total += t["montant"]
        elif t["type"] == "remboursement":
            total -= t["montant"]
    return total`;
    const r = await grade(ex, code);
    expect(r.misconceptions).toContain("arrondi-flottant");
  });

  it("CA net : modifier la liste reçue est détecté", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `def chiffre_affaires_net(transactions):
    total = 0
    while transactions:
        t = transactions.pop()
        if t["type"] == "vente":
            total += t["montant"]
        elif t["type"] == "remboursement":
            total -= t["montant"]
    return round(total, 2)`;
    const r = await grade(ex, code);
    expect(r.status).toBe("failed");
    expect(r.misconceptions).toContain("mutation-argument");
  });

  it("CA net : print au lieu de return est diagnostiqué", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const code = `def chiffre_affaires_net(transactions):
    print(42)`;
    const r = await grade(ex, code);
    expect(r.misconceptions).toContain("valeur-retour");
  });

  it("guidé : les ___ restants sont signalés", async () => {
    const ex = exerciseById("py-boucles-ex1-remboursements");
    const r = await grade(ex, ex.starterCode);
    expect(r.placeholder).toBe(true);
    expect(r.tests[0].error?.type).toBe("NameError");
  });

  it("guidé : m <= 0 est détecté sur le cas du zéro", async () => {
    const ex = exerciseById("py-boucles-ex1-remboursements");
    const r = await grade(ex, ex.referenceSolution.replace("m < 0", "m <= 0"));
    expect(r.misconceptions).toEqual(["condition-inversee"]);
  });

  it("débogage : le code de départ révèle les deux bugs", async () => {
    const ex = exerciseById("py-boucles-ex3-debug-panier");
    const r = await grade(ex, ex.starterCode);
    expect(r.stdout.trim()).toBe("50.0");
    expect(r.misconceptions).toEqual(expect.arrayContaining(["accumulateur-reinitialise", "liste-vide", "division-zero"]));
    expect(r.tests.find((t) => t.id === "t3")?.error?.type).toBe("UnboundLocalError");
    expect(r.tests.find((t) => t.id === "t4")?.error?.type).toBe("ZeroDivisionError");
  });

  it("débogage : corriger un seul bug ne suffit pas", async () => {
    const ex = exerciseById("py-boucles-ex3-debug-panier");
    const oneFix = `def panier_moyen(montants):
    total = 0
    nombre = 0
    for m in montants:
        if m > 0:
            total = total + m
            nombre = nombre + 1
    return round(total / nombre, 2)`;
    const r = await grade(ex, oneFix);
    expect(r.status).toBe("failed");
    expect(r.passedCount).toBe(4);
  });

  it("erreur de syntaxe : ligne et type remontés", async () => {
    const ex = exerciseById("py-boucles-validation");
    const r = await grade(ex, "def somme_au_dessus(montants, seuil)\n    return 0\n");
    expect(r.status).toBe("error");
    expect(r.loadError?.type).toBe("SyntaxError");
    expect(r.loadError?.line).toBe(1);
  });

  it("fonction absente : signalée", async () => {
    const ex = exerciseById("py-boucles-validation");
    const r = await grade(ex, "def autre():\n    return 1\n");
    expect(r.missingFunction).toBe(true);
  });

  it("les valeurs attendues des tests cachés ne sont pas exposées au rapport", async () => {
    const ex = exerciseById("py-boucles-ex2-ca-net");
    const r = await grade(ex, ex.starterCode);
    for (const t of r.tests.filter((t) => t.hidden)) {
      expect(t.expected).toBeUndefined();
      expect(t.args).toBeUndefined();
      expect(t.got).toBeUndefined();
    }
  });
});

describe("visualisation de la boucle", () => {
  it("chaque étape de la trace rédigée correspond à la trace réelle sys.settrace", async () => {
    const block = lessonBoucles.sections.flatMap((s) => s.blocks).find((b) => b.type === "trace");
    if (!block || block.type !== "trace") throw new Error("trace manquante");
    const real = await trace(block.code, ["montants", "total", "m"]);
    const authored = block.steps.filter((s) => s.line > 0);
    expect(authored.map((s) => s.line)).toEqual(real.steps.map((s) => s.line));
    authored.forEach((s, i) => expect(s.vars).toEqual(real.steps[i].vars));
    const final = block.steps[block.steps.length - 1];
    expect(final.output).toBe(real.stdout.trim());
  });

  it("les prédictions sont justes (exécution réelle)", async () => {
    const preds = lessonBoucles.sections.flatMap((s) => s.blocks).filter((b) => b.type === "prediction");
    const expected: Record<string, string> = { "pred-sans-condition": "215", "pred-init-dans-boucle": "80" };
    for (const p of preds) {
      if (p.type !== "prediction" || !p.code) continue;
      const code = p.code.includes("print") ? p.code : p.code + "\nprint(total)";
      const out = (await trace(code, [])).stdout.trim();
      expect(out).toBe(expected[p.id]);
      expect(p.choices.find((c) => c.id === p.answer)?.label).toBe(out);
    }
  });
});

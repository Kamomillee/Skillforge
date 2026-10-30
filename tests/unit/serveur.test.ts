import { describe, expect, it } from "vitest";
import { exerciseById, lessons } from "../../src/content";
import { tutorPayload, type TutorContext } from "../../src/domain/tutor";
import { claudeProvider, MODELE } from "../../server/claude";
import { handleTutor, Limiter, payloadSchema, simulatedProvider, systemPrompt, userPrompt } from "../../server/tuteur";

const ctx = (exId: string, over: Partial<TutorContext> = {}): TutorContext => {
  const exercise = exerciseById.get(exId)!;
  const lesson = lessons.find((l) => l.validationExerciseId === exId);
  return { exercise, lesson, code: exercise.starterCode, attempts: [], allAttempts: [], hintLevel: 0, turn: 0, ...over };
};

/** Faux fetch : capture la requête envoyée à l'API et renvoie une réponse au format Messages. */
function fakeFetch(reply: { status?: number; body: unknown }) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { f, calls };
}

const message = (stop_reason: string, text: string) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: MODELE,
  content: text ? [{ type: "text", text }] : [],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
});

describe("serveur — contexte envoyé au tuteur IA", () => {
  it("chaque exercice produit un contexte accepté par le serveur", () => {
    for (const id of exerciseById.keys()) {
      const r = payloadSchema.safeParse(JSON.parse(JSON.stringify(tutorPayload("deboguer", ctx(id)))));
      expect(r.success, `${id} : ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });

  it("le prompt contient les résultats réels mais pas la solution avant le niveau 4", () => {
    const ex = exerciseById.get("py-boucles-validation")!;
    const p = payloadSchema.parse(JSON.parse(JSON.stringify(tutorPayload("deboguer", ctx(ex.id, { hintLevel: 2 }), "pourquoi ?"))));
    const u = userPrompt(p);
    expect(u).toContain("Niveau d'aide déjà vu : 2/4");
    expect(u).toContain("pourquoi ?");
    expect(u).not.toContain(ex.referenceSolution.trim());
    expect(systemPrompt()).toMatch(/Ne donne JAMAIS la solution complète/);
  });
});

describe("serveur — règles de la route /api/tuteur", () => {
  const ok = JSON.parse(JSON.stringify(tutorPayload("expliquer", ctx("sql-agg-validation"))));

  it("sans fournisseur : 503, sans appel", async () => {
    expect((await handleTutor(ok, null, new Limiter(5, 5), "a")).status).toBe(503);
  });
  it("contexte invalide ou champ trop long : 400", async () => {
    const p = simulatedProvider();
    expect((await handleTutor({ mode: "pirate" }, p, new Limiter(5, 5), "a")).status).toBe(400);
    expect((await handleTutor({ ...ok, code: "x".repeat(9000) }, p, new Limiter(5, 5), "a")).status).toBe(400);
  });
  it("limite par minute et plafond quotidien : 429", async () => {
    const p = simulatedProvider();
    const lim = new Limiter(2, 3);
    expect((await handleTutor(ok, p, lim, "a")).status).toBe(200);
    expect((await handleTutor(ok, p, lim, "a")).status).toBe(200);
    expect((await handleTutor(ok, p, lim, "a")).status).toBe(429);
    expect((await handleTutor(ok, p, lim, "b")).status).toBe(200);
    expect((await handleTutor(ok, p, lim, "c")).status).toBe(429);
  });
  it("refus du modèle : 422, le navigateur repasse au tuteur local", async () => {
    const r = await handleTutor({ ...ok, question: "REFUS-SIMULE" }, simulatedProvider(), new Limiter(5, 5), "a");
    expect(r.status).toBe(422);
  });
});

describe("serveur — fournisseur Claude (réseau simulé, aucune clé réelle)", () => {
  it("appelle le bon modèle, avec les fallbacks et la bêta correspondante, et lit le texte", async () => {
    const { f, calls } = fakeFetch({ body: message("end_turn", "Regarde ton accumulateur.") });
    const p = claudeProvider({ apiKey: "cle-de-test", fetch: f, maxRetries: 0 });
    expect(await p.answer("sys", "user")).toEqual({ text: "Regarde ton accumulateur." });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" }, system: "sys" });
    expect(calls[0].headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });
  it("stop_reason refusal : signalé comme refus, pas comme texte", async () => {
    const { f } = fakeFetch({ body: message("refusal", "") });
    expect(await claudeProvider({ apiKey: "k", fetch: f, maxRetries: 0 }).answer("s", "u")).toEqual({ refused: true });
  });
  it("erreurs typées : clé refusée → 503, limite → 429, sans divulguer la clé", async () => {
    const auth = fakeFetch({ status: 401, body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } });
    const r1 = await handleTutor(JSON.parse(JSON.stringify(tutorPayload("expliquer", ctx("sql-agg-validation")))), claudeProvider({ apiKey: "cle-secrete-123", fetch: auth.f, maxRetries: 0 }), new Limiter(5, 5), "a");
    expect(r1.status).toBe(503);
    expect(JSON.stringify(r1.body)).not.toContain("cle-secrete-123");
    const rate = fakeFetch({ status: 429, body: { type: "error", error: { type: "rate_limit_error", message: "slow down" } } });
    const r2 = await handleTutor(JSON.parse(JSON.stringify(tutorPayload("expliquer", ctx("sql-agg-validation")))), claudeProvider({ apiKey: "k", fetch: rate.f, maxRetries: 0 }), new Limiter(5, 5), "a");
    expect(r2.status).toBe(429);
  });
});

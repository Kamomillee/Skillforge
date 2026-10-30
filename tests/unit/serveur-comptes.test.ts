import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exerciseById } from "../../src/content";
import { tutorPayload } from "../../src/domain/tutor";
import { createApp, CSP } from "../../server/app";
import { claudeProvider } from "../../server/claude";
import { openDatabase, purge, type Db } from "../../server/db";
import { Logger } from "../../server/observabilite";
import { simulatedProvider, type Provider } from "../../server/tuteur";

/**
 * Serveur réel (HTTP sur un port éphémère, base SQLite en mémoire), fournisseur IA simulé ou fetch simulé :
 * aucune clé réelle, aucun appel réseau sortant, aucune facturation.
 */

const CODE_ETUDIANT = "def total_net(montants):\n    return 'CODE-PRIVE-ETUDIANT'";
const payload = () => {
  const exercise = exerciseById.get("py-boucles-validation")!;
  return JSON.parse(JSON.stringify(tutorPayload("deboguer", { exercise, code: CODE_ETUDIANT, attempts: [], allAttempts: [], hintLevel: 0, turn: 0 })));
};

const exportVide = (marque = "") => ({ format: "skillforge-export", formatVersion: 1, exportedAt: new Date().toISOString(), kv: { marque: { text: marque } }, drafts: [], attempts: [], events: [], reviews: [] });

interface Started {
  base: string;
  server: Server;
  db: Db;
  logs: string[];
  calls: { n: number };
}

async function start(opts: { provider?: Provider | null; requestsPerDay?: number } = {}): Promise<Started> {
  const dist = mkdtempSync(join(tmpdir(), "sf-dist-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>SkillForge</title>");
  const db = openDatabase(":memory:");
  const logs: string[] = [];
  const calls = { n: 0 };
  const inner = opts.provider === undefined ? simulatedProvider() : opts.provider;
  const provider: Provider | null = inner && { ...inner, answer: (s, u) => (calls.n++, inner.answer(s, u)) };
  const app = createApp({
    db,
    provider,
    logger: new Logger((l) => logs.push(l)),
    config: { dist, adminEmails: ["prof@example.ch"], budget: { requestsPerDay: opts.requestsPerDay ?? 30, tokensPerDay: 60_000 }, cookieSecure: false, aiPerMinute: 100, aiPerDay: 1000 },
  });
  const server = createServer(app);
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server, db, logs, calls };
}

/** Petit client avec cookie, comme un navigateur. */
function client(base: string) {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const r = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json", "x-skillforge": "1", ...(cookie ? { cookie } : {}), ...headers },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      });
      const sc = r.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
      const text = await r.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: r.status, json, headers: r.headers };
    },
  };
}

async function inscrit(base: string, email: string, password = "mot-de-passe-solide") {
  const c = client(base);
  const r = await c.call("POST", "/api/comptes", { email, password, name: email.split("@")[0] });
  expect(r.status).toBe(201);
  return c;
}

describe("serveur — comptes, sessions et protection CSRF", () => {
  let s: Started;
  beforeAll(async () => (s = await start()));
  afterAll(() => s.server.close());

  it("inscription : cookie de session HttpOnly et SameSite=Strict, mot de passe jamais renvoyé", async () => {
    const c = client(s.base);
    const r = await c.call("POST", "/api/comptes", { email: "Alice@Example.ch", password: "mot-de-passe-solide", name: "Alice" });
    expect(r.status).toBe(201);
    expect(r.json.utilisateur).toMatchObject({ email: "alice@example.ch", role: "etudiant" });
    expect(JSON.stringify(r.json)).not.toContain("mot-de-passe");
    expect(r.headers.get("set-cookie")).toMatch(/sf_session=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=2592000/);
    expect((await c.call("GET", "/api/moi")).json.utilisateur.email).toBe("alice@example.ch");
    // Stockage : hachage scrypt, jamais le mot de passe en clair.
    const row = s.db.prepare("SELECT pwd_hash FROM users WHERE email = 'alice@example.ch'").get() as { pwd_hash: string };
    expect(row.pwd_hash).toMatch(/^scrypt\$/);
    expect(row.pwd_hash).not.toContain("mot-de-passe-solide");
  });

  it("refus : mot de passe trop court, e-mail invalide, compte existant", async () => {
    const c = client(s.base);
    expect((await c.call("POST", "/api/comptes", { email: "b@example.ch", password: "court" })).json.erreur).toMatch(/10 caractères/);
    expect((await c.call("POST", "/api/comptes", { email: "pas-un-email", password: "mot-de-passe-solide" })).status).toBe(400);
    expect((await c.call("POST", "/api/comptes", { email: "alice@example.ch", password: "mot-de-passe-solide" })).status).toBe(409);
  });

  it("connexion : même message pour un e-mail inconnu et un mauvais mot de passe ; déconnexion invalide la session", async () => {
    const c = client(s.base);
    const a = await c.call("POST", "/api/session", { email: "alice@example.ch", password: "mauvais-mot-de-passe" });
    const b = await c.call("POST", "/api/session", { email: "inconnu@example.ch", password: "mauvais-mot-de-passe" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.erreur).toBe(b.json.erreur);
    expect((await c.call("POST", "/api/session", { email: "alice@example.ch", password: "mot-de-passe-solide" })).status).toBe(200);
    const ancien = c.cookie;
    expect((await c.call("DELETE", "/api/session")).status).toBe(204);
    expect((await client(s.base).call("GET", "/api/moi", undefined, { cookie: ancien })).status).toBe(401);
  });

  it("CSRF : une modification sans l'en-tête x-skillforge ou depuis une autre origine est refusée", async () => {
    const r1 = await fetch(`${s.base}/api/comptes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "c@example.ch", password: "mot-de-passe-solide" }) });
    expect(r1.status).toBe(403);
    const r2 = await client(s.base).call("POST", "/api/comptes", { email: "c@example.ch", password: "mot-de-passe-solide" }, { origin: "https://site-malveillant.example" });
    expect(r2.status).toBe(403);
    expect(s.db.prepare("SELECT COUNT(*) n FROM users WHERE email = 'c@example.ch'").get()).toEqual({ n: 0 });
  });

  it("trop de tentatives de connexion : 429", async () => {
    const c = client(s.base);
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await c.call("POST", "/api/session", { email: "cible@example.ch", password: `essai-${i}-xxxxxx` })).status);
    expect(codes.slice(0, 10).every((x) => x === 401)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});

describe("serveur — isolation des données entre comptes", () => {
  let s: Started;
  beforeAll(async () => (s = await start()));
  afterAll(() => s.server.close());

  it("un compte ne peut ni lire ni modifier la progression, les signalements ou la consommation d'un autre", async () => {
    const a = await inscrit(s.base, "a@example.ch");
    const b = await inscrit(s.base, "b@example.ch");
    expect((await a.call("PUT", "/api/progression", { baseRevision: 0, data: exportVide("donnée privée de A") })).status).toBe(200);
    const rep = await a.call("POST", "/api/signalements", { kind: "exercice", target: "py-boucles-validation", targetVersion: 1, message: "Le test caché 3 semble faux." });
    expect(rep.status).toBe(201);
    expect((await a.call("POST", "/api/tuteur", payload())).status).toBe(200);

    // B voit SA progression (vide), pas celle de A.
    expect((await b.call("GET", "/api/progression")).json).toEqual({ revision: 0, updatedAt: null, data: null });
    // Ressource d'un autre compte : 404, indiscernable d'une ressource inexistante.
    expect((await b.call("GET", `/api/signalements/${rep.json.id}`)).status).toBe(404);
    expect((await b.call("GET", "/api/signalements")).json).toEqual([]);
    expect((await b.call("GET", "/api/consommation")).json.executions).toEqual([]);
    // Routes d'administration : interdites à un étudiant, même pour lire.
    expect((await b.call("GET", "/api/admin/signalements")).status).toBe(403);
    expect((await b.call("PATCH", `/api/admin/signalements/${rep.json.id}`, { status: "rejete" })).status).toBe(403);
    // Sans session : 401 partout.
    const anon = client(s.base);
    for (const p of ["/api/progression", "/api/signalements", `/api/signalements/${rep.json.id}`, "/api/consommation", "/api/moi/export"]) expect((await anon.call("GET", p)).status, p).toBe(401);
    // A, lui, retrouve tout.
    expect((await a.call("GET", "/api/progression")).json.data.kv.marque.text).toBe("donnée privée de A");
    expect((await a.call("GET", `/api/signalements/${rep.json.id}`)).json.message).toContain("test caché 3");
  });

  it("un cookie inventé ou expiré ne donne accès à rien", async () => {
    expect((await client(s.base).call("GET", "/api/moi", undefined, { cookie: "sf_session=invente" })).status).toBe(401);
    const c = await inscrit(s.base, "expire@example.ch");
    s.db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = (SELECT id FROM users WHERE email = 'expire@example.ch')").run();
    expect((await c.call("GET", "/api/moi")).status).toBe(401);
  });
});

describe("serveur — synchronisation de la progression sans écrasement silencieux", () => {
  let s: Started;
  beforeAll(async () => (s = await start()));
  afterAll(() => s.server.close());

  it("révisions : une version partie d'une base périmée est refusée (409) avec la version du serveur", async () => {
    const c = await inscrit(s.base, "sync@example.ch");
    expect((await c.call("PUT", "/api/progression", { baseRevision: 0, data: exportVide("ordinateur") })).json.revision).toBe(1);
    const conflit = await c.call("PUT", "/api/progression", { baseRevision: 0, data: exportVide("téléphone") });
    expect(conflit.status).toBe(409);
    expect(conflit.json.revision).toBe(1);
    expect(conflit.json.data.kv.marque.text).toBe("ordinateur");
    expect((await c.call("PUT", "/api/progression", { baseRevision: 1, data: exportVide("téléphone") })).json.revision).toBe(2);
  });

  it("format invalide : 400 ; trop gros : 413", async () => {
    const c = await inscrit(s.base, "sync2@example.ch");
    expect((await c.call("PUT", "/api/progression", { baseRevision: 0, data: { format: "autre" } })).status).toBe(400);
    const gros = { baseRevision: 0, data: { ...exportVide(), kv: { x: "a".repeat(2_200_000) } } };
    expect((await c.call("PUT", "/api/progression", gros)).status).toBe(413);
  });
});

describe("serveur — tuteur IA : sans clé, clé invalide, budget dépassé", () => {
  it("sans session : 401 ; serveur sans fournisseur : 503 ; aucun appel", async () => {
    const s = await start({ provider: null });
    expect((await client(s.base).call("POST", "/api/tuteur", payload())).status).toBe(401);
    const c = await inscrit(s.base, "sanscle@example.ch");
    const r = await c.call("POST", "/api/tuteur", payload());
    expect(r.status).toBe(503);
    expect(r.json.erreur).toMatch(/non configuré/);
    s.server.close();
  });

  it("clé invalide : erreur explicite (503), consommation enregistrée comme erreur, clé jamais dans les journaux", async () => {
    const f = (async () => new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;
    const s = await start({ provider: claudeProvider({ apiKey: "sk-ant-cle-invalide-123", fetch: f, maxRetries: 0 }) });
    const c = await inscrit(s.base, "clefausse@example.ch");
    const r = await c.call("POST", "/api/tuteur", payload());
    expect(r.status).toBe(503);
    expect(r.json.erreur).toBe("clé API refusée par le fournisseur");
    expect((await c.call("GET", "/api/consommation")).json.executions[0]).toMatchObject({ status: "erreur", inputTokens: 0 });
    expect(s.logs.join("\n")).not.toContain("sk-ant-cle-invalide-123");
    s.server.close();
  });

  it("budget par compte : la demande au-delà du budget est refusée AVANT d'appeler le fournisseur ; les autres comptes ne sont pas touchés", async () => {
    const s = await start({ requestsPerDay: 2 });
    const a = await inscrit(s.base, "budget@example.ch");
    expect((await a.call("POST", "/api/tuteur", payload())).status).toBe(200);
    expect((await a.call("POST", "/api/tuteur", payload())).status).toBe(200);
    const r = await a.call("POST", "/api/tuteur", payload());
    expect(r.status).toBe(429);
    expect(r.json.erreur).toMatch(/budget IA du jour atteint \(2 demandes\)/);
    expect(s.calls.n).toBe(2);
    const b = await inscrit(s.base, "autre@example.ch");
    expect((await b.call("POST", "/api/tuteur", payload())).status).toBe(200);
    // Consommation : celle du fournisseur simulé est une ESTIMATION, signalée comme telle.
    const conso = (await a.call("GET", "/api/consommation")).json;
    expect(conso.aujourdhui).toMatchObject({ requests: 2, estimated: true });
    expect(conso.executions).toHaveLength(2);
    expect(conso.executions.every((e: { estimated: boolean; inputTokens: number }) => e.estimated && e.inputTokens > 0)).toBe(true);
    s.server.close();
  });

  it("consommation réelle : les jetons enregistrés sont ceux renvoyés par l'API, non estimés", async () => {
    const f = (async () =>
      new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "Regarde ta boucle." }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 812, output_tokens: 64 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const s = await start({ provider: claudeProvider({ apiKey: "k", fetch: f, maxRetries: 0 }) });
    const c = await inscrit(s.base, "reel@example.ch");
    expect((await c.call("POST", "/api/tuteur", payload())).json.texte).toBe("Regarde ta boucle.");
    expect((await c.call("GET", "/api/consommation")).json.executions[0]).toMatchObject({ inputTokens: 812, outputTokens: 64, estimated: false, status: "ok" });
    s.server.close();
  });
});

describe("serveur — administration, export et suppression des données", () => {
  let s: Started;
  beforeAll(async () => (s = await start()));
  afterAll(() => s.server.close());

  it("circuit d'un signalement : l'étudiant signale, l'administration traite, l'étudiant voit la réponse", async () => {
    const etu = await inscrit(s.base, "etu@example.ch");
    const prof = await inscrit(s.base, "prof@example.ch");
    expect((await prof.call("GET", "/api/moi")).json.utilisateur.role).toBe("admin");
    const { json } = await etu.call("POST", "/api/signalements", { kind: "lecon", target: "sql-requetes-jointures", message: "Le schéma de LEFT JOIN inverse les tables." });
    const liste = (await prof.call("GET", "/api/admin/signalements?statut=nouveau")).json;
    expect(liste.map((r: { id: number }) => r.id)).toContain(json.id);
    // L'administration ne voit pas l'e-mail de l'auteur.
    expect(JSON.stringify(liste)).not.toContain("etu@example.ch");
    expect((await prof.call("PATCH", `/api/admin/signalements/${json.id}`, { status: "corrige", note: "Schéma corrigé dans la version 2." })).status).toBe(200);
    expect((await etu.call("GET", `/api/signalements/${json.id}`)).json).toMatchObject({ status: "corrige", note: "Schéma corrigé dans la version 2." });
    expect((await prof.call("PATCH", `/api/admin/signalements/${json.id}`, { status: "inconnu" })).status).toBe(400);
    expect((await prof.call("PATCH", "/api/admin/signalements/99999", { status: "rejete" })).status).toBe(404);
  });

  it("statistiques et métriques : agrégats seulement, réservés à l'administration", async () => {
    const prof = client(s.base);
    await prof.call("POST", "/api/session", { email: "prof@example.ch", password: "mot-de-passe-solide" });
    const st = (await prof.call("GET", "/api/admin/statistiques")).json;
    expect(st).toMatchObject({ comptes: 2, signalements: { corrige: 1 } });
    expect(JSON.stringify(st)).not.toMatch(/@/);
    await client(s.base).call("POST", "/api/erreurs-client", { message: "TypeError: x is undefined", route: "#/lecon/a?b=c" });
    const me = (await prof.call("GET", "/api/admin/metriques")).json;
    expect(me.erreursClient).toBe(1);
    expect(me.routes.find((r: { route: string }) => r.route === "PATCH /api/admin/signalements/:id")).toMatchObject({ requetes: 3 });
    expect((await client(s.base).call("GET", "/api/admin/metriques")).status).toBe(401);
  });

  it("export du compte : toutes les données détenues, sans hachage de mot de passe", async () => {
    const c = await inscrit(s.base, "export@example.ch");
    await c.call("PUT", "/api/progression", { baseRevision: 0, data: exportVide("à exporter") });
    await c.call("POST", "/api/tuteur", payload());
    await c.call("POST", "/api/signalements", { kind: "tuteur", target: "py-boucles-validation", message: "Réponse confuse." });
    const r = await c.call("GET", "/api/moi/export");
    expect(r.headers.get("content-disposition")).toMatch(/attachment/);
    expect(r.json).toMatchObject({ format: "skillforge-compte", compte: { email: "export@example.ch" }, progression: { revision: 1 } });
    expect(r.json.executionsIA).toHaveLength(1);
    expect(r.json.signalements).toHaveLength(1);
    expect(JSON.stringify(r.json)).not.toMatch(/scrypt|pwd_hash|token_hash/);
  });

  it("suppression du compte : mot de passe exigé, données effacées, signalements anonymisés", async () => {
    const c = await inscrit(s.base, "partir@example.ch");
    await c.call("PUT", "/api/progression", { baseRevision: 0, data: exportVide() });
    await c.call("POST", "/api/tuteur", payload());
    const rep = await c.call("POST", "/api/signalements", { kind: "exercice", target: "sql-agg-validation", message: "Énoncé ambigu." });
    expect((await c.call("DELETE", "/api/moi", { password: "faux" })).status).toBe(403);
    expect((await c.call("DELETE", "/api/moi", { password: "mot-de-passe-solide" })).status).toBe(204);
    expect((await client(s.base).call("POST", "/api/session", { email: "partir@example.ch", password: "mot-de-passe-solide" })).status).toBe(401);
    const n = (sql: string) => (s.db.prepare(sql).get() as { n: number }).n;
    expect(n("SELECT COUNT(*) n FROM users WHERE email = 'partir@example.ch'")).toBe(0);
    expect(n("SELECT COUNT(*) n FROM progress WHERE user_id NOT IN (SELECT id FROM users)")).toBe(0);
    expect(n("SELECT COUNT(*) n FROM ai_runs WHERE user_id NOT IN (SELECT id FROM users)")).toBe(0);
    expect(n("SELECT COUNT(*) n FROM sessions WHERE user_id NOT IN (SELECT id FROM users)")).toBe(0);
    expect(s.db.prepare("SELECT user_id FROM reports WHERE id = ?").get(rep.json.id)).toEqual({ user_id: null });
  });
});

describe("serveur — journaux, en-têtes de sécurité, conservation", () => {
  it("journaux structurés : route, statut, durée ; jamais de mot de passe, de jeton, de code ni de question", async () => {
    const s = await start();
    const c = await inscrit(s.base, "logs@example.ch", "secret-tres-long-42");
    await c.call("POST", "/api/tuteur", { ...payload(), question: "QUESTION-PRIVEE ?" });
    await c.call("POST", "/api/session", { email: "logs@example.ch", password: "mauvais-secret-99" });
    const all = s.logs.join("\n");
    const lines = s.logs.map((l) => JSON.parse(l));
    expect(lines.some((l) => l.evenement === "requete" && l.route === "/api/tuteur" && l.statut === 200 && typeof l.ms === "number" && typeof l.compte === "number")).toBe(true);
    expect(lines.some((l) => l.evenement === "connexion-refusee")).toBe(true);
    for (const secret of ["secret-tres-long-42", "mauvais-secret-99", c.cookie.split("=")[1], "CODE-PRIVE-ETUDIANT", "QUESTION-PRIVEE", "logs@example.ch"]) expect(all, secret).not.toContain(secret);
    s.server.close();
  });

  it("CSP stricte et en-têtes d'isolation sur les pages et l'API ; pas de traversée de répertoire", async () => {
    const s = await start();
    for (const p of ["/", "/api/sante"]) {
      const r = await fetch(s.base + p);
      expect(r.headers.get("content-security-policy")).toBe(CSP);
      expect(r.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    }
    // Scripts : uniquement ceux du site, plus la compilation WebAssembly (Pyodide, PGlite). Ni eval, ni script en ligne.
    expect(CSP.match(/script-src ([^;]*)/)![1]).toBe("'self' 'wasm-unsafe-eval'");
    expect(CSP).not.toContain("*");
    const r = await fetch(`${s.base}/..%2f..%2fetc%2fpasswd`);
    expect([403, 404]).toContain(r.status);
    expect(await r.text()).not.toContain("root:");
    s.server.close();
  });

  it("conservation : sessions expirées, exécutions IA de plus de 90 jours et signalements traités depuis un an sont purgés", () => {
    const db = openDatabase(":memory:");
    db.prepare("INSERT INTO users (id, email, pwd_hash, created_at, last_seen_at) VALUES (1, 'x@y.ch', 'h', '2026-01-01', '2026-01-01')").run();
    db.prepare("INSERT INTO sessions VALUES ('a', 1, '2026-01-01', '2026-02-01'), ('b', 1, '2026-10-01', '2026-11-30')").run();
    db.prepare("INSERT INTO ai_runs (user_id, at, day, model, mode, status) VALUES (1, '2026-07-01T00:00:00Z', '2026-07-01', 'm', 'x', 'ok'), (1, '2026-10-20T00:00:00Z', '2026-10-20', 'm', 'x', 'ok')").run();
    db.prepare(
      "INSERT INTO reports (user_id, at, kind, target, message, status, updated_at) VALUES (1, '2025-01-01', 'lecon', 't', 'm', 'corrige', '2025-01-02'), (1, '2025-01-01', 'lecon', 't', 'm', 'nouveau', '2025-01-02'), (1, '2026-10-01', 'lecon', 't', 'm', 'rejete', '2026-10-02')",
    ).run();
    expect(purge(db, new Date("2026-10-30T12:00:00Z"))).toEqual({ sessions: 1, aiRuns: 1, reports: 1 });
    // Un signalement non traité n'est jamais purgé, même ancien.
    expect(db.prepare("SELECT COUNT(*) n FROM reports WHERE status = 'nouveau'").get()).toEqual({ n: 1 });
  });
});

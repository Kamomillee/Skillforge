/**
 * Application HTTP du serveur SkillForge, sans état global : tout est injecté (base, fournisseur IA,
 * journal), ce qui permet de la tester de bout en bout sur un port éphémère, sans clé ni facturation.
 *
 * Sécurité, appliquée à chaque route :
 * - l'identité vient du cookie de session (HttpOnly, SameSite=Strict), jamais d'un paramètre ;
 * - toute ressource d'étudiant est lue avec `user_id = <compte de la session>` : la ressource d'un autre
 *   compte répond 404, comme une ressource inexistante ;
 * - les requêtes qui modifient exigent l'en-tête `x-skillforge: 1` et, si présent, une origine identique (CSRF) ;
 * - corps limités en taille et validés par schéma ; limitation de débit par adresse.
 */
import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Accounts, SESSION_DAYS, type User } from "./comptes.ts";
import { purge, type Db } from "./db.ts";
import { Logger, Metrics, redact, routeKey } from "./observabilite.ts";
import { Quotas, type Budget } from "./quotas.ts";
import { handleTutor, Limiter, type Provider } from "./tuteur.ts";

export interface AppConfig {
  dist: string;
  adminEmails: string[];
  budget: Budget;
  cookieSecure: boolean;
  aiPerMinute: number;
  aiPerDay: number;
}

export interface AppDeps {
  db: Db;
  provider: Provider | null;
  logger?: Logger;
  config: AppConfig;
}

const MAX_BODY = 64 * 1024;
const MAX_PROGRESS = 2 * 1024 * 1024;
const COOKIE = "sf_session";

/** Politique de sécurité du contenu : aucun script externe ni en ligne ; WebAssembly autorisé (Pyodide, PGlite). */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": CSP,
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".whl": "application/zip",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".data": "application/octet-stream",
  ".py": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Fenêtre glissante par clé (adresse, adresse + e-mail…). */
export class RateWindow {
  private hits = new Map<string, number[]>();
  private max: number;
  private ms: number;
  constructor(max: number, ms: number) {
    this.max = max;
    this.ms = ms;
  }
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.ms);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.clear();
    return true;
  }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const progressSchema = z.object({
  baseRevision: z.number().int().min(0),
  data: z.object({
    format: z.literal("skillforge-export"),
    formatVersion: z.literal(1),
    exportedAt: z.string().max(40),
    kv: z.record(z.string().max(300), z.unknown()),
    drafts: z.array(z.unknown()).max(2000),
    attempts: z.array(z.unknown()).max(20000),
    events: z.array(z.unknown()).max(50000),
    reviews: z.array(z.unknown()).max(2000),
  }),
});

const reportSchema = z.object({
  kind: z.enum(["exercice", "tuteur", "lecon"]),
  target: z.string().trim().min(1).max(120),
  targetVersion: z.number().int().min(0).optional(),
  message: z.string().trim().min(3).max(2000),
});

const reportUpdateSchema = z.object({ status: z.enum(["nouveau", "en-cours", "corrige", "rejete"]), note: z.string().max(1000).default("") });

const clientErrorSchema = z.object({ message: z.string().max(500), route: z.string().max(200).default(""), stack: z.string().max(2000).optional() });

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((ok, ko) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) {
        ko(new HttpError(413, "requête trop grosse"));
        req.resume();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", ko);
  });
}

export function createApp({ db, provider, logger = new Logger(), config }: AppDeps) {
  const accounts = new Accounts(db, config.adminEmails);
  const quotas = new Quotas(db, config.budget);
  const metrics = new Metrics();
  const aiLimiter = new Limiter(config.aiPerMinute, config.aiPerDay);
  const apiWindow = new RateWindow(240, 60_000);
  const loginWindow = new RateWindow(10, 15 * 60_000);
  const registerWindow = new RateWindow(10, 60 * 60_000);
  const clientErrorWindow = new RateWindow(20, 60_000);
  let lastPurge = 0;

  const send = (res: ServerResponse, status: number, body?: unknown, extra: Record<string, string | string[]> = {}) => {
    res.writeHead(status, { ...SECURITY_HEADERS, "cache-control": "no-store", ...(body === undefined ? {} : { "content-type": "application/json; charset=utf-8" }), ...extra });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };

  const sessionCookie = (token: string, maxAge: number) =>
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.cookieSecure ? "; Secure" : ""}`;

  async function jsonBody(req: IncomingMessage, max = MAX_BODY): Promise<unknown> {
    const text = await readBody(req, max);
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new HttpError(400, "JSON invalide");
    }
  }

  function requireUser(user: User | null): User {
    if (!user) throw new HttpError(401, "connexion requise");
    return user;
  }
  function requireAdmin(user: User | null): User {
    const u = requireUser(user);
    if (u.role !== "admin") throw new HttpError(403, "réservé à l'administration");
    return u;
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse, path0: string) {
    let path = normalize(join(config.dist, decodeURIComponent(path0)));
    if (!path.startsWith(config.dist)) return send(res, 403, { erreur: "interdit" });
    try {
      if (statSync(path).isDirectory()) path = join(path, "index.html");
    } catch {
      path = join(config.dist, "index.html");
    }
    try {
      const st = statSync(path);
      const immutable = path.includes(`${join(config.dist, "assets")}`);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
        "content-length": st.size,
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      });
      if (req.method === "HEAD") return res.end();
      createReadStream(path).pipe(res);
    } catch {
      send(res, 404, { erreur: "introuvable" });
    }
  }

  async function api(req: IncomingMessage, res: ServerResponse, path: string, user: User | null, ip: string) {
    const m = req.method ?? "GET";
    const token = cookies(req)[COOKIE];
    const route = `${m} ${path.replace(/\/\d+(?=\/|$)/g, "/:id")}`;
    const id = Number(path.match(/\/(\d+)$/)?.[1]);

    switch (route) {
      case "GET /api/sante":
        return send(res, 200, { ok: true, tuteurIA: !!provider, modele: provider?.model, comptes: true, simule: provider?.name === "simule" });

      case "POST /api/comptes": {
        if (!registerWindow.take(ip)) throw new HttpError(429, "trop de créations de compte depuis cette adresse");
        const r = accounts.register(await jsonBody(req));
        if (!r.ok) throw new HttpError(r.status, r.error);
        const s = accounts.createSession(r.user.id);
        logger.log({ niveau: "info", evenement: "compte-cree", compte: r.user.id });
        return send(res, 201, { utilisateur: r.user }, { "set-cookie": sessionCookie(s.token, SESSION_DAYS * 86400) });
      }
      case "POST /api/session": {
        const body = (await jsonBody(req)) as { email?: unknown };
        if (!loginWindow.take(`${ip}|${String(body.email ?? "").toLowerCase()}`)) throw new HttpError(429, "trop de tentatives, réessaie dans 15 minutes");
        const u = accounts.authenticate(body);
        if (!u) {
          logger.log({ niveau: "alerte", evenement: "connexion-refusee" });
          throw new HttpError(401, "e-mail ou mot de passe incorrect");
        }
        const s = accounts.createSession(u.id);
        logger.log({ niveau: "info", evenement: "connexion", compte: u.id });
        return send(res, 200, { utilisateur: u }, { "set-cookie": sessionCookie(s.token, SESSION_DAYS * 86400) });
      }
      case "DELETE /api/session":
        accounts.endSession(token);
        return send(res, 204, undefined, { "set-cookie": sessionCookie("", 0) });

      case "GET /api/moi":
        return send(res, 200, { utilisateur: requireUser(user) });
      case "GET /api/moi/export": {
        const u = requireUser(user);
        return send(res, 200, accounts.exportUser(u.id), { "content-disposition": `attachment; filename="skillforge-compte-${u.id}.json"` });
      }
      case "DELETE /api/moi": {
        const u = requireUser(user);
        const body = (await jsonBody(req)) as { password?: unknown };
        if (!accounts.passwordMatches(u.id, body.password)) throw new HttpError(403, "mot de passe incorrect : compte non supprimé");
        accounts.deleteUser(u.id);
        logger.log({ niveau: "info", evenement: "compte-supprime", compte: u.id });
        return send(res, 204, undefined, { "set-cookie": sessionCookie("", 0) });
      }

      case "GET /api/progression": {
        const u = requireUser(user);
        const row = db.prepare("SELECT revision, updated_at, data FROM progress WHERE user_id = ?").get(u.id) as { revision: number; updated_at: string; data: string } | undefined;
        return send(res, 200, row ? { revision: row.revision, updatedAt: row.updated_at, data: JSON.parse(row.data) } : { revision: 0, updatedAt: null, data: null });
      }
      case "PUT /api/progression": {
        const u = requireUser(user);
        const p = progressSchema.safeParse(await jsonBody(req, MAX_PROGRESS));
        if (!p.success) throw new HttpError(400, "progression invalide");
        const row = db.prepare("SELECT revision, updated_at, data FROM progress WHERE user_id = ?").get(u.id) as { revision: number; updated_at: string; data: string } | undefined;
        const current = row?.revision ?? 0;
        // Jamais d'écrasement silencieux : la version envoyée doit partir de la dernière version connue du serveur.
        if (p.data.baseRevision !== current) return send(res, 409, { erreur: "la progression a changé ailleurs", revision: current, updatedAt: row?.updated_at, data: row ? JSON.parse(row.data) : null });
        const at = new Date().toISOString();
        db.prepare("INSERT INTO progress (user_id, revision, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, data = excluded.data, updated_at = excluded.updated_at").run(
          u.id,
          current + 1,
          JSON.stringify(p.data.data),
          at,
        );
        return send(res, 200, { revision: current + 1, updatedAt: at });
      }

      case "GET /api/consommation":
        return send(res, 200, quotas.report(requireUser(user).id));

      case "POST /api/tuteur": {
        const u = requireUser(user);
        const r = await handleTutor(await jsonBody(req), provider, aiLimiter, ip, { userId: u.id, quotas, onCall: (s) => metrics.aiCall(s) });
        if (r.status >= 500 || r.status === 429) logger.log({ niveau: "alerte", evenement: "tuteur-ia", statut: r.status, compte: u.id, detail: "erreur" in r.body ? r.body.erreur : undefined });
        return send(res, r.status, r.body);
      }

      case "POST /api/signalements": {
        const u = requireUser(user);
        const p = reportSchema.safeParse(await jsonBody(req));
        if (!p.success) throw new HttpError(400, "signalement invalide");
        const at = new Date().toISOString();
        const r = db.prepare("INSERT INTO reports (user_id, at, kind, target, target_version, message, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(u.id, at, p.data.kind, p.data.target, p.data.targetVersion ?? null, p.data.message, at);
        return send(res, 201, { id: Number(r.lastInsertRowid) });
      }
      case "GET /api/signalements":
        return send(res, 200, db.prepare("SELECT id, at, kind, target, target_version AS targetVersion, message, status, admin_note AS note FROM reports WHERE user_id = ? ORDER BY id DESC").all(requireUser(user).id));
      case "GET /api/signalements/:id": {
        const row = db.prepare("SELECT id, at, kind, target, target_version AS targetVersion, message, status, admin_note AS note FROM reports WHERE id = ? AND user_id = ?").get(id, requireUser(user).id);
        if (!row) throw new HttpError(404, "introuvable");
        return send(res, 200, row);
      }

      case "GET /api/admin/signalements": {
        requireAdmin(user);
        const statut = new URL(req.url ?? "", "http://x").searchParams.get("statut");
        const rows = db
          .prepare(`SELECT id, at, kind, target, target_version AS targetVersion, message, status, admin_note AS note, updated_at AS updatedAt FROM reports ${statut ? "WHERE status = ?" : ""} ORDER BY id DESC LIMIT 500`)
          .all(...(statut ? [statut] : []));
        return send(res, 200, rows);
      }
      case "PATCH /api/admin/signalements/:id": {
        const a = requireAdmin(user);
        const p = reportUpdateSchema.safeParse(await jsonBody(req));
        if (!p.success) throw new HttpError(400, "statut invalide");
        const r = db.prepare("UPDATE reports SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?").run(p.data.status, p.data.note, new Date().toISOString(), id);
        if (!r.changes) throw new HttpError(404, "introuvable");
        logger.log({ niveau: "info", evenement: "signalement-traite", compte: a.id, detail: `#${id} → ${p.data.status}` });
        return send(res, 200, { ok: true });
      }
      case "GET /api/admin/statistiques": {
        requireAdmin(user);
        const one = (sql: string, ...a: (string | number)[]) => Object.values(db.prepare(sql).get(...a) as Record<string, number>)[0] ?? 0;
        const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
        const today = new Date().toISOString().slice(0, 10);
        // Agrégats seulement : aucune donnée individuelle (ni e-mail, ni contenu) n'est exposée ici.
        return send(res, 200, {
          comptes: one("SELECT COUNT(*) FROM users"),
          actifs7j: one("SELECT COUNT(*) FROM users WHERE last_seen_at > ?", since(7)),
          progressionsSynchronisees: one("SELECT COUNT(*) FROM progress"),
          ia: {
            demandesAujourdhui: one("SELECT COUNT(*) FROM ai_runs WHERE day = ?", today),
            jetonsAujourdhui: one("SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM ai_runs WHERE day = ?", today),
            estimees: one("SELECT COUNT(*) FROM ai_runs WHERE day = ? AND estimated = 1", today) > 0,
            erreurs7j: one("SELECT COUNT(*) FROM ai_runs WHERE status <> 'ok' AND at > ?", since(7)),
          },
          signalements: Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM reports GROUP BY status").all() as { status: string; n: number }[]).map((r) => [r.status, r.n])),
          budget: config.budget,
        });
      }
      case "GET /api/admin/metriques":
        requireAdmin(user);
        return send(res, 200, metrics.snapshot());

      case "POST /api/erreurs-client": {
        if (!clientErrorWindow.take(ip)) return send(res, 204);
        const p = clientErrorSchema.safeParse(await jsonBody(req, 8 * 1024));
        if (!p.success) throw new HttpError(400, "invalide");
        metrics.clientErrors++;
        logger.log({ niveau: "erreur", evenement: "erreur-client", compte: user?.id, route: p.data.route.split("?")[0], detail: p.data.message });
        return send(res, 204);
      }
    }
    throw new HttpError(m === "GET" || m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE" ? 404 : 405, "route inconnue");
  }

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const t0 = performance.now();
    const rid = randomUUID().slice(0, 8);
    const url = new URL(req.url ?? "/", "http://x");
    const method = req.method ?? "GET";
    const ip = req.socket.remoteAddress ?? "?";
    let userId: number | undefined;
    res.on("finish", () => {
      const ms = Math.round(performance.now() - t0);
      const key = routeKey(method, url.pathname);
      metrics.observe(key, res.statusCode, ms);
      if (key.endsWith("statique") && res.statusCode < 400) return; // fichiers statiques : métriques seulement
      logger.log({ niveau: res.statusCode >= 500 ? "erreur" : "info", evenement: "requete", requete: rid, methode: method, route: key.slice(method.length + 1), statut: res.statusCode, ms, compte: userId });
    });

    if (Date.now() - lastPurge > 3_600_000) {
      lastPurge = Date.now();
      const p = purge(db);
      if (p.sessions + p.aiRuns + p.reports) logger.log({ niveau: "info", evenement: "purge", detail: JSON.stringify(p) });
    }

    if (!url.pathname.startsWith("/api/")) {
      if (method !== "GET" && method !== "HEAD") return send(res, 405, { erreur: "méthode non autorisée" });
      return serveStatic(req, res, url.pathname);
    }
    try {
      if (!apiWindow.take(ip)) throw new HttpError(429, "trop de requêtes");
      if (method !== "GET" && method !== "HEAD") {
        if (req.headers["x-skillforge"] !== "1") throw new HttpError(403, "en-tête x-skillforge manquant");
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, "origine refusée");
      }
      const user = accounts.userForToken(cookies(req)[COOKIE]);
      userId = user?.id;
      await api(req, res, url.pathname, user, ip);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { erreur: e.message });
      logger.log({ niveau: "erreur", evenement: "exception", requete: rid, detail: redact(e instanceof Error ? e.message : String(e)) });
      if (!res.headersSent) send(res, 500, { erreur: "erreur interne", requete: rid });
    }
  };
}

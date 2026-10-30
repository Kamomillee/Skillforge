/**
 * Serveur SkillForge (optionnel) : sert l'application construite (dist/) avec les en-têtes d'isolation
 * nécessaires à Pyodide, et expose le tuteur IA si une clé est configurée.
 *
 *   pnpm build && pnpm serve
 *   ANTHROPIC_API_KEY=… pnpm serve           # tuteur IA activé
 *   SKILLFORGE_TUTEUR=simule pnpm serve      # tuteur IA simulé (démo, sans clé ni facturation)
 *
 * Journaux : méthode, chemin, statut, durée. Jamais la clé, jamais le code ni les questions de l'étudiant.
 */
import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { claudeProvider, MODELE } from "./claude.ts";
import { handleTutor, Limiter, simulatedProvider, type Provider } from "./tuteur.ts";

const PORT = Number(process.env.PORT ?? 8787);
const DIST = resolve(process.env.SKILLFORGE_DIST ?? "dist");
const MAX_BODY = 64 * 1024;

const provider: Provider | null = process.env.SKILLFORGE_TUTEUR === "simule" ? simulatedProvider() : process.env.ANTHROPIC_API_KEY ? claudeProvider() : null;
const limiter = new Limiter(Number(process.env.AI_MAX_REQUESTS_PER_MINUTE ?? 6), Number(process.env.AI_MAX_REQUESTS_PER_DAY ?? 200));

const headers = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const types: Record<string, string> = {
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

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { ...headers, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, ko) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        ko(new Error("trop gros"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", ko);
  });
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  let path = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!path.startsWith(DIST)) return json(res, 403, { erreur: "interdit" });
  try {
    if (statSync(path).isDirectory()) path = join(path, "index.html");
  } catch {
    path = join(DIST, "index.html");
  }
  try {
    const st = statSync(path);
    res.writeHead(200, { ...headers, "content-type": types[extname(path)] ?? "application/octet-stream", "content-length": st.size });
    createReadStream(path).pipe(res);
  } catch {
    json(res, 404, { erreur: "introuvable" });
  }
}

const server = createServer(async (req, res) => {
  const t0 = Date.now();
  res.on("finish", () => console.log(`${req.method} ${(req.url ?? "").split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms`));
  if (req.url === "/api/sante") return json(res, 200, { ok: true, tuteurIA: !!provider, modele: provider?.model });
  if (req.url === "/api/tuteur") {
    if (req.method !== "POST") return json(res, 405, { erreur: "POST attendu" });
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return json(res, 413, { erreur: "requête trop grosse ou JSON invalide" });
    }
    const ip = req.socket.remoteAddress ?? "?";
    const r = await handleTutor(body, provider, limiter, ip);
    return json(res, r.status, r.body);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { erreur: "méthode non autorisée" });
  serveStatic(req, res);
});

server.listen(PORT, () => {
  const mode = provider ? (provider.name === "simule" ? "simulé (aucun appel réseau)" : `Claude (${MODELE}, fallbacks activés)`) : "désactivé (pas de ANTHROPIC_API_KEY)";
  console.log(`SkillForge sur http://localhost:${PORT} — tuteur IA : ${mode}`);
});

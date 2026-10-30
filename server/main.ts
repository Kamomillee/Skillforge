/**
 * Serveur SkillForge (optionnel) : sert l'application construite (dist/) avec les en-têtes de sécurité,
 * gère les comptes, la synchronisation de la progression, le tuteur IA avec budget par compte,
 * les signalements et l'administration.
 *
 *   pnpm build && pnpm serve
 *   ANTHROPIC_API_KEY=… pnpm serve           # tuteur IA activé
 *   SKILLFORGE_TUTEUR=simule pnpm serve      # tuteur IA simulé (démo, sans clé ni facturation)
 *
 * Configuration : voir .env.example. Journaux : JSON sur la sortie standard, jamais de secret ni de contenu.
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { claudeProvider, MODELE } from "./claude.ts";
import { openDatabase } from "./db.ts";
import { Logger } from "./observabilite.ts";
import { simulatedProvider, type Provider } from "./tuteur.ts";

const env = process.env;
const PORT = Number(env.PORT ?? 8787);
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

const provider: Provider | null = env.SKILLFORGE_TUTEUR === "simule" ? simulatedProvider() : env.ANTHROPIC_API_KEY ? claudeProvider() : null;
const logger = new Logger();
const db = openDatabase(env.SKILLFORGE_DB ?? resolve("data/skillforge.db"));

const handler = createApp({
  db,
  provider,
  logger,
  config: {
    dist: resolve(env.SKILLFORGE_DIST ?? "dist"),
    adminEmails: (env.SKILLFORGE_ADMINS ?? "").split(","),
    budget: { requestsPerDay: num(env.AI_REQUESTS_PER_USER_PER_DAY, 30), tokensPerDay: num(env.AI_TOKENS_PER_USER_PER_DAY, 60_000) },
    cookieSecure: env.SKILLFORGE_COOKIE_SECURE === "1",
    aiPerMinute: num(env.AI_MAX_REQUESTS_PER_MINUTE, 6),
    aiPerDay: num(env.AI_MAX_REQUESTS_PER_DAY, 200),
  },
});

createServer(handler).listen(PORT, () => {
  const mode = provider ? (provider.name === "simule" ? "simulé (aucun appel réseau)" : `Claude (${MODELE}, fallbacks activés)`) : "désactivé (pas de ANTHROPIC_API_KEY)";
  logger.log({ niveau: "info", evenement: "demarrage", detail: `http://localhost:${PORT} — tuteur IA : ${mode}` });
});

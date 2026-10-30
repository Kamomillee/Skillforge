/**
 * Base du serveur (SQLite intégré à Node, `node:sqlite`). Une seule base, un fichier :
 * comptes, sessions, progression synchronisée, exécutions IA (consommation), signalements.
 * Chaque table qui contient des données d'étudiant porte `user_id` : toutes les requêtes filtrent dessus.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pwd_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'etudiant' CHECK (role IN ('etudiant', 'admin')),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  day TEXT NOT NULL,
  model TEXT NOT NULL,
  mode TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_runs_user_day ON ai_runs(user_id, day);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  target_version INTEGER,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en-cours', 'corrige', 'rejete')),
  admin_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_user ON reports(user_id);
`;

export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

/**
 * Politique de conservation (voir docs/CONFIDENTIALITE.md) : sessions expirées supprimées,
 * exécutions IA conservées 90 jours, signalements traités conservés 365 jours après traitement.
 * Les comptes ne sont jamais supprimés automatiquement : l'étudiant les supprime lui-même.
 */
export function purge(db: Db, now = new Date()) {
  const iso = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const s = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString());
  const r = db.prepare("DELETE FROM ai_runs WHERE at < ?").run(iso(90));
  const p = db.prepare("DELETE FROM reports WHERE status IN ('corrige', 'rejete') AND updated_at < ?").run(iso(365));
  return { sessions: Number(s.changes), aiRuns: Number(r.changes), reports: Number(p.changes) };
}

/**
 * Comptes et sessions. Mots de passe hachés avec scrypt (sel aléatoire), sessions par jeton aléatoire
 * dont seul le hachage est stocké : une fuite de la base ne donne ni les mots de passe ni des sessions valides.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Db } from "./db.ts";

export type Role = "etudiant" | "admin";
export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export const SESSION_DAYS = 30;

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, "10 caractères au moins").max(200),
  name: z.string().trim().max(80).default(""),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, got);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Hachage factice : la connexion avec un e-mail inconnu prend le même temps qu'avec un mauvais mot de passe. */
const DUMMY = hashPassword(randomBytes(12).toString("hex"));

type UserRow = { id: number; email: string; name: string; role: Role; created_at: string; pwd_hash: string };
const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, createdAt: r.created_at });

export class Accounts {
  private db: Db;
  private admins: Set<string>;
  constructor(db: Db, adminEmails: string[] = []) {
    this.db = db;
    this.admins = new Set(adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  }

  register(input: unknown, now = new Date()): { ok: true; user: User } | { ok: false; status: number; error: string } {
    const p = registerSchema.safeParse(input);
    if (!p.success) return { ok: false, status: 400, error: p.error.issues.some((i) => i.path[0] === "password") ? "mot de passe trop court (10 caractères au moins)" : "e-mail invalide" };
    const { email, password, name } = p.data;
    if (this.db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return { ok: false, status: 409, error: "un compte existe déjà avec cet e-mail" };
    const role: Role = this.admins.has(email) ? "admin" : "etudiant";
    const at = now.toISOString();
    const r = this.db.prepare("INSERT INTO users (email, name, pwd_hash, role, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").run(email, name, hashPassword(password), role, at, at);
    return { ok: true, user: { id: Number(r.lastInsertRowid), email, name, role, createdAt: at } };
  }

  /** Message unique en cas d'échec : on ne révèle pas si l'e-mail existe. */
  authenticate(input: unknown): User | null {
    const p = loginSchema.safeParse(input);
    if (!p.success) return null;
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(p.data.email) as UserRow | undefined;
    const ok = verifyPassword(p.data.password, row?.pwd_hash ?? DUMMY);
    return row && ok ? toUser(row) : null;
  }

  createSession(userId: number, now = new Date()): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
    this.db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(tokenHash(token), userId, now.toISOString(), expiresAt);
    return { token, expiresAt };
  }

  userForToken(token: string | undefined, now = new Date()): User | null {
    if (!token) return null;
    const row = this.db
      .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
      .get(tokenHash(token), now.toISOString()) as UserRow | undefined;
    if (!row) return null;
    this.db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(now.toISOString(), row.id);
    return toUser(row);
  }

  endSession(token: string | undefined) {
    if (token) this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  }

  /** Suppression définitive : sessions, progression et exécutions IA partent en cascade ; les signalements sont anonymisés. */
  deleteUser(userId: number) {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  }

  passwordMatches(userId: number, password: unknown): boolean {
    const row = this.db.prepare("SELECT pwd_hash FROM users WHERE id = ?").get(userId) as { pwd_hash: string } | undefined;
    return !!row && typeof password === "string" && verifyPassword(password, row.pwd_hash);
  }

  /** Export de toutes les données personnelles détenues par le serveur pour ce compte. */
  exportUser(userId: number) {
    const u = this.db.prepare("SELECT id, email, name, role, created_at, last_seen_at FROM users WHERE id = ?").get(userId);
    const progress = this.db.prepare("SELECT revision, updated_at, data FROM progress WHERE user_id = ?").get(userId) as { revision: number; updated_at: string; data: string } | undefined;
    return {
      format: "skillforge-compte",
      exportedAt: new Date().toISOString(),
      compte: u,
      sessionsActives: (this.db.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id = ?").get(userId) as { n: number }).n,
      progression: progress ? { revision: progress.revision, updatedAt: progress.updated_at, data: JSON.parse(progress.data) } : null,
      executionsIA: this.db.prepare("SELECT at, model, mode, input_tokens, output_tokens, estimated, status FROM ai_runs WHERE user_id = ? ORDER BY at").all(userId),
      signalements: this.db.prepare("SELECT id, at, kind, target, target_version, message, status, admin_note FROM reports WHERE user_id = ? ORDER BY at").all(userId),
    };
  }
}

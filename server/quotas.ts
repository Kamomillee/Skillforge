/**
 * Budget IA par compte et par jour (UTC). La consommation enregistrée est celle renvoyée par le fournisseur
 * (`usage` de l'API Messages) ; pour le fournisseur simulé, c'est une estimation, marquée comme telle.
 * Aucune facturation : le budget est un plafond technique, pas un prix.
 */
import type { Db } from "./db.ts";

export interface Budget {
  requestsPerDay: number;
  tokensPerDay: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimated: boolean;
}

export const day = (d = new Date()) => d.toISOString().slice(0, 10);

/** Estimation grossière (≈ 4 caractères par jeton) pour le fournisseur simulé uniquement. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export class Quotas {
  private db: Db;
  readonly budget: Budget;
  constructor(db: Db, budget: Budget) {
    this.db = db;
    this.budget = budget;
  }

  today(userId: number, now = new Date()) {
    const r = this.db
      .prepare("SELECT COUNT(*) AS requests, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens, COALESCE(MAX(estimated), 0) AS estimated FROM ai_runs WHERE user_id = ? AND day = ? AND status = 'ok'")
      .get(userId, day(now)) as { requests: number; tokens: number; estimated: number };
    return { requests: r.requests, tokens: r.tokens, estimated: r.estimated === 1 };
  }

  /** Vérifié AVANT l'appel : un budget dépassé n'appelle jamais le fournisseur. */
  check(userId: number, now = new Date()): { ok: true } | { ok: false; reason: string } {
    const t = this.today(userId, now);
    if (t.requests >= this.budget.requestsPerDay) return { ok: false, reason: `budget IA du jour atteint (${this.budget.requestsPerDay} demandes) : le tuteur local reste disponible` };
    if (t.tokens >= this.budget.tokensPerDay) return { ok: false, reason: `budget IA du jour atteint (${this.budget.tokensPerDay} jetons) : le tuteur local reste disponible` };
    return { ok: true };
  }

  record(userId: number, run: { model: string; mode: string; status: string; usage?: Usage }, now = new Date()) {
    this.db
      .prepare("INSERT INTO ai_runs (user_id, at, day, model, mode, input_tokens, output_tokens, estimated, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(userId, now.toISOString(), day(now), run.model, run.mode, run.usage?.inputTokens ?? 0, run.usage?.outputTokens ?? 0, run.usage?.estimated ? 1 : 0, run.status);
  }

  /** Vue « Consommation IA » de l'étudiant : uniquement ses propres exécutions. */
  report(userId: number, now = new Date()) {
    const runs = this.db
      .prepare("SELECT at, model, mode, input_tokens AS inputTokens, output_tokens AS outputTokens, estimated, status FROM ai_runs WHERE user_id = ? ORDER BY id DESC LIMIT 30")
      .all(userId) as { at: string; model: string; mode: string; inputTokens: number; outputTokens: number; estimated: number; status: string }[];
    const days = this.db
      .prepare("SELECT day, COUNT(*) AS requests, SUM(input_tokens + output_tokens) AS tokens, MAX(estimated) AS estimated FROM ai_runs WHERE user_id = ? AND status = 'ok' GROUP BY day ORDER BY day DESC LIMIT 14")
      .all(userId) as { day: string; requests: number; tokens: number; estimated: number }[];
    return {
      budget: this.budget,
      aujourdhui: this.today(userId, now),
      jours: days.map((d) => ({ ...d, estimated: d.estimated === 1 })),
      executions: runs.map((r) => ({ ...r, estimated: r.estimated === 1 })),
    };
  }
}

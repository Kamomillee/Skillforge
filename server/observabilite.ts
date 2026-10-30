/**
 * Observabilité : journaux structurés (une ligne JSON par événement) et métriques en mémoire.
 * Règle : on journalise des faits techniques (route, statut, durée, identifiant de compte numérique),
 * jamais de contenu (corps de requête, code, questions, mots de passe, jetons, clés).
 */

export type LogSink = (line: string) => void;

/** Champs autorisés dans un journal. Toute autre clé est refusée à la compilation. */
export interface LogFields {
  niveau: "info" | "alerte" | "erreur";
  evenement: string;
  requete?: string;
  methode?: string;
  route?: string;
  statut?: number;
  ms?: number;
  compte?: number;
  detail?: string;
}

/** Masque tout ce qui ressemble à un secret, au cas où un message d'erreur en contiendrait. */
export function redact(s: string): string {
  return s
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[clé masquée]")
    .replace(/(authorization|x-api-key|cookie)\s*[:=]\s*\S+/gi, "$1=[masqué]")
    .replace(/sf_session=[^;\s]+/g, "sf_session=[masqué]")
    .slice(0, 300);
}

export class Logger {
  private sink: LogSink;
  constructor(sink: LogSink = (l) => console.log(l)) {
    this.sink = sink;
  }
  log(f: LogFields) {
    this.sink(JSON.stringify({ t: new Date().toISOString(), ...f, ...(f.detail ? { detail: redact(f.detail) } : {}) }));
  }
}

/** Remplace les identifiants dans un chemin pour regrouper les métriques (/api/admin/signalements/12 → …/:id). */
export function routeKey(method: string, path: string): string {
  const p = path.split("?")[0];
  if (!p.startsWith("/api/")) return `${method} statique`;
  return `${method} ${p.replace(/\/\d+(?=\/|$)/g, "/:id")}`;
}

export class Metrics {
  readonly startedAt = Date.now();
  private requests = new Map<string, { count: number; errors: number; durations: number[] }>();
  private ai = new Map<string, number>();
  clientErrors = 0;

  observe(route: string, status: number, ms: number) {
    const m = this.requests.get(route) ?? { count: 0, errors: 0, durations: [] };
    m.count++;
    if (status >= 500) m.errors++;
    m.durations.push(ms);
    if (m.durations.length > 500) m.durations.shift();
    this.requests.set(route, m);
  }

  aiCall(status: string) {
    this.ai.set(status, (this.ai.get(status) ?? 0) + 1);
  }

  snapshot() {
    const pct = (xs: number[], p: number) => {
      if (!xs.length) return 0;
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
    };
    return {
      depuis: new Date(this.startedAt).toISOString(),
      dureeSecondes: Math.round((Date.now() - this.startedAt) / 1000),
      routes: [...this.requests.entries()]
        .map(([route, m]) => ({ route, requetes: m.count, erreurs5xx: m.errors, p50ms: pct(m.durations, 50), p95ms: pct(m.durations, 95) }))
        .sort((a, b) => b.requetes - a.requetes),
      appelsIA: Object.fromEntries(this.ai),
      erreursClient: this.clientErrors,
    };
  }
}

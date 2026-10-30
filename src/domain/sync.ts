/**
 * Synchronisation de la progression entre ce navigateur et le compte serveur.
 * Principe : jamais d'écrasement silencieux. On compare trois états — la dernière version synchronisée
 * (révision + empreinte, gardées localement), la version locale actuelle et la version du serveur.
 */

export const SYNC_KEY = "sync:etat";

export interface SyncState {
  revision: number;
  fingerprint: string;
  at: string;
  userId: number;
}

export interface ExportLike {
  kv: Record<string, unknown>;
  drafts: unknown[];
  attempts: unknown[];
  events: unknown[];
  reviews: unknown[];
}

/**
 * Empreinte stable du contenu (deux FNV-1a 32 bits sur le JSON), hors date d'export, état de synchronisation et
 * compteur de temps actif (il change toutes les 15 s : il ferait croire à un conflit à chaque changement d'appareil).
 */
export function fingerprint(d: ExportLike): string {
  const kv = Object.fromEntries(Object.entries(d.kv).filter(([k]) => !k.startsWith("sync:") && k !== "activity").sort(([a], [b]) => a.localeCompare(b)));
  const s = JSON.stringify([kv, d.drafts, d.attempts, d.events, d.reviews]);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export function isEmpty(d: ExportLike): boolean {
  return !d.attempts.length && !d.drafts.length && !d.reviews.length && !Object.keys(d.kv).some((k) => k === "profile");
}

export type SyncDecision =
  | { action: "a-jour" }
  | { action: "envoyer"; baseRevision: number }
  | { action: "recuperer" }
  | { action: "conflit"; raison: string };

export function decideSync(local: ExportLike, state: SyncState | undefined, server: { revision: number; hasData: boolean }, userId: number): SyncDecision {
  const fp = fingerprint(local);
  const known = state && state.userId === userId ? state : undefined;
  if (server.revision === 0 || !server.hasData) return { action: "envoyer", baseRevision: 0 };
  if (!known) {
    // Premier rattachement de ce navigateur à un compte qui a déjà une progression.
    return isEmpty(local) ? { action: "recuperer" } : { action: "conflit", raison: "ce navigateur et ton compte contiennent chacun une progression" };
  }
  const localChanged = fp !== known.fingerprint;
  const serverChanged = server.revision !== known.revision;
  if (!localChanged && !serverChanged) return { action: "a-jour" };
  if (localChanged && !serverChanged) return { action: "envoyer", baseRevision: server.revision };
  if (!localChanged && serverChanged) return { action: "recuperer" };
  return { action: "conflit", raison: "la progression a changé ici ET sur un autre appareil depuis la dernière synchronisation" };
}

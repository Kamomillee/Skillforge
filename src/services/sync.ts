import { decideSync, fingerprint, SYNC_KEY, type SyncDecision, type SyncState } from "../domain/sync";
import type { Store } from "../storage/store";
import { api } from "./serveur";

type Export = Awaited<ReturnType<Store["exportAll"]>>;
interface ServerProgress {
  revision: number;
  updatedAt: string | null;
  data: Export | null;
}

export type SyncOutcome =
  | { kind: "a-jour"; revision: number }
  | { kind: "envoye"; revision: number }
  | { kind: "recupere"; revision: number }
  | { kind: "conflit"; raison: string; serverRevision: number; serverUpdatedAt: string | null }
  | { kind: "erreur"; message: string };

async function remember(store: Store, revision: number, userId: number) {
  const fp = fingerprint(await store.exportAll());
  const s: SyncState = { revision, fingerprint: fp, at: new Date().toISOString(), userId };
  await store.set(SYNC_KEY, s);
}

/** Télécharge une copie de la progression locale avant de la remplacer. */
export function downloadBackup(data: Export) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `skillforge-copie-avant-synchronisation-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Synchronise. Sans `force`, un conflit est renvoyé tel quel : c'est l'étudiant qui choisit.
 * `force: "local"` garde ce navigateur (remplace le serveur), `force: "serveur"` prend le compte
 * (remplace ce navigateur, après téléchargement d'une copie de sécurité).
 */
export async function synchroniser(store: Store, userId: number, force?: "local" | "serveur"): Promise<SyncOutcome> {
  const remote = await api<ServerProgress>("GET", "/api/progression");
  if (!remote.ok) return { kind: "erreur", message: remote.erreur };
  const local = await store.exportAll();
  const state = await store.get<SyncState>(SYNC_KEY);
  const decision: SyncDecision = force === "local" ? { action: "envoyer", baseRevision: remote.data.revision } : force === "serveur" ? { action: "recuperer" } : decideSync(local, state, { revision: remote.data.revision, hasData: !!remote.data.data }, userId);

  switch (decision.action) {
    case "a-jour":
      await remember(store, remote.data.revision, userId);
      return { kind: "a-jour", revision: remote.data.revision };
    case "envoyer": {
      const put = await api<{ revision: number }>("PUT", "/api/progression", { baseRevision: decision.baseRevision, data: local });
      if (put.status === 409) return { kind: "conflit", raison: "le serveur a reçu une autre version entre-temps", serverRevision: (put.data as { revision: number }).revision, serverUpdatedAt: null };
      if (!put.ok) return { kind: "erreur", message: put.erreur };
      await remember(store, put.data.revision, userId);
      return { kind: "envoye", revision: put.data.revision };
    }
    case "recuperer": {
      if (!remote.data.data) return { kind: "erreur", message: "aucune progression sur le serveur" };
      if (force === "serveur") downloadBackup(local);
      await store.importAll(remote.data.data);
      await remember(store, remote.data.revision, userId);
      return { kind: "recupere", revision: remote.data.revision };
    }
    case "conflit":
      return { kind: "conflit", raison: decision.raison, serverRevision: remote.data.revision, serverUpdatedAt: remote.data.updatedAt };
  }
}

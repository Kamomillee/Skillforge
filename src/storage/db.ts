/**
 * Accès IndexedDB minimal (promesses). La progression est stockée localement dans le navigateur
 * pour cette première étape ; l'interface `Store` (store.ts) isole ce choix pour une future
 * synchronisation serveur.
 */
export const DB_NAME = "skillforge";
export const DB_VERSION = 1;

export const STORES = {
  kv: "kv",
  drafts: "drafts",
  attempts: "attempts",
  events: "events",
  reviews: "reviews",
} as const;

export function openDb(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv);
      if (!db.objectStoreNames.contains(STORES.drafts)) db.createObjectStore(STORES.drafts, { keyPath: "exerciseId" });
      if (!db.objectStoreNames.contains(STORES.attempts)) {
        const s = db.createObjectStore(STORES.attempts, { keyPath: "id", autoIncrement: true });
        s.createIndex("byExercise", "exerciseId");
      }
      if (!db.objectStoreNames.contains(STORES.events)) {
        const s = db.createObjectStore(STORES.events, { keyPath: "id", autoIncrement: true });
        s.createIndex("byType", "type");
      }
      if (!db.objectStoreNames.contains(STORES.reviews)) db.createObjectStore(STORES.reviews, { keyPath: "conceptId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Base locale bloquée par un autre onglet."));
  });
}

export function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction annulée"));
  });
}

import type { DomainId } from "../content/types";
import { openDb, reqP, STORES, txDone } from "./db";

export type Level = "aucun" | "debutant" | "intermediaire" | "avance";
export type Goal = "data" | "ia" | "bi" | "automatisation" | "exploration";

export interface Profile {
  name: string;
  programmingLevel: Level;
  levels: { python: Level; sql: Level; stats: Level; bi: Level };
  goal: Goal;
  hoursPerWeek: number;
  targetDate?: string;
  preferences: { concreteExamples: boolean; visualFirst: boolean; shortSessions: boolean };
  apiKey: "non" | "plus-tard" | "oui";
  createdAt: string;
}

export interface LearningPath {
  domainOrder: DomainId[];
  /** Modules que l'étudiant a retirés de son parcours (restent accessibles). */
  hiddenModules: string[];
  reasons: string[];
  updatedAt: string;
}

export interface Draft {
  exerciseId: string;
  exerciseVersion: number;
  code: string;
  revision: number;
  updatedAt: string;
  tabId: string;
}

export interface Attempt {
  id?: number;
  exerciseId: string;
  exerciseVersion: number;
  at: string;
  code: string;
  status: "passed" | "failed" | "error" | "timeout" | "interrupted";
  passedCount: number;
  total: number;
  hiddenPassed: number;
  hiddenTotal: number;
  misconceptions: string[];
  errorType?: string;
  /** Niveau d'aide maximal consulté avant cette tentative (0 = aucune). */
  hintLevel: number;
  solutionViewed: boolean;
  durationMs: number;
}

export type EventType =
  | "lesson-open"
  | "section-view"
  | "prediction"
  | "hint"
  | "run"
  | "explain"
  | "diagnostic"
  | "report"
  | "review-done";

export interface LearningEvent {
  id?: number;
  type: EventType;
  at: string;
  lessonId?: string;
  sectionId?: string;
  exerciseId?: string;
  data?: Record<string, unknown>;
}

export interface Review {
  conceptId: string;
  dueAt: string;
  step: number;
  reason: string;
  history: { at: string; ok: boolean }[];
}

export interface ResumePoint {
  lessonId: string;
  sectionId: string;
  exerciseId?: string;
  at: string;
}

export type SaveDraftResult = { ok: true; draft: Draft } | { ok: false; conflict: Draft };

export const TAB_ID = Math.random().toString(36).slice(2, 10);

export class Store {
  private constructor(private db: IDBDatabase, private channel: BroadcastChannel | null) {}

  static async open(factory?: IDBFactory, name?: string) {
    const db = await openDb(factory, name);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("skillforge") : null;
    return new Store(db, channel);
  }

  /** Notifications entre onglets (brouillon modifié ailleurs). */
  onRemoteChange(fn: (m: { kind: "draft"; exerciseId: string; revision: number; tabId: string }) => void) {
    if (!this.channel) return () => {};
    const h = (e: MessageEvent) => e.data?.tabId !== TAB_ID && fn(e.data);
    this.channel.addEventListener("message", h);
    return () => this.channel?.removeEventListener("message", h);
  }

  private store(name: string, mode: IDBTransactionMode = "readonly") {
    return this.db.transaction(name, mode).objectStore(name);
  }

  // ---- clé / valeur ----
  get<T>(key: string): Promise<T | undefined> {
    return reqP(this.store(STORES.kv).get(key));
  }
  async set<T>(key: string, value: T) {
    await reqP(this.store(STORES.kv, "readwrite").put(value, key));
  }

  getProfile = () => this.get<Profile>("profile");
  saveProfile = (p: Profile) => this.set("profile", p);
  getPath = () => this.get<LearningPath>("path");
  savePath = (p: LearningPath) => this.set("path", p);
  getResume = () => this.get<ResumePoint>("resume");
  saveResume = (r: ResumePoint) => this.set("resume", r);

  // ---- brouillons, avec détection de conflit ----
  getDraft(exerciseId: string): Promise<Draft | undefined> {
    return reqP(this.store(STORES.drafts).get(exerciseId));
  }

  /**
   * Enregistre un brouillon seulement si la version stockée est celle sur laquelle on travaillait
   * (`baseRevision`). Sinon, un autre onglet a écrit entre-temps : on renvoie le conflit
   * au lieu d'écraser un travail plus récent.
   */
  async saveDraft(exerciseId: string, exerciseVersion: number, code: string, baseRevision: number, force = false): Promise<SaveDraftResult> {
    const tx = this.db.transaction(STORES.drafts, "readwrite");
    const s = tx.objectStore(STORES.drafts);
    const current = (await reqP(s.get(exerciseId))) as Draft | undefined;
    const currentRev = current?.revision ?? 0;
    if (!force && current && currentRev !== baseRevision && current.code !== code) {
      await txDone(tx);
      return { ok: false, conflict: current };
    }
    const draft: Draft = { exerciseId, exerciseVersion, code, revision: currentRev + 1, updatedAt: new Date().toISOString(), tabId: TAB_ID };
    s.put(draft);
    await txDone(tx);
    this.channel?.postMessage({ kind: "draft", exerciseId, revision: draft.revision, tabId: TAB_ID });
    return { ok: true, draft };
  }

  async deleteDraft(exerciseId: string) {
    await reqP(this.store(STORES.drafts, "readwrite").delete(exerciseId));
  }

  listDrafts(): Promise<Draft[]> {
    return reqP(this.store(STORES.drafts).getAll());
  }

  // ---- tentatives ----
  async addAttempt(a: Attempt): Promise<number> {
    return (await reqP(this.store(STORES.attempts, "readwrite").add(a))) as number;
  }
  listAttempts(exerciseId?: string): Promise<Attempt[]> {
    const s = this.store(STORES.attempts);
    return reqP(exerciseId ? s.index("byExercise").getAll(exerciseId) : s.getAll());
  }

  // ---- événements ----
  async addEvent(e: Omit<LearningEvent, "at"> & { at?: string }) {
    await reqP(this.store(STORES.events, "readwrite").add({ at: new Date().toISOString(), ...e }));
  }
  listEvents(type?: EventType): Promise<LearningEvent[]> {
    const s = this.store(STORES.events);
    return reqP(type ? s.index("byType").getAll(type) : s.getAll());
  }

  // ---- révisions ----
  listReviews(): Promise<Review[]> {
    return reqP(this.store(STORES.reviews).getAll());
  }
  getReview(conceptId: string): Promise<Review | undefined> {
    return reqP(this.store(STORES.reviews).get(conceptId));
  }
  async putReview(r: Review) {
    await reqP(this.store(STORES.reviews, "readwrite").put(r));
  }

  // ---- temps actif (mesuré, par jour) ----
  async addActiveSeconds(seconds: number, day = new Date().toISOString().slice(0, 10)) {
    const tx = this.db.transaction(STORES.kv, "readwrite");
    const s = tx.objectStore(STORES.kv);
    const cur = ((await reqP(s.get("activity"))) as Record<string, number> | undefined) ?? {};
    cur[day] = (cur[day] ?? 0) + seconds;
    s.put(cur, "activity");
    await txDone(tx);
  }
  getActivity = async () => (await this.get<Record<string, number>>("activity")) ?? {};

  // ---- export / import / suppression (données personnelles) ----
  async exportAll() {
    const kvStore = this.store(STORES.kv);
    const keys = (await reqP(kvStore.getAllKeys())) as string[];
    const values = await reqP(this.store(STORES.kv).getAll());
    return {
      format: "skillforge-export",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      kv: Object.fromEntries(keys.map((k, i) => [k, values[i]])),
      drafts: await this.listDrafts(),
      attempts: await this.listAttempts(),
      events: await this.listEvents(),
      reviews: await this.listReviews(),
    };
  }

  async importAll(data: Awaited<ReturnType<Store["exportAll"]>>) {
    if (data?.format !== "skillforge-export" || data.formatVersion !== 1) throw new Error("Fichier d'export non reconnu.");
    await this.clearAll();
    const tx = this.db.transaction(Object.values(STORES), "readwrite");
    for (const [k, v] of Object.entries(data.kv)) tx.objectStore(STORES.kv).put(v, k);
    data.drafts.forEach((d) => tx.objectStore(STORES.drafts).put(d));
    data.attempts.forEach((a) => tx.objectStore(STORES.attempts).put(a));
    data.events.forEach((e) => tx.objectStore(STORES.events).put(e));
    data.reviews.forEach((r) => tx.objectStore(STORES.reviews).put(r));
    await txDone(tx);
  }

  async clearAll() {
    const tx = this.db.transaction(Object.values(STORES), "readwrite");
    Object.values(STORES).forEach((s) => tx.objectStore(s).clear());
    await txDone(tx);
  }
}

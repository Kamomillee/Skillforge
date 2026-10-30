import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Attempt, Draft, Favorite, LearningEvent, LearningPath, Profile, ResumePoint, Review } from "../storage/store";
import { Store } from "../storage/store";
import { getRunner, type PythonRunner, type RunnerState } from "../runtime/python/client";
import { getSqlRunner, type SqlRunner } from "../runtime/sql/client";

export interface Snapshot {
  profile?: Profile;
  path?: LearningPath;
  resume?: ResumePoint;
  attempts: Attempt[];
  events: LearningEvent[];
  reviews: Review[];
  drafts: Draft[];
  activity: Record<string, number>;
  favorites: Favorite[];
}

interface Ctx {
  store: Store;
  data: Snapshot;
  refresh: () => Promise<void>;
  runner: PythonRunner;
  runnerState: RunnerState;
  sqlRunner: SqlRunner;
  sqlState: RunnerState;
  toast: (msg: string) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp hors du fournisseur");
  return c;
}

async function load(store: Store): Promise<Snapshot> {
  const [profile, path, resume, attempts, events, reviews, drafts, activity, favorites] = await Promise.all([
    store.getProfile(),
    store.getPath(),
    store.getResume(),
    store.listAttempts(),
    store.listEvents(),
    store.listReviews(),
    store.listDrafts(),
    store.getActivity(),
    store.getFavorites(),
  ]);
  return { profile, path, resume, attempts, events, reviews, drafts, activity, favorites };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runner = useMemo(() => getRunner(), []);
  const [runnerState, setRunnerState] = useState<RunnerState>(runner.state);
  const sqlRunner = useMemo(() => getSqlRunner(), []);
  const [sqlState, setSqlState] = useState<RunnerState>(sqlRunner.state);
  const [toastMsg, setToast] = useState<string | null>(null);

  useEffect(() => runner.subscribe(setRunnerState), [runner]);
  useEffect(() => sqlRunner.subscribe(setSqlState), [sqlRunner]);

  useEffect(() => {
    Store.open()
      .then(async (s) => {
        setStore(s);
        setData(await load(s));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const refresh = useCallback(async () => {
    if (store) setData(await load(store));
  }, [store]);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((m) => (m === msg ? null : m)), 3500);
  }, []);

  if (error)
    return (
      <div className="page page-narrow" role="alert">
        <h1>Stockage local indisponible</h1>
        <p>
          SkillForge enregistre ta progression dans ce navigateur (IndexedDB). Il n'a pas pu y accéder : <code>{error}</code>
        </p>
        <p>Cause fréquente : navigation privée stricte ou stockage désactivé pour ce site.</p>
      </div>
    );
  if (!store || !data)
    return (
      <div className="page" aria-busy="true">
        <p className="muted">Chargement de ta progression…</p>
      </div>
    );

  return (
    <AppCtx.Provider value={{ store, data, refresh, runner, runnerState, sqlRunner, sqlState, toast }}>
      {children}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AppCtx.Provider>
  );
}

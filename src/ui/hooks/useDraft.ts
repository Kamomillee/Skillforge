import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "../../content/types";
import type { Draft, Store } from "../../storage/store";

export type SaveState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string; retryIn: number }
  | { kind: "conflict"; theirs: Draft };

const RETRY = [1000, 2000, 4000, 8000, 15000];

/**
 * Brouillon d'exercice avec sauvegarde automatique :
 * - enregistrement différé (700 ms) et immédiat quand l'onglet passe en arrière-plan ;
 * - nouvelles tentatives avec temporisation croissante en cas d'erreur ;
 * - jamais d'écrasement silencieux d'une version plus récente (autre onglet) : conflit explicite.
 */
export function useDraft(store: Store, ex: Exercise, draftKey: string) {
  const [code, setCodeState] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [storedVersion, setStoredVersion] = useState<number | null>(null);
  const base = useRef(0);
  const dirty = useRef(false);
  const latest = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retries = useRef(0);

  useEffect(() => {
    let alive = true;
    dirty.current = false;
    retries.current = 0;
    setSave({ kind: "idle" });
    store.getDraft(draftKey).then((d) => {
      if (!alive) return;
      base.current = d?.revision ?? 0;
      latest.current = d?.code ?? ex.starterCode;
      setStoredVersion(d ? d.exerciseVersion : null);
      setCodeState(latest.current);
      if (d) setSave({ kind: "saved", at: d.updatedAt });
    });
    return () => {
      alive = false;
    };
  }, [store, draftKey, ex.starterCode]);

  const flush = useCallback(
    async (force = false) => {
      clearTimeout(timer.current);
      if (!dirty.current && !force) return;
      setSave({ kind: "saving" });
      try {
        const r = await store.saveDraft(draftKey, ex.version, latest.current, base.current, force);
        if (!r.ok) {
          setSave({ kind: "conflict", theirs: r.conflict });
          return;
        }
        base.current = r.draft.revision;
        retries.current = 0;
        if (r.draft.code === latest.current) dirty.current = false;
        setStoredVersion(ex.version);
        setSave({ kind: "saved", at: r.draft.updatedAt });
      } catch (e) {
        const delay = RETRY[Math.min(retries.current, RETRY.length - 1)];
        retries.current++;
        setSave({ kind: "error", message: e instanceof Error ? e.message : String(e), retryIn: delay });
        timer.current = setTimeout(() => void flush(), delay);
      }
    },
    [store, draftKey, ex.version],
  );

  const setCode = useCallback(
    (v: string) => {
      latest.current = v;
      setCodeState(v);
      dirty.current = true;
      setSave((s) => (s.kind === "conflict" ? s : { kind: "pending" }));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Sauvegarde immédiate quand l'onglet est masqué ou fermé ; reprise quand le réseau revient.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush();
    const onOnline = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    addEventListener("pagehide", onHide);
    addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      removeEventListener("pagehide", onHide);
      removeEventListener("online", onOnline);
      clearTimeout(timer.current);
    };
  }, [flush]);

  // Modification depuis un autre onglet.
  useEffect(
    () =>
      store.onRemoteChange(async (m) => {
        if (m.exerciseId !== draftKey || m.revision <= base.current) return;
        const theirs = await store.getDraft(draftKey);
        if (!theirs) return;
        if (!dirty.current) {
          base.current = theirs.revision;
          latest.current = theirs.code;
          setCodeState(theirs.code);
          setSave({ kind: "saved", at: theirs.updatedAt });
        } else setSave({ kind: "conflict", theirs });
      }),
    [store, draftKey],
  );

  const resolveConflict = useCallback(
    async (choice: "mine" | "theirs") => {
      if (save.kind !== "conflict") return;
      if (choice === "theirs") {
        base.current = save.theirs.revision;
        latest.current = save.theirs.code;
        dirty.current = false;
        setCodeState(save.theirs.code);
        setSave({ kind: "saved", at: save.theirs.updatedAt });
      } else {
        base.current = save.theirs.revision;
        dirty.current = true;
        await flush(true);
      }
    },
    [save, flush],
  );

  /** Remplace le code (réinitialisation ou restauration d'une tentative) et l'enregistre. */
  const replace = useCallback(
    async (v: string) => {
      latest.current = v;
      setCodeState(v);
      dirty.current = true;
      await flush();
    },
    [flush],
  );

  return { code, setCode, save, flush, resolveConflict, replace, versionChanged: storedVersion !== null && storedVersion !== ex.version };
}

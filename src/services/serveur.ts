/**
 * Client du serveur SkillForge (optionnel). Sans serveur, l'application reste complète en local :
 * chaque fonction renvoie un résultat explicite (« serveur injoignable ») au lieu de simuler un succès.
 */
import { useEffect, useState } from "react";

export interface Sante {
  ok: boolean;
  tuteurIA: boolean;
  modele?: string;
  comptes?: boolean;
  simule?: boolean;
}

export interface Utilisateur {
  id: number;
  email: string;
  name: string;
  role: "etudiant" | "admin";
  createdAt: string;
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; erreur: string; data?: unknown };

export async function api<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }), ...(method === "GET" ? {} : { "x-skillforge": "1" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: r.status, erreur: r.ok ? "réponse illisible du serveur" : `serveur indisponible (${r.status})` };
    }
    if (!r.ok) return { ok: false, status: r.status, erreur: (data as { erreur?: string } | null)?.erreur ?? `erreur ${r.status}`, data };
    return { ok: true, status: r.status, data: data as T };
  } catch {
    return { ok: false, status: 0, erreur: "serveur injoignable" };
  }
}

let santeP: Promise<Sante | null> | null = null;
/** État du serveur, mis en cache pour la session de la page. `null` = pas de serveur SkillForge. */
export function sante(): Promise<Sante | null> {
  santeP ??= api<Sante>("GET", "/api/sante").then((r) => (r.ok && r.data?.ok ? r.data : null));
  return santeP;
}

/** État du compte partagé entre composants. */
export type EtatCompte = { kind: "chargement" } | { kind: "hors-ligne" } | { kind: "anonyme" } | { kind: "connecte"; user: Utilisateur };

let etat: EtatCompte = { kind: "chargement" };
const abonnes = new Set<(e: EtatCompte) => void>();
let charge: Promise<void> | null = null;

function publier(e: EtatCompte) {
  etat = e;
  abonnes.forEach((f) => f(e));
}

export function rechargerCompte(): Promise<void> {
  charge = (async () => {
    const s = await sante();
    if (!s?.comptes) return publier({ kind: "hors-ligne" });
    const r = await api<{ utilisateur: Utilisateur }>("GET", "/api/moi");
    publier(r.ok ? { kind: "connecte", user: r.data.utilisateur } : r.status === 401 ? { kind: "anonyme" } : { kind: "hors-ligne" });
  })();
  return charge;
}

export function useCompte(): EtatCompte {
  const [e, setE] = useState(etat);
  useEffect(() => {
    abonnes.add(setE);
    if (!charge) void rechargerCompte();
    else setE(etat);
    return () => void abonnes.delete(setE);
  }, []);
  return e;
}

export async function connexion(email: string, password: string) {
  const r = await api<{ utilisateur: Utilisateur }>("POST", "/api/session", { email, password });
  if (r.ok) publier({ kind: "connecte", user: r.data.utilisateur });
  return r;
}

export async function inscription(email: string, password: string, name: string) {
  const r = await api<{ utilisateur: Utilisateur }>("POST", "/api/comptes", { email, password, name });
  if (r.ok) publier({ kind: "connecte", user: r.data.utilisateur });
  return r;
}

export async function deconnexion() {
  const r = await api("DELETE", "/api/session");
  if (r.ok || r.status === 401) publier({ kind: "anonyme" });
  return r;
}

export async function supprimerCompte(password: string) {
  const r = await api("DELETE", "/api/moi", { password });
  if (r.ok) publier({ kind: "anonyme" });
  return r;
}

export interface Signalement {
  id: number;
  at: string;
  kind: "exercice" | "tuteur" | "lecon";
  target: string;
  targetVersion: number | null;
  message: string;
  status: "nouveau" | "en-cours" | "corrige" | "rejete";
  note: string;
  updatedAt?: string;
}

export const statutSignalement: Record<Signalement["status"], string> = { nouveau: "Nouveau", "en-cours": "En cours", corrige: "Corrigé", rejete: "Non retenu" };

export interface Consommation {
  budget: { requestsPerDay: number; tokensPerDay: number };
  aujourdhui: { requests: number; tokens: number; estimated: boolean };
  jours: { day: string; requests: number; tokens: number; estimated: boolean }[];
  executions: { at: string; model: string; mode: string; inputTokens: number; outputTokens: number; estimated: boolean; status: string }[];
}

/**
 * Erreurs du navigateur : gardées localement (20 dernières) et envoyées au serveur s'il existe.
 * Uniquement le message et la route, jamais le code de l'étudiant ni le contenu de la page.
 */
export function installerJournalErreurs(garder: (e: { at: string; message: string; route: string }) => void) {
  let envoyees = 0;
  const report = (message: string) => {
    const e = { at: new Date().toISOString(), message: message.slice(0, 300), route: location.hash.split("?")[0] };
    garder(e);
    if (envoyees++ < 10) void sante().then((s) => s && api("POST", "/api/erreurs-client", { message: e.message, route: e.route }));
  };
  addEventListener("error", (ev) => report(ev.message || "erreur inconnue"));
  addEventListener("unhandledrejection", (ev) => report(ev.reason instanceof Error ? ev.reason.message : String(ev.reason)));
  return report;
}

import { useEffect, useState } from "react";

export interface Route {
  name: "accueil" | "onboarding" | "tableau" | "lecon" | "programme" | "parametres" | "revision" | "lecons" | "projet" | "introuvable";
  params: string[];
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const [path, qs = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(qs);
  const [head, ...params] = parts;
  const known: Route["name"][] = ["onboarding", "tableau", "lecon", "programme", "parametres", "revision", "lecons", "projet"];
  if (!head) return { name: "accueil", params: [], query };
  if ((known as string[]).includes(head)) return { name: head as Route["name"], params, query };
  return { name: "introuvable", params, query };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const h = () => setHash(location.hash);
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  return parseHash(hash);
}

export function navigate(href: string, replace = false) {
  if (replace) history.replaceState(null, "", href);
  else location.hash = href.replace(/^#/, "");
  if (replace) dispatchEvent(new HashChangeEvent("hashchange"));
}

import { useEffect } from "react";
import { useApp } from "./app-context";
import { useRoute } from "./router";
import { Dashboard } from "./pages/Dashboard";
import { LessonPage } from "./pages/LessonPage";
import { Onboarding, Welcome } from "./pages/Onboarding";
import { Curriculum } from "./pages/Curriculum";
import { Settings } from "./pages/Settings";
import { ReviewPage } from "./pages/ReviewPage";

/** Mesure du temps actif : page visible ET interaction dans la dernière minute. */
function useActivityTracker() {
  const { store } = useApp();
  useEffect(() => {
    let last = Date.now();
    const bump = () => (last = Date.now());
    const evs = ["pointerdown", "keydown", "scroll", "wheel"];
    evs.forEach((e) => addEventListener(e, bump, { passive: true, capture: true }));
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - last < 60_000) void store.addActiveSeconds(15);
    }, 15_000);
    return () => {
      clearInterval(t);
      evs.forEach((e) => removeEventListener(e, bump, { capture: true }));
    };
  }, [store]);
}

export function App() {
  const route = useRoute();
  const { data, runnerState } = useApp();
  useActivityTracker();

  const nav = [
    { href: "#/tableau", label: "Tableau de bord", name: "tableau" },
    { href: "#/lecon/py-boucles-accumulateurs", label: "Leçon", name: "lecon" },
    { href: "#/programme", label: "Programme", name: "programme" },
    { href: "#/parametres", label: "Paramètres", name: "parametres" },
  ];

  let page;
  switch (route.name) {
    case "accueil":
      page = data.profile ? <Dashboard /> : <Welcome />;
      break;
    case "onboarding":
      page = <Onboarding />;
      break;
    case "tableau":
      page = data.profile ? <Dashboard /> : <Welcome />;
      break;
    case "lecon":
      page = <LessonPage route={route} />;
      break;
    case "programme":
      page = <Curriculum />;
      break;
    case "parametres":
      page = <Settings />;
      break;
    case "revision":
      page = <ReviewPage route={route} />;
      break;
    default:
      page = (
        <div className="page">
          <h1>Page introuvable</h1>
          <a href="#/">Retour à l'accueil</a>
        </div>
      );
  }

  useEffect(() => {
    const titles: Record<string, string> = { tableau: "Tableau de bord", lecon: "Leçon", programme: "Programme", parametres: "Paramètres", onboarding: "Mon parcours", revision: "Révision" };
    document.title = titles[route.name] ? `${titles[route.name]} · SkillForge AI` : "SkillForge AI";
  }, [route.name]);

  const dot = runnerState.kind === "ready" ? "ok" : runnerState.kind === "error" ? "err" : runnerState.kind === "idle" ? "" : "busy";
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 32 32">
              <path d="M7 23l9-14 9 14" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          SkillForge AI
        </a>
        <nav className="topnav" aria-label="Navigation principale">
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={route.name === n.name || (n.name === "tableau" && route.name === "accueil" && data.profile) ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        <span className="engine-status" title="Moteur Python (Pyodide)">
          <span className={`dot ${dot}`} aria-hidden="true" />
          <span className="label">
            {runnerState.kind === "ready" ? "Python prêt" : runnerState.kind === "error" ? "Python indisponible" : runnerState.kind === "idle" ? "Python en veille" : "Python…"}
          </span>
        </span>
      </header>
      <main id="main" tabIndex={-1}>
        {page}
      </main>
    </div>
  );
}

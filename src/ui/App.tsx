import { useEffect } from "react";
import { useApp } from "./app-context";
import { useRoute } from "./router";
import { lessonById } from "../content";
import { Dashboard } from "./pages/Dashboard";
import { LessonPage } from "./pages/LessonPage";
import { Onboarding, Welcome } from "./pages/Onboarding";
import { Curriculum } from "./pages/Curriculum";
import { Settings } from "./pages/Settings";
import { ReviewPage } from "./pages/ReviewPage";
import { LessonsPage } from "./pages/LessonsPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SkillMap } from "./pages/SkillMap";

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
  const { data, runnerState, sqlState } = useApp();
  useActivityTracker();

  const nav = [
    { href: "#/tableau", label: "Tableau de bord", name: "tableau" },
    { href: "#/lecons", label: "Leçons", name: "lecons" },
    { href: "#/carte", label: "Carte", name: "carte" },
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
    case "lecons":
      page = <LessonsPage />;
      break;
    case "projet":
      page = <ProjectPage route={route} />;
      break;
    case "carte":
      page = <SkillMap route={route} />;
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
    const titles: Record<string, string> = { tableau: "Tableau de bord", lecon: "Leçon", programme: "Programme", parametres: "Paramètres", onboarding: "Mon parcours", revision: "Révision", lecons: "Leçons", projet: "Projet", carte: "Carte des compétences" };
    document.title = titles[route.name] ? `${titles[route.name]} · SkillForge AI` : "SkillForge AI";
  }, [route.name]);

  // Le moteur affiché est celui de la page : PostgreSQL pour le contenu SQL, Python sinon.
  const sqlPage = (route.name === "lecon" && lessonById.get(route.params[0])?.domain === "sql") || route.name === "projet";
  const st = sqlPage ? sqlState : runnerState;
  const engineName = sqlPage ? "PostgreSQL" : "Python";
  const dot = st.kind === "ready" ? "ok" : st.kind === "error" ? "err" : st.kind === "idle" ? "" : "busy";
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
          <span className="brand-text">SkillForge AI</span>
        </a>
        <nav className="topnav" aria-label="Navigation principale">
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={route.name === n.name || (n.name === "lecons" && (route.name === "lecon" || route.name === "projet")) || (n.name === "tableau" && route.name === "accueil" && data.profile) ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <span className="spacer" />
        <span className="engine-status" title={sqlPage ? "Moteur PostgreSQL (PGlite)" : "Moteur Python (Pyodide)"}>
          <span className={`dot ${dot}`} aria-hidden="true" />
          <span className="label">
            {engineName} {st.kind === "ready" ? "prêt" : st.kind === "error" ? "indisponible" : st.kind === "idle" ? "en veille" : "…"}
          </span>
        </span>
      </header>
      <main id="main" tabIndex={-1}>
        {page}
      </main>
    </div>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./ui/app-context";
import { App } from "./ui/App";
import "./ui/styles.css";
import { installerJournalErreurs } from "./services/serveur";

// Erreurs du navigateur : 20 dernières gardées localement (Paramètres → Diagnostic), envoyées au serveur s'il existe.
installerJournalErreurs((e) => {
  try {
    const list = JSON.parse(localStorage.getItem("sf-erreurs") ?? "[]") as unknown[];
    localStorage.setItem("sf-erreurs", JSON.stringify([e, ...list].slice(0, 20)));
  } catch {
    /* stockage indisponible : l'erreur reste seulement dans la console */
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

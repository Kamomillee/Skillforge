import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./ui/app-context";
import { App } from "./ui/App";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

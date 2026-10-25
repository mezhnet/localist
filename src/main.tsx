// Schrift Inter, mit der App gebündelt (OFL-Lizenz) – es wird nichts aus dem Internet geladen.
import "@fontsource-variable/inter";
import { openUrl } from "@tauri-apps/plugin-opener";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function start() {
  if ("__TAURI_INTERNALS__" in window) {
    // Links aus dem Editor (z. B. über "Link öffnen") im Standardbrowser öffnen, nicht im App-Fenster.
    window.open = (url) => {
      if (url) void openUrl(String(url));
      return null;
    };
  } else if (import.meta.env.DEV) {
    // Im normalen Browser (npm run dev ohne Tauri) einen simulierten Vault verwenden.
    const { installDevBackend } = await import("./lib/dev-backend");
    installDevBackend();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();

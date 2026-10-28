// Schriften Plus Jakarta Sans (Text) und JetBrains Mono (Datum, Kürzel, Code), mit der App gebündelt (OFL-Lizenz) –
// es wird nichts aus dem Internet geladen.
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/plus-jakarta-sans";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { themaAnwenden } from "./lib/theme";

async function start() {
  // Modus und Akzentfarbe vor dem ersten Zeichnen setzen (die Styles sind dann schon geladen).
  themaAnwenden();
  if ("__TAURI_INTERNALS__" in window) {
    // Das Fenster startet unsichtbar (tauri.conf.json) und erscheint erst jetzt, in den richtigen Farben.
    void getCurrentWindow()
      .show()
      .catch(() => {});
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

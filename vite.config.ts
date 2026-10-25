import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  // Vitest: Tests laufen in einer simulierten Browser-Umgebung (jsdom),
  // damit React-Komponenten wie im echten Fenster gerendert werden können.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    // CSS bleibt in Tests sonst leer. Der Inhalt wird nur gebraucht, wenn ein Test eine Datei mit ?raw liest
    // (Prüfung des Design-Systems in src/styles/tokens.test.ts).
    css: { include: [/\.css\?raw$/] },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

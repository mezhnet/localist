// Wird vor jeder Testdatei geladen (siehe test.setupFiles in vite.config.ts).
// Testing Library räumt nach jedem Test das gerenderte DOM wieder auf, damit
// sich Tests nicht gegenseitig beeinflussen.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// jsdom kennt matchMedia nicht; die Editor-Oberfläche (Mantine) fragt damit das Farbschema ab.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

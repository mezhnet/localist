// Wird vor jeder Testdatei geladen (siehe test.setupFiles in vite.config.ts).
// Testing Library räumt nach jedem Test das gerenderte DOM wieder auf, damit
// sich Tests nicht gegenseitig beeinflussen.
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

afterEach(cleanup);

// findBy… und waitFor warten bis zu 5 Sekunden (Standard: 1). Die Oberfläche ist seit Etappe 9 größer
// (Startseite, Favoriten, seit Etappe 11 der Code-Editor); wenn alle Testdateien parallel laufen,
// dauern Abfragen in jsdom auf einem ausgelasteten Rechner länger.
configure({ asyncUtilTimeout: 5000 });

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

// jsdom misst keine Textbereiche (Range.getClientRects fehlt). CodeMirror braucht das, wenn es zu einer
// Stelle scrollt (z. B. nach dem Einfügen eines Bausteins); leere Maße reichen für die Tests.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  const empty = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => empty;
}

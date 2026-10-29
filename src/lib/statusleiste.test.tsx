// Android-Statusleiste: Die App meldet der Rust-Seite beim Start und bei jedem Wechsel, ob der geltende Modus dunkel
// ist (Dunkel/Schwarz → helle Symbole, Hell → dunkle). Die Rust-Seite (src-tauri/src/statusleiste.rs) setzt dann
// auf Android die Symbole, am PC tut sie nichts.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme";

let aufrufe: unknown[] = [];
let systemDunkel = false;
let systemWechsel: (() => void) | null = null;

function Knoepfe() {
  const { setModus, setWieSystem, setAkzent } = useTheme();
  return (
    <>
      <button onClick={() => setModus("light")}>Hell</button>
      <button onClick={() => setModus("dark")}>Dunkel</button>
      <button onClick={() => setModus("black")}>Schwarz</button>
      <button onClick={() => setWieSystem(true)}>Wie System</button>
      <button onClick={() => setAkzent("blau")}>Blau</button>
    </>
  );
}
const starten = () => render(<ThemeProvider><Knoepfe /></ThemeProvider>);
const klick = (name: string) => fireEvent.click(screen.getByText(name));

beforeEach(() => {
  localStorage.clear();
  aufrufe = [];
  systemDunkel = false;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        get matches() {
          return systemDunkel && query.includes("dark");
        },
        addEventListener: (_: string, handler: () => void) => (systemWechsel = handler),
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  mockIPC((cmd, args) => {
    if (cmd === "statusleiste_setzen") aufrufe.push(args);
    return null;
  });
});
afterEach(() => {
  clearMocks();
  vi.restoreAllMocks();
});

describe("Statusleiste folgt dem Modus der App", () => {
  it("meldet beim Start den gespeicherten Modus: Schwarz bei hellem System → helle Symbole", () => {
    localStorage.setItem("theme", "black");
    starten();
    expect(aufrufe).toEqual([{ dunkel: true }]);
  });

  it("meldet beim Start „Wie System“ bei hellem System als hell", () => {
    starten();
    expect(aufrufe).toEqual([{ dunkel: false }]);
  });

  it("meldet jeden Wechsel zwischen hell und dunkel sofort, aber nicht Dunkel → Schwarz oder die Akzentfarbe", () => {
    starten();
    klick("Schwarz");
    klick("Dunkel"); // bleibt dunkel: kein neuer Aufruf
    klick("Blau");
    klick("Hell");
    klick("Dunkel");
    expect(aufrufe).toEqual([{ dunkel: false }, { dunkel: true }, { dunkel: false }, { dunkel: true }]);
  });

  it("„Wie System“: wird das Handy dunkel, folgen die Symbole", () => {
    localStorage.setItem("theme-dunkel", "black");
    starten();
    systemDunkel = true;
    act(() => systemWechsel?.());
    expect(aufrufe).toEqual([{ dunkel: false }, { dunkel: true }]);
    klick("Hell"); // ausdrücklich Hell: System egal
    expect(aufrufe).toEqual([{ dunkel: false }, { dunkel: true }, { dunkel: false }]);
  });

  it("ohne Tauri (Browser-Vorschau vor dem Start) passiert nichts und es gibt keinen Fehler", () => {
    clearMocks();
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    localStorage.setItem("theme", "dark");
    starten();
    klick("Hell");
    expect(aufrufe).toEqual([]);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

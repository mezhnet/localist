// Modus (Hell, Dunkel, Schwarz) und Akzentfarbe. Standard ist „Wie System“: Ist Windows hell, gilt Hell; ist es
// dunkel, gilt der zuletzt gewählte dunkle Modus (Dunkel oder Schwarz). Die Wahl steht im App-Speicher (nicht im
// Vault): „theme“ = light | dark | black (fehlt bei „Wie System“; alte Werte light/dark gelten weiter),
// „theme-dunkel“ = zuletzt gewählter dunkler Modus, „akzent“ = orange | blau | gruen | lila.
// `themaAnwenden()` setzt data-theme und data-accent schon vor dem ersten Zeichnen (src/main.tsx), damit nichts flackert.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Modus = "light" | "dark" | "black";
export type DunklerModus = Exclude<Modus, "light">;
export type Akzent = "orange" | "blau" | "gruen" | "lila";

export const MODI: { value: Modus; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "black", label: "Schwarz" },
];

export const AKZENTE: { value: Akzent; label: string }[] = [
  { value: "orange", label: "Orange" },
  { value: "blau", label: "Blau" },
  { value: "gruen", label: "Grün" },
  { value: "lila", label: "Lila" },
];

const MODUS_KEY = "theme";
const DUNKEL_KEY = "theme-dunkel";
const AKZENT_KEY = "akzent";

interface Wahl {
  /** Ausdrücklich gewählter Modus, null = „Wie System“. */
  modus: Modus | null;
  /** Gilt bei „Wie System“, wenn das System dunkel ist. */
  dunkel: DunklerModus;
  akzent: Akzent;
}

interface ThemeState {
  /** Der Modus, der gerade gilt. */
  resolved: Modus;
  /** Dunkel oder Schwarz: für Teile, die nur hell und dunkel kennen (BlockNote, CodeMirror). */
  dark: boolean;
  wieSystem: boolean;
  akzent: Akzent;
  /** Wählt einen Modus und schaltet „Wie System“ aus. */
  setModus: (modus: Modus) => void;
  setWieSystem: (an: boolean) => void;
  setAkzent: (akzent: Akzent) => void;
}

const lesen = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const schreiben = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neustart.
  }
};

function gespeicherteWahl(): Wahl {
  const modus = lesen(MODUS_KEY);
  const dunkel = lesen(DUNKEL_KEY);
  const akzent = lesen(AKZENT_KEY);
  return {
    modus: MODI.some((m) => m.value === modus) ? (modus as Modus) : null,
    // Wer früher „Dunkel“ gewählt hatte, bekommt bei „Wie System“ weiter Dunkel.
    dunkel: dunkel === "black" ? "black" : modus === "black" ? "black" : "dark",
    akzent: AKZENTE.some((a) => a.value === akzent) ? (akzent as Akzent) : "orange",
  };
}

const systemDunkel = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
const aufloesen = (wahl: Wahl, dunkel: boolean): Modus => wahl.modus ?? (dunkel ? wahl.dunkel : "light");

function setzen(modus: Modus, akzent: Akzent) {
  const html = document.documentElement;
  html.dataset.theme = modus;
  html.dataset.accent = akzent;
  html.style.colorScheme = modus === "light" ? "light" : "dark";
}

/** Setzt Modus und Akzentfarbe sofort aus dem App-Speicher (vor dem ersten Zeichnen aufrufen). */
export function themaAnwenden(): void {
  const wahl = gespeicherteWahl();
  setzen(aufloesen(wahl, systemDunkel()), wahl.akzent);
}

const ThemeContext = createContext<ThemeState>({
  resolved: "light",
  dark: false,
  wieSystem: true,
  akzent: "orange",
  setModus: () => {},
  setWieSystem: () => {},
  setAkzent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [wahl, setWahl] = useState<Wahl>(gespeicherteWahl);
  const [system, setSystem] = useState(systemDunkel);

  // Ändert sich die Windows-Einstellung, zieht die App sofort nach.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystem(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const resolved = aufloesen(wahl, system);

  useEffect(() => setzen(resolved, wahl.akzent), [resolved, wahl.akzent]);

  const setModus = (modus: Modus) => {
    const dunkel = modus === "light" ? wahl.dunkel : modus;
    setWahl({ ...wahl, modus, dunkel });
    schreiben(MODUS_KEY, modus);
    schreiben(DUNKEL_KEY, dunkel);
  };
  const setWieSystem = (an: boolean) => {
    // Ausschalten behält den Modus, der gerade gilt.
    const modus = an ? null : resolved;
    setWahl({ ...wahl, modus });
    schreiben(MODUS_KEY, modus);
  };
  const setAkzent = (akzent: Akzent) => {
    setWahl({ ...wahl, akzent });
    schreiben(AKZENT_KEY, akzent);
  };

  return (
    <ThemeContext.Provider value={{ resolved, dark: resolved !== "light", wieSystem: wahl.modus === null, akzent: wahl.akzent, setModus, setWieSystem, setAkzent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

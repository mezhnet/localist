// Eigener Fensterrahmen auf dem PC (Vorlage 01/02): Statt der Windows-Titelleiste gibt es oben eine Leiste auf dem
// Fensterhintergrund. Freie Stellen darin verschieben das Fenster (data-tauri-drag-region), ein Doppelklick maximiert,
// oben rechts stehen drei schlichte Knöpfe. Die Größe ändert man wie gewohnt am Rand, Win+Pfeiltasten docken an
// (beides erledigt Tauri für Fenster ohne Rahmen). Auf dem Handy gibt es weder Leiste noch Knöpfe.
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";

/** Hat dieses Gerät ein verschiebbares Fenster mit eigenem Rahmen? (nicht auf Android und iOS) */
export function hatFensterrahmen(platform: string): boolean {
  return platform !== "android" && platform !== "ios";
}

/** Das App-Fenster; fehlt es (z. B. in Tests ohne Tauri), passiert bei den Knöpfen nichts. */
function fenster(): Window | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/** Ist das Fenster maximiert? Folgt auch Doppelklick, Win+Pfeiltasten und Andocken (über das Ereignis „resized“). */
function useMaximiert(): [boolean, () => void] {
  const [maximiert, setMaximiert] = useState(false);
  const pruefen = useCallback(() => {
    fenster()
      ?.isMaximized()
      .then(setMaximiert, () => {});
  }, []);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let vorbei = false;
    pruefen();
    // Abmelden darf nie scheitern (z. B. wenn beim Beenden die Ereignis-Schnittstelle schon fort ist); Tauri meldet
    // asynchron ab, deshalb über ein Versprechen.
    const abmelden = (ende?: () => void) => {
      if (ende) void Promise.resolve().then(ende).catch(() => {});
    };
    fenster()
      ?.onResized(pruefen)
      .then((ende) => (vorbei ? abmelden(ende) : (stop = ende)), () => {});
    return () => {
      vorbei = true;
      abmelden(stop);
    };
  }, [pruefen]);
  return [maximiert, pruefen];
}

/** Minimieren, Maximieren/Wiederherstellen und Schließen. Wie die Knöpfe von Windows nicht in der Tab-Reihenfolge. */
export function FensterKnoepfe() {
  const [maximiert, pruefen] = useMaximiert();
  return (
    <div className="fenster-knoepfe" role="group" aria-label="Fenster">
      <button type="button" tabIndex={-1} className="fenster-knopf" aria-label="Fenster minimieren" title="Minimieren" onClick={() => void fenster()?.minimize().catch(() => {})}>
        <Minus aria-hidden="true" />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="fenster-knopf"
        aria-label={maximiert ? "Fenster wiederherstellen" : "Fenster maximieren"}
        title={maximiert ? "Wiederherstellen" : "Maximieren"}
        onClick={() =>
          void fenster()
            ?.toggleMaximize()
            .then(pruefen, () => {})
        }
      >
        {maximiert ? <Copy aria-hidden="true" className="fenster-symbol-wiederherstellen" /> : <Square aria-hidden="true" />}
      </button>
      {/* close() löst wie das X von Windows „Schließen angefordert“ aus: Ungespeichertes wird vorher gesichert. */}
      <button type="button" tabIndex={-1} className="fenster-knopf is-schliessen" aria-label="Fenster schließen" title="Schließen" onClick={() => void fenster()?.close().catch(() => {})}>
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Obere Leiste: Freie Stellen ziehen das Fenster (auch zwischen den Elementen in `children`), Knöpfe und
 * Eingabefelder darin nicht. Ohne Fensterrahmen (Handy) wird nichts gezeigt.
 */
export function Fensterleiste({ platform, className, children }: { platform: string; className?: string; children?: ReactNode }) {
  if (!hatFensterrahmen(platform)) return null;
  return (
    <div className={cx("fensterleiste", className)} data-tauri-drag-region="deep">
      {children}
      <span className="fensterleiste-frei" />
      <FensterKnoepfe />
    </div>
  );
}

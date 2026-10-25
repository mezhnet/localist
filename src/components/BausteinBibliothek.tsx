// Bereich „Bausteine“ (Sidebar): die ganze Bibliothek – eingebaute und eigene Bausteine – mit fertiger Vorschau,
// dazu die Hilfe mit Erklärung und Beispielcode zum Kopieren. Eigene Bausteine lassen sich hier bearbeiten,
// umbenennen und löschen. Die Vorschau ist die virtuelle Seite `.localist/bausteine/bibliothek.html` in der
// abgeschotteten Anzeige (wie jede HTML-Seite).
import { Check, Copy, Pencil, TextCursorInput, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/autosave";
import { BAUSTEINE, type BausteinInfo } from "../lib/bausteine";
import { BIBLIOTHEK_PFAD } from "../lib/bibliothek";
import { ankerMessage, parseBridgeMessage, themeMessage } from "../lib/bridge";
import type { EigenerBaustein } from "../lib/eigene-bausteine";
import { useTheme } from "../lib/theme";
import { confirmAction, deleteEigenerBaustein, pageUrl } from "../lib/vault-api";
import { BAUSTEIN_SYMBOLE } from "./BausteinLeiste";
import { EigenerBausteinDialog } from "./EigenerBausteinDialog";
import { Button, cx, IconButton, Tab, TabList } from "./ui";

interface Props {
  eigene: EigenerBaustein[];
  onEigeneChanged: () => void;
  onError: (message: string) => void;
}

type Bereich = "bibliothek" | "hilfe";

/** Kopiert Text in die Zwischenablage (mit Ausweichweg für ältere Umgebungen). */
async function kopieren(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const feld = document.createElement("textarea");
    feld.value = text;
    feld.style.position = "fixed";
    feld.style.opacity = "0";
    document.body.appendChild(feld);
    feld.select();
    const ok = document.execCommand("copy");
    feld.remove();
    if (!ok) throw new Error("Der Code konnte nicht in die Zwischenablage kopiert werden.");
  }
}

function Hilfe({ onError }: { onError: (message: string) => void }) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  const copy = async (info: BausteinInfo) => {
    try {
      await kopieren(info.beispiel.join("\n"));
      setKopiert(info.art);
      window.setTimeout(() => setKopiert((current) => (current === info.art ? null : current)), 2000);
    } catch (error) {
      onError(errorMessage(error));
    }
  };
  return (
    <div className="hilfe">
      <p className="hilfe-einleitung">
        Bausteine sind fertige Elemente für HTML-Seiten. Im Code-Editor fügst du sie über die Werkzeugleiste oder mit „/“ am Zeilenanfang ein. In „Lesen“ und
        „Geteilt“ öffnet das Stift-Symbol eines Bausteins ein Formular, mit dem du ihn ohne Code änderst.
      </p>
      {BAUSTEINE.map((info) => {
        const Symbol = BAUSTEIN_SYMBOLE[info.art];
        return (
          <section key={info.art} className="hilfe-eintrag" aria-labelledby={`hilfe-${info.art}`}>
            <h2 id={`hilfe-${info.art}`}>
              <Symbol aria-hidden="true" /> {info.name}
            </h2>
            <p>{info.hilfe}</p>
            <div className="hilfe-code">
              <pre>
                <code>{info.beispiel.join("\n")}</code>
              </pre>
              <Button size="sm" variant="ghost" icon={kopiert === info.art ? <Check /> : <Copy />} aria-label={`Beispielcode „${info.name}“ kopieren`} onClick={() => void copy(info)}>
                {kopiert === info.art ? "Kopiert" : "Kopieren"}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function BausteinBibliothek({ eigene, onEigeneChanged, onError }: Props) {
  const [bereich, setBereich] = useState<Bereich>("bibliothek");
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ baustein: EigenerBaustein; nurName: boolean } | null>(null);
  /** Neu laden, wenn sich die eigenen Bausteine geändert haben. */
  const [version, setVersion] = useState(1);
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolved } = useTheme();
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const erstesMal = useRef(true);

  useEffect(() => {
    if (erstesMal.current) {
      erstesMal.current = false;
      return;
    }
    setVersion((v) => v + 1);
  }, [eigene]);

  // Nachrichten der Vorschau: Farbschema beim Start, Tastenkürzel der App.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = parseBridgeMessage(event.data);
      if (message?.typ === "bereit") frame.current.contentWindow?.postMessage(themeMessage(resolvedRef.current), "*");
      else if (message?.typ === "taste") window.dispatchEvent(new KeyboardEvent("keydown", { key: message.taste, ctrlKey: true, shiftKey: message.umschalt, bubbles: true }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage(themeMessage(resolved), "*");
  }, [resolved]);

  const zeigen = (id: string) => {
    setAuswahl(id);
    frame.current?.contentWindow?.postMessage(ankerMessage(id), "*");
  };

  const loeschen = async (baustein: EigenerBaustein) => {
    if (!(await confirmAction(`Den eigenen Baustein „${baustein.name}“ in den Papierkorb verschieben?`, "Baustein löschen"))) return;
    try {
      await deleteEigenerBaustein(baustein.name);
      onEigeneChanged();
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  return (
    <div className="page is-wide bibliothek-seite">
      <h1 className="bibliothek-titel">Bausteine</h1>
      <TabList label="Bereich">
        <Tab selected={bereich === "bibliothek"} onClick={() => setBereich("bibliothek")}>
          Bibliothek
        </Tab>
        <Tab selected={bereich === "hilfe"} onClick={() => setBereich("hilfe")}>
          Hilfe
        </Tab>
      </TabList>
      {bereich === "hilfe" ? (
        <Hilfe onError={onError} />
      ) : (
        <div className="bibliothek">
          <nav className="bibliothek-liste" aria-label="Bausteine">
            <h2>Eingebaut</h2>
            <ul>
              {BAUSTEINE.map((info) => {
                const Symbol = BAUSTEIN_SYMBOLE[info.art];
                const id = `baustein-${info.art}`;
                return (
                  <li key={info.art}>
                    <button type="button" className={cx("bibliothek-eintrag", auswahl === id && "active")} onClick={() => zeigen(id)}>
                      <Symbol aria-hidden="true" />
                      <span>
                        <span className="bibliothek-name">{info.name}</span>
                        <span className="bibliothek-beschreibung">{info.beschreibung}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <h2>Eigene</h2>
            {eigene.length === 0 ? (
              <p className="bibliothek-leer">Markiere im Code-Editor einen Abschnitt und wähle „Als Baustein speichern“.</p>
            ) : (
              <ul aria-label="Eigene Bausteine">
                {eigene.map((baustein, i) => {
                  const id = `eigen-${i}`;
                  return (
                    <li key={baustein.name} className="bibliothek-eigen">
                      <button type="button" className={cx("bibliothek-eintrag", auswahl === id && "active")} onClick={() => zeigen(id)}>
                        <span>
                          <span className="bibliothek-name">{baustein.name}</span>
                          <span className="bibliothek-beschreibung">{baustein.beschreibung || "Ohne Beschreibung"}</span>
                        </span>
                      </button>
                      <span className="bibliothek-aktionen">
                        <IconButton size="sm" label={`„${baustein.name}“ bearbeiten`} onClick={() => setDialog({ baustein, nurName: false })}>
                          <Pencil />
                        </IconButton>
                        <IconButton size="sm" label={`„${baustein.name}“ umbenennen`} onClick={() => setDialog({ baustein, nurName: true })}>
                          <TextCursorInput />
                        </IconButton>
                        <IconButton size="sm" label={`„${baustein.name}“ löschen`} onClick={() => void loeschen(baustein)}>
                          <Trash2 />
                        </IconButton>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <div className="bibliothek-vorschau">
            <iframe ref={frame} className="html-frame" title="Vorschau der Bausteine" sandbox="allow-scripts" referrerPolicy="no-referrer" src={pageUrl(BIBLIOTHEK_PFAD, version)} />
          </div>
        </div>
      )}
      {dialog && (
        <EigenerBausteinDialog
          baustein={dialog.baustein}
          nurName={dialog.nurName}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onEigeneChanged();
          }}
        />
      )}
    </div>
  );
}

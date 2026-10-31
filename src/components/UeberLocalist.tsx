// Abschnitt „Über Localist“ in den Einstellungen (PC-Dialog und Handy-Seite): Versionsnummer und Updates.
// Am PC sucht der Knopf „Nach Updates suchen“ über GitHub Releases (src/lib/updates.ts), erst nach dem Klick.
// Auf Android gibt es keinen Updater; dort öffnet ein Knopf die Releases-Seite im Standardbrowser.
import { getVersion } from "@tauri-apps/api/app";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import { useEffect, useRef, useState } from "react";
import { hatUpdater, nachUpdatesSuchen, RELEASES_SEITE, updateInstallieren, updateText, type UpdateZustand } from "../lib/updates";
import { Button } from "./ui";

interface Props {
  platform: string;
  /** Speichert alle ausstehenden Änderungen; scheitert, wenn etwas nicht gespeichert werden konnte. */
  vorDemUpdate: () => Promise<void>;
  /** Öffnet eine Adresse im Standardbrowser (vorhandener Weg für externe Links). */
  onOpenExternal: (url: string) => void;
  /** Meldet, ob gerade ein Update lädt oder installiert wird (dann bleiben die Einstellungen offen). */
  onLaeuft?: (laeuft: boolean) => void;
  handy?: boolean;
}

export function UeberLocalist({ platform, vorDemUpdate, onOpenExternal, onLaeuft, handy = false }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [zustand, setZustand] = useState<UpdateZustand>({ art: "bereit" });
  const updater = hatUpdater(platform);
  const laeuft = zustand.art === "laedt" || zustand.art === "installiert";

  // Nur die eigene Versionsnummer (aus tauri.conf.json); keine Anfrage ins Netz.
  useEffect(() => {
    let aktiv = true;
    getVersion()
      .then((wert) => aktiv && setVersion(wert))
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, []);

  useEffect(() => onLaeuft?.(laeuft), [laeuft, onLaeuft]);

  // Ein gefundenes, aber nicht installiertes Update gibt seine Ressource auf der Rust-Seite wieder frei.
  const offenRef = useRef<Update | null>(null);
  const freigeben = () => {
    void offenRef.current?.close().catch(() => {});
    offenRef.current = null;
  };
  useEffect(() => freigeben, []);

  const suchen = async () => {
    freigeben();
    setZustand({ art: "sucht" });
    const ergebnis = await nachUpdatesSuchen(version ?? "");
    if (ergebnis.art === "verfuegbar") offenRef.current = ergebnis.update;
    setZustand(ergebnis);
  };

  const installieren = async () => {
    if (zustand.art !== "verfuegbar") return;
    // Ab hier gehört die Ressource der Installation.
    offenRef.current = null;
    await updateInstallieren(zustand.update, vorDemUpdate, setZustand);
  };

  const text = updateText(zustand);
  const knopfKlasse = handy ? "handy-einstellungen-knopf" : undefined;
  return (
    <div className="ueber-localist">
      <div className="settings-text">
        <h3>Über Localist</h3>
        <p>
          Version <span className="app-version">{version ?? "…"}</span>. Alle Seiten liegen als normale Dateien in deinem Vault. Keine Konten, kein Server,
          keine Telemetrie – Localist funktioniert offline. {updater ? "Nur nach Klick auf „Nach Updates suchen“ fragt Localist bei GitHub nach einer neuen Version." : ""}
        </p>
      </div>
      {updater ? (
        <>
          {zustand.art !== "verfuegbar" && !laeuft && (
            <Button className={knopfKlasse} icon={<RefreshCw />} disabled={zustand.art === "sucht"} onClick={() => void suchen()}>
              Nach Updates suchen
            </Button>
          )}
          {text && (
            <div className={`update-status update-status--${zustand.art}`} role="status" aria-live="polite">
              <p className="update-meldung">{text}</p>
              {zustand.art === "verfuegbar" && zustand.notizen.trim() && <p className="update-notizen">{zustand.notizen.trim()}</p>}
              {zustand.art === "laedt" && (
                <div
                  className="update-fortschritt"
                  role="progressbar"
                  aria-label="Download des Updates"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={zustand.prozent ?? undefined}
                >
                  <span style={{ width: `${zustand.prozent ?? 0}%` }} />
                </div>
              )}
            </div>
          )}
          {zustand.art === "verfuegbar" && (
            <Button className={knopfKlasse} variant="primary" icon={<Download />} onClick={() => void installieren()}>
              Jetzt installieren
            </Button>
          )}
        </>
      ) : (
        <Button className={knopfKlasse} icon={<ExternalLink />} onClick={() => onOpenExternal(RELEASES_SEITE)}>
          Neue Versionen auf GitHub ansehen
        </Button>
      )}
    </div>
  );
}

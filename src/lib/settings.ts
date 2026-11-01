// Vault-Einstellungen in `.localist/settings.json` (z. B. Eigenschaftstypen und Favoriten).
// Nur dieser Hook liest und schreibt die Datei, damit sich Änderungen aus verschiedenen Teilen
// der App nicht gegenseitig überschreiben. Unbekannte Felder bleiben beim Speichern erhalten.
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./autosave";
import { readPage, writePage } from "./vault-api";

export const SETTINGS_FILE = ".localist/settings.json";

export type VaultSettings = Record<string, unknown>;

export interface VaultSettingsState {
  settings: VaultSettings;
  /** Die Datei ist gelesen (oder fehlt bzw. ist beschädigt); vorher gelten noch keine Werte des Vaults. */
  geladen: boolean;
  /** Ändert die Einstellungen und speichert sie sofort. */
  update: (change: (settings: VaultSettings) => VaultSettings) => Promise<void>;
}

export function useVaultSettings(onError: (message: string) => void): VaultSettingsState {
  const [settings, setSettings] = useState<VaultSettings>({});
  const [geladen, setGeladen] = useState(false);
  const ref = useRef<VaultSettings>({});
  /** Die Datei ist kein gültiges JSON: nicht überschreiben, sonst gingen Einstellungen verloren. */
  const broken = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readPage(SETTINGS_FILE).then(
      (text) => {
        if (cancelled) return;
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("kein Objekt");
          // Änderungen, die vor dem Laden passiert sind, behalten.
          ref.current = { ...(parsed as VaultSettings), ...ref.current };
          setSettings(ref.current);
        } catch {
          broken.current = true;
        }
        setGeladen(true);
      },
      () => {
        // Datei fehlt: Sie wird beim ersten Speichern angelegt.
        if (!cancelled) setGeladen(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (change: (settings: VaultSettings) => VaultSettings) => {
      if (broken.current) {
        onError(`Die Einstellungen in „${SETTINGS_FILE}“ sind beschädigt und werden nicht überschrieben. Bitte die Datei prüfen.`);
        return;
      }
      const next = change(ref.current);
      if (JSON.stringify(next) === JSON.stringify(ref.current)) return;
      ref.current = next;
      setSettings(next);
      try {
        await writePage(SETTINGS_FILE, `${JSON.stringify({ version: 1, ...next }, null, 2)}\n`);
      } catch (error) {
        onError(`Die Vault-Einstellungen konnten nicht gespeichert werden: ${errorMessage(error)}`);
      }
    },
    [onError],
  );

  return { settings, geladen, update };
}

// Ordnerauswahl für den Vault auf dem Handy. Android liefert im System-Dialog keine normalen
// Dateipfade, deshalb blättert man hier selbst durch den Gerätespeicher.
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/autosave";
import { createFolderAt, listFolders, storageLocations, type FolderEntry } from "../lib/vault-api";

interface Props {
  onPick: (path: string) => void;
  onCancel: () => void;
}

export function FolderPicker({ onPick, onCancel }: Props) {
  const [locations, setLocations] = useState<FolderEntry[]>([]);
  /** Weg vom Startpunkt bis zum aktuellen Ordner; leer = Übersicht der Startpunkte. */
  const [trail, setTrail] = useState<FolderEntry[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const current = trail[trail.length - 1] ?? null;

  useEffect(() => {
    storageLocations().then(setLocations, (e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    setError(null);
    if (!current) return;
    listFolders(current.path).then(setFolders, (e) => {
      setFolders([]);
      setError(errorMessage(e));
    });
  }, [current]);

  const createFolder = async () => {
    if (!current || !newName.trim()) return;
    try {
      const path = await createFolderAt(current.path, newName.trim());
      setNewName("");
      setTrail([...trail, { name: newName.trim(), path }]);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const list = current ? folders : locations;
  return (
    <div className="dialog-backdrop">
      <div className="dialog folder-picker" role="dialog" aria-label="Vault-Ordner auswählen">
        <div className="folder-picker-header">
          <button type="button" aria-label="Zurück" disabled={!current} onClick={() => setTrail(trail.slice(0, -1))}>
            ←
          </button>
          <strong>{current ? trail.map((step) => step.name).join(" / ") : "Speicherort wählen"}</strong>
        </div>
        {error && <p className="notice error">{error}</p>}
        <ul className="dialog-list" aria-label="Ordner">
          {list.length === 0 && !error && <li className="dialog-empty">{current ? "Keine Unterordner." : "Lädt …"}</li>}
          {list.map((folder) => (
            <li key={folder.path} role="option" aria-selected={false} onClick={() => setTrail([...trail, folder])}>
              <span className="dialog-title">📁 {folder.name}</span>
              {!current && <span className="dialog-sub">{folder.path}</span>}
            </li>
          ))}
        </ul>
        {current && (
          <form
            className="folder-picker-new"
            onSubmit={(event) => {
              event.preventDefault();
              void createFolder();
            }}
          >
            <input aria-label="Name für neuen Ordner" placeholder="Neuer Ordner …" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" disabled={!newName.trim()}>
              Anlegen
            </button>
          </form>
        )}
        <div className="folder-picker-actions">
          <button type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="primary" disabled={!current} onClick={() => current && onPick(current.path)}>
            Diesen Ordner als Vault verwenden
          </button>
        </div>
      </div>
    </div>
  );
}

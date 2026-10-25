// Eigenschaftstypen im Vault: für Datenbank-Ordner aus `_ansichten.yaml`, sonst aus
// `.localist/settings.json` (Feld "eigenschaften"). Dieser Hook lädt und speichert beides.
import { useCallback, useEffect, useRef, useState } from "react";
import type { PropertySchema } from "../components/PropertiesBar";
import { errorMessage } from "./autosave";
import { parseDatabaseConfig, serializeDatabaseConfig, VIEWS_FILE, type DatabaseConfig } from "./database";
import { DEFAULT_STATUS_OPTIONS, isPropertyType, type PropertyType } from "./properties";
import { findNode, parentDir } from "./tree";
import { readPage, writePage, type TreeNode } from "./vault-api";

export const SETTINGS_FILE = ".localist/settings.json";

/** Alle Datenbank-Ordner im Baum. */
export function databaseFolders(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "folder" && node.database ? [node.path] : []),
    ...(node.children ? databaseFolders(node.children) : []),
  ]);
}

export function useSchemas(tree: TreeNode[], onError: (message: string) => void) {
  const [configs, setConfigs] = useState<Record<string, DatabaseConfig>>({});
  const [vaultTypes, setVaultTypes] = useState<Record<string, PropertyType>>({});
  const settingsRef = useRef<Record<string, unknown>>({});

  const reloadConfig = useCallback(async (folder: string) => {
    try {
      const config = parseDatabaseConfig(await readPage(`${folder}/${VIEWS_FILE}`));
      setConfigs((current) => ({ ...current, [folder]: config }));
    } catch {
      setConfigs((current) => {
        const next = { ...current };
        delete next[folder];
        return next;
      });
    }
  }, []);

  // Datenbanken laden, sobald sie im Baum auftauchen.
  const folders = databaseFolders(tree).join("\n");
  useEffect(() => {
    for (const folder of folders ? folders.split("\n") : []) void reloadConfig(folder);
  }, [folders, reloadConfig]);

  // Vault-Einstellungen (Typen außerhalb von Datenbanken).
  useEffect(() => {
    readPage(SETTINGS_FILE).then(
      (text) => {
        try {
          const settings = JSON.parse(text) as Record<string, unknown>;
          settingsRef.current = settings;
          const types: Record<string, PropertyType> = {};
          for (const [name, type] of Object.entries((settings.eigenschaften ?? {}) as Record<string, unknown>)) {
            if (isPropertyType(type)) types[name] = type;
          }
          setVaultTypes(types);
        } catch {
          // Unlesbare Einstellungen: mit Standardwerten weiterarbeiten, Datei nicht überschreiben.
        }
      },
      () => {},
    );
  }, []);

  const saveConfig = useCallback(
    async (folder: string, config: DatabaseConfig) => {
      setConfigs((current) => ({ ...current, [folder]: config }));
      try {
        await writePage(`${folder}/${VIEWS_FILE}`, serializeDatabaseConfig(config));
      } catch (error) {
        onError(`Die Datenbank-Einstellungen konnten nicht gespeichert werden: ${errorMessage(error)}`);
      }
    },
    [onError],
  );

  /** Ordner der Datenbank, zu der eine Seite gehört, oder null. */
  const databaseOf = (pagePath: string): string | null => {
    const folder = parentDir(pagePath);
    return folder && findNode(tree, folder)?.database && configs[folder] ? folder : null;
  };

  const schemaForPage = (pagePath: string): PropertySchema => {
    const folder = databaseOf(pagePath);
    if (folder) {
      const props = configs[folder].eigenschaften;
      return {
        types: Object.fromEntries(Object.entries(props).map(([name, def]) => [name, def.typ])),
        options: Object.fromEntries(Object.entries(props).map(([name, def]) => [name, def.optionen ?? []])),
        always: Object.keys(props),
      };
    }
    return { types: vaultTypes, options: { status: DEFAULT_STATUS_OPTIONS }, always: [] };
  };

  const setTypeForPage = async (pagePath: string, name: string, type: PropertyType) => {
    const folder = databaseOf(pagePath);
    if (folder) {
      const config = configs[folder];
      const previous = config.eigenschaften[name];
      const optionen = type === "status" && !previous?.optionen ? DEFAULT_STATUS_OPTIONS : previous?.optionen;
      await saveConfig(folder, { ...config, eigenschaften: { ...config.eigenschaften, [name]: { typ: type, ...(optionen ? { optionen } : {}) } } });
      return;
    }
    const types = { ...vaultTypes, [name]: type };
    setVaultTypes(types);
    settingsRef.current = { version: 1, ...settingsRef.current, eigenschaften: types };
    try {
      await writePage(SETTINGS_FILE, `${JSON.stringify(settingsRef.current, null, 2)}\n`);
    } catch (error) {
      onError(`Die Vault-Einstellungen konnten nicht gespeichert werden: ${errorMessage(error)}`);
    }
  };

  return { configs, reloadConfig, saveConfig, schemaForPage, setTypeForPage };
}

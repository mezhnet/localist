// Eigenschaftstypen im Vault: für Datenbank-Ordner aus `_ansichten.yaml`, sonst aus
// `.localist/settings.json` (Feld "eigenschaften", gelesen und geschrieben über useVaultSettings).
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropertySchema } from "../components/PropertiesBar";
import { errorMessage } from "./autosave";
import { parseDatabaseConfig, serializeDatabaseConfig, VIEWS_FILE, type DatabaseConfig } from "./database";
import { DEFAULT_STATUS_OPTIONS, isPropertyType, type PropertyType } from "./properties";
import { findNode, parentDir } from "./tree";
import type { VaultSettingsState } from "./settings";
import { readPage, writePage, type TreeNode } from "./vault-api";

/** Alle Datenbank-Ordner im Baum. */
export function databaseFolders(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "folder" && node.database ? [node.path] : []),
    ...(node.children ? databaseFolders(node.children) : []),
  ]);
}

export function useSchemas(tree: TreeNode[], onError: (message: string) => void, vaultSettings: VaultSettingsState) {
  const [configs, setConfigs] = useState<Record<string, DatabaseConfig>>({});

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

  // Typen außerhalb von Datenbanken stehen in den Vault-Einstellungen.
  const vaultTypes = useMemo(() => {
    const types: Record<string, PropertyType> = {};
    for (const [name, type] of Object.entries((vaultSettings.settings.eigenschaften ?? {}) as Record<string, unknown>)) {
      if (isPropertyType(type)) types[name] = type;
    }
    return types;
  }, [vaultSettings.settings]);

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
    await vaultSettings.update((settings) => ({ ...settings, eigenschaften: { ...vaultTypes, [name]: type } }));
  };

  return { configs, reloadConfig, saveConfig, schemaForPage, setTypeForPage };
}

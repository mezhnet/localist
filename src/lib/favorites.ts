// Favoriten: angeheftete Seiten und Datenbanken oben in der Sidebar und auf der Startseite.
// Gespeichert als Liste relativer Pfade in `.localist/settings.json` unter "favoriten".
import type { VaultSettings } from "./settings";
import { isInside, movePath } from "./tree";

export const FAVORITES_KEY = "favoriten";

/** Favoriten aus den Einstellungen (ungültige Einträge werden übersprungen). */
export function readFavorites(settings: VaultSettings): string[] {
  const list = settings[FAVORITES_KEY];
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((item): item is string => typeof item === "string" && item !== ""))];
}

export function withFavorites(settings: VaultSettings, favorites: readonly string[]): VaultSettings {
  return { ...settings, [FAVORITES_KEY]: [...favorites] };
}

/** Anheften oder lösen. Neue Favoriten kommen ans Ende der Liste. */
export function toggleFavorite(favorites: readonly string[], path: string): string[] {
  return favorites.includes(path) ? favorites.filter((item) => item !== path) : [...favorites, path];
}

/** Nach Umbenennen oder Verschieben von `from` nach `to` (auch Ordner): Pfade nachziehen. */
export function renameInFavorites(favorites: readonly string[], from: string, to: string): string[] {
  return [...new Set(favorites.map((item) => movePath(item, from, to)))];
}

/** Nach dem Löschen von `path` (auch ein Ordner mit allem darin). */
export function removeFromFavorites(favorites: readonly string[], path: string): string[] {
  return favorites.filter((item) => !isInside(item, path));
}

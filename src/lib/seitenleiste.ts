// Bedien-Einstellungen der Seitenleiste auf diesem Gerät (App-Speicher, nicht im Vault): links oder rechts und
// eingeklappt. Eine Änderung (Einstellungen, Knopf in der oberen Leiste, Tastenkürzel) wirkt sofort überall.
// Schlüssel: „seitenleiste-seite“ = links | rechts, „seitenleiste-eingeklappt“ = true | false.
import { useSyncExternalStore } from "react";

export type SeitenleisteSeite = "links" | "rechts";

export const SEITENLEISTE_SEITEN: { value: SeitenleisteSeite; label: string }[] = [
  { value: "links", label: "Links" },
  { value: "rechts", label: "Rechts" },
];

const SEITE_KEY = "seitenleiste-seite";
const EINGEKLAPPT_KEY = "seitenleiste-eingeklappt";

/** Ein gemerkter Wert mit Hörern; ohne App-Speicher gilt er bis zum Neustart. */
function wert<T extends string | boolean>(key: string, lesen: (gespeichert: string | null) => T) {
  let ohneSpeicher: T | null = null;
  const hoerer = new Set<() => void>();
  const holen = (): T => {
    try {
      return lesen(localStorage.getItem(key));
    } catch {
      return ohneSpeicher ?? lesen(null);
    }
  };
  const setzen = (neu: T) => {
    try {
      localStorage.setItem(key, String(neu));
    } catch {
      ohneSpeicher = neu;
    }
    hoerer.forEach((h) => h());
  };
  const abonnieren = (h: () => void) => {
    hoerer.add(h);
    return () => {
      hoerer.delete(h);
    };
  };
  return { holen, setzen, abonnieren, standard: () => lesen(null) };
}

const seite = wert<SeitenleisteSeite>(SEITE_KEY, (gespeichert) => (gespeichert === "rechts" ? "rechts" : "links"));
const eingeklappt = wert<boolean>(EINGEKLAPPT_KEY, (gespeichert) => gespeichert === "true");

export const storedSeitenleisteSeite = seite.holen;
export const storeSeitenleisteSeite = seite.setzen;
export const storedEingeklappt = eingeklappt.holen;
export const storeEingeklappt = eingeklappt.setzen;

/** Steht die Seitenleiste links oder rechts? */
export function useSeitenleisteSeite(): [SeitenleisteSeite, (seite: SeitenleisteSeite) => void] {
  return [useSyncExternalStore(seite.abonnieren, seite.holen, seite.standard), seite.setzen];
}

/** Ist die Seitenleiste eingeklappt (PC)? */
export function useEingeklappt(): [boolean, (eingeklappt: boolean) => void] {
  return [useSyncExternalStore(eingeklappt.abonnieren, eingeklappt.holen, eingeklappt.standard), eingeklappt.setzen];
}

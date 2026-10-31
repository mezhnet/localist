// „Über Localist“ (Etappe 21): Versionsanzeige, Updates über GitHub Releases mit gemocktem Updater und die
// Handy-Variante ohne Updater. Gefragt wird nur nach dem Klick, vor der Installation wird gespeichert.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageInfo from "../../package.json";
import cargoToml from "../../src-tauri/Cargo.toml?raw";
import tauriConf from "../../src-tauri/tauri.conf.json";
import { ThemeProvider } from "../lib/theme";
import { RELEASES_SEITE } from "../lib/updates";
import { SettingsDialog } from "./Dialogs";

const updater = vi.hoisted(() => ({ check: vi.fn(), relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: updater.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: updater.relaunch }));

type Ereignis = { event: "Started"; data: { contentLength?: number } } | { event: "Progress"; data: { chunkLength: number } } | { event: "Finished" };

/** Ein Update wie aus check(); `laden` steuert, was downloadAndInstall tut. */
function einUpdate(laden: (melden: (ereignis: Ereignis) => void) => Promise<void> = async () => {}, body = "Neu:\n- Schneller") {
  return {
    available: true,
    version: "2.9.0",
    currentVersion: tauriConf.version,
    body,
    downloadAndInstall: vi.fn((melden: (ereignis: Ereignis) => void) => laden(melden)),
    close: vi.fn(async () => {}),
  };
}

function zurueckhalten<T = void>() {
  let loesen!: (wert: T) => void;
  let ablehnen!: (grund: unknown) => void;
  const versprechen = new Promise<T>((ok, nein) => {
    loesen = ok;
    ablehnen = nein;
  });
  return { versprechen, loesen, ablehnen };
}

interface Optionen {
  platform?: string;
  handy?: boolean;
  vorDemUpdate?: () => Promise<void>;
}

function oeffnen({ platform = "windows", handy = false, vorDemUpdate = async () => {} }: Optionen = {}) {
  const onClose = vi.fn();
  const onOpenExternal = vi.fn();
  render(
    <ThemeProvider>
      <SettingsDialog
        vaultName="Testvault"
        vaultRoot="C:/Testvault"
        onSwitchVault={() => {}}
        onClose={onClose}
        platform={platform}
        vorDemUpdate={vorDemUpdate}
        onOpenExternal={onOpenExternal}
        handy={handy}
      />
    </ThemeProvider>,
  );
  return { onClose, onOpenExternal };
}

const suchenKnopf = () => screen.getByRole("button", { name: "Nach Updates suchen" });
const status = () => screen.getByRole("status").textContent ?? "";

beforeEach(() => {
  localStorage.clear();
  updater.check.mockReset();
  updater.relaunch.mockReset().mockResolvedValue(undefined);
  // Die Rust-Seite liefert mit getVersion() die Version aus tauri.conf.json.
  mockIPC((cmd) => (cmd === "plugin:app|version" ? tauriConf.version : null));
});

afterEach(() => {
  cleanup();
  clearMocks();
});

describe("Über Localist: Version", () => {
  it("zeigt die Version aus getVersion(), gleich der in tauri.conf.json (und überall gleich)", async () => {
    oeffnen();
    await waitFor(() => expect(document.querySelector(".app-version")?.textContent).toBe(tauriConf.version));
    const cargo = cargoToml.match(/^version = "([^"]+)"/m)?.[1];
    expect([packageInfo.version, cargo]).toEqual([tauriConf.version, tauriConf.version]);
  });
});

describe("Über Localist: kein Netz ohne Klick", () => {
  it("check() wird beim Öffnen der Einstellungen nicht aufgerufen, erst nach dem Klick (PC und schmales Fenster)", async () => {
    updater.check.mockResolvedValue(null);
    for (const handy of [false, true]) {
      oeffnen({ handy });
      await waitFor(() => expect(document.querySelector(".app-version")?.textContent).toBe(tauriConf.version));
      await act(async () => new Promise((ok) => setTimeout(ok, 20)));
      expect(updater.check).not.toHaveBeenCalled();
      fireEvent.click(suchenKnopf());
      await waitFor(() => expect(updater.check).toHaveBeenCalledTimes(1));
      cleanup();
      updater.check.mockClear();
    }
  });
});

describe("Über Localist: Zustände (gemockter Updater)", () => {
  it("„Suche nach Updates …“ mit gesperrtem Knopf, dann „Du bist auf dem neuesten Stand (vX.Y.Z)“", async () => {
    const antwort = zurueckhalten<null>();
    updater.check.mockReturnValue(antwort.versprechen);
    oeffnen();
    await waitFor(() => expect(document.querySelector(".app-version")?.textContent).toBe(tauriConf.version));
    fireEvent.click(suchenKnopf());
    expect(status()).toBe("Suche nach Updates …");
    expect((suchenKnopf() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => antwort.loesen(null));
    expect(status()).toBe(`Du bist auf dem neuesten Stand (v${tauriConf.version})`);
    expect((suchenKnopf() as HTMLButtonElement).disabled).toBe(false);
  });

  it("„Update verfügbar: vX.Y.Z“ mit Release-Notizen als reinem Text und „Jetzt installieren“", async () => {
    updater.check.mockResolvedValue(einUpdate(undefined, "<b>Fett?</b>\n<img src=x onerror=alert(1)>"));
    oeffnen();
    fireEvent.click(suchenKnopf());
    expect(await screen.findByText("Update verfügbar: v2.9.0")).toBeTruthy();
    const notizen = document.querySelector(".update-notizen")!;
    expect(notizen.textContent).toBe("<b>Fett?</b>\n<img src=x onerror=alert(1)>");
    expect(notizen.querySelector("b, img")).toBeNull();
    expect(screen.getByRole("button", { name: "Jetzt installieren" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nach Updates suchen" })).toBeNull();
  });

  it("„Wird heruntergeladen … NN %“, dann „Wird installiert, Localist startet neu …“ und Neustart", async () => {
    const fertig = zurueckhalten();
    let melden!: (ereignis: Ereignis) => void;
    const update = einUpdate((m) => {
      melden = m;
      return fertig.versprechen;
    });
    updater.check.mockResolvedValue(update);
    oeffnen();
    fireEvent.click(suchenKnopf());
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt installieren" }));
    await waitFor(() => expect(update.downloadAndInstall).toHaveBeenCalled());
    act(() => melden({ event: "Started", data: { contentLength: 1000 } }));
    act(() => melden({ event: "Progress", data: { chunkLength: 420 } }));
    expect(status()).toBe("Wird heruntergeladen … 42 %");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    act(() => melden({ event: "Finished" }));
    expect(status()).toBe("Wird installiert, Localist startet neu …");
    expect(updater.relaunch).not.toHaveBeenCalled();
    await act(async () => fertig.loesen());
    expect(updater.relaunch).toHaveBeenCalledTimes(1);
    expect(update.close).not.toHaveBeenCalled();
  });

  it("ohne Verbindung: „Keine Verbindung zu GitHub. Bitte später erneut versuchen.“, die App läuft weiter", async () => {
    updater.check.mockRejectedValue(new Error("error sending request for url"));
    oeffnen();
    fireEvent.click(suchenKnopf());
    await waitFor(() => expect(status()).toBe("Keine Verbindung zu GitHub. Bitte später erneut versuchen."));
    expect((suchenKnopf() as HTMLButtonElement).disabled).toBe(false);
  });

  it("Fehler beim Installieren: „Update fehlgeschlagen: <kurze Ursache>“, kein Neustart, erneut suchbar", async () => {
    const update = einUpdate(async () => {
      throw "Die Signatur ist ungültig.\nDetails: minisign …";
    });
    updater.check.mockResolvedValue(update);
    const { onClose } = oeffnen();
    fireEvent.click(suchenKnopf());
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt installieren" }));
    await waitFor(() => expect(status()).toBe("Update fehlgeschlagen: Die Signatur ist ungültig."));
    expect(updater.relaunch).not.toHaveBeenCalled();
    expect(suchenKnopf()).toBeTruthy();
    // Nach dem Fehler lassen sich die Einstellungen wieder schließen.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ab „Jetzt installieren“ (Speichern, Download, Installation) bleiben die Einstellungen offen (Escape schließt nicht)", async () => {
    const fertig = zurueckhalten();
    const gespeichert = zurueckhalten();
    updater.check.mockResolvedValue(einUpdate(() => fertig.versprechen));
    const { onClose } = oeffnen({ vorDemUpdate: () => gespeichert.versprechen });
    fireEvent.click(suchenKnopf());
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt installieren" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => gespeichert.loesen());
    await waitFor(() => expect(status()).toBe("Wird heruntergeladen …"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => fertig.loesen());
  });
});

describe("Über Localist: erst speichern, dann installieren", () => {
  it("Reihenfolge speichern → downloadAndInstall → relaunch", async () => {
    const ablauf: string[] = [];
    const update = einUpdate(async () => {
      ablauf.push("installieren");
    });
    updater.check.mockResolvedValue(update);
    updater.relaunch.mockImplementation(async () => {
      ablauf.push("neustart");
    });
    oeffnen({
      vorDemUpdate: async () => {
        await new Promise((ok) => setTimeout(ok, 10));
        ablauf.push("speichern");
      },
    });
    fireEvent.click(suchenKnopf());
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt installieren" }));
    await waitFor(() => expect(ablauf).toEqual(["speichern", "installieren", "neustart"]));
  });

  it("schlägt das Speichern fehl, wird nicht installiert und die Fehlermeldung erscheint", async () => {
    const update = einUpdate();
    updater.check.mockResolvedValue(update);
    oeffnen({
      vorDemUpdate: async () => {
        throw new Error("Datenträger voll");
      },
    });
    fireEvent.click(suchenKnopf());
    fireEvent.click(await screen.findByRole("button", { name: "Jetzt installieren" }));
    await waitFor(() => expect(status()).toContain("Update fehlgeschlagen"));
    expect(status()).toContain("Datenträger voll");
    expect(status()).toContain("Es wurde nichts installiert.");
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    expect(updater.relaunch).not.toHaveBeenCalled();
  });
});

describe("Über Localist: Android (kein Updater)", () => {
  it("Handy-Einstellungen zeigen Version und „Neue Versionen auf GitHub ansehen“, der Knopf öffnet die Releases-Seite", async () => {
    const { onOpenExternal } = oeffnen({ platform: "android", handy: true });
    const karte = screen.getByRole("region", { name: "Über Localist" });
    await waitFor(() => expect(karte.querySelector(".app-version")?.textContent).toBe(tauriConf.version));
    expect(screen.queryByRole("button", { name: "Nach Updates suchen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Neue Versionen auf GitHub ansehen" }));
    expect(onOpenExternal).toHaveBeenCalledWith(RELEASES_SEITE);
    expect(RELEASES_SEITE).toBe(tauriConf.plugins.updater.endpoints[0].replace(/\/latest\/download\/latest\.json$/, ""));
    expect(updater.check).not.toHaveBeenCalled();
  });

  it("auch ein breites Android-Gerät (PC-Dialog) hat keinen Updater", async () => {
    oeffnen({ platform: "android" });
    expect(screen.getByRole("button", { name: "Neue Versionen auf GitHub ansehen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nach Updates suchen" })).toBeNull();
  });
});

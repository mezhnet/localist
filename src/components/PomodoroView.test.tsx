// Oberflächen-Tests für das Werkzeug „Pomodoro“ (Etappe 23) in der ganzen App: Bereich „Werkzeuge“, Ansicht mit
// Leertaste, Mini-Timer (PC und Handy), Ende einer Phase mit Verlauf und Benachrichtigung, „Pomodoro für diese Seite
// starten“ und der Abschnitt in den Einstellungen. Statt der Rust-Seite antwortet die Vault-Simulation aus
// dev-backend.ts; die Uhr der App wird über `__devVault.vorspulen` vorgestellt.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { installDevBackend } from "../lib/dev-backend";
import { BENACHRICHTIGUNG_ID, pomodoro, pomodoroNeu } from "../lib/pomodoro-timer";
import { reiterLaden, reiterMerken, startStand, oeffnen } from "../lib/reiter";
import { seitenId } from "../lib/seiten-id";

function vault() {
  return window.__devVault!;
}

async function oeffneVault() {
  localStorage.setItem("dev-last-vault", "Testvault");
  render(<App />);
  return screen.findByRole("tree");
}

/** „Pomodoro“ im Bereich „Werkzeuge“ der Seitenleiste. */
function werkzeugPomodoro() {
  return within(screen.getByRole("region", { name: "Werkzeuge" })).getByRole("button", { name: "Pomodoro" });
}

async function oeffnePomodoro() {
  fireEvent.click(werkzeugPomodoro());
  return within(await screen.findByRole("region", { name: "Pomodoro" }));
}

async function oeffneSeite(ordner: string, seite: string) {
  const baum = within(await screen.findByRole("tree"));
  fireEvent.click(await baum.findByText(ordner));
  fireEvent.click(await baum.findByText(seite));
}

/** Handy-Bildschirm (unter 769 px) vortäuschen: untere Navigationsleiste statt Reiterleiste. */
function handyBildschirm() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) => ({ matches: query === "(max-width: 768px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
}

const verlaufDateien = () => [...vault().files.keys()].filter((pfad) => pfad.startsWith(".localist/pomodoro/"));

beforeEach(() => {
  localStorage.clear();
  installDevBackend();
  pomodoroNeu();
});

afterEach(async () => {
  cleanup();
  await pomodoro.beenden();
  clearMocks();
  vi.restoreAllMocks();
});

describe("Werkzeug „Pomodoro“ (Etappe 23)", () => {
  it("„Werkzeuge“ → „Pomodoro“ öffnet die Ansicht in einem Reiter, Strg+Klick in einem weiteren", async () => {
    await oeffneVault();
    const ansicht = await oeffnePomodoro();
    expect(ansicht.getByRole("timer").textContent).toBe("25:00");
    expect(ansicht.getByText("Runde 1 von 4")).toBeTruthy();
    expect(ansicht.getByRole("button", { name: "Starten" })).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Startseite", "Pomodoro"]);
    fireEvent.click(werkzeugPomodoro(), { ctrlKey: true });
    await waitFor(() => expect(screen.getAllByRole("tab").filter((tab) => tab.textContent === "Pomodoro")).toHaveLength(2));
  });

  it("Leertaste startet und pausiert, aber nicht im Feld „Woran arbeitest du?“", async () => {
    await oeffneVault();
    const ansicht = await oeffnePomodoro();
    fireEvent.keyDown(document.body, { key: " " });
    await ansicht.findByRole("button", { name: "Pausieren" });
    fireEvent.keyDown(document.body, { key: " " });
    await ansicht.findByRole("button", { name: "Fortsetzen" });
    const feld = ansicht.getByLabelText("Woran arbeitest du?");
    feld.focus();
    fireEvent.keyDown(feld, { key: " " });
    fireEvent.change(feld, { target: { value: "Subnetting üben" } });
    expect(ansicht.getByRole("button", { name: "Fortsetzen" })).toBeTruthy();
    expect(pomodoro.stand().timer.ziel).toBe("Subnetting üben");
  });

  it("läuft beim Wechsel zu einer Notiz weiter: Mini-Timer unten in der Seitenleiste, ein Klick öffnet die Ansicht", async () => {
    await oeffneVault();
    const ansicht = await oeffnePomodoro();
    fireEvent.click(ansicht.getByRole("button", { name: "Starten" }));
    await ansicht.findByRole("button", { name: "Pausieren" });
    // In der Ansicht selbst gibt es keinen Mini-Timer.
    expect(screen.queryByRole("group", { name: "Pomodoro" })).toBeNull();
    await oeffneSeite("Notizen", "Ideen");
    const mini = within(await screen.findByRole("group", { name: "Pomodoro" }));
    expect(mini.getByRole("timer").textContent).toMatch(/^2[45]:\d\d$/);
    vault().vorspulen(5 * 60_000);
    await waitFor(() => expect(mini.getByRole("timer").textContent).toMatch(/^(19|20):\d\d$/));
    fireEvent.click(mini.getByRole("button", { name: "Pomodoro pausieren" }));
    await mini.findByRole("button", { name: "Pomodoro fortsetzen" });
    fireEvent.click(mini.getByTitle("Pomodoro öffnen"));
    await screen.findByRole("region", { name: "Pomodoro" });
  });

  it("Ende einer Phase: geplante Benachrichtigung, Session in .localist/pomodoro/JJJJ-MM.jsonl und unter „Heute“; Pausieren bricht die geplante ab", async () => {
    await oeffneVault();
    const ansicht = await oeffnePomodoro();
    fireEvent.change(ansicht.getByLabelText("Woran arbeitest du?"), { target: { value: "Subnetting üben" } });
    fireEvent.click(ansicht.getByRole("button", { name: "Starten" }));
    await ansicht.findByRole("button", { name: "Pausieren" });
    await waitFor(() => expect(vault().benachrichtigungen.geplant.has(BENACHRICHTIGUNG_ID.fokus)).toBe(true));
    fireEvent.click(ansicht.getByRole("button", { name: "Pausieren" }));
    await waitFor(() => expect(vault().benachrichtigungen.geplant.has(BENACHRICHTIGUNG_ID.fokus)).toBe(false));
    fireEvent.click(ansicht.getByRole("button", { name: "Fortsetzen" }));
    await waitFor(() => expect(vault().benachrichtigungen.geplant.has(BENACHRICHTIGUNG_ID.fokus)).toBe(true));
    // Geplant für den Endzeitpunkt (in Tests zeigt die Vorschau sie nicht selbst an).
    const geplant = vault().benachrichtigungen.geplant.get(BENACHRICHTIGUNG_ID.fokus)!;
    expect(geplant).toMatchObject({ titel: "Pomodoro", text: "Fokus geschafft – Zeit für 5 Minuten Pause" });
    expect(geplant.zeitpunkt).toBe(pomodoro.stand().timer.ende);

    vault().vorspulen(26 * 60_000);
    await waitFor(() => expect(verlaufDateien()).toHaveLength(1));
    // Ein reguläres Ende bricht die Benachrichtigung nicht ab (sie kommt ja gerade).
    expect(vault().benachrichtigungen.geplant.has(BENACHRICHTIGUNG_ID.fokus)).toBe(true);
    const [datei] = verlaufDateien();
    expect(datei).toMatch(/^\.localist\/pomodoro\/\d{4}-\d{2}\.jsonl$/);
    const zeile = JSON.parse(vault().files.get(datei)!.trim());
    expect(zeile).toMatchObject({ minuten: 25, ziel: "Subnetting üben", seite: null, abgebrochen: false });
    expect(Object.keys(zeile)).toEqual(["id", "start", "ende", "minuten", "ziel", "seite", "abgebrochen"]);
    const heute = within(ansicht.getByRole("region", { name: "Verlauf" }));
    await heute.findByText("Subnetting üben");
    expect(within(heute.getByLabelText("Heute")).getByText("25 Min.")).toBeTruthy();
    expect(within(heute.getByLabelText("Diese Woche")).getByText("25 Min.")).toBeTruthy();
    // Danach wartet die kurze Pause (nicht automatisch gestartet).
    expect(ansicht.getByRole("timer").textContent).toBe("05:00");
    expect(ansicht.getByRole("button", { name: "Starten" })).toBeTruthy();
  });

  it("„Pomodoro für diese Seite starten“ im „…“-Menü: Die Seite bekommt ihre feste id, die Ansicht zeigt den Link und startet", async () => {
    await oeffneVault();
    await oeffneSeite("Notizen", "Ideen");
    expect(seitenId("Notizen/Ideen.md", vault().files.get("Notizen/Ideen.md")!)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Weitere Aktionen" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pomodoro für diese Seite starten" }));
    const ansicht = within(await screen.findByRole("region", { name: "Pomodoro" }));
    const id = seitenId("Notizen/Ideen.md", vault().files.get("Notizen/Ideen.md")!);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(pomodoro.stand().timer.seite).toBe(id);
    await ansicht.findByRole("button", { name: "Pausieren" });
    // Am PC bleibt die Seite in ihrem Reiter offen, Pomodoro kommt in einen eigenen.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Startseite", "Ideen", "Pomodoro"]);
    fireEvent.click(await ansicht.findByRole("button", { name: "Ideen" }));
    await waitFor(() => expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Ideen"));
  });

  it("eine HTML-Seite mit `localist-id` behält ihre id und ihren Inhalt Zeichen für Zeichen", async () => {
    await oeffneVault();
    const vorher = vault().files.get("Notizen/DNS.html")!;
    const baum = within(await screen.findByRole("tree"));
    fireEvent.click(await baum.findByText("Notizen"));
    const zeile = (await baum.findByText("DNS")).closest(".tree-row")!;
    fireEvent.click(within(zeile as HTMLElement).getByRole("button", { name: "Aktionen für „DNS“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pomodoro für diese Seite starten" }));
    await screen.findByRole("region", { name: "Pomodoro" });
    expect(pomodoro.stand().timer.seite).toBe("7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a");
    expect(vault().files.get("Notizen/DNS.html")).toBe(vorher);
  });

  it("Einstellungen → „Pomodoro“: Dauern (begrenzt auf 1–120) und Schalter landen in settings.json unter `pomodoro`", async () => {
    await oeffneVault();
    const ansicht = await oeffnePomodoro();
    fireEvent.click(ansicht.getByRole("button", { name: "Einstellungen" }));
    const abschnitt = within(await screen.findByRole("group", { name: "Pomodoro" }));
    const fokus = abschnitt.getByRole("spinbutton", { name: "Fokus (1–120 Min.)" });
    fireEvent.change(fokus, { target: { value: "500" } });
    fireEvent.blur(fokus);
    await waitFor(() => expect(JSON.parse(vault().files.get(".localist/settings.json")!).pomodoro.fokus).toBe(120));
    fireEvent.change(fokus, { target: { value: "50" } });
    fireEvent.keyDown(fokus, { key: "Enter" });
    fireEvent.click(abschnitt.getByRole("switch", { name: "Pausen automatisch starten" }));
    fireEvent.click(abschnitt.getByRole("switch", { name: "Ton am Ende" }));
    await waitFor(() =>
      expect(JSON.parse(vault().files.get(".localist/settings.json")!).pomodoro).toMatchObject({ fokus: 50, pausenAuto: true, fokusAuto: false, ton: false }),
    );
    // Andere Einstellungen bleiben erhalten.
    expect(JSON.parse(vault().files.get(".localist/settings.json")!).favoriten).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(ansicht.getByRole("timer").textContent).toBe("50:00"));
  });

  it("die Ansicht „Pomodoro“ wird als Reiter gemerkt", () => {
    const stand = oeffnen(startStand(), { art: "pomodoro" });
    reiterMerken("C:/Vault", stand);
    const geladen = reiterLaden("C:/Vault");
    expect(geladen.reiter.map((reiter) => reiter.inhalt)).toEqual([{ art: "start" }, { art: "pomodoro" }]);
  });
});

describe("Pomodoro auf dem Handy (Etappe 23)", () => {
  it("Schnellaktion auf der Startseite und Eintrag oben in „Seiten“ öffnen die Ansicht", async () => {
    handyBildschirm();
    await oeffneVault();
    fireEvent.click(within(await screen.findByRole("group", { name: "Schnellaktionen" })).getByRole("button", { name: "Pomodoro" }));
    await screen.findByRole("region", { name: "Pomodoro" });
    const navigation = within(screen.getByRole("navigation", { name: "Navigation" }));
    fireEvent.click(navigation.getByRole("button", { name: "Start" }));
    await screen.findByRole("region", { name: "Startseite" });
    fireEvent.click(navigation.getByRole("button", { name: "Seiten" }));
    fireEvent.click(werkzeugPomodoro());
    await screen.findByRole("region", { name: "Pomodoro" });
  });

  it("läuft ein Timer, steht die Mini-Leiste direkt über der Navigationsleiste; ein Tipp öffnet die Ansicht", async () => {
    handyBildschirm();
    await oeffneVault();
    await pomodoro.starten();
    const mini = await screen.findByRole("group", { name: "Pomodoro" });
    expect(mini.classList.contains("is-handy")).toBe(true);
    expect(mini.nextElementSibling).toBe(screen.getByRole("navigation", { name: "Navigation" }));
    expect(mini.closest(".workspace")?.classList.contains("hat-mini-timer")).toBe(true);
    fireEvent.click(within(mini).getByTitle("Pomodoro öffnen"));
    await screen.findByRole("region", { name: "Pomodoro" });
    expect(screen.queryByRole("group", { name: "Pomodoro" })).toBeNull();
  });
});

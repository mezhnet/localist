// Oberflächen-Tests der ganzen App. Statt der Rust-Seite antwortet die Vault-Simulation aus
// dev-backend.ts (Inhalt wie beispiel-vault/, nur im Arbeitsspeicher).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { acceptCompletion, currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { today, weekDays } from "./lib/calendar";
import { installDevBackend } from "./lib/dev-backend";

function vault() {
  return window.__devVault!;
}

async function openVaultFromStart() {
  localStorage.setItem("dev-last-vault", "Testvault");
  render(<App />);
  return screen.findByRole("tree");
}

/** Der Ordnerbaum der Sidebar. Seitennamen stehen auch auf der Startseite, in den Favoriten und oben im Pfad. */
async function inTree() {
  return within(await screen.findByRole("tree"));
}

async function openPage(folder: string, page: string) {
  fireEvent.click(await (await inTree()).findByText(folder));
  fireEvent.click(await (await inTree()).findByText(page));
}

/** Öffnet das „Neu“-Menü der Sidebar („Neue Seite“, bis Etappe 17 „Neu“) und wählt einen Eintrag. */
function createNew(item: "Notiz" | "HTML-Seite" | "Ordner" | "Datenbank" | "Notiz aus Vorlage …") {
  fireEvent.click(screen.getByRole("button", { name: "Neue Seite" }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
}

beforeEach(() => {
  localStorage.clear();
  installDevBackend();
});

afterEach(() => {
  // Erst die Komponenten abbauen (sie melden sich beim Dateiwächter ab), dann die Attrappe entfernen.
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

describe("Start und Vault-Auswahl", () => {
  it("zeigt ohne gemerkten Vault die Startseite „Hallo Vault“", async () => {
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Hallo Vault");
    expect(screen.getByRole("button", { name: "Vault-Ordner öffnen …" })).toBeTruthy();
  });

  it("öffnet einen Vault per Dialog und merkt ihn für den nächsten Start", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Vault-Ordner öffnen …" }));
    await screen.findByRole("tree");
    expect(localStorage.getItem("dev-last-vault")).toBe("beispiel-vault (Browser-Vorschau)");
  });

  it("öffnet den zuletzt geöffneten Vault beim Start automatisch", async () => {
    await openVaultFromStart();
    expect(document.querySelector(".vault-name")?.textContent).toBe("Testvault");
    expect(screen.queryByText("Hallo Vault")).toBeNull();
  });

  it("meldet verständlich, wenn der zuletzt geöffnete Vault fehlt", async () => {
    clearMocks();
    mockIPC((cmd) => {
      if (cmd === "get_last_vault") return "C:\\Weg\\Vault";
      if (cmd === "open_vault") throw "Der Vault-Ordner „C:\\Weg\\Vault“ wurde nicht gefunden.";
      return null;
    });
    render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Der zuletzt geöffnete Vault konnte nicht geöffnet werden.");
    expect(alert.textContent).toContain("wurde nicht gefunden");
  });
});

describe("Sidebar", () => {
  it("zeigt Ordner und Seiten, versteckte Ordner und andere Dateien fehlen", async () => {
    vault().externalWrite(".localist/geheim.md", "x");
    const tree = await openVaultFromStart();
    await within(tree).findByText("Notizen");
    const top = within(tree).getAllByRole("treeitem").map((item) => item.querySelector(".tree-name")?.textContent);
    // „Lernen“ kam in Etappe 12 mit der Beispielseite Bausteine.html dazu.
    expect(top).toEqual(["Anhänge", "Lernen", "Notizen", "Projekte", "Vorlagen"]);
    expect(screen.queryByText(".localist")).toBeNull();

    fireEvent.click(within(tree).getByText("Anhänge"));
    expect(await within(tree).findByText("Leer")).toBeTruthy(); // skizze.png ist keine Seite
    fireEvent.click(within(tree).getByText("Notizen"));
    expect(await within(tree).findByText("Formatierung")).toBeTruthy();
    expect(within(tree).getByText("Ideen")).toBeTruthy();
  });

  it("legt Seiten mit id an und Ordner mit freiem Namen", async () => {
    await openVaultFromStart();
    createNew("Notiz");
    await screen.findByDisplayValue("Unbenannt");
    expect(vault().files.get("Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\n---\n$/);

    createNew("Ordner");
    const input = await screen.findByRole("textbox", { name: "Neuer Name für „Neuer Ordner“" });
    fireEvent.change(input, { target: { value: "Archiv" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(vault().folders.has("Archiv")).toBe(true));
    expect(vault().folders.has("Neuer Ordner")).toBe(false);
  });

  it("benennt Seiten in der Sidebar (F2) und über den Seitentitel um", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.keyDown(await (await inTree()).findByTitle("Notizen/Ideen.md"), { key: "F2" });
    const input = await screen.findByRole("textbox", { name: "Neuer Name für „Ideen“" });
    fireEvent.change(input, { target: { value: "Gedanken" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(vault().files.has("Notizen/Gedanken.md")).toBe(true));
    expect(vault().files.has("Notizen/Ideen.md")).toBe(false);

    fireEvent.click(await (await inTree()).findByText("Gedanken"));
    const title = await screen.findByRole("textbox", { name: "Seitentitel" });
    fireEvent.change(title, { target: { value: "Neue Gedanken" } });
    fireEvent.keyDown(title, { key: "Enter" });
    fireEvent.blur(title);
    await waitFor(() => expect(vault().files.has("Notizen/Neue Gedanken.md")).toBe(true));
  });

  it("löscht nur nach Bestätigung", async () => {
    await openVaultFromStart();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Vorlagen“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Löschen …" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0][0]).toContain("Den Ordner „Vorlagen“ mit allen Seiten darin löschen?");
    expect(vault().folders.has("Vorlagen")).toBe(true);

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Aktionen für „Vorlagen“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Löschen …" }));
    await waitFor(() => expect(vault().folders.has("Vorlagen")).toBe(false));
    await waitFor(() => expect(within(screen.getByRole("tree")).queryByText("Vorlagen")).toBeNull());
  });
});

describe("Eigenschaften und Datenbanken", () => {
  const commitInput = (input: HTMLElement, value: string) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  };

  it("Eigenschaften-Leiste: Werte ändern, Eigenschaft hinzufügen, unbekannte Felder bleiben erhalten", async () => {
    vault().externalWrite(
      "Notizen/Ideen.md",
      "---\nid: 42\nunbekannt: bleibt # Kommentar\nerledigt: false\n---\n# Ideen\n",
    );
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    const checkbox = await screen.findByRole("checkbox", { name: "erledigt" });
    fireEvent.click(checkbox);
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toBe("---\nid: 42\nunbekannt: bleibt # Kommentar\nerledigt: true\n---\n# Ideen\n"));

    // Neue Eigenschaft vom Typ Datum: im Frontmatter als YYYY-MM-DD
    fireEvent.click(screen.getByRole("button", { name: "Eigenschaft hinzufügen" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name der Eigenschaft" }), { target: { value: "fällig" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Typ der neuen Eigenschaft" }), { target: { value: "datum" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    const date = await screen.findByLabelText("fällig");
    fireEvent.change(date, { target: { value: "2026-12-24" } });
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toContain("erledigt: true\nfällig: 2026-12-24\n---\n"));
    expect(vault().files.get(".localist/settings.json")).toContain('"fällig": "datum"');

    // Mehrfachauswahl als YAML-Liste
    fireEvent.click(screen.getByRole("button", { name: "Eigenschaft hinzufügen" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name der Eigenschaft" }), { target: { value: "tags" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Typ der neuen Eigenschaft" }), { target: { value: "mehrfachauswahl" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    const tags = await screen.findByRole("combobox", { name: "tags" });
    fireEvent.change(tags, { target: { value: "Arbeit" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toContain("tags:\n  - Arbeit\n---\n# Ideen\n"));
    expect(vault().files.get("Notizen/Ideen.md")).toContain("unbekannt: bleibt # Kommentar\n");
  });

  it("wandelt einen Ordner in eine Datenbank um und zeigt eine Zeile pro Seite", async () => {
    vault().externalWrite("Notizen/Ideen.md", "---\nid: 1\nstatus: Offen\naufwand: 3\n---\n");
    vault().externalWrite("Notizen/Formatierung.md", "---\nid: 2\nstatus: Fertig\n---\n");
    await openVaultFromStart();
    fireEvent.contextMenu(await (await inTree()).findByText("Notizen"));
    fireEvent.click(screen.getByRole("menuitem", { name: "In Datenbank umwandeln" }));
    await waitFor(() => expect(vault().files.has("Notizen/_ansichten.yaml")).toBe(true));
    const yaml = vault().files.get("Notizen/_ansichten.yaml")!;
    expect(yaml).toContain("eigenschaften:\n  status:\n    typ: status\n");
    expect(yaml).toContain("  aufwand:\n    typ: zahl\n");
    expect(yaml).toContain("ansichten:\n  - name: Tabelle\n    typ: tabelle\n");

    const table = await screen.findByRole("table");
    // Die Einträge laden nach der Tabelle (unter Last etwas später): darauf warten.
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(3)); // Kopfzeile + 2 Seiten
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent?.trim())).toEqual(["Aa Name", "◐ status", "# aufwand", ""]);
  });

  it("Tabelle: Zellen bearbeiten, sortieren und filtern (gespeichert in _ansichten.yaml), neue Zeile mit id", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Projekte"));
    const table = await screen.findByRole("table");
    await within(table).findByDisplayValue("Website-Relaunch");
    // Sortierung aus der Datei: fällig aufsteigend → Website (2026) vor Umzug (2027)
    const names = () => within(table).queryAllByRole("textbox", { name: /^Name von/ }).map((input) => (input as HTMLInputElement).value);
    expect(names()).toEqual(["Website-Relaunch", "Umzug"]);

    // Zelle bearbeiten schreibt ins Frontmatter der Seite
    commitInput(within(table).getByRole("combobox", { name: "priorität von „Umzug“" }), "hoch");
    await waitFor(() => expect(vault().files.get("Projekte/Umzug.md")).toContain("fällig: 2027-03-01\npriorität: hoch\n---\n"));

    // Absteigend sortieren über das Spaltenmenü
    fireEvent.click(within(table).getByRole("button", { name: /fällig/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Absteigend sortieren" }));
    await waitFor(() => expect(names()).toEqual(["Umzug", "Website-Relaunch"]));
    expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("sortierung:\n      - eigenschaft: fällig\n        richtung: absteigend\n");

    // Filter: status ist "In Arbeit"
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter hinzufügen" }));
    commitInput(await screen.findByRole("combobox", { name: "Filterwert" }), "In Arbeit");
    await waitFor(() => expect(names()).toEqual(["Website-Relaunch"]));
    expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("filter:\n      - eigenschaft: status\n        operator: ist\n        wert: In Arbeit\n");

    // Neue Zeile legt eine .md-Datei mit id an
    fireEvent.click(screen.getByRole("button", { name: "Filter (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Neuer Eintrag" }));
    await waitFor(() => expect(vault().files.get("Projekte/Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\n---\n$/));
  });
});

describe("Kanban", () => {
  async function openKanban() {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Projekte"));
    await screen.findByDisplayValue("Umzug"); // Einträge sind geladen
    fireEvent.click(screen.getByRole("button", { name: "Ansicht hinzufügen" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Kanban" }));
    return screen.findByRole("list", { name: "Kanban nach status" });
  }

  it("legt eine Kanban-Ansicht an (gespeichert in _ansichten.yaml) und schaltet per Reiter um", async () => {
    const board = await openKanban();
    const columns = within(board).getAllByRole("listitem").map((column) => column.getAttribute("aria-label"));
    expect(columns).toEqual(["Spalte Geplant", "Spalte In Arbeit", "Spalte Erledigt", "Ohne status".replace(/^/, "Spalte ")]);
    expect(within(within(board).getByRole("listitem", { name: "Spalte In Arbeit" })).getByRole("article", { name: "Website-Relaunch" })).toBeTruthy();
    await waitFor(() =>
      expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("  - name: Kanban\n    typ: kanban\n    gruppierung: status\n"),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Tabelle" }));
    expect(await screen.findByRole("table")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Kanban" }));
    expect(await screen.findByRole("list", { name: "Kanban nach status" })).toBeTruthy();
  });

  it("Drag & Drop in eine andere Spalte ändert den Wert in der Datei", async () => {
    const board = await openKanban();
    const card = within(board).getByRole("article", { name: "Umzug" });
    const target = within(board).getByRole("listitem", { name: "Spalte Erledigt" });
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", dropEffect: "", effectAllowed: "" };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    await waitFor(() => expect(vault().files.get("Projekte/Umzug.md")).toContain("status: Erledigt\n"));
    expect(vault().files.get("Projekte/Umzug.md")).toContain("id: 8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f\n");
    expect(within(target).getByRole("article", { name: "Umzug" })).toBeTruthy();
  });

  it("legt neue Karten direkt in einer Spalte an, ein Klick auf eine Karte öffnet die Seite", async () => {
    const board = await openKanban();
    const column = within(board).getByRole("listitem", { name: "Spalte In Arbeit" });
    fireEvent.click(within(column).getByRole("button", { name: "Neu" }));
    await waitFor(() => expect(vault().files.get("Projekte/Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\nstatus: In Arbeit\n---\n$/));
    expect(await within(column).findByRole("article", { name: "Unbenannt" })).toBeTruthy();

    fireEvent.click(within(board).getByRole("article", { name: "Website-Relaunch" }));
    expect(await screen.findByText("Domain prüfen")).toBeTruthy();
  });
});

describe("Kalender", () => {
  const fmt = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
  const dragTo = (item: HTMLElement, target: HTMLElement) => {
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", dropEffect: "", effectAllowed: "" };
    fireEvent.dragStart(item, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
  };

  async function openCalendar() {
    const now = today();
    vault().externalWrite(
      "Projekte/Website-Relaunch.md",
      `---\nid: 3f2a\nstatus: In Arbeit\nfällig: ${now}T09:30\n---\nInhalt\n`,
    );
    vault().externalWrite("Projekte/Notiz.md", "---\nid: n1\nstatus: Geplant\n---\n");
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Projekte"));
    await screen.findByDisplayValue("Notiz");
    fireEvent.click(screen.getByRole("button", { name: "Ansicht hinzufügen" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Kalender" }));
    return screen.findByRole("grid", { name: "Kalender nach fällig" });
  }

  it("zeigt Einträge im Monat, schaltet auf Woche um (gespeichert in _ansichten.yaml)", async () => {
    const grid = await openCalendar();
    const cell = within(grid).getByRole("gridcell", { name: fmt(today()) });
    expect(within(cell).getByRole("button", { name: "Website-Relaunch" }).textContent).toContain("09:30");
    await waitFor(() => expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("    typ: kalender\n    datum: fällig\n    modus: monat\n"));
    expect(within(grid).getAllByRole("gridcell").length).toBeGreaterThanOrEqual(28);

    fireEvent.click(screen.getByRole("button", { name: "Woche" }));
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("gridcell")).toHaveLength(7));
    expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("    modus: woche\n");
  });

  it("Drag & Drop auf einen anderen Tag ändert das Datum in der Datei (Uhrzeit bleibt)", async () => {
    const grid = await openCalendar();
    const week = weekDays(today());
    const target = week[(week.indexOf(today()) + 1) % 7];
    dragTo(within(grid).getByRole("button", { name: "Website-Relaunch" }), within(grid).getByRole("gridcell", { name: fmt(target) }));
    await waitFor(() => expect(vault().files.get("Projekte/Website-Relaunch.md")).toContain(`fällig: ${target}T09:30\n`));
    expect(vault().files.get("Projekte/Website-Relaunch.md")).toContain("---\nInhalt\n");
  });

  it("ein Klick auf einen Tag legt einen Eintrag mit diesem Datum an", async () => {
    const grid = await openCalendar();
    const day = weekDays(today())[0];
    fireEvent.click(within(grid).getByRole("gridcell", { name: fmt(day) }));
    await waitFor(() => expect(vault().files.get("Projekte/Unbenannt.md")).toMatch(new RegExp(`^---\\nid: [0-9a-f-]{36}\\nfällig: ${day}\\n---\\n$`)));
    expect(await within(screen.getByRole("gridcell", { name: fmt(day) })).findByRole("button", { name: "Unbenannt" })).toBeTruthy();
  });

  it("Einträge ohne Datum stehen in der Liste „Ohne Datum“ und lassen sich auf einen Tag ziehen", async () => {
    const grid = await openCalendar();
    const undated = screen.getByRole("complementary", { name: "Ohne Datum" });
    const notiz = within(undated).getByRole("button", { name: "Notiz" });
    dragTo(notiz, within(grid).getByRole("gridcell", { name: fmt(today()) }));
    await waitFor(() => expect(vault().files.get("Projekte/Notiz.md")).toBe(`---\nid: n1\nstatus: Geplant\nfällig: ${today()}\n---\n`));
    await waitFor(() => expect(within(undated).queryByRole("button", { name: "Notiz" })).toBeNull());
  });
});

describe("Komfort: Suche, Strg+P, Vorlagen, Backlinks", () => {
  it("Volltextsuche findet Text in allen Seiten und öffnet den Treffer", async () => {
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: /Volltextsuche/ }));
    const input = await screen.findByRole("textbox", { name: "Volltextsuche" });
    fireEvent.change(input, { target: { value: "wochenplanung" } });
    const option = await screen.findByRole("option", { name: /Ideen/ });
    expect(option.querySelector("mark")?.textContent).toBe("Wochenplanung");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Hier sammle ich lose Gedanken.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Strg+P öffnet die Schnellsuche, Enter öffnet die Seite", async () => {
    await openVaultFromStart();
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const input = await screen.findByRole("textbox", { name: "Schnellsuche" });
    fireEvent.change(input, { target: { value: "wsr" } });
    const results = screen.getByRole("listbox", { name: "Ergebnisse" });
    expect(within(results).getAllByRole("option").map((o) => o.querySelector(".dialog-title")?.textContent)).toEqual(["Website-Relaunch"]);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Domain prüfen")).toBeTruthy();
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    fireEvent.keyDown(await screen.findByRole("textbox", { name: "Schnellsuche" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("legt eine neue Seite aus einer Vorlage an (Eigenschaften und Inhalt, eigene id)", async () => {
    await openVaultFromStart();
    createNew("Notiz aus Vorlage …");
    fireEvent.click(await screen.findByRole("option", { name: /Projekt/ }));
    await waitFor(() => expect(vault().files.get("Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\nstatus: Geplant\npriorität: mittel\n---\n# Ziel\n/));
    expect(vault().files.get("Unbenannt.md")).toContain("- [ ] Ersten Schritt eintragen\n");
    expect(vault().files.get("Vorlagen/Projekt.md")).toBe("---\nstatus: Geplant\npriorität: mittel\n---\n# Ziel\n\nWas soll am Ende stehen?\n\n# Nächste Schritte\n\n- [ ] Ersten Schritt eintragen\n");
    expect(await screen.findByDisplayValue("Unbenannt")).toBeTruthy();
  });

  it("zeigt unten auf der Seite, welche Seiten auf sie verlinken", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    const backlinks = await screen.findByRole("region", { name: "Backlinks" });
    const link = await within(backlinks).findByRole("button", { name: /Website-Relaunch/ });
    expect(link.textContent).toContain("Siehe auch [[Ideen]].");
    fireEvent.click(link);
    expect(await screen.findByText("Domain prüfen")).toBeTruthy();
    expect(within(await screen.findByRole("region", { name: "Backlinks" })).getByText(/Noch keine Seite verlinkt hierher/)).toBeTruthy();
  });
});

describe("Verständliche Fehlermeldungen statt Abstürzen", () => {
  it("eine nicht lesbare Datei zeigt eine deutsche Meldung, die App läuft weiter", async () => {
    clearMocks();
    mockIPC(
      (cmd) => {
        if (cmd === "get_last_vault") return "Testvault";
        if (cmd === "open_vault") return { root: "C:\\Vault", name: "Testvault" };
        if (cmd === "list_tree") return [{ name: "Kaputt", path: "Kaputt.md", kind: "page" }];
        if (cmd === "read_page") throw "Die Datei „Kaputt.md“ ist keine gültige UTF-8-Textdatei.";
        if (cmd === "vault_index") return [];
        return null;
      },
      { shouldMockEvents: true },
    );
    render(<App />);
    fireEvent.click(await screen.findByText("Kaputt"));
    expect(await screen.findByText("Die Seite konnte nicht geöffnet werden: Die Datei „Kaputt.md“ ist keine gültige UTF-8-Textdatei.")).toBeTruthy();
    expect(screen.getByRole("tree")).toBeTruthy();
  });

  it("fehlt der Vault-Ordner während der Arbeit, gibt es einen klaren Hinweis statt Fehlerflut", async () => {
    await openVaultFromStart();
    act(() => vault().setMissing(true));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Der Vault-Ordner ist nicht erreichbar");
    expect(within(alert).getByRole("button", { name: "Anderen Vault öffnen …" })).toBeTruthy();
    // Ist der Ordner wieder da, geht es normal weiter.
    act(() => vault().setMissing(false));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(within(screen.getByRole("tree")).getByText("Notizen")).toBeTruthy();
  });

  it("ein unerwarteter Fehler in der Oberfläche zeigt eine Meldung mit „App neu laden“", async () => {
    const { ErrorBoundary } = await import("./components/ErrorBoundary");
    const Kaputt = () => {
      throw new Error("Test-Absturz");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Kaputt />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Da ist etwas schiefgegangen");
    expect(alert.textContent).toContain("Test-Absturz");
    expect(screen.getByRole("button", { name: "App neu laden" })).toBeTruthy();
  });
});

describe("Handy (Android)", () => {
  it("wählt den Vault-Ordner in der eigenen Ordnerauswahl, legt bei Bedarf einen neuen Ordner an", async () => {
    localStorage.setItem("dev-platform", "android");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Vault-Ordner öffnen …" }));
    const picker = await screen.findByRole("dialog", { name: "Vault-Ordner auswählen" });
    expect(within(picker).getByRole("button", { name: "Diesen Ordner als Vault verwenden" })).toHaveProperty("disabled", true);

    fireEvent.click(await within(picker).findByText("Interner Speicher"));
    fireEvent.click(await within(picker).findByText("Documents"));
    fireEvent.change(within(picker).getByRole("textbox", { name: "Name für neuen Ordner" }), { target: { value: "Mein Vault" } });
    fireEvent.click(within(picker).getByRole("button", { name: "Anlegen" }));
    expect(await within(picker).findByText("Interner Speicher / Documents / Mein Vault")).toBeTruthy();

    fireEvent.click(within(picker).getByRole("button", { name: "Diesen Ordner als Vault verwenden" }));
    expect(await screen.findByRole("tree")).toBeTruthy();
    expect(localStorage.getItem("dev-last-vault")).toBe("/storage/emulated/0/Documents/Mein Vault");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Seiten lassen sich über das ausklappbare Menü öffnen und bearbeiten, das Menü klappt danach zu", async () => {
    await openVaultFromStart();
    const menuButton = screen.getByRole("button", { name: "Menü öffnen" });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(menuButton);
    expect(menuButton.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".sidebar-shell.open")).toBeTruthy();

    await openPage("Notizen", "Ideen");
    await screen.findByText("Hier sammle ich lose Gedanken.");
    await waitFor(() => expect(document.querySelector(".sidebar-shell.open")).toBeNull());
    expect(document.querySelector(".topbar-title")?.textContent).toBe("Ideen");
  });
});

describe("Seiten im Editor", () => {
  it("öffnet eine Seite im Block-Editor", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    expect(await screen.findByText("Hier sammle ich lose Gedanken.")).toBeTruthy();
    expect(screen.getByText("Wochenplanung als Kanban")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Seitentitel" }) as HTMLInputElement).value).toBe("Ideen");
  });

  it("speichert kurz nach der letzten Eingabe automatisch als Markdown", async () => {
    await openVaultFromStart();
    await openPage("Projekte", "Website-Relaunch");
    await screen.findByText("Domain prüfen");
    const before = vault().files.get("Projekte/Website-Relaunch.md")!;

    const tiptap = (window as unknown as { ProseMirror: { commands: { setTextSelection: (pos: number) => void; insertContent: (text: string) => void } } }).ProseMirror;
    act(() => {
      tiptap.commands.setTextSelection(3);
      tiptap.commands.insertContent("Neue ");
    });
    expect(vault().files.get("Projekte/Website-Relaunch.md")).toBe(before);

    await waitFor(() => expect(vault().files.get("Projekte/Website-Relaunch.md")).not.toBe(before), { timeout: 2000 });
    const after = vault().files.get("Projekte/Website-Relaunch.md")!;
    expect(after).toContain("- [ ] Neue Domain prüfen\n");
    // Frontmatter und Obsidian-Schreibweisen bleiben unverändert.
    expect(after.slice(0, after.indexOf("\n---\n") + 5)).toBe(before.slice(0, before.indexOf("\n---\n") + 5));
    expect(after).toContain("> [!info] Hinweis\n");
    expect(after).toContain("Siehe auch [[Ideen]].\n");
  });

  it("lädt die Seite neu, wenn sie außerhalb der App geändert wird", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    await screen.findByText("Hier sammle ich lose Gedanken.");
    act(() => vault().externalWrite("Notizen/Ideen.md", "# Ideen\n\nVon außen geschrieben.\n"));
    expect(await screen.findByText("Von außen geschrieben.")).toBeTruthy();
    expect(screen.queryByText("Hier sammle ich lose Gedanken.")).toBeNull();
  });

  it("setzt Icon und Cover und speichert sie im Frontmatter, der Rest bleibt unverändert", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    await screen.findByText("Hier sammle ich lose Gedanken.");
    const before = vault().files.get("Notizen/Ideen.md")!;

    fireEvent.click(screen.getByRole("button", { name: "Icon hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Icon 💡" }));
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toBe(`---\nicon: 💡\n---\n${before}`));
    expect(screen.getByRole("button", { name: "Icon ändern" }).textContent).toBe("💡");

    fireEvent.click(screen.getByRole("button", { name: "Cover hinzufügen" }));
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toBe(`---\nicon: 💡\ncover: Anhänge/skizze.png\n---\n${before}`));

    fireEvent.click(screen.getByRole("button", { name: "Icon ändern" }));
    fireEvent.click(screen.getByRole("button", { name: "Icon entfernen" }));
    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toBe(`---\n---\n${before}`));
  });

  it("zeigt [[Links]] an, öffnet sie per Klick und passt sie beim Umbenennen im ganzen Vault an", async () => {
    await openVaultFromStart();
    await openPage("Projekte", "Website-Relaunch");
    const link = await screen.findByRole("link", { name: "Ideen" });
    fireEvent.click(link);
    expect(await screen.findByText("Hier sammle ich lose Gedanken.")).toBeTruthy();

    const title = screen.getByRole("textbox", { name: "Seitentitel" });
    fireEvent.change(title, { target: { value: "Gedanken" } });
    fireEvent.blur(title);
    await waitFor(() => expect(vault().files.get("Projekte/Website-Relaunch.md")).toContain("Siehe auch [[Gedanken]]."));
    // Seit Etappe 10 verlinkt auch die HTML-Seite Notizen/DNS.html auf „Ideen“ (<a href>); sie wird mit angepasst,
    // seit Etappe 12 ebenso der Seitenlink in Lernen/Bausteine.html.
    expect(vault().files.get("Notizen/DNS.html")).toContain('<a href="Gedanken.md">Ideen</a>');
    expect(vault().files.get("Lernen/Bausteine.html")).toContain('<a class="l-seitenlink" href="../Notizen/Gedanken.md">Ideen</a>');
    expect(await screen.findByText("Links in 3 Seiten angepasst.")).toBeTruthy();
  });

  it("schaltet zwischen hell und dunkel um und merkt sich die Wahl", async () => {
    await openVaultFromStart();
    expect(document.documentElement.dataset.theme).toBe("light"); // System (Test) ist hell
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const theme = within(await screen.findByRole("group", { name: "Darstellung" }));
    fireEvent.click(theme.getByRole("button", { name: "Dunkel" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(theme.getByRole("button", { name: "Dunkel" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(theme.getByRole("switch", { name: "Wie System" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("schließt die Seite und entfernt sie aus der Sidebar, wenn sie außerhalb gelöscht wird", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "Ideen");
    await screen.findByText("Hier sammle ich lose Gedanken.");
    act(() => vault().externalDelete("Notizen/Ideen.md"));
    expect(await screen.findByText("„Ideen“ wurde außerhalb der App gelöscht oder verschoben.")).toBeTruthy();
    expect(screen.queryByTitle("Notizen/Ideen.md")).toBeNull();
    expect(screen.queryByText("Hier sammle ich lose Gedanken.")).toBeNull();
  });
});

describe("Neues Design: Favoriten, Startseite, „Neu“-Menü und Einstellungen", () => {
  const sidebarFavorites = () => within(screen.getByRole("navigation", { name: "Seiten" })).getByRole("region", { name: "Favoriten" });
  const favoriteNames = () => [...sidebarFavorites().querySelectorAll(".tree-name")].map((el) => el.textContent);
  const savedFavorites = () => JSON.parse(vault().files.get(".localist/settings.json")!).favoriten;

  it("zeigt die Favoriten aus .localist/settings.json oben in der Sidebar und öffnet sie", async () => {
    await openVaultFromStart();
    await waitFor(() => expect(favoriteNames()).toEqual(["Ideen", "Projekte"]));
    fireEvent.click(within(sidebarFavorites()).getByText("Ideen"));
    expect(await screen.findByText("Hier sammle ich lose Gedanken.")).toBeTruthy();
    fireEvent.click(within(sidebarFavorites()).getByText("Projekte"));
    expect(await screen.findByRole("table")).toBeTruthy();
  });

  it("heftet Seiten an und löst sie wieder (Menü und Stern), gespeichert in .localist/settings.json", async () => {
    await openVaultFromStart();
    await waitFor(() => expect(favoriteNames()).toHaveLength(2));
    // Anheften über das „⋯“-Menü im Ordnerbaum
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Formatierung“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Zu Favoriten hinzufügen" }));
    await waitFor(() => expect(savedFavorites()).toEqual(["Notizen/Ideen.md", "Projekte", "Notizen/Formatierung.md"]));
    expect(favoriteNames()).toEqual(["Ideen", "Projekte", "Formatierung"]);
    expect(vault().files.get(".localist/settings.json")).toMatch(/^\{\n {2}"version": 1,\n/);

    // Lösen über den Stern oben rechts auf der geöffneten Seite („Notizen“ ist schon aufgeklappt)
    fireEvent.click(await (await inTree()).findByText("Ideen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aus Favoriten entfernen" }));
    await waitFor(() => expect(savedFavorites()).toEqual(["Projekte", "Notizen/Formatierung.md"]));
    expect(await screen.findByRole("button", { name: "Zu Favoriten hinzufügen" })).toBeTruthy();
    expect(favoriteNames()).toEqual(["Projekte", "Formatierung"]);
  });

  it("Favoriten folgen beim Umbenennen und verschwinden beim Löschen", async () => {
    await openVaultFromStart();
    await waitFor(() => expect(favoriteNames()).toHaveLength(2));
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.keyDown(await (await inTree()).findByTitle("Notizen/Ideen.md"), { key: "F2" });
    const input = await screen.findByRole("textbox", { name: "Neuer Name für „Ideen“" });
    fireEvent.change(input, { target: { value: "Gedanken" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(savedFavorites()).toEqual(["Notizen/Gedanken.md", "Projekte"]));

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Aktionen für „Projekte“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Löschen …" }));
    await waitFor(() => expect(savedFavorites()).toEqual(["Notizen/Gedanken.md"]));
  });

  it("Startseite: zuletzt bearbeitete Seiten, Favoriten, Schnellaktionen und Suchfeld", async () => {
    await openVaultFromStart();
    const home = within(await screen.findByRole("region", { name: "Startseite" }));
    expect(home.getByRole("heading", { level: 1 }).textContent).toMatch(/^(Guten (Morgen|Tag|Abend)|Gute Nacht)$/);
    const recentTitles = () =>
      [...home.getByRole("region", { name: "Zuletzt bearbeitet" }).querySelectorAll(".home-card-title")].map((el) => el.textContent);

    // Zuletzt bearbeitet: neueste zuerst, ohne Vorlagen
    act(() => vault().externalWrite("Projekte/Umzug.md", "---\nid: 8c1d\nstatus: Geplant\n---\nKisten packen\n"));
    await waitFor(() => expect(recentTitles()[0]).toBe("Umzug"));
    expect(recentTitles()).toEqual(expect.arrayContaining(["Umzug", "Ideen", "Formatierung", "Website-Relaunch"]));
    expect(recentTitles()).not.toContain("Projekt"); // Vorlage
    expect(home.getByRole("region", { name: "Zuletzt bearbeitet" }).textContent).toContain("Projekte · gerade eben");

    // Favoriten
    const favorites = [...home.getByRole("region", { name: "Favoriten" }).querySelectorAll(".home-card-title")].map((el) => el.textContent);
    expect(favorites).toEqual(["Ideen", "Projekte"]);

    // Schnellaktionen
    const actions = within(home.getByRole("region", { name: "Schnellaktionen" }));
    expect(actions.getAllByRole("button").map((b) => b.querySelector(".home-action-title")?.textContent)).toEqual([
      "Neue Notiz",
      "Neue Datenbank",
      "Aus Vorlage",
      "Alle Seiten durchsuchen",
    ]);

    // Suchfeld: Titel finden, Enter öffnet die Seite
    const search = home.getByRole("textbox", { name: "Seiten suchen" });
    fireEvent.change(search, { target: { value: "relaunch" } });
    expect(within(home.getByRole("listbox", { name: "Suchergebnisse" })).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Website-RelaunchProjekte",
      "Im Text aller Seiten suchen: „relaunch“",
    ]);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(await screen.findByText("Domain prüfen")).toBeTruthy();

    // „Startseite“ in der Sidebar führt zurück
    fireEvent.click(screen.getByRole("button", { name: "Startseite" }));
    expect(await screen.findByRole("region", { name: "Startseite" })).toBeTruthy();
  });

  it("Startseite: Suche im Text aller Seiten und „Neue Notiz“", async () => {
    await openVaultFromStart();
    const home = within(await screen.findByRole("region", { name: "Startseite" }));
    fireEvent.change(home.getByRole("textbox", { name: "Seiten suchen" }), { target: { value: "wochenplanung" } });
    fireEvent.click(home.getByRole("option", { name: /Im Text aller Seiten suchen/ }));
    const input = await screen.findByRole("textbox", { name: "Volltextsuche" });
    expect((input as HTMLInputElement).value).toBe("wochenplanung");
    expect(await screen.findByRole("option", { name: /Ideen/ })).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(home.getByRole("button", { name: /Neue Notiz/ }));
    await waitFor(() => expect(vault().files.get("Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\n---\n$/));
    expect(await screen.findByDisplayValue("Unbenannt")).toBeTruthy();
  });

  it("„Neu“-Menü legt eine Datenbank an (mit _ansichten.yaml) und öffnet sie", async () => {
    await openVaultFromStart();
    createNew("Datenbank");
    await waitFor(() => expect(vault().files.has("Neue Datenbank/_ansichten.yaml")).toBe(true));
    const yaml = vault().files.get("Neue Datenbank/_ansichten.yaml")!;
    expect(yaml).toContain("eigenschaften:\n  status:\n    typ: status\n");
    expect(yaml).toContain("  datum:\n    typ: datum\n");
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(await screen.findByRole("textbox", { name: "Neuer Name für „Neue Datenbank“" })).toBeTruthy();
  });

  it("Einstellungen zeigen Darstellung und Vault, der Dialog schließt mit Escape", async () => {
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const dialog = await screen.findByRole("dialog", { name: "Einstellungen" });
    expect(within(dialog).getByRole("group", { name: "Darstellung" })).toBeTruthy();
    expect(dialog.querySelector(".settings-vault-name")?.textContent).toBe("Testvault");
    expect(within(dialog).getByRole("button", { name: "Anderen Vault öffnen …" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("HTML-Seiten (Etappe 10)", () => {
  const frame = () => document.querySelector("iframe.html-frame") as HTMLIFrameElement;
  const fromFrame = (data: unknown, source: Window | null = frame().contentWindow) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, source }));
    });

  async function openDns() {
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    await waitFor(() => expect(frame()).toBeTruthy());
  }

  it("erscheinen in Sidebar (eigenes Symbol), Strg+P und Volltextsuche", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    const row = (await (await inTree()).findByTitle("Notizen/DNS.html")) as HTMLElement;
    // Icon aus <meta name="localist-icon">, sonst das Symbol für HTML-Seiten
    await waitFor(() => expect(row.querySelector(".tree-emoji")?.textContent).toBe("🧠"));
    expect((await (await inTree()).findByTitle("Notizen/Ideen.md")).querySelector(".lucide-file-text")).toBeTruthy();

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    fireEvent.change(await screen.findByRole("textbox", { name: "Schnellsuche" }), { target: { value: "dns" } });
    const option = within(screen.getByRole("listbox", { name: "Ergebnisse" })).getAllByRole("option")[0];
    expect(option.querySelector(".dialog-title")?.textContent).toBe("DNS");
    expect(option.querySelector(".lucide-file-code")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Schnellsuche" }), { key: "Escape" });

    fireEvent.keyDown(window, { key: "f", ctrlKey: true, shiftKey: true });
    fireEvent.change(await screen.findByRole("textbox", { name: "Volltextsuche" }), { target: { value: "Port 53" } });
    // Seit Etappe 12 steht „DNS“ auch in Lernen/Bausteine.html: gesucht ist der Treffer mit dem Titel „DNS“.
    const hit = await screen.findByRole("option", { name: /^DNS/ });
    expect(hit.querySelector("mark")?.textContent).toBe("Port");
    expect(hit.textContent).toContain("Port 53 (UDP und TCP)");
  });

  it("„Neu“ → „HTML-Seite“ legt eine Seite nach dem Speicherformat an und zeigt sie abgeschottet an", async () => {
    await openVaultFromStart();
    createNew("HTML-Seite");
    await waitFor(() => expect(vault().files.has("Unbenannt.html")).toBe(true));
    const html = vault().files.get("Unbenannt.html")!;
    expect(html).toMatch(/^<!doctype html>\n<html lang="de">\n<head>\n/);
    expect(html).toMatch(/<title>Unbenannt<\/title>\n<meta name="localist-id" content="[0-9a-f-]{36}">\n<link rel="stylesheet" href=".localist\/bausteine\/localist.css">/);
    expect(html).toContain("<main>\n</main>");
    await waitFor(() => expect(frame()).toBeTruthy());
    expect(frame().getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame().getAttribute("src")).toMatch(/\/__localist-seite\/Unbenannt\.html\?v=\d+$/);
    expect(await screen.findByDisplayValue("Unbenannt")).toBeTruthy();
  });

  it("Umbenennen passt <title> an, ein Name gilt pro Ordner für beide Typen, Links folgen", async () => {
    vault().externalWrite("Notizen/Ideen.md", "# Ideen\n\nMehr in [[DNS.html]].\n");
    await openDns();
    const title = screen.getByRole("textbox", { name: "Seitentitel" });
    // Gleicher Name wie die Notiz „Ideen“ im selben Ordner: nicht erlaubt
    fireEvent.change(title, { target: { value: "Ideen" } });
    fireEvent.blur(title);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(vault().files.has("Notizen/DNS.html")).toBe(true);

    fireEvent.change(title, { target: { value: "Namensauflösung" } });
    fireEvent.blur(title);
    await waitFor(() => expect(vault().files.has("Notizen/Namensauflösung.html")).toBe(true));
    expect(vault().files.has("Notizen/DNS.html")).toBe(false);
    await waitFor(() => expect(vault().files.get("Notizen/Namensauflösung.html")).toContain("<title>Namensauflösung</title>"));
    expect(vault().files.get("Notizen/Namensauflösung.html")).toContain('<meta name="localist-id" content="7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a">');
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toContain("Mehr in [[Namensauflösung.html]]."));
  });

  it("Verschieben per „Verschieben nach …“: relative Pfade der HTML-Seite werden neu berechnet", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „DNS“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Verschieben nach …" }));
    fireEvent.click(await screen.findByRole("option", { name: /Vault \(oberste Ebene\)/ }));
    await waitFor(() => expect(vault().files.has("DNS.html")).toBe(true));
    const html = vault().files.get("DNS.html")!;
    expect(html).toContain('<link rel="stylesheet" href=".localist/bausteine/localist.css">');
    expect(html).toContain('<script src=".localist/bausteine/localist.js" defer></script>');
    expect(html).toContain('<img src="Anhänge/skizze.png" alt="Skizze einer Namensauflösung" width="240">');
    expect(html).toContain('<a href="Notizen/Ideen.md">Ideen</a>');
    expect(html).toContain('<a href="https://www.iana.org/domains/root">');
  });

  it("Verschieben per Drag & Drop: Notiz in einen anderen Ordner, Links und Favoriten folgen", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    const ideen = ((await (await inTree()).findByTitle("Notizen/Ideen.md")) as HTMLElement).closest(".tree-row")!;
    const vorlagen = (await (await inTree()).findByTitle("Vorlagen")).closest(".tree-row")!;
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", dropEffect: "", effectAllowed: "" };
    fireEvent.dragStart(ideen, { dataTransfer });
    fireEvent.dragOver(vorlagen, { dataTransfer });
    expect(vorlagen.classList.contains("drop-target")).toBe(true);
    fireEvent.drop(vorlagen, { dataTransfer });
    await waitFor(() => expect(vault().files.has("Vorlagen/Ideen.md")).toBe(true));
    expect(vault().files.has("Notizen/Ideen.md")).toBe(false);
    // Der <a href> in der HTML-Seite zeigt auf den neuen Ort, [[Ideen]] (über den Titel) bleibt gleich.
    await waitFor(() => expect(vault().files.get("Notizen/DNS.html")).toContain('<a href="../Vorlagen/Ideen.md">Ideen</a>'));
    expect(vault().files.get("Projekte/Website-Relaunch.md")).toContain("Siehe auch [[Ideen]].");
    expect(JSON.parse(vault().files.get(".localist/settings.json")!).favoriten).toEqual(["Vorlagen/Ideen.md", "Projekte"]);
    // Ein Ordner lässt sich nicht in sich selbst ziehen.
    const notizen = (await (await inTree()).findByTitle("Notizen")).closest(".tree-row")!;
    fireEvent.dragStart(notizen, { dataTransfer });
    fireEvent.dragOver(notizen, { dataTransfer });
    expect(notizen.classList.contains("drop-target")).toBe(false);
  });

  it("Nachrichten der Seite: nur aus dem eigenen iframe und nur gültige (Links, Tastenkürzel)", async () => {
    await openDns();
    // Falsche Quelle: wird ignoriert
    fromFrame({ localist: 1, typ: "link", pfad: "Notizen/Ideen.md" }, window);
    // Ungültiger Pfad aus dem eigenen iframe: wird ignoriert
    fromFrame({ localist: 1, typ: "link", pfad: "../geheim.md" });
    expect((screen.getByRole("textbox", { name: "Seitentitel" }) as HTMLInputElement).value).toBe("DNS");
    // Strg+P in der Seite öffnet die Schnellsuche der App
    fromFrame({ localist: 1, typ: "taste", taste: "p", umschalt: false });
    fireEvent.keyDown(await screen.findByRole("textbox", { name: "Schnellsuche" }), { key: "Escape" });
    // Höhe übernehmen
    fromFrame({ localist: 1, typ: "groesse", hoehe: 640 });
    // Seit Etappe 11 gilt die Höhe für den Behälter der Vorschau (darin kann eine neue Fassung über der alten laden).
    expect((document.querySelector(".html-preview") as HTMLElement).style.height).toBe("640px");
    // Gültiger Link aus dem eigenen iframe: öffnet die Notiz in der App
    fromFrame({ localist: 1, typ: "link", pfad: "Notizen/Ideen.md", anker: "" });
    expect(await screen.findByText("Hier sammle ich lose Gedanken.")).toBeTruthy();
  });

  it("Seitenkopf aus <meta>, Backlinks und Neuladen nach Änderung von außen", async () => {
    await openDns();
    expect(screen.getByRole("button", { name: "Icon ändern" }).textContent).toBe("🧠");
    const before = frame().getAttribute("src");
    act(() => vault().externalWrite("Notizen/DNS.html", vault().files.get("Notizen/DNS.html")!.replace('content="🧠"', 'content="🌐"')));
    await waitFor(() => expect(screen.getByRole("button", { name: "Icon ändern" }).textContent).toBe("🌐"));
    await waitFor(() => expect(frame().getAttribute("src")).not.toBe(before));

    // Icon über den Seitenkopf ändern: nur das <meta>-Tag ändert sich
    const original = vault().files.get("Notizen/DNS.html")!;
    fireEvent.click(screen.getByRole("button", { name: "Icon ändern" }));
    fireEvent.click(screen.getByRole("button", { name: "Icon 🚀" }));
    await waitFor(() => expect(vault().files.get("Notizen/DNS.html")).toBe(original.replace('content="🌐"', 'content="🚀"')));

    // Backlinks: Die Notiz „Ideen“ wird von der HTML-Seite verlinkt („Notizen“ ist schon aufgeklappt)
    fireEvent.click(await (await inTree()).findByText("Ideen"));
    await screen.findByText("Hier sammle ich lose Gedanken.");
    const backlinks = await screen.findByRole("region", { name: "Backlinks" });
    expect((await within(backlinks).findByRole("button", { name: /DNS/ })).textContent).toContain("Link „Ideen“");
  });

  it("Löschen funktioniert wie bei Notizen (nur nach Bestätigung, Favoriten werden bereinigt)", async () => {
    await openDns();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Aktionen für „DNS“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Löschen …" }));
    await waitFor(() => expect(vault().files.has("Notizen/DNS.html")).toBe(false));
    expect(confirm.mock.calls[0][0]).toContain("Die Seite „DNS“ löschen?");
    await waitFor(() => expect(document.querySelector("iframe.html-frame")).toBeNull());
  });

  it("Vorlagen funktionieren auch für HTML-Seiten (neue id, Titel, Pfade für den Zielordner)", async () => {
    await openVaultFromStart();
    createNew("Notiz aus Vorlage …");
    fireEvent.click(await screen.findByRole("option", { name: /Lernseite/ }));
    await waitFor(() => expect(vault().files.has("Unbenannt.html")).toBe(true));
    const html = vault().files.get("Unbenannt.html")!;
    expect(html).toContain("<title>Unbenannt</title>");
    expect(html).toMatch(/<meta name="localist-id" content="[0-9a-f-]{36}">/);
    expect(html).not.toContain('content="vorlage"');
    expect(html).toContain('<link rel="stylesheet" href=".localist/bausteine/localist.css">');
    expect(html).toMatch(/<p>Angelegt am \d{4}-\d{2}-\d{2} um \d{2}:\d{2}\.<\/p>/);
    expect(vault().files.get("Vorlagen/Lernseite.html")).toContain("<title>{{title}}</title>");
  });
});

describe("HTML-Seiten: Code-Editor (Etappe 11)", () => {
  const modeButton = (name: "Lesen" | "Code" | "Geteilt") => within(screen.getByRole("group", { name: "Ansicht (Strg+E)" })).getByRole("button", { name });
  const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  const editorText = () => editorView().state.sliceDoc();
  /** Ersetzt im Editor `from` durch `to` (wie Tippen). */
  const typeInEditor = (from: string, to: string) =>
    act(() => {
      const view = editorView();
      const at = view.state.sliceDoc().indexOf(from);
      expect(at).toBeGreaterThanOrEqual(0);
      // Positionen im Editor zählen ein Zeilenende als ein Zeichen.
      const pos = view.state.sliceDoc().slice(0, at).replace(/\r\n/g, "\n").length;
      view.dispatch({ changes: { from: pos, to: pos + from.replace(/\r\n/g, "\n").length, insert: to } });
    });

  async function openDns() {
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    await waitFor(() => expect(document.querySelector(".html-workspace")).toBeTruthy());
  }

  it("drei Ansichten: Lesen, Code, Geteilt – per Schaltfläche und Strg+E, die Wahl wird gemerkt", async () => {
    await openDns();
    expect(modeButton("Lesen").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".cm-editor")).toBeNull();

    fireEvent.click(modeButton("Code"));
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
    expect(document.querySelector("iframe.html-frame")).toBeNull();
    expect(localStorage.getItem("html-ansicht")).toBe("code");

    fireEvent.keyDown(window, { key: "e", ctrlKey: true });
    await waitFor(() => expect(modeButton("Geteilt").getAttribute("aria-pressed")).toBe("true"));
    expect(document.querySelector(".html-workspace.is-geteilt .html-code-pane .cm-editor")).toBeTruthy();
    expect(document.querySelector(".html-workspace.is-geteilt .html-preview-pane iframe")).toBeTruthy();

    // Strg+E aus der Seite heraus (die Brücke reicht die Taste weiter)
    const frame = document.querySelector("iframe.html-frame") as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { localist: 1, typ: "taste", taste: "e", umschalt: false }, source: frame.contentWindow }));
    });
    await waitFor(() => expect(modeButton("Lesen").getAttribute("aria-pressed")).toBe("true"));
    expect(localStorage.getItem("html-ansicht")).toBe("lesen");

    // Gemerkt: Beim nächsten Öffnen erscheint die zuletzt gewählte Ansicht.
    fireEvent.click(modeButton("Code"));
    fireEvent.click(await (await inTree()).findByText("Ideen"));
    await screen.findByText("Hier sammle ich lose Gedanken.");
    fireEvent.click(await (await inTree()).findByText("DNS"));
    await waitFor(() => expect(modeButton("Code").getAttribute("aria-pressed")).toBe("true"));
  });

  it("eine neue HTML-Seite öffnet in „Geteilt“", async () => {
    localStorage.setItem("html-ansicht", "lesen");
    await openVaultFromStart();
    createNew("HTML-Seite");
    await waitFor(() => expect(modeButton("Geteilt").getAttribute("aria-pressed")).toBe("true"));
    await waitFor(() => expect(document.querySelector(".html-workspace.is-geteilt .cm-editor")).toBeTruthy());
  });

  it("vereinfachte Ansicht: nur der Inhalt von <main>, „Ganze Datei“ zeigt alles", async () => {
    localStorage.setItem("html-ansicht", "code");
    await openDns();
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
    expect(editorText().startsWith("\n<h1>Namensauflösung mit DNS</h1>")).toBe(true);
    expect(editorText()).not.toContain("<title>");
    expect(editorText()).not.toContain("</main>");
    const whole = screen.getByRole("button", { name: "Ganze Datei" });
    expect(whole.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(whole);
    await waitFor(() => expect(editorText()).toBe(vault().files.get("Notizen/DNS.html")));
    expect(screen.getByRole("button", { name: "Ganze Datei" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("speichert automatisch und ändert nur die bearbeitete Stelle – auch mit CRLF und BOM", async () => {
    const original = `﻿${vault().files.get("Notizen/DNS.html")!.replace(/\n/g, "\r\n")}`;
    vault().externalWrite("Notizen/DNS.html", original);
    localStorage.setItem("html-ansicht", "code");
    await openDns();
    await waitFor(() => expect(editorText()).toContain("Port 53"));
    expect(editorText()).toContain("\r\n"); // Zeilenenden der Datei bleiben im Editor erhalten
    typeInEditor("Port 53 (UDP und TCP)", "Port 53 (UDP, TCP und DoT)");
    typeInEditor("<l-callout", "<p>Neu getippt</p>\r\n<l-callout");
    // Noch nicht gespeichert (Wartezeit nach der letzten Eingabe) …
    expect(vault().files.get("Notizen/DNS.html")).toBe(original);
    // … dann genau diese Änderungen, alles andere Zeichen für Zeichen gleich.
    await waitFor(() => expect(vault().files.get("Notizen/DNS.html")).not.toBe(original), { timeout: 3000 });
    expect(vault().files.get("Notizen/DNS.html")).toBe(
      original.replace("Port 53 (UDP und TCP)", "Port 53 (UDP, TCP und DoT)").replace("<l-callout", "<p>Neu getippt</p>\r\n<l-callout"),
    );
  });

  it("fehlerhaftes HTML geht nie verloren: ohne </main> zeigt der Editor die ganze Datei und speichert sie wörtlich", async () => {
    const broken = "<!doctype html>\n<title>Kaputt</title>\n<main>\n<p>offen <div>auch offen\n<span>noch einer";
    vault().externalWrite("Notizen/Kaputt.html", broken);
    localStorage.setItem("html-ansicht", "geteilt");
    await openVaultFromStart();
    await openPage("Notizen", "Kaputt");
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
    expect(editorText()).toBe(broken);
    expect(screen.getByRole("button", { name: "Ganze Datei" })).toHaveProperty("disabled", true);
    typeInEditor("<span>noch einer", "<span>noch einer <b>fett");
    await waitFor(() => expect(vault().files.get("Notizen/Kaputt.html")).toBe(`${broken} <b>fett`), { timeout: 3000 });
    // Die Vorschau zeigt, was der Browser daraus macht: Sie lädt die gespeicherte Fassung neu.
    await waitFor(() => expect([...document.querySelectorAll("iframe.html-frame")].some((f) => /\?v=[2-9]/.test(f.getAttribute("src")!))).toBe(true));
  });

  it("„Geteilt“: Die Vorschau lädt nach dem Speichern neu, die neue Fassung liegt erst unsichtbar über der alten", async () => {
    localStorage.setItem("html-ansicht", "geteilt");
    await openDns();
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
    const first = document.querySelector("iframe.html-frame") as HTMLIFrameElement;
    const firstSrc = first.getAttribute("src")!;
    // Die Seite meldet ihre Scrollposition.
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { localist: 1, typ: "position", y: 480 }, source: first.contentWindow }));
    });
    typeInEditor("Mehr zu Resolvern", "Mehr zu Resolvern und Caches");
    await waitFor(() => expect(document.querySelectorAll("iframe.html-frame")).toHaveLength(2), { timeout: 3000 });
    const [old, next] = document.querySelectorAll("iframe.html-frame");
    expect(old.getAttribute("src")).toBe(firstSrc);
    expect(next.classList.contains("is-loading")).toBe(true);
    expect(next.getAttribute("aria-hidden")).toBe("true");
    // Die neue Fassung bekommt beim Start die alte Scrollposition …
    const posted: unknown[] = [];
    (next as HTMLIFrameElement).contentWindow!.postMessage = ((data: unknown) => posted.push(data)) as typeof window.postMessage;
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { localist: 1, typ: "bereit" }, source: (next as HTMLIFrameElement).contentWindow }));
    });
    expect(posted).toContainEqual({ localist: 1, typ: "scrollen", y: 480 });
    // … und ersetzt danach die alte.
    await waitFor(() => expect(document.querySelectorAll("iframe.html-frame")).toHaveLength(1));
    expect(document.querySelector("iframe.html-frame")!.classList.contains("is-loading")).toBe(false);
    expect(document.querySelector("iframe.html-frame")!.getAttribute("src")).not.toBe(firstSrc);
  });
});

describe("Bausteine (Etappe 12)", () => {
  const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  const editorText = () => editorView().state.sliceDoc();
  const toolbar = () => within(screen.getByRole("toolbar", { name: "Baustein einfügen" }));
  const selectedText = () => {
    const { from, to } = editorView().state.selection.main;
    return editorView().state.sliceDoc(from, to);
  };
  /** Setzt den Cursor direkt hinter `text` (bzw. an den Anfang davon). */
  const cursorAt = (text: string, where: "vor" | "hinter" = "hinter") =>
    act(() => {
      const view = editorView();
      const at = view.state.doc.toString().indexOf(text);
      expect(at).toBeGreaterThanOrEqual(0);
      view.dispatch({ selection: { anchor: where === "vor" ? at : at + text.length } });
    });
  /** Tippt Text an der Cursorposition (wie über die Tastatur, damit die Autovervollständigung reagiert). */
  const type = (text: string) =>
    act(() => {
      const view = editorView();
      const pos = view.state.selection.main.head;
      view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length }, userEvent: "input.type" });
    });
  const completions = () => currentCompletions(editorView().state).map((option) => option.label);

  async function openInCode(folder: string, page: string) {
    localStorage.setItem("html-ansicht", "code");
    await openVaultFromStart();
    await openPage(folder, page);
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
  }

  it("beim Öffnen des Vaults liegen localist.css und localist.js mit Version in .localist/bausteine/", async () => {
    await openVaultFromStart();
    for (const name of ["localist.css", "localist.js"]) {
      expect(vault().files.get(`.localist/bausteine/${name}`)).toMatch(/^\/\*! Localist-Bausteine \d+\.\d+\.\d+\+[0-9a-f]{8} /);
    }
  });

  it("Werkzeugleiste: ein Klick fügt den Baustein eingerückt an der Cursorposition ein und speichert automatisch", async () => {
    await openInCode("Notizen", "DNS");
    expect(toolbar().getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Callout",
      "Toggle",
      "Tabelle",
      "Checkliste",
      "Spalten",
      "Bild",
      "Trennlinie",
      "Code-Block",
      "Seitenlink",
      "Karteikarte",
      "Kartenstapel",
      "Quiz",
      "Diagramm",
      // seit Etappe 13: eigene Bausteine des Vaults und „Als Baustein speichern“
      "Lernziel-Box",
      "Als Baustein speichern",
    ]);
    cursorAt("</l-callout>");
    fireEvent.click(toolbar().getByRole("button", { name: "Checkliste" }));
    expect(editorText()).toContain(
      '</l-callout>\n<ul class="l-checkliste">\n  <li><input type="checkbox"> Erster Punkt</li>\n  <li><input type="checkbox"> Zweiter Punkt</li>\n</ul>\n\n<l-kartenstapel>',
    );
    expect(selectedText()).toBe("Erster Punkt");
    // Eingerückt wie die Zeile, in der der Cursor steht.
    cursorAt("<l-frage>", "vor");
    fireEvent.click(toolbar().getByRole("button", { name: "Callout" }));
    expect(editorText()).toContain('  <l-karteikarte>\n    <l-callout typ="info">Text</l-callout>\n    <l-frage>');
    await waitFor(() => expect(vault().files.get("Notizen/DNS.html")).toContain('<ul class="l-checkliste">\n  <li><input type="checkbox"> Erster Punkt</li>'), {
      timeout: 3000,
    });
  });

  it("Seitenlink und Bild fragen nach dem Ziel und setzen einen Pfad relativ zur Seite", async () => {
    await openInCode("Notizen", "DNS");
    cursorAt("</table>");
    fireEvent.click(toolbar().getByRole("button", { name: "Seitenlink" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Seite für den Seitenlink wählen" }), { target: { value: "Bausteine" } });
    fireEvent.click(within(screen.getByRole("listbox", { name: "Ergebnisse" })).getAllByRole("option")[0]);
    await waitFor(() => expect(editorText()).toContain('</table>\n<a class="l-seitenlink" href="../Lernen/Bausteine.html">Bausteine</a>\n'));

    cursorAt("</details>");
    fireEvent.click(toolbar().getByRole("button", { name: "Bild" }));
    // Neue Pfade: Leerzeichen als %20, Umlaute bleiben lesbar (wie überall seit Etappe 10).
    await waitFor(() => expect(editorText()).toContain('</details>\n<figure>\n  <img src="../Anhänge/skizze.png" alt="Beschreibung">\n  <figcaption>Bildunterschrift</figcaption>\n</figure>'));
  });

  it("„/“-Menü: „/“ am Zeilenanfang zeigt alle Bausteine, Tippen filtert, die Auswahl fügt ein", async () => {
    await openInCode("Notizen", "DNS");
    cursorAt("</l-callout>\n");
    type("/");
    await waitFor(() => expect(completions()).toEqual(["Callout", "Toggle", "Tabelle", "Checkliste", "Spalten", "Bild", "Trennlinie", "Code-Block", "Seitenlink", "Karteikarte", "Kartenstapel", "Quiz", "Diagramm", "Lernziel-Box"]));
    type("tab");
    await waitFor(() => expect(completions()).toEqual(["Tabelle"]));
    act(() => {
      acceptCompletion(editorView());
    });
    await waitFor(() => expect(editorText()).toContain("</l-callout>\n<table>\n  <tr><th>Spalte 1</th><th>Spalte 2</th></tr>\n  <tr><td>Wert</td><td>Wert</td></tr>\n</table>\n<l-kartenstapel>"));
    expect(editorText()).not.toMatch(/^\/tab/m);
    expect(selectedText()).toBe("Spalte 1");
  });

  it("„/“ in einem Tag oder Text öffnet das Menü nicht; die Autovervollständigung kennt Tags und Werte der Bausteine", async () => {
    await openInCode("Notizen", "DNS");
    cursorAt("Root-Zone bei der IANA</a>");
    type(" und/");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(completions()).not.toContain("Callout");

    cursorAt("</l-callout>\n");
    type("<l-");
    await waitFor(() => expect(completions()).toEqual(expect.arrayContaining(["l-callout", "l-spalten"])));
    type('callout typ="');
    act(() => {
      startCompletion(editorView());
    });
    await waitFor(() => expect(completions()).toEqual(expect.arrayContaining(["info", "tipp", "warnung", "fehler"])));
  });
});

describe("Bausteine ohne Code bearbeiten (Etappe 12)", () => {
  const frame = () => [...document.querySelectorAll<HTMLIFrameElement>("iframe.html-frame")].find((element) => !element.classList.contains("is-loading"))!;
  const fromFrame = (data: unknown) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { localist: 1, ...(data as object) }, source: frame().contentWindow }));
    });
  const file = () => vault().files.get("Lernen/Bausteine.html")!;

  async function openBausteine(mode: "lesen" | "geteilt" = "lesen") {
    localStorage.setItem("html-ansicht", mode);
    await openVaultFromStart();
    await openPage("Lernen", "Bausteine");
    await waitFor(() => expect(frame()).toBeTruthy());
    return file();
  }

  it("die Seite bekommt beim Start die Erlaubnis für Stift-Symbole und Häkchen", async () => {
    await openBausteine();
    const posted: unknown[] = [];
    frame().contentWindow!.postMessage = ((data: unknown) => posted.push(data)) as typeof window.postMessage;
    fromFrame({ typ: "bereit" });
    expect(posted).toContainEqual({ localist: 1, typ: "stifte", an: true });
  });

  it("Stift am Callout öffnet ein Formular, Speichern ändert nur diesen Baustein", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 0, art: "callout", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Callout bearbeiten" }));
    expect((dialog.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe("Ein Callout hebt einen Hinweis hervor.");
    fireEvent.click(dialog.getByRole("button", { name: "Warnung" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Text" }), { target: { value: "Nicht vergessen: speichern & sichern" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(file()).not.toBe(original));
    expect(file()).toBe(original.replace('<l-callout typ="info">Ein Callout hebt einen Hinweis hervor.</l-callout>', '<l-callout typ="warnung">Nicht vergessen: speichern &amp; sichern</l-callout>'));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Die Anzeige lädt die geänderte Seite neu.
    await waitFor(() => expect([...document.querySelectorAll("iframe.html-frame")].some((element) => /\?v=2$/.test(element.getAttribute("src")!))).toBe(true));
  });

  it("Tabellen-Editor: Zeile hinzufügen, Spalte entfernen, Überschrift bleibt", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 5, art: "tabelle", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Tabelle bearbeiten" }));
    expect((dialog.getByRole("textbox", { name: "Zeile 2, Spalte 1" }) as HTMLInputElement).value).toBe("DNS");
    expect(dialog.getByRole("checkbox", { name: "Erste Zeile ist Überschrift" })).toHaveProperty("checked", true);
    fireEvent.click(dialog.getByRole("button", { name: "Zeile hinzufügen" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Zeile 5, Spalte 1" }), { target: { value: "SSH" } });
    fireEvent.change(dialog.getByRole("textbox", { name: "Zeile 5, Spalte 2" }), { target: { value: "22" } });
    fireEvent.click(dialog.getByRole("button", { name: "Spalte 3 entfernen" }));
    expect(dialog.queryByRole("textbox", { name: "Zeile 1, Spalte 3" })).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(file()).not.toBe(original));
    expect(file()).toBe(
      original.replace(
        /<table>[\s\S]*?<\/table>/,
        "<table>\n  <tr><th>Protokoll</th><th>Port</th></tr>\n  <tr><td>DNS</td><td>53</td></tr>\n  <tr><td>HTTP</td><td>80</td></tr>\n  <tr><td>HTTPS</td><td>443</td></tr>\n  <tr><td>SSH</td><td>22</td></tr>\n</table>",
      ),
    );
  });

  it("in „Geteilt“: Checkliste im Formular ergänzen, der Code-Editor zeigt die neue Fassung", async () => {
    const original = await openBausteine("geteilt");
    fromFrame({ typ: "bearbeiten", index: 6, art: "checkliste", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Checkliste bearbeiten" }));
    fireEvent.click(dialog.getByRole("button", { name: "Punkt hinzufügen" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Punkt 4" }), { target: { value: "Mit Freunden teilen" } });
    fireEvent.click(dialog.getByRole("checkbox", { name: "Punkt 2 erledigt" }));
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    const expected = original.replace(
      /<ul class="l-checkliste">[\s\S]*?<\/ul>/,
      '<ul class="l-checkliste">\n  <li><input type="checkbox" checked> Bausteine kennenlernen</li>\n  <li><input type="checkbox" checked> Eine eigene Lernseite anlegen</li>\n  <li><input type="checkbox"> Die Seite im Browser öffnen</li>\n  <li><input type="checkbox"> Mit Freunden teilen</li>\n</ul>',
    );
    await waitFor(() => expect(file()).toBe(expected));
    await waitFor(() => expect(EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!.state.sliceDoc()).toContain("Mit Freunden teilen"));
  });

  it("„Baustein entfernen“ fragt nach und entfernt nur diesen Baustein", async () => {
    const original = await openBausteine();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fromFrame({ typ: "bearbeiten", index: 9, art: "trennlinie", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Trennlinie bearbeiten" }));
    fireEvent.click(dialog.getByRole("button", { name: "Baustein entfernen" }));
    await waitFor(() => expect(file()).toBe(original.replace("<hr>\n", "")));
    expect(window.confirm).toHaveBeenCalledWith("Trennlinie wirklich aus der Seite entfernen?");
  });

  it("Häkchen in „Lesen“ werden in der Datei gespeichert", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "haekchen", index: 1, an: true });
    await waitFor(() => expect(file()).toBe(original.replace('<input type="checkbox"> Eine eigene Lernseite', '<input type="checkbox" checked> Eine eigene Lernseite')));
    fromFrame({ typ: "haekchen", index: 0, an: false });
    await waitFor(() => expect(file()).toContain('<li><input type="checkbox"> Bausteine kennenlernen</li>'));
    // Kein Neuladen der Anzeige nötig: Das Häkchen ist dort schon gesetzt.
    expect(frame().getAttribute("src")).toMatch(/\?v=1$/);
  });

  it("passt die Seite nicht zur Datei (z. B. ein Skript hat Bausteine erzeugt), ändert das Formular nichts", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 0, art: "callout", anzahl: 23 });
    expect(await screen.findByText(/lässt sich nicht ohne Code bearbeiten/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fromFrame({ typ: "haekchen", index: 7, an: true });
    expect(await screen.findByText(/Das Häkchen konnte nicht gespeichert werden/)).toBeTruthy();
    expect(file()).toBe(original);
    // Unbekannte Bausteinarten oder falsche Felder werden gar nicht erst angenommen.
    fromFrame({ typ: "bearbeiten", index: 0, art: "skript", anzahl: 22 });
    fromFrame({ typ: "haekchen", index: -1, an: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Lern-Bausteine und Diagramme bearbeiten (Etappe 13)", () => {
  const frame = () => [...document.querySelectorAll<HTMLIFrameElement>("iframe.html-frame")].find((element) => !element.classList.contains("is-loading"))!;
  const fromFrame = (data: unknown) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { localist: 1, ...(data as object) }, source: frame().contentWindow }));
    });
  const file = () => vault().files.get("Lernen/Bausteine.html")!;
  async function openBausteine() {
    localStorage.setItem("html-ansicht", "lesen");
    await openVaultFromStart();
    await openPage("Lernen", "Bausteine");
    await waitFor(() => expect(frame()).toBeTruthy());
    return file();
  }

  it("Werkzeugleiste fügt Karteikarte, Kartenstapel, Quiz und Diagramm nach dem Speicherformat ein", async () => {
    localStorage.setItem("html-ansicht", "code");
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
    act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("</h1>") + 5 } }));
    const toolbar = within(screen.getByRole("toolbar", { name: "Baustein einfügen" }));
    fireEvent.click(toolbar.getByRole("button", { name: "Quiz" }));
    expect(view.state.sliceDoc()).toContain(
      '</h1>\n<l-quiz>\n  <l-quizfrage>\n    <l-frage>Frage</l-frage>\n    <ul>\n      <li>Falsche Antwort</li>\n      <li data-richtig>Richtige Antwort</li>\n    </ul>\n  </l-quizfrage>\n</l-quiz>\n',
    );
    // Der Platzhalter „Frage“ ist noch markiert: Der nächste Baustein kommt hinter das ganze Quiz, nicht in es hinein.
    fireEvent.click(toolbar.getByRole("button", { name: "Karteikarte" }));
    expect(view.state.sliceDoc()).toContain("  </l-quizfrage>\n</l-quiz>\n<l-karteikarte>\n  <l-frage>Frage</l-frage>\n  <l-antwort>Antwort</l-antwort>\n</l-karteikarte>\n");
    // Ist etwas anderes markiert, kommt der Baustein wie bisher hinter die Zeile mit der Markierung.
    const frageZeile = view.state.doc.toString().indexOf("<l-frage>Frage</l-frage>");
    act(() => view.dispatch({ selection: { anchor: frageZeile + "<l-frage>".length, head: frageZeile + "<l-frage>Frage".length } }));
    fireEvent.click(toolbar.getByRole("button", { name: "Trennlinie" }));
    expect(view.state.sliceDoc()).toContain("    <l-frage>Frage</l-frage>\n    <hr>\n    <ul>");
    act(() => view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("</h1>") + 5 } }));
    fireEvent.click(toolbar.getByRole("button", { name: "Diagramm" }));
    expect(view.state.sliceDoc()).toContain('</h1>\n<l-diagramm typ="balken" titel="Titel">\n  <table>\n    <tr><th>Beschriftung</th><th>Wert</th></tr>');
    await waitFor(() => expect(vault().files.get("Notizen/DNS.html")).toContain('<l-diagramm typ="balken" titel="Titel">'), { timeout: 3000 });
  });

  it("Kartenstapel-Formular: Karte hinzufügen", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 14, art: "kartenstapel", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Kartenstapel bearbeiten" }));
    expect((dialog.getByRole("textbox", { name: "Karte 2: Frage" }) as HTMLInputElement).value).toBe("Wofür steht DNS?");
    fireEvent.click(dialog.getByRole("button", { name: "Karte hinzufügen" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Karte 4: Frage" }), { target: { value: "Was ist ein Switch?" } });
    fireEvent.change(dialog.getByRole("textbox", { name: "Karte 4: Antwort" }), { target: { value: "Verteiler im LAN" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(file()).toBe(
        original.replace(
          "    <l-antwort>Die feste Hardware-Adresse einer Netzwerkkarte.</l-antwort>\n  </l-karteikarte>\n</l-kartenstapel>",
          "    <l-antwort>Die feste Hardware-Adresse einer Netzwerkkarte.</l-antwort>\n  </l-karteikarte>\n  <l-karteikarte>\n    <l-frage>Was ist ein Switch?</l-frage>\n    <l-antwort>Verteiler im LAN</l-antwort>\n  </l-karteikarte>\n</l-kartenstapel>",
        ),
      ),
    );
  });

  it("Quiz-Formular: richtige Antwort per Auswahlknopf festlegen", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 18, art: "quiz", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Quiz bearbeiten" }));
    expect(dialog.getByRole("radio", { name: "Frage 1, Antwort 2 ist richtig" })).toHaveProperty("checked", true);
    fireEvent.click(dialog.getByRole("radio", { name: "Frage 2, Antwort 1 ist richtig" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Frage 2, Antwort 1" }), { target: { value: "HTTP (unverschlüsselt)" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(file()).toBe(
        original.replace("      <li>HTTP</li>\n      <li>FTP</li>\n      <li data-richtig>HTTPS</li>", "      <li data-richtig>HTTP (unverschlüsselt)</li>\n      <li>FTP</li>\n      <li>HTTPS</li>"),
      ),
    );
  });

  it("Diagramm-Formular: Art, Titel und Daten-Editor", async () => {
    const original = await openBausteine();
    fromFrame({ typ: "bearbeiten", index: 21, art: "diagramm", anzahl: 22 });
    const dialog = within(await screen.findByRole("dialog", { name: "Diagramm bearbeiten" }));
    expect(within(dialog.getByRole("group", { name: "Diagrammart" })).getByRole("button", { name: "Kreis" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(dialog.getByRole("group", { name: "Diagrammart" })).getByRole("button", { name: "Balken" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Titel" }), { target: { value: "Datenverkehr" } });
    fireEvent.change(dialog.getByRole("textbox", { name: "Zeile 2, Spalte 2" }), { target: { value: "60" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(file()).toBe(
        original
          .replace('<l-diagramm typ="kreis" titel="Datenverkehr nach Art">', '<l-diagramm typ="balken" titel="Datenverkehr">')
          .replace("<tr><td>Video</td><td>58</td></tr>", "<tr><td>Video</td><td>60</td></tr>"),
      ),
    );
  });
});

describe("Eigene Bausteine, Bibliothek und Hilfe (Etappe 13)", () => {
  const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  const toolbar = () => within(screen.getByRole("toolbar", { name: "Baustein einfügen" }));
  const eigeneDatei = (name: string) => vault().files.get(`.localist/bausteine/eigene/${name}.html`);

  async function openDnsCode() {
    localStorage.setItem("html-ansicht", "code");
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    await waitFor(() => expect(document.querySelector(".cm-editor")).toBeTruthy());
  }

  it("markierten Code als eigenen Baustein speichern; er erscheint in Werkzeugleiste und „/“-Menü", async () => {
    await openDnsCode();
    // Ohne Markierung: Hinweis statt Dialog
    fireEvent.click(toolbar().getByRole("button", { name: "Als Baustein speichern" }));
    expect(await screen.findByText(/Markiere zuerst den Code/)).toBeTruthy();

    const code = '<l-callout typ="tipp">DNS übersetzt Namen wie example.com in IP-Adressen.</l-callout>';
    act(() => {
      const view = editorView();
      const from = view.state.doc.toString().indexOf(code);
      view.dispatch({ selection: { anchor: from, head: from + code.length } });
    });
    fireEvent.click(toolbar().getByRole("button", { name: "Als Baustein speichern" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Als eigenen Baustein speichern" }));
    expect((dialog.getByRole("textbox", { name: "Code" }) as HTMLTextAreaElement).value).toBe(code);
    fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), { target: { value: "DNS-Tipp" } });
    fireEvent.change(dialog.getByRole("textbox", { name: "Beschreibung" }), { target: { value: "Merksatz zu DNS" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(eigeneDatei("DNS-Tipp")).toBe(`<!-- beschreibung: Merksatz zu DNS -->\n${code}\n`));

    // Werkzeugleiste: der neue Baustein (und der aus dem Beispiel-Vault) – ein Klick fügt ihn ein
    const knopf = await waitFor(() => toolbar().getByRole("button", { name: "DNS-Tipp" }));
    expect(toolbar().getByRole("button", { name: "Lernziel-Box" })).toBeTruthy();
    act(() => editorView().dispatch({ selection: { anchor: editorView().state.doc.toString().indexOf("</h1>") + 5 } }));
    fireEvent.click(toolbar().getByRole("button", { name: "Lernziel-Box" }));
    expect(editorView().state.sliceDoc()).toContain('</h1>\n<l-callout typ="tipp">\n  <strong>Lernziel:</strong> Nach dieser Seite kannst du …\n</l-callout>\n');
    expect(knopf).toBeTruthy();

    // „/“-Menü kennt die eigenen Bausteine
    act(() => {
      const view = editorView();
      const at = view.state.doc.toString().indexOf("<l-kartenstapel>");
      view.dispatch({ changes: { from: at, insert: "\n" }, selection: { anchor: at } });
      view.dispatch({ changes: { from: at, insert: "/dns" }, selection: { anchor: at + 4 }, userEvent: "input.type" });
    });
    await waitFor(() => expect(currentCompletions(editorView().state).map((option) => option.label)).toContain("DNS-Tipp"));
  });

  it("Bereich „Bausteine“: Bibliothek mit Vorschau, eigene Bausteine bearbeiten, umbenennen und löschen", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: "Bausteine" }));
    const liste = within(await screen.findByRole("navigation", { name: "Bausteine" }));
    for (const name of ["Callout", "Toggle", "Tabelle", "Checkliste", "Spalten", "Bild", "Trennlinie", "Code-Block", "Seitenlink", "Karteikarte", "Kartenstapel", "Quiz", "Diagramm"]) {
      expect(liste.getByText(name)).toBeTruthy();
    }
    const vorschau = screen.getByTitle("Vorschau der Bausteine") as HTMLIFrameElement;
    expect(vorschau.getAttribute("sandbox")).toBe("allow-scripts");
    expect(vorschau.getAttribute("src")).toContain(".localist/bausteine/bibliothek.html");
    const eigene = within(liste.getByRole("list", { name: "Eigene Bausteine" }));
    expect(eigene.getByText("Lernziel-Box")).toBeTruthy();
    expect(eigene.getByText("Box für Lernziele")).toBeTruthy();

    // Bearbeiten
    fireEvent.click(eigene.getByRole("button", { name: "„Lernziel-Box“ bearbeiten" }));
    let dialog = within(await screen.findByRole("dialog", { name: "„Lernziel-Box“ bearbeiten" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Beschreibung" }), { target: { value: "Ziel der Lerneinheit" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(eigeneDatei("Lernziel-Box")).toMatch(/^<!-- beschreibung: Ziel der Lerneinheit -->\n<l-callout typ="tipp">/));
    // Die Vorschau lädt die geänderte Bibliothek neu
    await waitFor(() => expect((screen.getByTitle("Vorschau der Bausteine") as HTMLIFrameElement).getAttribute("src")).toMatch(/\?v=2$/));

    // Umbenennen
    fireEvent.click(await screen.findByRole("button", { name: "„Lernziel-Box“ umbenennen" }));
    dialog = within(await screen.findByRole("dialog", { name: "„Lernziel-Box“ umbenennen" }));
    expect(dialog.queryByRole("textbox", { name: "Code" })).toBeNull();
    fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), { target: { value: "Lernziel" } });
    fireEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(eigeneDatei("Lernziel")).toMatch(/^<!-- beschreibung: Ziel der Lerneinheit -->/));
    expect(eigeneDatei("Lernziel-Box")).toBeUndefined();

    // Löschen (mit Rückfrage)
    fireEvent.click(await screen.findByRole("button", { name: "„Lernziel“ löschen" }));
    await waitFor(() => expect(eigeneDatei("Lernziel")).toBeUndefined());
    expect(window.confirm).toHaveBeenCalledWith("Den eigenen Baustein „Lernziel“ in den Papierkorb verschieben?");
    expect(await screen.findByText(/Markiere im Code-Editor einen Abschnitt/)).toBeTruthy();
  });

  it("Hilfe: alle eingebauten Bausteine mit Erklärung und Beispielcode zum Kopieren", async () => {
    const kopiert: string[] = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text: string) => (kopiert.push(text), Promise.resolve()) } });
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: "Bausteine" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Hilfe" }));
    for (const name of ["Callout", "Toggle", "Tabelle", "Checkliste", "Spalten", "Bild", "Trennlinie", "Code-Block", "Seitenlink", "Karteikarte", "Kartenstapel", "Quiz", "Diagramm"]) {
      expect(screen.getByRole("region", { name }), name).toBeTruthy();
    }
    const quiz = within(screen.getByRole("region", { name: "Quiz" }));
    expect(quiz.getByText(/data-richtig/, { selector: "p" })).toBeTruthy();
    fireEvent.click(quiz.getByRole("button", { name: "Beispielcode „Quiz“ kopieren" }));
    await waitFor(() => expect(kopiert).toHaveLength(1));
    expect(kopiert[0]).toMatch(/^<l-quiz>\n  <l-quizfrage>[\s\S]*<li data-richtig>8<\/li>[\s\S]*<\/l-quiz>$/);
    expect(await quiz.findByText("Kopiert")).toBeTruthy();
  });
});

describe("Notizbücher, Umwandeln und Export (Etappe 14)", () => {
  const ordnerMenue = async (name: string) => fireEvent.click(await screen.findByRole("button", { name: `Aktionen für „${name}“` }));
  const inhalt = () => within(screen.getByRole("navigation", { name: "Inhaltsverzeichnis" }));
  const eintraege = () => inhalt().getAllByRole("button").map((button) => button.textContent);
  const vorschau = () => document.querySelector<HTMLIFrameElement>(".notizbuch-inhaltsseite iframe");

  it("ein Ordner wird zum Notizbuch; Datenbank und Notizbuch schließen sich aus", async () => {
    await openVaultFromStart();
    await ordnerMenue("Projekte");
    expect(screen.getByRole("menuitem", { name: "Datenbank öffnen" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "In Notizbuch umwandeln" })).toBeNull();
    await ordnerMenue("Lernen");
    expect(screen.getByRole("menuitem", { name: "Notizbuch öffnen" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "In Datenbank umwandeln" })).toBeNull();

    await ordnerMenue("Notizen");
    fireEvent.click(screen.getByRole("menuitem", { name: "In Notizbuch umwandeln" }));
    await waitFor(() => expect(vault().files.get("Notizen/_notizbuch.yaml")).toBe("titel: Notizen\nseiten:\n  - DNS.html\n  - Formatierung.md\n  - Ideen.md\n"));
    expect(await screen.findByRole("heading", { name: "Notizen", level: 1 })).toBeTruthy();
    expect(eintraege()).toEqual(["1DNS", "2Formatierung", "3Ideen"]);
    expect(await screen.findByText("„Notizen“ ist jetzt ein Notizbuch.")).toBeTruthy();
  });

  it("Notizbuch-Ansicht: Inhaltsverzeichnis, Notizen fertig dargestellt, Zurück/Weiter und Bearbeiten", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Lernen"));
    expect(await screen.findByRole("heading", { name: "Lernen für die Prüfung", level: 1 })).toBeTruthy();
    expect(eintraege()).toEqual(["1Subnetting", "2Bausteine"]);
    // Die Notiz erscheint umgewandelt in der abgeschotteten Anzeige
    await waitFor(() => expect(vorschau()?.getAttribute("src")).toMatch(/Lernen\/Subnetting\.md\?v=1$/));
    expect(vorschau()!.getAttribute("sandbox")).toBe("allow-scripts");
    const darstellung = vault().darstellungen.get("Lernen/Subnetting.md")!;
    expect(darstellung).toContain('<l-callout typ="tipp">');
    expect(darstellung).toContain("<summary>Lösungsweg</summary>");
    expect(darstellung).toContain('<a href="Bausteine.html">Bausteinen</a>');
    expect(screen.getByRole("button", { name: "Zurück" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Weiter: Bausteine" }));
    await waitFor(() => expect(vorschau()?.getAttribute("src")).toMatch(/Lernen\/Bausteine\.html\?v=1$/));
    expect(screen.getByRole("button", { name: "Weiter" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Zurück: Subnetting" })).toBeTruthy();
    // Bearbeiten öffnet die Seite im passenden Editor
    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));
    expect(await screen.findByRole("group", { name: "Ansicht (Strg+E)" })).toBeTruthy();
  });

  it("Reihenfolge per Drag & Drop (und Alt+↓) ändern; neue Seiten erscheinen am Ende", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Lernen"));
    await screen.findByRole("heading", { name: "Lernen für die Prüfung", level: 1 });
    const eintrag = (name: string) => inhalt().getByText(name).closest("li")!;
    fireEvent.dragStart(eintrag("Bausteine"));
    fireEvent.dragOver(eintrag("Subnetting"), { clientY: -100 });
    fireEvent.drop(eintrag("Subnetting"));
    await waitFor(() => expect(vault().files.get("Lernen/_notizbuch.yaml")).toBe("titel: Lernen für die Prüfung\nseiten:\n  - Bausteine.html\n  - Subnetting.md\n"));
    expect(eintraege()).toEqual(["1Bausteine", "2Subnetting"]);
    fireEvent.keyDown(inhalt().getByText("Bausteine").closest("button")!, { key: "ArrowDown", altKey: true });
    await waitFor(() => expect(vault().files.get("Lernen/_notizbuch.yaml")).toContain("seiten:\n  - Subnetting.md\n  - Bausteine.html\n"));
    act(() => vault().externalWrite("Lernen/Adressen.md", "# Adressen\n"));
    await waitFor(() => expect(eintraege()).toEqual(["1Subnetting", "2Bausteine", "3Adressen"]));
  });

  it("„In HTML-Seite umwandeln“: neue Seite, Notiz im Papierkorb, Links und Notizbuch angepasst", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Ideen“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In HTML-Seite umwandeln …" }));
    await waitFor(() => expect(vault().files.has("Notizen/Ideen.html")).toBe(true));
    expect(confirm.mock.calls[0][0]).toMatch(/^„Ideen“ in eine HTML-Seite umwandeln\? Die Notiz kommt in den Papierkorb/);
    const seite = vault().files.get("Notizen/Ideen.html")!;
    expect(seite).toMatch(/<title>Ideen<\/title>\n<meta name="localist-id" content="[0-9a-f-]{36}">/);
    expect(seite).toContain("<p>Hier sammle ich lose Gedanken.</p>");
    expect(seite).toContain("<li>Wochenplanung als Kanban</li>");
    await waitFor(() => expect(vault().files.has("Notizen/Ideen.md")).toBe(false));
    // Links im Vault zeigen auf die neue Seite
    await waitFor(() => expect(vault().files.get("Projekte/Website-Relaunch.md")).toContain("[[Ideen.html]]"));
    expect(vault().files.get("Notizen/DNS.html")).toContain('<a href="Ideen.html">Ideen</a>');
    expect(vault().files.get("Lernen/Bausteine.html")).toContain('<a class="l-seitenlink" href="../Notizen/Ideen.html">Ideen</a>');
    expect(await screen.findByText("„Ideen“ ist jetzt eine HTML-Seite. Links in 3 Seiten angepasst.")).toBeTruthy();
    expect(await screen.findByRole("group", { name: "Ansicht (Strg+E)" })).toBeTruthy();

    // In einem Notizbuch wandert der Eintrag mit
    fireEvent.click(await (await inTree()).findByText("Lernen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Subnetting“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In HTML-Seite umwandeln …" }));
    await waitFor(() => expect(vault().files.get("Lernen/_notizbuch.yaml")).toContain("  - Subnetting.html\n"));
    expect(vault().files.get("Lernen/Subnetting.html")).toContain('<meta name="localist-prop-thema" content="Netzwerke">');
    expect(vault().files.get("Lernen/Subnetting.html")).toContain('<meta name="localist-id" content="5e7c2a91-');
  });

  it("eine Notiz in einer Datenbank wird nur nach Hinweis umgewandelt", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Projekte"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Umzug“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In HTML-Seite umwandeln …" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0][0]).toContain("Sie liegt in einer Datenbank und erscheint danach nicht mehr in Tabelle, Kanban und Kalender.");
    expect(vault().files.has("Projekte/Umzug.md")).toBe(true);
    expect(vault().files.has("Projekte/Umzug.html")).toBe(false);
  });

  it("„Als HTML-Datei exportieren“: Speichern-Dialog, CSS und Skript eingebettet, keine Verweise in den Vault", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „DNS“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Als HTML-Datei exportieren …" }));
    await waitFor(() => expect(vault().exporte.has("C:/Export/DNS.html")).toBe(true));
    const datei = vault().exporte.get("C:/Export/DNS.html")!;
    expect(datei).toMatch(/<style>\n\/\*! Localist-Bausteine /);
    expect(datei).toMatch(/<\/main>\n<script>\n\/\*! Localist-Bausteine [\s\S]*<\/script>\n<\/body>/);
    expect(datei).not.toContain(".localist/");
    expect(await screen.findByText("„DNS“ wurde als eigenständige HTML-Datei gespeichert: C:/Export/DNS.html")).toBeTruthy();
    // Notizen werden dabei umgewandelt, die Notiz selbst bleibt
    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „Formatierung“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Als HTML-Datei exportieren …" }));
    await waitFor(() => expect(vault().exporte.get("C:/Export/Formatierung.html")).toContain("<h1>Alle Formatierungen</h1>"));
    expect(vault().files.has("Notizen/Formatierung.md")).toBe(true);
  });
});

describe("Bedienung: Im Explorer öffnen (Etappe 17)", () => {
  it("„Im Explorer öffnen“ für Notiz, HTML-Seite und Ordner, „Vault im Explorer öffnen“ im Vault-Menü; die Vorschau zeigt einen Hinweis", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.contextMenu(await (await inTree()).findByText("Ideen"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Im Explorer öffnen" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Browser-Vorschau: Hier gibt es keinen Explorer. In der App öffnet sich jetzt der Windows-Explorer und zeigt „Notizen/Ideen.md“ markiert in seinem Ordner.",
    );

    fireEvent.click(await screen.findByRole("button", { name: "Aktionen für „DNS“" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Im Explorer öffnen" }));
    fireEvent.contextMenu((await inTree()).getByText("Notizen"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Im Explorer öffnen" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("zeigt den Ordner „Notizen“"));

    fireEvent.click(screen.getByTitle("Vault wechseln oder Einstellungen öffnen"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Vault im Explorer öffnen" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("zeigt den Vault-Ordner"));
    expect(vault().explorer).toEqual(["Notizen/Ideen.md", "Notizen/DNS.html", "Notizen", ""]);
  });

  it("ein verschwundener Eintrag wird verständlich gemeldet", async () => {
    await openVaultFromStart();
    fireEvent.click(await (await inTree()).findByText("Notizen"));
    fireEvent.contextMenu(await (await inTree()).findByText("Ideen"));
    vault().files.delete("Notizen/Ideen.md");
    fireEvent.click(screen.getByRole("menuitem", { name: "Im Explorer öffnen" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Der Eintrag existiert nicht mehr.");
    expect(vault().explorer).toEqual([]);
  });

  it("auf Android gibt es „Im Explorer öffnen“ nicht", async () => {
    localStorage.setItem("dev-platform", "android");
    await openVaultFromStart();
    fireEvent.contextMenu(await (await inTree()).findByText("Notizen"));
    expect(screen.getByRole("menuitem", { name: "Umbenennen" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Im Explorer öffnen" })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByTitle("Vault wechseln oder Einstellungen öffnen"));
    expect(screen.getByRole("menuitem", { name: "Anderen Vault öffnen …" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Vault im Explorer öffnen" })).toBeNull();
    expect(vault().explorer).toEqual([]);
  });
});

describe("„Geteilt“: Code links oder rechts, verschiebbare Trennlinie (Etappe 17)", () => {
  const modeButton = (name: "Lesen" | "Code" | "Geteilt") => within(screen.getByRole("group", { name: "Ansicht (Strg+E)" })).getByRole("button", { name });
  const flaeche = () => document.querySelector(".html-workspace") as HTMLDivElement;
  const frame = () => document.querySelector("iframe.html-frame") as HTMLIFrameElement;

  async function openGeteilt() {
    localStorage.setItem("html-ansicht", "geteilt");
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    await waitFor(() => expect(document.querySelector(".html-workspace.is-geteilt iframe.html-frame")).toBeTruthy());
  }

  /** jsdom misst nichts: Die Fläche ist 1016 px breit (ab x = 0), die Trennlinie 16 px mit der Mitte bei x = 508. */
  function trennlinie() {
    const rect = (left: number, width: number) => ({ left, width, x: left, y: 0, top: 0, right: left + width, bottom: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(flaeche(), "getBoundingClientRect").mockReturnValue(rect(0, 1016));
    const trenner = screen.getByRole("separator", { name: "Trennlinie zwischen Code-Editor und Vorschau" });
    vi.spyOn(trenner, "getBoundingClientRect").mockReturnValue(rect(500, 16));
    return trenner;
  }

  it("Einstellung „Code-Editor rechts“ wirkt sofort, lädt die Vorschau nicht neu und wird gemerkt", async () => {
    await openGeteilt();
    const vorher = frame();
    const src = vorher.src;
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const dialog = await screen.findByRole("dialog", { name: "Einstellungen" });
    const gruppe = within(dialog).getByRole("group", { name: "Code-Editor" });
    expect(within(gruppe).getByRole("button", { name: "Links" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(gruppe).getByRole("button", { name: "Rechts" }));
    // Der Dialog liegt über der Seite: Die Seite folgt sofort, ohne Neuladen der Vorschau.
    expect(flaeche().classList.contains("is-code-rechts")).toBe(true);
    expect(localStorage.getItem("html-code-seite")).toBe("rechts");
    expect(frame()).toBe(vorher);
    expect(frame().src).toBe(src);
    expect(document.querySelectorAll("iframe.html-frame").length).toBe(1);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(await (await inTree()).findByText("Ideen"));
    await screen.findByText("Hier sammle ich lose Gedanken.");
    fireEvent.click(await (await inTree()).findByText("DNS"));
    await waitFor(() => expect(document.querySelector(".html-workspace.is-geteilt.is-code-rechts")).toBeTruthy());
  });

  it("„Seiten tauschen“ gibt es nur in „Geteilt“; der Knopf tauscht sofort, ohne die Vorschau neu zu laden", async () => {
    await openGeteilt();
    const vorher = frame();
    fireEvent.click(screen.getByRole("button", { name: "Seiten tauschen" }));
    expect(flaeche().classList.contains("is-code-rechts")).toBe(true);
    expect(localStorage.getItem("html-code-seite")).toBe("rechts");
    expect(frame()).toBe(vorher);
    fireEvent.click(screen.getByRole("button", { name: "Seiten tauschen" }));
    expect(flaeche().classList.contains("is-code-rechts")).toBe(false);
    expect(localStorage.getItem("html-code-seite")).toBe("links");

    fireEvent.click(modeButton("Code"));
    await waitFor(() => expect(document.querySelector(".html-workspace.is-code")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Seiten tauschen" })).toBeNull();
    expect(screen.queryByRole("separator", { name: /Trennlinie/ })).toBeNull();
    fireEvent.click(modeButton("Lesen"));
    expect(screen.queryByRole("button", { name: "Seiten tauschen" })).toBeNull();
  });

  it("Trennlinie mit der Tastatur: role=separator mit aria-valuenow, Pfeile, Pos1/Ende, Enter und Doppelklick, das Verhältnis wird gemerkt", async () => {
    await openGeteilt();
    const trenner = trennlinie();
    expect(trenner.getAttribute("tabindex")).toBe("0");
    expect(trenner.getAttribute("aria-orientation")).toBe("vertical");
    expect(trenner.getAttribute("aria-controls")).toBe(document.querySelector(".html-code-pane")!.id);
    expect(trenner.getAttribute("aria-valuenow")).toBe("50");

    fireEvent.keyDown(trenner, { key: "ArrowRight" });
    expect(trenner.getAttribute("aria-valuenow")).toBe("52");
    expect(trenner.getAttribute("aria-valuetext")).toBe("Code-Editor 52 %, Vorschau 48 %");
    expect(flaeche().style.getPropertyValue("--html-links")).toBe("52.00fr");
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.52");
    fireEvent.keyDown(trenner, { key: "ArrowLeft", shiftKey: true });
    expect(trenner.getAttribute("aria-valuenow")).toBe("42");
    // Jede Seite bleibt mindestens 280 px breit: 1000 px Platz → 28 % bis 72 %
    fireEvent.keyDown(trenner, { key: "End" });
    expect(trenner.getAttribute("aria-valuenow")).toBe("72");
    fireEvent.keyDown(trenner, { key: "Home" });
    expect(trenner.getAttribute("aria-valuenow")).toBe("28");
    fireEvent.keyDown(trenner, { key: "Enter" });
    expect(trenner.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(trenner, { key: "ArrowRight" });
    fireEvent.doubleClick(trenner);
    expect(trenner.getAttribute("aria-valuenow")).toBe("50");
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.5");

    // Code rechts: Die linke Spalte ist die Vorschau, ← macht den Code breiter.
    fireEvent.click(screen.getByRole("button", { name: "Seiten tauschen" }));
    fireEvent.keyDown(trenner, { key: "ArrowLeft" });
    expect(trenner.getAttribute("aria-valuenow")).toBe("52");
    expect(flaeche().style.getPropertyValue("--html-links")).toBe("48.00fr");
    expect(flaeche().style.getPropertyValue("--html-rechts")).toBe("52.00fr");
  });

  it("Trennlinie ziehen: Pointer Capture, iframes ohne Mausereignisse, Begrenzung, kein Neuladen der Vorschau", async () => {
    localStorage.setItem("html-geteilt-anteil", "0.4");
    await openGeteilt();
    const trenner = trennlinie();
    expect(trenner.getAttribute("aria-valuenow")).toBe("40");
    const capture = vi.fn();
    Object.assign(trenner, { setPointerCapture: capture });
    const vorher = frame();

    fireEvent.pointerDown(trenner, { pointerId: 1, button: 0, clientX: 508 });
    expect(capture).toHaveBeenCalledWith(1);
    expect(flaeche().classList.contains("is-ziehen")).toBe(true);
    fireEvent.pointerMove(trenner, { pointerId: 1, clientX: 708 });
    await waitFor(() => expect(trenner.getAttribute("aria-valuenow")).toBe("70"));
    fireEvent.pointerMove(trenner, { pointerId: 1, clientX: 1010 });
    await waitFor(() => expect(trenner.getAttribute("aria-valuenow")).toBe("72"));
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.4"); // erst beim Loslassen gemerkt
    fireEvent.pointerUp(trenner, { pointerId: 1, clientX: 1010 });
    expect(flaeche().classList.contains("is-ziehen")).toBe(false);
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.72");
    expect(frame()).toBe(vorher);

    // Nur die Haupttaste zieht; ein bloßer Klick neben die Mitte der Linie (jetzt bei x = 728) verschiebt nichts.
    fireEvent.pointerDown(trenner, { pointerId: 2, button: 2, clientX: 300 });
    expect(flaeche().classList.contains("is-ziehen")).toBe(false);
    vi.spyOn(trenner, "getBoundingClientRect").mockReturnValue({ left: 720, width: 16, x: 720, y: 0, top: 0, right: 736, bottom: 0, height: 0, toJSON: () => ({}) } as DOMRect);
    fireEvent.pointerDown(trenner, { pointerId: 3, button: 0, clientX: 733 });
    fireEvent.pointerUp(trenner, { pointerId: 3, clientX: 733 });
    expect(trenner.getAttribute("aria-valuenow")).toBe("72");
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.72");
  });
});

describe("Seite „Bausteine“ breiter (Etappe 17)", () => {
  async function openBausteine() {
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: "Bausteine" }));
    await screen.findByTitle("Vorschau der Bausteine");
    return document.querySelector(".bibliothek-seite") as HTMLElement;
  }

  it("die Seite kennzeichnet Bibliothek und Hilfe (nur die Bibliothek füllt die Fensterhöhe)", async () => {
    const seite = await openBausteine();
    expect(seite.classList.contains("is-bibliothek")).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Hilfe" }));
    await waitFor(() => expect(seite.classList.contains("is-hilfe")).toBe(true));
    expect(seite.classList.contains("is-bibliothek")).toBe(false);
  });

  it("Hilfe: Erklärung und Beispielcode sind zwei Bereiche, die nebeneinander stehen können", async () => {
    await openBausteine();
    fireEvent.click(screen.getByRole("tab", { name: "Hilfe" }));
    const quiz = await screen.findByRole("region", { name: "Quiz" });
    const [text, code] = [...quiz.children];
    expect(text.className).toBe("hilfe-text");
    expect(text.querySelector("h2")?.textContent).toContain("Quiz");
    expect(text.querySelector("p")?.textContent).toContain("data-richtig");
    expect(code.className).toBe("hilfe-code");
    expect(code.querySelector("pre")).toBeTruthy();
    expect(within(code as HTMLElement).getByRole("button", { name: "Beispielcode „Quiz“ kopieren" })).toBeTruthy();
  });

  it("Handy: ein Tipp auf einen Eintrag holt die Vorschau ins Bild, auf dem PC nicht", async () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true, writable: true });
    try {
      await openBausteine();
      fireEvent.click(screen.getByRole("button", { name: /^Quiz/ }));
      expect(scroll).not.toHaveBeenCalled();

      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: query === "(max-width: 767px)" }) as MediaQueryList);
      fireEvent.click(screen.getByRole("button", { name: /^Diagramm/ }));
      expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
      expect(scroll.mock.contexts[0]).toBe(document.querySelector(".bibliothek-vorschau"));
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("CSS: Seite „Bausteine“ nutzt die Breite (jsdom misst kein Layout)", () => {
  it("volle Breite bis --library-max-width, Bibliothek füllt die Höhe, Hilfe nebeneinander per Container-Abfrage", async () => {
    const { default: css } = await import("./styles/page.css?raw");
    /** Inhalt der ersten Regel, die genau mit diesem Selektor am Zeilenanfang beginnt. */
    const text = css.replace(/\r\n/g, "\n");
    const regel = (selektor: string) => {
      const start = text.indexOf(`\n${selektor} {`);
      return start < 0 ? "" : text.slice(start, text.indexOf("}", start));
    };
    expect(regel(".page.bibliothek-seite")).toMatch(/width: 100%;[\s\S]*max-width: var\(--library-max-width\);/);
    expect(regel(".page.bibliothek-seite.is-bibliothek")).toMatch(/flex: 1 1 0;[\s\S]*min-height: 0;/);
    expect(regel(".bibliothek")).toContain("grid-template-columns: minmax(0, var(--library-list-width)) minmax(0, 1fr);");
    expect(regel(".bibliothek-vorschau")).not.toContain("--code-pane-height");
    expect(regel(".hilfe")).toContain("container-type: inline-size;");
    expect(text).toMatch(/@container \(min-width: 820px\) \{\s*\.hilfe-eintrag \{\s*display: grid;/);
  });
});

describe("Modi Hell, Dunkel, Schwarz und Akzentfarbe (Etappe 18)", () => {
  /** System hell oder dunkel vortäuschen (prefers-color-scheme). */
  function system(dunkel: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: dunkel && query.includes("dark"), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
    );
  }
  const html = () => document.documentElement.dataset;

  it("Einstellungen → Darstellung: Karten Hell, Dunkel, Schwarz; „Wie System“ nimmt bei dunklem System den zuletzt gewählten dunklen Modus", async () => {
    system(true);
    await openVaultFromStart();
    expect(html().theme).toBe("dark"); // Standard „Wie System“, dunkles System → Dunkel
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const darstellung = within(await screen.findByRole("group", { name: "Darstellung" }));
    expect(darstellung.getByRole("switch", { name: "Wie System" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(darstellung.getByRole("button", { name: "Schwarz" }));
    expect(html().theme).toBe("black");
    expect(localStorage.getItem("theme")).toBe("black");
    expect(localStorage.getItem("theme-dunkel")).toBe("black");
    expect(darstellung.getByRole("switch", { name: "Wie System" }).getAttribute("aria-checked")).toBe("false");
    expect(darstellung.getByRole("button", { name: "Schwarz" }).getAttribute("aria-pressed")).toBe("true");
    expect(darstellung.getByText(/nutzt echtes Schwarz statt Dunkelgrau/)).toBeTruthy();
    // Wieder „Wie System“: dunkles System → der zuletzt gewählte dunkle Modus (Schwarz)
    fireEvent.click(darstellung.getByRole("switch", { name: "Wie System" }));
    expect(html().theme).toBe("black");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("Umschalter in der Seitenleiste: drei Knöpfe, ein Klick schaltet „Wie System“ aus", async () => {
    await openVaultFromStart();
    const modus = within(screen.getByRole("group", { name: "Modus" }));
    expect(modus.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Hell", "Dunkel", "Schwarz"]);
    expect(modus.getByRole("button", { name: "Hell" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(modus.getByRole("button", { name: "Schwarz" }));
    expect(html().theme).toBe("black");
    expect(localStorage.getItem("theme")).toBe("black");
    fireEvent.click(modus.getByRole("button", { name: "Hell" }));
    expect(html().theme).toBe("light");
    // Hell gewählt: Der dunkle Modus für „Wie System“ bleibt Schwarz.
    expect(localStorage.getItem("theme-dunkel")).toBe("black");
  });

  it("alte gespeicherte Werte gelten weiter (theme = dark aus Version 2.0)", async () => {
    localStorage.setItem("theme", "dark");
    system(false);
    await openVaultFromStart();
    expect(html().theme).toBe("dark");
    expect(html().accent).toBe("orange");
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const darstellung = within(await screen.findByRole("group", { name: "Darstellung" }));
    expect(darstellung.getByRole("button", { name: "Dunkel" }).getAttribute("aria-pressed")).toBe("true");
    expect(darstellung.getByRole("switch", { name: "Wie System" }).getAttribute("aria-checked")).toBe("false");
  });

  it("Akzentfarbe: vier Farben, wirkt sofort (auch in HTML-Seiten) und wird gemerkt", async () => {
    await openVaultFromStart();
    await openPage("Notizen", "DNS");
    const frame = await waitFor(() => {
      const f = document.querySelector<HTMLIFrameElement>("iframe.html-frame");
      expect(f).toBeTruthy();
      return f!;
    });
    const nachrichten: unknown[] = [];
    vi.spyOn(frame.contentWindow!, "postMessage").mockImplementation((daten: unknown) => void nachrichten.push(daten));
    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    const akzent = within(await screen.findByRole("radiogroup", { name: "Akzentfarbe" }));
    expect(akzent.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Orange", "Blau", "Grün", "Lila"]);
    expect(akzent.getByRole("radio", { name: "Orange" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(akzent.getByRole("radio", { name: "Blau" }));
    expect(html().accent).toBe("blau");
    expect(localStorage.getItem("akzent")).toBe("blau");
    await waitFor(() => expect(nachrichten).toContainEqual({ localist: 1, typ: "thema", wert: "hell", akzent: "blau" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Darstellung" })).getByRole("button", { name: "Schwarz" }));
    await waitFor(() => expect(nachrichten).toContainEqual({ localist: 1, typ: "thema", wert: "schwarz", akzent: "blau" }));
  });
});

describe("Fensterrahmen ohne Windows-Titelleiste (Etappe 18)", () => {
  const knoepfe = () => within(screen.getByRole("group", { name: "Fenster" }));

  it("Minimieren, Maximieren/Wiederherstellen und Schließen oben rechts; freie Stellen der Leiste ziehen das Fenster", async () => {
    await openVaultFromStart();
    const leiste = document.querySelector(".workspace-leiste")!;
    expect(leiste.getAttribute("data-tauri-drag-region")).toBe("deep");
    expect([...knoepfe().getAllByRole("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Fenster minimieren", "Fenster maximieren", "Fenster schließen"]);
    // Wie die Knöpfe von Windows nicht in der Tab-Reihenfolge
    expect(knoepfe().getAllByRole("button").every((b) => b.tabIndex === -1)).toBe(true);

    fireEvent.click(knoepfe().getByRole("button", { name: "Fenster minimieren" }));
    fireEvent.click(knoepfe().getByRole("button", { name: "Fenster maximieren" }));
    expect(await knoepfe().findByRole("button", { name: "Fenster wiederherstellen" })).toBeTruthy();
    fireEvent.click(knoepfe().getByRole("button", { name: "Fenster wiederherstellen" }));
    expect(await knoepfe().findByRole("button", { name: "Fenster maximieren" })).toBeTruthy();
    fireEvent.click(knoepfe().getByRole("button", { name: "Fenster schließen" }));
    await waitFor(() => expect(vault().fenster).toEqual(["minimize", "toggle_maximize", "toggle_maximize", "close"]));
  });

  it("auch vor der Vault-Auswahl gibt es Leiste und Knöpfe, auf Android nicht", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Vault-Ordner öffnen …" });
    expect(document.querySelector(".app-leiste")?.getAttribute("data-tauri-drag-region")).toBe("deep");
    expect(knoepfe().getAllByRole("button")).toHaveLength(3);
    cleanup();

    localStorage.setItem("dev-platform", "android");
    await openVaultFromStart();
    expect(screen.queryByRole("group", { name: "Fenster" })).toBeNull();
    expect(document.querySelector("[data-tauri-drag-region]")).toBeNull();
  });

  it("tauri.conf.json ohne Titelleiste, Capabilities nur um die Fensterrechte erweitert", async () => {
    const { default: conf } = await import("../src-tauri/tauri.conf.json");
    const { default: capability } = await import("../src-tauri/capabilities/default.json");
    expect(conf.app.windows[0].decorations).toBe(false);
    expect(capability.permissions).toEqual([
      "core:default",
      "core:window:allow-destroy",
      "core:window:allow-show",
      "core:window:allow-start-dragging",
      "core:window:allow-minimize",
      "core:window:allow-toggle-maximize",
      "core:window:allow-close",
      "opener:default",
      "dialog:default",
    ]);
  });
});

describe("CSS: Inhalt als abgesetzte Fläche (Etappe 18, jsdom misst kein Layout)", () => {
  it("Fensterhintergrund für Seitenleiste und Leiste, Inhalt mit Radius, feiner Linie und schmalem Rand ringsum", async () => {
    const { default: css } = await import("./styles/layout.css?raw");
    const { default: tokens } = await import("./styles/tokens.css?raw");
    const text = css.replace(/\r\n/g, "\n");
    /** Inhalt der ersten Regel mit genau diesem Selektor (am Zeilenanfang, auch eingerückt in @media). */
    const regel = (selektor: string, ab = 0) => {
      const start = text.slice(ab).search(new RegExp(`\\n\\s*${selektor.replace(/[.()[\]]/g, "\\$&")} \\{`));
      return start < 0 ? "" : text.slice(ab + start, text.indexOf("}", ab + start));
    };
    expect(regel(".workspace")).toContain("background: var(--color-window);");
    expect(regel(".sidebar")).toContain("background: var(--color-window);");
    expect(regel(".sidebar")).not.toContain("border-right");
    expect(regel(".main")).toContain("background: var(--color-bg);");
    const pc = text.indexOf("@media (min-width: 769px)");
    expect(pc).toBeGreaterThan(0);
    const karte = regel(".main", pc);
    expect(karte).toContain("margin: 0 var(--window-gap) var(--window-gap) 0;");
    expect(karte).toContain("border: var(--border-width) solid var(--color-frame-line);");
    expect(karte).toContain("border-radius: var(--radius-content);");
    expect(regel(".workspace:not(.hat-fensterleiste) .main", pc)).toContain("margin-top: var(--window-gap);");
    expect(tokens).toMatch(/--window-gap: 6px;/);
    expect(tokens).toMatch(/--radius-content: var\(--radius-xl\);/);
  });
});

describe("Seitenleiste nach der Vorlage (Etappe 18)", () => {
  const seitenleiste = () => within(screen.getByRole("navigation", { name: "Seiten" }));

  it("Aufbau von oben nach unten: Vault-Umschalter, Suchen, Volltextsuche, Startseite, Bausteine, Neue Seite, Favoriten, Seiten, Modus, Einstellungen", async () => {
    await openVaultFromStart();
    const nav = document.querySelector(".sidebar")!;
    expect(nav.querySelector(".sidebar-header .vault-avatar")?.textContent).toBe("T");
    expect(nav.querySelector(".sidebar-header .vault-name")?.textContent).toBe("Testvault");
    expect([...nav.querySelectorAll(".sidebar-nav .sidebar-item .ui-button__label")].map((el) => el.textContent)).toEqual([
      "Suchen",
      "Volltextsuche",
      "Startseite",
      "Bausteine",
      "Neue Seite",
    ]);
    expect([...nav.querySelectorAll(".sidebar-nav .ui-kbd")].map((el) => el.textContent)).toEqual(["Strg P", "Strg ⇧ F"]);
    expect([...nav.querySelectorAll(".sidebar-section-title")].map((el) => el.textContent)).toEqual(["Favoriten", "Seiten"]);
    expect(seitenleiste().getByRole("region", { name: "Seiten" }).querySelector('[role="tree"]')).toBeTruthy();
    expect(seitenleiste().getByRole("button", { name: "Neu im Vault" })).toBeTruthy();
    // Unten: Modus (drei Knöpfe), Trennlinie, Einstellungen mit der Versionsnummer daneben
    const fuss = within(nav.querySelector<HTMLElement>(".sidebar-footer")!);
    expect(fuss.getByText("Darstellung")).toBeTruthy();
    expect(within(fuss.getByRole("group", { name: "Modus" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Hell", "Dunkel", "Schwarz"]);
    expect(fuss.getByRole("button", { name: "Einstellungen" }).querySelector(".lucide-sliders-horizontal")).toBeTruthy();
    expect(nav.querySelector(".sidebar-footer .app-version")?.textContent).toMatch(/^v\d+\.\d+\.\d+$/);
    // Die Startseite ist offen: Ihr Eintrag ist hervorgehoben.
    expect(seitenleiste().getByRole("button", { name: "Startseite" }).classList.contains("active")).toBe(true);
  });

  it("„Neue Seite“ öffnet das bisherige „Neu“-Menü; aktiv ist der Eintrag im Ordnerbaum, nicht der Favorit", async () => {
    await openVaultFromStart();
    const neu = seitenleiste().getByRole("button", { name: "Neue Seite" });
    expect(neu.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(neu);
    const menue = within(screen.getByRole("menu", { name: "Neu" }));
    expect(menue.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Notiz", "HTML-Seite", "Ordner", "Datenbank", "Notiz aus Vorlage …"]);
    fireEvent.keyDown(window, { key: "Escape" });

    await openPage("Notizen", "Ideen");
    await screen.findByRole("textbox", { name: "Seitentitel" });
    const zeile = ((await (await inTree()).findByTitle("Notizen/Ideen.md")) as HTMLElement).closest(".tree-row")!;
    expect(zeile.classList.contains("active")).toBe(true);
    const favorit = within(seitenleiste().getByRole("region", { name: "Favoriten" })).getByTitle("Notizen/Ideen.md").closest(".tree-row")!;
    expect(favorit.classList.contains("active")).toBe(false);
    expect(seitenleiste().getByRole("button", { name: "Startseite" }).classList.contains("active")).toBe(false);
  });

  it("aus Version 2.0 erhalten: Symbole für Datenbank, Notizbuch, HTML-Seite und Emoji, Markierung gleichnamiger Seiten, Kontextmenü", async () => {
    await openVaultFromStart();
    const baum = await inTree();
    expect((await baum.findByTitle("Projekte")).querySelector(".lucide-database")).toBeTruthy();
    expect((await baum.findByTitle("Lernen")).querySelector(".lucide-book-open")).toBeTruthy();
    fireEvent.click(baum.getByText("Notizen"));
    await waitFor(() => expect((baum.getByTitle("Notizen/DNS.html") as HTMLElement).querySelector(".tree-emoji")?.textContent).toBe("🧠"));
    expect(baum.getByTitle("Notizen/Formatierung.md").querySelector(".lucide-file-text")).toBeTruthy();
    act(() => vault().externalWrite("Notizen/Ideen.html", "<!doctype html><html><head><title>Ideen</title></head><body><main></main></body></html>"));
    await waitFor(() => expect([...document.querySelectorAll(".tree .tree-duplicate")].map((el) => el.textContent).sort()).toEqual(["HTML", "MD"]));
    fireEvent.contextMenu(baum.getByTitle("Notizen/Formatierung.md"));
    expect(screen.getByRole("menuitem", { name: "Umbenennen" })).toBeTruthy();
  });
});

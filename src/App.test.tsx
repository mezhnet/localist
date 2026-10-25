// Oberflächen-Tests der ganzen App. Statt der Rust-Seite antwortet die Vault-Simulation aus
// dev-backend.ts (Inhalt wie beispiel-vault/, nur im Arbeitsspeicher).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

async function openPage(folder: string, page: string) {
  fireEvent.click(await screen.findByText(folder));
  fireEvent.click(await screen.findByText(page));
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
    expect(top).toEqual(["Anhänge", "Notizen", "Projekte", "Vorlagen"]);
    expect(screen.queryByText(".localist")).toBeNull();

    fireEvent.click(screen.getByText("Anhänge"));
    expect(await screen.findByText("Leer")).toBeTruthy(); // skizze.png ist keine Seite
    fireEvent.click(screen.getByText("Notizen"));
    expect(await screen.findByText("Formatierung")).toBeTruthy();
    expect(screen.getByText("Ideen")).toBeTruthy();
  });

  it("legt Seiten mit id an und Ordner mit freiem Namen", async () => {
    await openVaultFromStart();
    fireEvent.click(screen.getByRole("button", { name: "+ Neue Seite" }));
    await screen.findByDisplayValue("Unbenannt");
    expect(vault().files.get("Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\n---\n$/);

    fireEvent.click(screen.getByRole("button", { name: "+ Neuer Ordner" }));
    const input = await screen.findByRole("textbox", { name: "Neuer Name für „Neuer Ordner“" });
    fireEvent.change(input, { target: { value: "Archiv" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(vault().folders.has("Archiv")).toBe(true));
    expect(vault().folders.has("Neuer Ordner")).toBe(false);
  });

  it("benennt Seiten in der Sidebar (F2) und über den Seitentitel um", async () => {
    await openVaultFromStart();
    fireEvent.click(await screen.findByText("Notizen"));
    fireEvent.keyDown(await screen.findByTitle("Notizen/Ideen.md"), { key: "F2" });
    const input = await screen.findByRole("textbox", { name: "Neuer Name für „Ideen“" });
    fireEvent.change(input, { target: { value: "Gedanken" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(vault().files.has("Notizen/Gedanken.md")).toBe(true));
    expect(vault().files.has("Notizen/Ideen.md")).toBe(false);

    fireEvent.click(await screen.findByText("Gedanken"));
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
    await waitFor(() => expect(screen.queryByText("Vorlagen")).toBeNull());
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
    fireEvent.click(screen.getByRole("button", { name: "+ Eigenschaft hinzufügen" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name der Eigenschaft" }), { target: { value: "fällig" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Typ der neuen Eigenschaft" }), { target: { value: "datum" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    const date = await screen.findByLabelText("fällig");
    fireEvent.change(date, { target: { value: "2026-12-24" } });
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toContain("erledigt: true\nfällig: 2026-12-24\n---\n"));
    expect(vault().files.get(".localist/settings.json")).toContain('"fällig": "datum"');

    // Mehrfachauswahl als YAML-Liste
    fireEvent.click(screen.getByRole("button", { name: "+ Eigenschaft hinzufügen" }));
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
    fireEvent.contextMenu(await screen.findByText("Notizen"));
    fireEvent.click(screen.getByRole("menuitem", { name: "In Datenbank umwandeln" }));
    await waitFor(() => expect(vault().files.has("Notizen/_ansichten.yaml")).toBe(true));
    const yaml = vault().files.get("Notizen/_ansichten.yaml")!;
    expect(yaml).toContain("eigenschaften:\n  status:\n    typ: status\n");
    expect(yaml).toContain("  aufwand:\n    typ: zahl\n");
    expect(yaml).toContain("ansichten:\n  - name: Tabelle\n    typ: tabelle\n");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3); // Kopfzeile + 2 Seiten
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent?.trim())).toEqual(["Aa Name", "◐ status", "# aufwand", "+"]);
  });

  it("Tabelle: Zellen bearbeiten, sortieren und filtern (gespeichert in _ansichten.yaml), neue Zeile mit id", async () => {
    await openVaultFromStart();
    fireEvent.click(await screen.findByText("Projekte"));
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
    fireEvent.click(screen.getByRole("button", { name: "Absteigend sortieren" }));
    await waitFor(() => expect(names()).toEqual(["Umzug", "Website-Relaunch"]));
    expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("sortierung:\n      - eigenschaft: fällig\n        richtung: absteigend\n");

    // Filter: status ist "In Arbeit"
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Filter hinzufügen" }));
    commitInput(await screen.findByRole("combobox", { name: "Filterwert" }), "In Arbeit");
    await waitFor(() => expect(names()).toEqual(["Website-Relaunch"]));
    expect(vault().files.get("Projekte/_ansichten.yaml")).toContain("filter:\n      - eigenschaft: status\n        operator: ist\n        wert: In Arbeit\n");

    // Neue Zeile legt eine .md-Datei mit id an
    fireEvent.click(screen.getByRole("button", { name: "Filter (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Neu" }));
    await waitFor(() => expect(vault().files.get("Projekte/Unbenannt.md")).toMatch(/^---\nid: [0-9a-f-]{36}\n---\n$/));
  });
});

describe("Kanban", () => {
  async function openKanban() {
    await openVaultFromStart();
    fireEvent.click(await screen.findByText("Projekte"));
    await screen.findByDisplayValue("Umzug"); // Einträge sind geladen
    fireEvent.click(screen.getByRole("button", { name: "Ansicht hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "▥ Kanban" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "▦ Tabelle" }));
    expect(await screen.findByRole("table")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "▥ Kanban" }));
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
    fireEvent.click(within(column).getByRole("button", { name: "+ Neu" }));
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
    fireEvent.click(await screen.findByText("Projekte"));
    await screen.findByDisplayValue("Notiz");
    fireEvent.click(screen.getByRole("button", { name: "Ansicht hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "📅 Kalender" }));
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
    fireEvent.click(screen.getByRole("button", { name: "+ Seite aus Vorlage" }));
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
    expect(screen.getByText("Notizen")).toBeTruthy();
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

    fireEvent.click(await within(picker).findByText("📁 Interner Speicher"));
    fireEvent.click(await within(picker).findByText("📁 Documents"));
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
    expect(document.querySelector(".mobile-title")?.textContent).toBe("Ideen");
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

    fireEvent.click(screen.getByRole("button", { name: "🙂 Icon hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: "Icon 💡" }));
    await waitFor(() => expect(vault().files.get("Notizen/Ideen.md")).toBe(`---\nicon: 💡\n---\n${before}`));
    expect(screen.getByRole("button", { name: "Icon ändern" }).textContent).toBe("💡");

    fireEvent.click(screen.getByRole("button", { name: "🖼️ Cover hinzufügen" }));
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
    expect(await screen.findByText("Links in 1 Seite angepasst.")).toBeTruthy();
  });

  it("schaltet zwischen hell und dunkel um und merkt sich die Wahl", async () => {
    await openVaultFromStart();
    expect(document.documentElement.dataset.theme).toBe("light"); // System (Test) ist hell
    fireEvent.change(screen.getByRole("combobox", { name: "Darstellung" }), { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    fireEvent.change(screen.getByRole("combobox", { name: "Darstellung" }), { target: { value: "system" } });
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

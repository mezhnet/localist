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

/** Der Ordnerbaum der Sidebar. Seitennamen stehen auch auf der Startseite, in den Favoriten und oben im Pfad. */
async function inTree() {
  return within(await screen.findByRole("tree"));
}

async function openPage(folder: string, page: string) {
  fireEvent.click(await (await inTree()).findByText(folder));
  fireEvent.click(await (await inTree()).findByText(page));
}

/** Öffnet das „Neu“-Menü der Sidebar und wählt einen Eintrag. */
function createNew(item: "Notiz" | "HTML-Seite" | "Ordner" | "Datenbank" | "Notiz aus Vorlage …") {
  fireEvent.click(screen.getByRole("button", { name: "Neu" }));
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
    expect(top).toEqual(["Anhänge", "Notizen", "Projekte", "Vorlagen"]);
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
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3); // Kopfzeile + 2 Seiten
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
    // Seit Etappe 10 verlinkt auch die HTML-Seite Notizen/DNS.html auf „Ideen“ (<a href>); sie wird mit angepasst.
    expect(vault().files.get("Notizen/DNS.html")).toContain('<a href="Gedanken.md">Ideen</a>');
    expect(await screen.findByText("Links in 2 Seiten angepasst.")).toBeTruthy();
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
    fireEvent.click(theme.getByRole("button", { name: "Wie System" }));
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
    const hit = await screen.findByRole("option", { name: /DNS/ });
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
    expect(frame().style.height).toBe("640px");
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

// Oberflächen-Tests der ganzen App. Statt der Rust-Seite antwortet die Vault-Simulation aus
// dev-backend.ts (Inhalt wie beispiel-vault/, nur im Arbeitsspeicher).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
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
    expect(screen.getByText("Testvault")).toBeTruthy();
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
    vault().externalWrite(".meinapp/geheim.md", "x");
    const tree = await openVaultFromStart();
    await within(tree).findByText("Notizen");
    const top = within(tree).getAllByRole("treeitem").map((item) => item.querySelector(".tree-name")?.textContent);
    expect(top).toEqual(["Anhänge", "Notizen", "Projekte", "Vorlagen"]);
    expect(screen.queryByText(".meinapp")).toBeNull();

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

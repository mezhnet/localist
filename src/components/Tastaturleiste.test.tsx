// Leiste über der Tastatur (Etappe 20): Lage über der Bildschirmtastatur und der Cursor bleibt immer darüber.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultEditor } from "../editor/schema";
import { BlockEditor } from "./BlockEditor";
import { tastaturUeberdeckung } from "./Tastaturleiste";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
});

/** Handy-Bildschirm (unter 769 px) vortäuschen. */
function handyBildschirm() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) => ({ matches: query === "(max-width: 768px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
}

/** Sichtbarer Ausschnitt der Seite (bei offener Tastatur kleiner als das Fenster). */
function sichtbar(height: number, offsetTop = 0) {
  Object.defineProperty(window, "visualViewport", {
    value: { height, offsetTop, addEventListener: () => {}, removeEventListener: () => {} },
    configurable: true,
  });
}

const rechteck = (top: number, height: number) => ({ x: 0, y: top, top, left: 0, right: 300, bottom: top + height, width: 300, height, toJSON: () => ({}) }) as DOMRect;

describe("Leiste über der Tastatur (Etappe 20)", () => {
  it("misst, wie weit die Bildschirmtastatur die Seite überdeckt (0, wenn die Seite selbst kleiner wird)", () => {
    expect(tastaturUeberdeckung()).toBe(0);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(740);
    sichtbar(740);
    expect(tastaturUeberdeckung()).toBe(0);
    sichtbar(440);
    expect(tastaturUeberdeckung()).toBe(300);
    sichtbar(440, 50);
    expect(tastaturUeberdeckung()).toBe(250);
  });

  it("schiebt den Text, sobald der Cursor unter die Oberkante der Leiste käme; gibt die Überdeckung als CSS-Variable weiter", async () => {
    handyBildschirm();
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(740);
    sichtbar(440);
    const scrollBy = vi.fn();
    vi.spyOn(window, "scrollBy").mockImplementation(scrollBy);
    // Leiste oben bei 380 px (über der Tastatur), der Cursor steht bei 390–412 px: 412 + 12 − 380 = 44 px zu tief.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("tastaturleiste") ? rechteck(380, 50) : rechteck(0, 20);
    });
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(rechteck(390, 22));

    let editor: VaultEditor | null = null;
    render(<BlockEditor initialBlocks={[{ type: "paragraph", content: "Hallo" }]} onChange={() => {}} onReady={(fertig) => (editor = fertig)} resolveFileUrl={async (url) => url} />);
    await waitFor(() => expect(editor).not.toBeNull());
    act(() => editor!.focus());
    expect(await screen.findByRole("toolbar", { name: "Schreiben" })).toBeTruthy();
    expect(document.querySelector(".tastaturleiste")?.hasAttribute("data-ueberdeckt")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--tastatur-ueberdeckung")).toBe("300px");
    act(() => editor!.setTextCursorPosition(editor!.document[0], "end"));
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(0, 44));

    // Steht der Cursor weit genug darüber, bleibt alles, wie es ist.
    scrollBy.mockClear();
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(rechteck(200, 22));
    act(() => editor!.setTextCursorPosition(editor!.document[0], "start"));
    await new Promise((fertig) => setTimeout(fertig, 50));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

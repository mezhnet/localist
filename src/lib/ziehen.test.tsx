// Tests für den gemeinsamen Zieh-Mechanismus (Etappe 22): Maus, Finger mit langem Drücken, Escape, Verweilen,
// Mit-Scrollen am Rand und der Schutz gegen fremde Dateien.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fremdeDateienAbweisen, GEIST_ABSTAND_PX, GREIFEN_MS, randScroll, RAND_PX, SCROLL_MAX_PX, useZiehen, VERWEILEN_MS } from "./ziehen";

describe("randScroll: Mit-Scrollen am Rand", () => {
  it("scrollt nur in den Randzonen: am Beginn der Zone kaum, an der Kante und darüber hinaus am schnellsten", () => {
    // Bereich 100 … 500 (400 px hoch): Randzone 40 px
    expect(randScroll(300, 100, 500)).toBe(0);
    expect(randScroll(100 + RAND_PX, 100, 500)).toBe(0);
    expect(randScroll(500 - RAND_PX, 100, 500)).toBe(0);
    // Eine Zeile nahe am Rand nur gestreift (6 px in der Zone): kein Scrollen, das Ziel bleibt unter dem Finger
    expect(randScroll(500 - RAND_PX + 6, 100, 500)).toBe(0);
    // Halb in der Zone: ein Viertel der Höchstgeschwindigkeit (quadratisch)
    expect(randScroll(120, 100, 500)).toBe(-SCROLL_MAX_PX / 4);
    expect(randScroll(480, 100, 500)).toBe(SCROLL_MAX_PX / 4);
    expect(randScroll(100, 100, 500)).toBe(-SCROLL_MAX_PX);
    expect(randScroll(500, 100, 500)).toBe(SCROLL_MAX_PX);
    // Zeiger über bzw. unter dem Bereich: nicht schneller als das Maximum
    expect(randScroll(20, 100, 500)).toBe(-SCROLL_MAX_PX);
    expect(randScroll(900, 100, 500)).toBe(SCROLL_MAX_PX);
  });

  it("in kleinen Bereichen ist die Randzone höchstens ein Viertel groß, ein leerer Bereich scrollt nie", () => {
    // 80 px hoch: Randzone 20 px, die Mitte bleibt frei
    expect(randScroll(40, 0, 80)).toBe(0);
    expect(randScroll(10, 0, 80)).toBe(-SCROLL_MAX_PX / 4);
    expect(randScroll(0, 0, 0)).toBe(0);
  });
});

interface Ereignisse {
  abgelegt: [string, string][];
  langDruck: [string, number, number][];
  verweilt: string[];
}

/** Zwei Zeilen „a“ und „b“ (Ziele über `data-ziel`) und ein Element ohne Ziel. */
function Liste({ e }: { e: Ereignisse }) {
  const ziehen = useZiehen<string, string>({
    zielAn: (element, _x, _y, quelle) => {
      const ziel = element.closest<HTMLElement>("[data-ziel]")?.dataset.ziel ?? null;
      return ziel === quelle ? null : ziel;
    },
    onAblegen: (quelle, ziel) => e.abgelegt.push([quelle, ziel]),
    onLangDruck: (quelle, x, y) => e.langDruck.push([quelle, x, y]),
    onVerweilen: (ziel) => e.verweilt.push(ziel),
  });
  const z = ziehen.zustand;
  return (
    <div onContextMenu={() => e.langDruck.push(["kontextmenue-der-app", 0, 0])}>
      {["a", "b"].map((name) => (
        <div
          key={name}
          data-ziel={name}
          data-testid={name}
          className={[z?.ziel === name && "drop-target", z?.quelle === name && `ist-${z.phase}`].filter(Boolean).join(" ")}
          {...ziehen.griff(name)}
        >
          {name}
        </div>
      ))}
      <div data-testid="frei">frei</div>
    </div>
  );
}

let e: Ereignisse;
let unterZeiger: Element | null;

beforeEach(async () => {
  // Nach einem Ziehen im vorigen Test schluckt die Seite noch kurz den folgenden Klick.
  await new Promise((fertig) => setTimeout(fertig, 0));
  e = { abgelegt: [], langDruck: [], verweilt: [] };
  unterZeiger = null;
  // jsdom kennt keine Layout-Berechnung: Das Element unter dem Zeiger legt der Test fest.
  document.elementFromPoint = () => unterZeiger;
});
afterEach(() => {
  cleanup();
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

const maus = { pointerId: 1, pointerType: "mouse", button: 0 };
const finger = { pointerId: 7, pointerType: "touch", button: 0 };

describe("useZiehen mit der Maus", () => {
  it("beginnt erst ab einigen Pixeln, hebt das Ziel hervor, legt beim Loslassen ab und räumt die Kopie weg", () => {
    const { getByTestId } = render(<Liste e={e} />);
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, clientX: 12, clientY: 11 });
    expect(document.querySelector(".ziehen-geist")).toBeNull();
    expect(getByTestId("a").className).toBe("");
    unterZeiger = getByTestId("b");
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 40 });
    // Die Kopie liegt rechts unter dem Mauszeiger, nicht auf dem Ziel
    expect(document.querySelector<HTMLElement>(".ziehen-geist")?.style.transform).toBe(`translate(${10 + GEIST_ABSTAND_PX}px, ${40 + GEIST_ABSTAND_PX}px)`);
    expect(document.documentElement.classList.contains("ist-ziehen")).toBe(true);
    expect(getByTestId("a").className).toBe("ist-zieht");
    expect(getByTestId("b").className).toBe("drop-target");
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 40 });
    expect(e.abgelegt).toEqual([["a", "b"]]);
    expect(document.querySelector(".ziehen-geist")).toBeNull();
    expect(document.documentElement.classList.contains("ist-ziehen")).toBe(false);
    expect(getByTestId("b").className).toBe("");
  });

  it("ein Klick ohne Bewegung bleibt ein Klick; Loslassen ohne Ziel legt nichts ab", () => {
    const { getByTestId } = render(<Liste e={e} />);
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 10 });
    expect(fireEvent.click(getByTestId("a"))).toBe(true);
    unterZeiger = getByTestId("frei");
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 80 });
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 80 });
    expect(e.abgelegt).toEqual([]);
  });

  it("die rechte Maustaste zieht nicht", () => {
    const { getByTestId } = render(<Liste e={e} />);
    unterZeiger = getByTestId("b");
    fireEvent.pointerDown(getByTestId("a"), { ...maus, button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, button: 2, clientX: 10, clientY: 40 });
    fireEvent.pointerUp(window, { ...maus, button: 2, clientX: 10, clientY: 40 });
    expect(e.abgelegt).toEqual([]);
    expect(document.querySelector(".ziehen-geist")).toBeNull();
  });

  it("Escape bricht ab: nichts wird abgelegt, der Klick beim Loslassen wird geschluckt", async () => {
    const { getByTestId } = render(<Liste e={e} />);
    unterZeiger = getByTestId("b");
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 40 });
    expect(getByTestId("b").className).toBe("drop-target");
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    expect(document.querySelector(".ziehen-geist")).toBeNull();
    expect(getByTestId("b").className).toBe("");
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 40 });
    expect(fireEvent.click(getByTestId("b"))).toBe(false);
    expect(e.abgelegt).toEqual([]);
    // Danach sind Klicks wieder normal.
    await act(() => new Promise((fertig) => setTimeout(fertig, 0)));
    expect(fireEvent.click(getByTestId("b"))).toBe(true);
  });

  it("Verweilen über demselben Ziel meldet sich nach etwa 600 ms, ein Zielwechsel beginnt von vorn", () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Liste e={e} />);
    unterZeiger = getByTestId("b");
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 40 });
    act(() => vi.advanceTimersByTime(VERWEILEN_MS - 100));
    unterZeiger = getByTestId("frei");
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 80 });
    unterZeiger = getByTestId("b");
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 41 });
    act(() => vi.advanceTimersByTime(VERWEILEN_MS - 100));
    expect(e.verweilt).toEqual([]);
    act(() => vi.advanceTimersByTime(100));
    expect(e.verweilt).toEqual(["b"]);
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 41 });
  });
});

describe("useZiehen: Mit-Scrollen am Rand", () => {
  it("am unteren Rand der Liste scrollt sie beim Ziehen weiter, in der Mitte nicht; nach dem Loslassen hört es auf", async () => {
    const { getByTestId } = render(
      <div data-testid="liste" style={{ overflowY: "auto" }}>
        <Liste e={e} />
      </div>,
    );
    const liste = getByTestId("liste");
    // jsdom rechnet kein Layout: 200 px hohe Liste mit 1000 px Inhalt
    let oben = 0;
    Object.defineProperties(liste, {
      scrollHeight: { value: 1000 },
      clientHeight: { value: 200 },
      scrollTop: { get: () => oben, set: (wert: number) => (oben = Math.max(0, Math.min(800, wert))) },
    });
    liste.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 300, width: 300, height: 200, x: 0, y: 0, toJSON: () => ({}) });
    const warten = (ms: number) => act(() => new Promise((fertig) => setTimeout(fertig, ms)));
    unterZeiger = getByTestId("b");
    fireEvent.pointerDown(getByTestId("a"), { ...maus, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 100 });
    await warten(100);
    expect(oben).toBe(0);
    fireEvent.pointerMove(window, { ...maus, clientX: 10, clientY: 198 });
    await warten(150);
    expect(oben).toBeGreaterThan(0);
    fireEvent.pointerUp(window, { ...maus, clientX: 10, clientY: 198 });
    const danach = oben;
    await warten(100);
    expect(oben).toBe(danach);
  });
});

describe("useZiehen mit dem Finger (langes Drücken)", () => {
  it("unter 400 ms wird nichts gegriffen, danach hebt sich die Zeile an", () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Liste e={e} />);
    fireEvent.pointerDown(getByTestId("a"), { ...finger, clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(GREIFEN_MS - 1));
    expect(getByTestId("a").className).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(getByTestId("a").className).toBe("ist-gegriffen");
    fireEvent.pointerCancel(window, finger);
    expect(getByTestId("a").className).toBe("");
  });

  it("Bewegung vor 400 ms ist Wischen: kein Greifen, kein Ablegen, der Browser darf scrollen", () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Liste e={e} />);
    unterZeiger = getByTestId("b");
    fireEvent.pointerDown(getByTestId("a"), { ...finger, clientX: 10, clientY: 100 });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.pointerMove(window, { ...finger, clientX: 10, clientY: 60 });
    // Der Finger scrollt: touchmove wird nicht verhindert.
    const wischen = new Event("touchmove", { bubbles: true, cancelable: true });
    window.dispatchEvent(wischen);
    expect(wischen.defaultPrevented).toBe(false);
    act(() => vi.advanceTimersByTime(GREIFEN_MS));
    expect(getByTestId("a").className).toBe("");
    fireEvent.pointerUp(window, { ...finger, clientX: 10, clientY: 60 });
    expect(e.abgelegt).toEqual([]);
    expect(e.langDruck).toEqual([]);
  });

  it("lange gedrückt und ohne Bewegung losgelassen: das Menü (onLangDruck), kein Kontextmenü von Android oder der App", () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Liste e={e} />);
    fireEvent.pointerDown(getByTestId("a"), { ...finger, clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(GREIFEN_MS));
    // Android schickt beim langen Drücken „contextmenu“: verhindert und nicht an die App weitergegeben
    expect(fireEvent.contextMenu(getByTestId("a"))).toBe(false);
    fireEvent.pointerMove(window, { ...finger, clientX: 13, clientY: 14 });
    fireEvent.pointerUp(window, { ...finger, clientX: 13, clientY: 14 });
    expect(e.langDruck).toEqual([["a", 13, 14]]);
    expect(e.abgelegt).toEqual([]);
    // Mit der Maus bleibt der Rechtsklick wie bisher.
    act(() => vi.runAllTimers());
    fireEvent.contextMenu(getByTestId("a"));
    expect(e.langDruck[e.langDruck.length - 1][0]).toBe("kontextmenue-der-app");
  });

  it("nach dem Greifen zieht eine Bewegung: kein Scrollen, Kopie folgt, Ablegen im Ziel, kein Menü", () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Liste e={e} />);
    fireEvent.pointerDown(getByTestId("a"), { ...finger, clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(GREIFEN_MS));
    unterZeiger = getByTestId("b");
    fireEvent.pointerMove(window, { ...finger, clientX: 10, clientY: 50 });
    const ziehenStattScrollen = new Event("touchmove", { bubbles: true, cancelable: true });
    window.dispatchEvent(ziehenStattScrollen);
    expect(ziehenStattScrollen.defaultPrevented).toBe(true);
    const geist = document.querySelector<HTMLElement>(".ziehen-geist");
    expect(geist?.getAttribute("aria-hidden")).toBe("true");
    // Die Kopie schwebt über dem Finger (jsdom: Kopie 0 × 0 px), damit sie weder vom Finger noch über dem Ziel liegt
    expect(geist?.style.transform).toBe(`translate(10px, ${50 - 3 * GEIST_ABSTAND_PX}px)`);
    expect(getByTestId("b").className).toBe("drop-target");
    fireEvent.pointerUp(window, { ...finger, clientX: 10, clientY: 50 });
    expect(e.abgelegt).toEqual([["a", "b"]]);
    expect(e.langDruck).toEqual([]);
  });
});

describe("fremdeDateienAbweisen", () => {
  const ereignis = (typ: string, types: string[]) => {
    const event = new Event(typ, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, "dataTransfer", { value: { types, dropEffect: "move" } });
    return event;
  };

  it("eine Datei aus dem Explorer wird nirgends abgelegt (die WebView öffnet sie nicht), Ziehen in der Seite bleibt", () => {
    const entfernen = fremdeDateienAbweisen();
    const ueber = ereignis("dragover", ["Files"]);
    document.body.dispatchEvent(ueber);
    expect(ueber.defaultPrevented).toBe(true);
    expect(ueber.dataTransfer?.dropEffect).toBe("none");
    const ablegen = ereignis("drop", ["Files"]);
    document.body.dispatchEvent(ablegen);
    expect(ablegen.defaultPrevented).toBe(true);
    // Ziehgriff im Block-Editor: keine Dateien, nichts wird verhindert
    const block = ereignis("dragover", ["text/html", "blocknote/html"]);
    document.body.dispatchEvent(block);
    expect(block.defaultPrevented).toBe(false);
    entfernen();
    const danach = ereignis("drop", ["Files"]);
    document.body.dispatchEvent(danach);
    expect(danach.defaultPrevented).toBe(false);
  });
});

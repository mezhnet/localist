import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollWiederherstellen } from "./scroll-gedaechtnis";

/** Ein Element, dessen Inhalt erst nach und nach hoch genug wird (wie eine Seite, die nachlädt). */
function element(hoehen: number[]) {
  const el = document.createElement("div");
  let bild = 0;
  let scrollTop = 0;
  Object.defineProperty(el, "clientHeight", { value: 500 });
  Object.defineProperty(el, "scrollHeight", { get: () => hoehen[Math.min(bild, hoehen.length - 1)] });
  Object.defineProperty(el, "scrollTop", {
    get: () => scrollTop,
    set: (wert: number) => (scrollTop = Math.max(0, Math.min(wert, hoehen[Math.min(bild, hoehen.length - 1)] - 500))),
  });
  return { el, weiter: () => bild++ };
}

afterEach(() => vi.restoreAllMocks());

describe("Scrollposition je Reiter wiederherstellen", () => {
  it("wartet, bis der Inhalt hoch genug ist, und scrollt dann an die gemerkte Stelle", () => {
    const rueckrufe: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => rueckrufe.push(cb));
    const { el, weiter } = element([600, 900, 2400]);
    scrollWiederherstellen(el, 1200);
    expect(el.scrollTop).toBe(100); // so weit es schon geht
    for (let i = 0; i < 12 && rueckrufe.length; i++) {
      weiter();
      rueckrufe.shift()!(0);
    }
    expect(el.scrollTop).toBe(1200);
  });

  it("hört auf, sobald der Nutzer selbst scrollt, klickt oder tippt; ohne Position passiert nichts", () => {
    const rueckrufe: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => rueckrufe.push(cb));
    const { el, weiter } = element([600, 2400]);
    scrollWiederherstellen(el, 1200);
    el.dispatchEvent(new Event("wheel"));
    el.scrollTop = 40;
    weiter();
    while (rueckrufe.length) rueckrufe.shift()!(0);
    expect(el.scrollTop).toBe(40);

    const leer = element([2400]);
    scrollWiederherstellen(leer.el, 0);
    expect(leer.el.scrollTop).toBe(0);
    expect(rueckrufe).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { gespeichertText } from "./SeitenKopf";

describe("Speicherstatus im Seitenkopf (Etappe 19)", () => {
  it("nennt die Zeit seit dem Speichern: gerade eben, vor 3 Min., gestern, sonst das Datum", () => {
    const jetzt = new Date(2026, 9, 29, 15, 0).getTime();
    expect(gespeichertText(jetzt - 10_000, jetzt)).toBe("gerade eben gespeichert");
    expect(gespeichertText(jetzt - 3 * 60_000 - 5_000, jetzt)).toBe("vor 3 Min. gespeichert");
    expect(gespeichertText(jetzt - 2 * 3_600_000, jetzt)).toBe("vor 2 Std. gespeichert");
    expect(gespeichertText(new Date(2026, 9, 28, 9, 0).getTime(), jetzt)).toBe("gestern gespeichert");
    expect(gespeichertText(new Date(2026, 9, 12, 9, 0).getTime(), jetzt)).toBe("am 12.10.2026 gespeichert");
  });
});

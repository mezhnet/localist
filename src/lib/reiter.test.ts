import { beforeEach, describe, expect, it } from "vitest";
import {
  aktiverReiter,
  aktivieren,
  entfernen,
  neuerStartReiter,
  oeffnen,
  pfadeFolgen,
  reiterLaden,
  reiterMerken,
  schliessen,
  START_REITER,
  startStand,
  verlassen,
  wechseln,
  type ReiterStand,
} from "./reiter";

const seite = (pfad: string) => ({ art: "seite" as const, pfad });
const titel = (stand: ReiterStand) => stand.reiter.map((r) => ("pfad" in r.inhalt ? r.inhalt.pfad : r.inhalt.art));
const aktiv = (stand: ReiterStand) => {
  const inhalt = aktiverReiter(stand).inhalt;
  return "pfad" in inhalt ? inhalt.pfad : inhalt.art;
};

beforeEach(() => localStorage.clear());

describe("Reiter: öffnen", () => {
  it("vom festen Reiter „Startseite“ aus öffnet ein Klick einen neuen Reiter, danach im aktuellen Reiter", () => {
    let stand = oeffnen(startStand(), seite("Notizen/Ideen.md"));
    expect(titel(stand)).toEqual(["start", "Notizen/Ideen.md"]);
    expect(aktiv(stand)).toBe("Notizen/Ideen.md");
    const ansicht = aktiverReiter(stand).ansicht;
    stand = oeffnen(stand, seite("Lernen/DNS.html"));
    expect(titel(stand)).toEqual(["start", "Lernen/DNS.html"]);
    expect(aktiverReiter(stand).ansicht).not.toBe(ansicht);
    // dieselbe Seite noch einmal: nichts ändert sich
    expect(oeffnen(stand, seite("Lernen/DNS.html"))).toBe(stand);
  });

  it("Strg+Klick oder Mittelklick öffnet einen neuen Reiter rechts neben dem aktiven", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = oeffnen(stand, seite("B.md"), { neuerReiter: true });
    stand = aktivieren(stand, stand.reiter[1].id);
    stand = oeffnen(stand, seite("C.md"), { neuerReiter: true });
    expect(titel(stand)).toEqual(["start", "A.md", "C.md", "B.md"]);
    expect(aktiv(stand)).toBe("C.md");
  });

  it("vom festen Reiter aus: ist die Seite schon offen, wird zu ihrem Reiter gewechselt", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = oeffnen(stand, seite("B.md"), { neuerReiter: true });
    stand = aktivieren(stand, START_REITER);
    stand = oeffnen(stand, seite("A.md"));
    expect(titel(stand)).toEqual(["start", "A.md", "B.md"]);
    expect(aktiv(stand)).toBe("A.md");
  });

  it("ohne Reiterleiste (Handy) wird vom festen Reiter aus der letzte Reiter wiederverwendet", () => {
    let stand = oeffnen(startStand(), seite("A.md"), { ohneLeiste: true });
    stand = aktivieren(stand, START_REITER);
    stand = oeffnen(stand, seite("B.md"), { ohneLeiste: true });
    expect(titel(stand)).toEqual(["start", "B.md"]);
  });

  it("Datenbank, Notizbuch und Bausteine öffnen wie Seiten; der feste Reiter bleibt die Startseite", () => {
    let stand = oeffnen(startStand(), { art: "datenbank", pfad: "Projekte" });
    stand = oeffnen(stand, { art: "bausteine" });
    stand = aktivieren(stand, START_REITER);
    expect(oeffnen(stand, { art: "start" })).toBe(stand);
    stand = oeffnen(stand, { art: "notizbuch", pfad: "Lernen" });
    expect(titel(stand)).toEqual(["start", "bausteine", "Lernen"]);
  });
});

describe("Reiter: Strg+T, Strg+W, Strg+Tab", () => {
  it("Strg+T öffnet einen Reiter mit der Startseite am Ende; Strg+W schließt, der feste Reiter bleibt", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = neuerStartReiter(stand);
    expect(titel(stand)).toEqual(["start", "A.md", "start"]);
    expect(aktiverReiter(stand).id).not.toBe(START_REITER);
    // Im neuen Reiter öffnet ein Klick die Seite in diesem Reiter.
    stand = oeffnen(stand, seite("B.md"));
    expect(titel(stand)).toEqual(["start", "A.md", "B.md"]);
    stand = schliessen(stand, stand.aktiv);
    expect(titel(stand)).toEqual(["start", "A.md"]);
    expect(aktiv(stand)).toBe("A.md");
    stand = schliessen(stand, stand.aktiv);
    expect(titel(stand)).toEqual(["start"]);
    expect(schliessen(stand, START_REITER)).toBe(stand);
  });

  it("Schließen des aktiven Reiters aktiviert den rechten Nachbarn, am Ende den linken; andere bleiben aktiv", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = oeffnen(stand, seite("B.md"), { neuerReiter: true });
    stand = oeffnen(stand, seite("C.md"), { neuerReiter: true });
    const [, a, b] = stand.reiter;
    stand = aktivieren(stand, a.id);
    expect(aktiv(schliessen(stand, a.id))).toBe("B.md");
    expect(aktiv(schliessen(stand, b.id))).toBe("A.md");
    expect(titel(schliessen(stand, b.id))).toEqual(["start", "A.md", "C.md"]);
  });

  it("Strg+Tab und Strg+Umschalt+Tab wechseln reihum, auch über den festen Reiter", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = oeffnen(stand, seite("B.md"), { neuerReiter: true });
    expect(aktiv(wechseln(stand, 1))).toBe("start");
    expect(aktiv(wechseln(wechseln(stand, 1), 1))).toBe("A.md");
    expect(aktiv(wechseln(stand, -1))).toBe("A.md");
  });
});

describe("Reiter folgen Umbenennen, Verschieben, Umwandeln und Löschen", () => {
  it("Seiten und Ordner: alle Reiter mit dem Pfad (oder darin) zeigen danach auf den neuen Pfad", () => {
    let stand = oeffnen(startStand(), seite("Notizen/Ideen.md"));
    stand = oeffnen(stand, { art: "datenbank", pfad: "Notizen/DB" }, { neuerReiter: true });
    stand = oeffnen(stand, seite("Andere.md"), { neuerReiter: true });
    const ansicht = stand.reiter[1].ansicht;
    stand = pfadeFolgen(stand, "Notizen", "Archiv/Notizen");
    expect(titel(stand)).toEqual(["start", "Archiv/Notizen/Ideen.md", "Archiv/Notizen/DB", "Andere.md"]);
    expect(stand.reiter[1].ansicht).toBe(ansicht); // der Editor bleibt offen
    stand = pfadeFolgen(stand, "Archiv/Notizen/Ideen.md", "Archiv/Notizen/Ideen.html");
    expect(titel(stand)[1]).toBe("Archiv/Notizen/Ideen.html");
    expect(pfadeFolgen(stand, "Gibt/Es/Nicht.md", "X.md")).toBe(stand);
  });

  it("Löschen schließt die betroffenen Reiter, nie den festen", () => {
    let stand = oeffnen(startStand(), seite("Notizen/Ideen.md"));
    stand = oeffnen(stand, seite("Notizen/Plan.md"), { neuerReiter: true });
    stand = oeffnen(stand, seite("Andere.md"), { neuerReiter: true });
    stand = aktivieren(stand, stand.reiter[2].id);
    stand = entfernen(stand, (inhalt) => "pfad" in inhalt && inhalt.pfad.startsWith("Notizen/"));
    expect(titel(stand)).toEqual(["start", "Andere.md"]);
    expect(aktiv(stand)).toBe("Andere.md");
  });
});

describe("Reiter: Scrollposition und Merken pro Vault", () => {
  it("verlassen merkt die Scrollposition und nimmt die Markierung „neu“ weg", () => {
    let stand = oeffnen(startStand(), seite("A.md"), { neu: true });
    expect(aktiverReiter(stand).neu).toBe(true);
    const id = stand.aktiv;
    stand = verlassen(aktivieren(stand, START_REITER), id, { haupt: 420, code: 30, vorschau: 99 });
    const reiter = stand.reiter.find((r) => r.id === id)!;
    expect(reiter.scroll).toEqual({ haupt: 420, code: 30, vorschau: 99 });
    expect(reiter.neu).toBeUndefined();
  });

  it("offene Reiter werden pro Vault gemerkt und wieder geladen, kaputte Einträge fallen weg", () => {
    let stand = oeffnen(startStand(), seite("A.md"));
    stand = oeffnen(stand, { art: "bausteine" }, { neuerReiter: true });
    stand = oeffnen(stand, { art: "datenbank", pfad: "Projekte" }, { neuerReiter: true });
    stand = aktivieren(stand, stand.reiter[2].id);
    reiterMerken("C:/Vault", stand);
    expect(JSON.parse(localStorage.getItem("reiter:C:/Vault")!)).toEqual({
      reiter: [seite("A.md"), { art: "bausteine" }, { art: "datenbank", pfad: "Projekte" }],
      aktiv: 1,
    });
    const geladen = reiterLaden("C:/Vault");
    expect(titel(geladen)).toEqual(["start", "A.md", "bausteine", "Projekte"]);
    expect(aktiv(geladen)).toBe("bausteine");
    expect(titel(reiterLaden("D:/Anderer Vault"))).toEqual(["start"]);

    localStorage.setItem("reiter:X", JSON.stringify({ reiter: [{ art: "seite" }, { art: "toString" }, seite("B.md")], aktiv: 2 }));
    const repariert = reiterLaden("X");
    expect(titel(repariert)).toEqual(["start", "B.md"]);
    expect(aktiv(repariert)).toBe("B.md");
    localStorage.setItem("reiter:Y", "{kaputt");
    expect(titel(reiterLaden("Y"))).toEqual(["start"]);
    // fester Reiter aktiv
    reiterMerken("Z", aktivieren(stand, START_REITER));
    expect(aktiverReiter(reiterLaden("Z")).id).toBe(START_REITER);
  });
});

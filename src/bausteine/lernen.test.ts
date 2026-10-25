// Etappe 13: Lernlogik (Kartenstapel), Quiz, Karteikarte und Diagramm-Daten aus Tabellen – geprüft an der
// erzeugten localist.js in einer simulierten Browser-Umgebung.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import localistCss from "../../src-tauri/seite/localist.css?raw";
import localistJs from "../../src-tauri/seite/localist.js?raw";

interface Zustand {
  reihe: number[];
  versuche: number[];
  gewusst: number[];
}
interface LocalistApi {
  lernen: {
    starten: (anzahl: number) => Zustand;
    antworten: (zustand: Zustand, gewusst: boolean) => Zustand;
    fertig: (zustand: Zustand) => boolean;
    auswerten: (zustand: Zustand) => { karten: number; sofort: number; wiederholt: { karte: number; versuche: number }[]; versuche: number };
  };
  quiz: { auswerten: (antworten: (boolean | null)[]) => { fragen: number; beantwortet: number; richtig: number; fertig: boolean } };
  diagramm: {
    zahl: (text: string) => number | null;
    daten: (tabelle: HTMLTableElement) => { reihen: string[]; zeilen: { beschriftung: string; werte: (number | null)[] }[] };
    zeichnen: (typ: string, daten: ReturnType<LocalistApi["diagramm"]["daten"]>, titel: string) => SVGSVGElement;
  };
}

let L: LocalistApi;
beforeAll(() => {
  new Function(localistJs)();
  L = (window as unknown as { Localist: LocalistApi }).Localist;
});
beforeEach(() => {
  document.body.innerHTML = "";
});

const klick = (element: Element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const taste = (element: Element, key: string) => element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

describe("Lernlogik des Kartenstapels", () => {
  it("Reihenfolge: die Karten kommen in der Reihenfolge der Seite", () => {
    expect(L.lernen.starten(3)).toEqual({ reihe: [0, 1, 2], versuche: [0, 0, 0], gewusst: [] });
  });

  it("Wiederholung: „Nochmal“ legt die Karte ans Ende, „Gewusst“ legt sie weg", () => {
    let zustand = L.lernen.starten(3);
    const start = zustand;
    zustand = L.lernen.antworten(zustand, false); // Karte 0: nochmal
    expect(zustand.reihe).toEqual([1, 2, 0]);
    expect(start.reihe).toEqual([0, 1, 2]); // der alte Zustand bleibt unverändert
    zustand = L.lernen.antworten(zustand, true); // Karte 1: gewusst
    zustand = L.lernen.antworten(zustand, false); // Karte 2: nochmal
    expect(zustand.reihe).toEqual([0, 2]);
    zustand = L.lernen.antworten(zustand, false); // Karte 0: nochmal (dritter Versuch kommt)
    zustand = L.lernen.antworten(zustand, true); // Karte 2: gewusst
    expect(zustand.reihe).toEqual([0]);
    expect(L.lernen.fertig(zustand)).toBe(false);
    zustand = L.lernen.antworten(zustand, true); // Karte 0: endlich gewusst
    expect(L.lernen.fertig(zustand)).toBe(true);
    expect(L.lernen.antworten(zustand, true)).toBe(zustand); // nichts mehr übrig
  });

  it("Auswertung: beim ersten Mal gewusst, wiederholte Karten mit Anzahl der Versuche", () => {
    let zustand = L.lernen.starten(3);
    for (const gewusst of [false, true, false, false, true, true]) zustand = L.lernen.antworten(zustand, gewusst);
    expect(zustand.versuche).toEqual([3, 1, 2]);
    expect(L.lernen.auswerten(zustand)).toEqual({ karten: 3, sofort: 1, wiederholt: [{ karte: 0, versuche: 3 }, { karte: 2, versuche: 2 }], versuche: 6 });
  });

  it("im Stapel: eine Karte nach der anderen, Bewerten erst nach dem Umdrehen, am Ende die Auswertung", () => {
    document.body.innerHTML = `<main><l-kartenstapel>
      <l-karteikarte><l-frage>Frage A</l-frage><l-antwort>Antwort A</l-antwort></l-karteikarte>
      <l-karteikarte><l-frage>Frage B</l-frage><l-antwort>Antwort B</l-antwort></l-karteikarte>
    </l-kartenstapel></main>`;
    const stapel = document.querySelector("l-kartenstapel")!;
    const karten = [...stapel.querySelectorAll("l-karteikarte")] as HTMLElement[];
    const knopf = (text: string) => [...stapel.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;
    const sichtbar = () => karten.filter((karte) => !karte.hidden).map((karte) => karte.querySelector("l-frage")!.textContent);
    expect(sichtbar()).toEqual(["Frage A"]);
    expect(stapel.querySelector(".l-stapel-zaehler")!.textContent).toBe("0 von 2 gewusst");
    expect(knopf("Gewusst").disabled).toBe(true);
    klick(karten[0]); // umdrehen
    expect(karten[0].hasAttribute("data-umgedreht")).toBe(true);
    expect(knopf("Gewusst").disabled).toBe(false);
    klick(knopf("Nochmal"));
    expect(sichtbar()).toEqual(["Frage B"]);
    klick(karten[1]);
    klick(knopf("Gewusst"));
    expect(sichtbar()).toEqual(["Frage A"]); // nicht gewusst → kommt erneut dran, wieder mit der Frage vorne
    expect(karten[0].hasAttribute("data-umgedreht")).toBe(false);
    expect(stapel.querySelector(".l-stapel-zaehler")!.textContent).toBe("1 von 2 gewusst");
    klick(karten[0]);
    klick(knopf("Gewusst"));
    const ergebnis = stapel.querySelector(".l-stapel-ergebnis") as HTMLElement;
    expect(ergebnis.hidden).toBe(false);
    expect(sichtbar()).toEqual([]);
    expect(ergebnis.textContent).toContain("Geschafft!");
    expect(ergebnis.textContent).toContain("1 von 2 Karten beim ersten Mal gewusst.");
    expect(ergebnis.textContent).toContain("„Frage A“ – 2 Versuche");
    klick(knopf("Noch einmal lernen"));
    expect(sichtbar()).toEqual(["Frage A"]);
    expect(stapel.querySelector(".l-stapel-zaehler")!.textContent).toBe("0 von 2 gewusst");
  });
});

describe("Karteikarte", () => {
  it("dreht sich per Klick (auch Fingertipp), Leertaste und Enter um", () => {
    document.body.innerHTML = '<main><l-karteikarte><l-frage>Port von DNS?</l-frage><l-antwort>53 – <a href="#x">mehr</a></l-antwort></l-karteikarte></main>';
    const karte = document.querySelector("l-karteikarte") as HTMLElement;
    expect(karte.getAttribute("role")).toBe("button");
    expect(karte.tabIndex).toBe(0);
    klick(karte);
    expect(karte.hasAttribute("data-umgedreht")).toBe(true);
    expect(karte.getAttribute("aria-pressed")).toBe("true");
    taste(karte, " ");
    expect(karte.hasAttribute("data-umgedreht")).toBe(false);
    taste(karte, "Enter");
    expect(karte.hasAttribute("data-umgedreht")).toBe(true);
    // Ein Link in der Antwort dreht die Karte nicht um.
    klick(karte.querySelector("a")!);
    expect(karte.hasAttribute("data-umgedreht")).toBe(true);
  });
});

describe("Quiz", () => {
  it("Punktzahl aus den Antworten", () => {
    expect(L.quiz.auswerten([true, null, false])).toEqual({ fragen: 3, beantwortet: 2, richtig: 1, fertig: false });
    expect(L.quiz.auswerten([true, true])).toEqual({ fragen: 2, beantwortet: 2, richtig: 2, fertig: true });
  });

  it("sofortige Rückmeldung, richtige Antwort wird gezeigt, Punktzahl und Wiederholen", () => {
    document.body.innerHTML = `<main><l-quiz>
      <l-quizfrage><l-frage>Bits in IPv4?</l-frage><ul><li>16</li><li data-richtig>32</li></ul></l-quizfrage>
      <l-quizfrage><l-frage>Sicheres Web?</l-frage><ul><li data-richtig>HTTPS</li><li>HTTP</li></ul></l-quizfrage>
    </l-quiz></main>`;
    const quiz = document.querySelector("l-quiz")!;
    const [erste, zweite] = [...quiz.querySelectorAll("l-quizfrage")];
    const punkte = () => quiz.querySelector(".l-quiz-punkte")!.textContent;
    expect(punkte()).toBe("Punkte: 0 von 2");
    klick(erste.querySelectorAll("li")[0]); // falsch
    expect(erste.getAttribute("data-ergebnis")).toBe("falsch");
    expect(erste.querySelector(".l-quiz-rueckmeldung")!.textContent).toBe("Leider falsch. Richtig ist: 32");
    expect(erste.querySelectorAll("li")[1].hasAttribute("data-loesung")).toBe(true);
    klick(erste.querySelectorAll("li")[1]); // zählt nicht mehr
    expect(erste.getAttribute("data-ergebnis")).toBe("falsch");
    taste(zweite.querySelectorAll("li")[0], "Enter"); // richtig, per Tastatur
    expect(zweite.querySelector(".l-quiz-rueckmeldung")!.textContent).toBe("Richtig!");
    expect(punkte()).toBe("Ergebnis: 1 von 2 richtig");
    const wiederholen = [...quiz.querySelectorAll("button")].find((b) => b.textContent === "Quiz wiederholen") as HTMLButtonElement;
    expect(wiederholen.hidden).toBe(false);
    klick(wiederholen);
    expect(punkte()).toBe("Punkte: 0 von 2");
    expect(erste.hasAttribute("data-ergebnis")).toBe(false);
  });
});

describe("Diagramm-Daten aus Tabellen", () => {
  const tabelle = (html: string) => {
    document.body.innerHTML = `<table>${html}</table>`;
    return document.querySelector("table")!;
  };

  it("liest Zahlen wie sie in Tabellen stehen (deutsche Schreibweise, Einheiten)", () => {
    const cases: [string, number | null][] = [
      ["120", 120],
      ["1.234,5", 1234.5],
      ["12,5 %", 12.5],
      ["1.234", 1234],
      ["3.5", 3.5],
      ["1,234,567", 1234567],
      ["-7", -7],
      ["1e3", 1000],
      [" 42 € ", 42],
      ["abc", null],
      ["", null],
    ];
    for (const [text, zahl] of cases) expect(L.diagramm.zahl(text), text).toBe(zahl);
  });

  it("erste Spalte = Beschriftung, weitere Spalten = Reihen, erste Zeile = Namen", () => {
    const daten = L.diagramm.daten(tabelle("<tr><th>Tag</th><th>Anfragen</th><th>Fehler</th></tr><tr><td>Mo</td><td>120</td><td>4</td></tr><tr><td>Di</td><td>95</td></tr>"));
    expect(daten).toEqual({
      reihen: ["Anfragen", "Fehler"],
      zeilen: [
        { beschriftung: "Mo", werte: [120, 4] },
        { beschriftung: "Di", werte: [95, null] },
      ],
    });
    // Kopfzeile aus <td>, aber ohne Zahlen, gilt ebenfalls als Kopfzeile
    expect(L.diagramm.daten(tabelle("<tr><td>Art</td><td>Anteil</td></tr><tr><td>Video</td><td>58</td></tr>")).reihen).toEqual(["Anteil"]);
    // Ohne Kopfzeile: Reihen werden durchnummeriert
    expect(L.diagramm.daten(tabelle("<tr><td>A</td><td>1</td><td>2</td></tr>"))).toEqual({ reihen: ["Reihe 1", "Reihe 2"], zeilen: [{ beschriftung: "A", werte: [1, 2] }] });
    expect(L.diagramm.daten(tabelle(""))).toEqual({ reihen: [], zeilen: [] });
  });

  it("zeichnet Balken, Linien und Kreis als SVG mit Farben aus den Design-Variablen", () => {
    const daten = L.diagramm.daten(tabelle("<tr><th>Tag</th><th>A</th><th>B</th></tr><tr><td>Mo</td><td>10</td><td>5</td></tr><tr><td>Di</td><td>20</td><td></td></tr>"));
    const balken = L.diagramm.zeichnen("balken", daten, "Test");
    expect(balken.getAttribute("aria-label")).toBe("Test (Balkendiagramm)");
    expect([...balken.querySelectorAll("rect")].map((rect) => rect.querySelector("title")!.textContent)).toEqual(["Mo – A: 10", "Mo – B: 5", "Di – A: 20"]);
    const linie = L.diagramm.zeichnen("linie", daten, "");
    expect(linie.querySelectorAll("polyline")).toHaveLength(1); // Reihe B hat nur einen Punkt
    expect(linie.querySelectorAll("circle")).toHaveLength(3);
    const kreis = L.diagramm.zeichnen("kreis", daten, "");
    expect([...kreis.querySelectorAll("path")].map((path) => path.querySelector("title")!.textContent)).toEqual(["Mo: 10 (33,3 %)", "Di: 20 (66,7 %)"]);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(localistCss).toContain(`.l-reihe-${n} {\n  fill: var(--color-chart-${n});`);
  });

  it("<l-diagramm> zeichnet sich aus seiner Tabelle, die Tabelle bleibt für Bildschirmleser im Dokument", () => {
    document.body.innerHTML = '<main><l-diagramm typ="linie" titel="Antwortzeit"><table><tr><th>Uhr</th><th>A</th><th>B</th></tr><tr><td>8</td><td>42</td><td>55</td></tr><tr><td>12</td><td>51,5</td><td>61</td></tr></table></l-diagramm></main>';
    const diagramm = document.querySelector("l-diagramm")!;
    expect(diagramm.hasAttribute("data-gezeichnet")).toBe(true);
    expect(diagramm.querySelector(".l-diagramm-titel")!.textContent).toBe("Antwortzeit");
    expect(diagramm.querySelector("svg.l-diagramm-linie")).toBeTruthy();
    expect([...diagramm.querySelectorAll(".l-diagramm-legende span")].map((span) => span.textContent)).toEqual(["A", "B"]);
    expect(diagramm.querySelector("table")).toBeTruthy();
    expect(localistCss).toContain("l-diagramm[data-gezeichnet] > table {");
  });
});

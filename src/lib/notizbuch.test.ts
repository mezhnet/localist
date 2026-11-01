// Notizbücher: _notizbuch.yaml lesen und schreiben, Reihenfolge der Seiten.
import { describe, expect, it } from "vitest";
import { notizbuchLesen, notizbuchMitReihenfolge, notizbuchNeu, notizbuchReihenfolge, notizbuchUmbenennen, notizbuchWiederEinfuegen, verschieben } from "./notizbuch";

describe("_notizbuch.yaml", () => {
  it("liest Titel und Seiten, auch mit Kommentaren und fehlerhaftem Inhalt", () => {
    expect(notizbuchLesen("titel: Lernen für die Prüfung\nseiten:\n  - DNS.html\n  - Subnetting.md\n")).toEqual({ titel: "Lernen für die Prüfung", seiten: ["DNS.html", "Subnetting.md"] });
    expect(notizbuchLesen("# nur ein Kommentar\n")).toEqual({ titel: null, seiten: [] });
    expect(notizbuchLesen("seiten: [a.md, b.md]")).toEqual({ titel: null, seiten: ["a.md", "b.md"] });
    expect(notizbuchLesen("titel: [kaputt\n")).toEqual({ titel: null, seiten: [] });
    expect(notizbuchLesen("- keine\n- Zuordnung\n")).toEqual({ titel: null, seiten: [] });
  });

  it("legt eine neue Datei an (Titel = Ordnername, Seiten in der aktuellen Reihenfolge)", () => {
    expect(notizbuchNeu("Lernen", ["DNS.html", "Subnetting.md"])).toBe("titel: Lernen\nseiten:\n  - DNS.html\n  - Subnetting.md\n");
    expect(notizbuchNeu("Leer", [])).toBe("titel: Leer\nseiten: []\n");
  });

  it("speichert eine neue Reihenfolge, andere Felder und Kommentare bleiben", () => {
    const text = "# Mein Notizbuch\ntitel: Lernen # Kurs\nfarbe: blau\nseiten:\n  - A.md\n  - B.md\n";
    expect(notizbuchMitReihenfolge(text, ["B.md", "A.md", "C.html"])).toBe("# Mein Notizbuch\ntitel: Lernen # Kurs\nfarbe: blau\nseiten:\n  - B.md\n  - A.md\n  - C.html\n");
  });

  it("Reihenfolge: genannte Seiten zuerst, fehlende alphabetisch am Ende, verschwundene fallen weg", () => {
    const notizbuch = { titel: null, seiten: ["Subnetting.md", "gelöscht.md", "dns.HTML"] };
    expect(notizbuchReihenfolge(notizbuch, ["Zahlen.md", "DNS.html", "Subnetting.md", "Adressen.md"])).toEqual(["Subnetting.md", "DNS.html", "Adressen.md", "Zahlen.md"]);
    expect(notizbuchReihenfolge({ titel: null, seiten: [] }, ["b.md", "Ä.md", "a.md"])).toEqual(["a.md", "Ä.md", "b.md"]);
  });

  it("Drag & Drop: an die Stelle eines anderen Eintrags oder dahinter", () => {
    expect(verschieben(["A", "B", "C", "D"], "D", "B")).toEqual(["A", "D", "B", "C"]);
    expect(verschieben(["A", "B", "C", "D"], "A", "C", true)).toEqual(["B", "C", "A", "D"]);
    expect(verschieben(["A", "B"], "A", "A")).toEqual(["A", "B"]);
  });

  it("Umbenennen und Umwandeln passen den Eintrag an, Verschieben aus dem Ordner entfernt ihn", () => {
    const text = "titel: X\nseiten:\n  - Ideen.md\n  - DNS.html\n";
    expect(notizbuchUmbenennen(text, "Ideen.md", "Ideen.html")).toBe("titel: X\nseiten:\n  - Ideen.html\n  - DNS.html\n");
    expect(notizbuchUmbenennen(text, "dns.html", null)).toBe("titel: X\nseiten:\n  - Ideen.md\n");
    expect(notizbuchUmbenennen(text, "Fehlt.md", "Neu.md")).toBe(text);
  });

  it("„Rückgängig“ nach dem Verschieben: die Seite kommt an ihren alten Platz im Notizbuch zurück (Etappe 22)", () => {
    const vorher = ["A.md", "B.html", "C.md", "D.md"];
    const ohneB = "titel: X\nseiten:\n  - A.md\n  - C.md\n  - D.md\n";
    expect(notizbuchWiederEinfuegen(ohneB, "B.html", vorher)).toBe("titel: X\nseiten:\n  - A.md\n  - B.html\n  - C.md\n  - D.md\n");
    // Der Nachfolger fehlt inzwischen: vor den nächsten vorhandenen, sonst ans Ende
    expect(notizbuchWiederEinfuegen("titel: X\nseiten:\n  - A.md\n  - D.md\n", "B.html", vorher)).toBe("titel: X\nseiten:\n  - A.md\n  - B.html\n  - D.md\n");
    expect(notizbuchWiederEinfuegen("titel: X\nseiten:\n  - A.md\n  - C.md\n", "D.md", vorher)).toBe("titel: X\nseiten:\n  - A.md\n  - C.md\n  - D.md\n");
    // Stand nicht in der Liste oder steht schon wieder darin: unverändert
    expect(notizbuchWiederEinfuegen(ohneB, "Neu.md", vorher)).toBe(ohneB);
    expect(notizbuchWiederEinfuegen("titel: X\nseiten:\n  - b.html\n", "B.html", vorher)).toBe("titel: X\nseiten:\n  - b.html\n");
  });
});

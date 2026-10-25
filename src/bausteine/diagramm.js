// Diagramm: liest die Daten aus der enthaltenen <table> (erste Spalte = Beschriftung, weitere Spalten = Werte,
// erste Zeile = Namen der Reihen) und zeichnet sie als SVG – ohne Bibliothek. Farben kommen aus den
// Variablen --color-chart-1 … 6, deshalb passt es zu hell und dunkel. Die Tabelle bleibt für Bildschirmleser.
// <l-diagramm typ="balken|linie|kreis" titel="…"><table>…</table></l-diagramm>

var SVG_NS = "http://www.w3.org/2000/svg";
var BREITE = 640;
var HOEHE = 320;
var RAND = { links: 56, rechts: 16, oben: 16, unten: 44 };

var DIAGRAMM = {
  /** Zahl aus einem Tabellenfeld: „1.234,5“, „12,5 %“, „-3“, „1e3“; sonst null. */
  zahl: function (text) {
    var t = String(text).replace(/[\s  ]/g, "").replace(/[^\d,.\-+eE]/g, "");
    if (!/\d/.test(t)) return null;
    var komma = t.lastIndexOf(",");
    var punkt = t.lastIndexOf(".");
    if (komma >= 0 && punkt >= 0) t = komma > punkt ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (komma >= 0) t = (t.match(/,/g) || []).length > 1 ? t.replace(/,/g, "") : t.replace(",", ".");
    else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.234 = Tausender
    var zahl = Number(t);
    return t !== "" && isFinite(zahl) ? zahl : null;
  },

  /** Daten aus einer Tabelle (DOM): { reihen: ["Anfragen", …], zeilen: [{ beschriftung: "Mo", werte: [120, …] }] }. */
  daten: function (tabelle) {
    var zeilen = Array.prototype.slice.call(tabelle.rows);
    if (zeilen.length === 0) return { reihen: [], zeilen: [] };
    var zellen = function (zeile) {
      return Array.prototype.slice.call(zeile.cells);
    };
    var erste = zellen(zeilen[0]);
    // Kopfzeile: aus <th>, oder ihre Wert-Spalten enthalten keine Zahlen
    var kopf =
      erste.every(function (zelle) {
        return zelle.localName === "th";
      }) ||
      erste.slice(1).every(function (zelle) {
        return DIAGRAMM.zahl(zelle.textContent) === null;
      });
    var text = function (zelle) {
      return zelle ? zelle.textContent.replace(/\s+/g, " ").trim() : "";
    };
    var daten = (kopf ? zeilen.slice(1) : zeilen).map(function (zeile) {
      var z = zellen(zeile);
      return {
        beschriftung: text(z[0]),
        werte: z.slice(1).map(function (zelle) {
          return DIAGRAMM.zahl(zelle.textContent);
        }),
      };
    });
    var breite = Math.max.apply(
      null,
      [kopf ? erste.length - 1 : 0].concat(
        daten.map(function (zeile) {
          return zeile.werte.length;
        }),
      ),
    );
    var reihen = [];
    for (var i = 0; i < breite; i++) reihen.push((kopf && text(erste[i + 1])) || "Reihe " + (i + 1));
    daten.forEach(function (zeile) {
      while (zeile.werte.length < breite) zeile.werte.push(null);
    });
    return { reihen: reihen, zeilen: daten };
  },

  /** Runde Achsenwerte: 4–6 Striche von min bis max. */
  skala: function (min, max) {
    if (min === max) max = min + 1;
    var roh = (max - min) / 5;
    var stufe = Math.pow(10, Math.floor(Math.log10(roh)));
    var schritt = [1, 2, 2.5, 5, 10]
      .map(function (f) {
        return f * stufe;
      })
      .find(function (s) {
        return s >= roh;
      });
    var von = Math.floor(min / schritt) * schritt;
    var bis = Math.ceil(max / schritt) * schritt;
    var striche = [];
    for (var wert = von; wert <= bis + schritt / 1000; wert += schritt) striche.push(Number(wert.toPrecision(12)));
    return { von: von, bis: bis, striche: striche };
  },

  /** Zeichnet das Diagramm; liefert ein <svg>-Element. */
  zeichnen: function (typ, daten, titel) {
    var svg = svgElement("svg", { viewBox: "0 0 " + BREITE + " " + HOEHE, class: "l-diagramm-bild l-diagramm-" + typ, role: "img" });
    svg.setAttribute("aria-label", (titel || "Diagramm") + " (" + { balken: "Balkendiagramm", linie: "Liniendiagramm", kreis: "Kreisdiagramm" }[typ] + ")");
    if (typ === "kreis") kreisZeichnen(svg, daten);
    else achsenZeichnen(svg, daten, typ);
    return svg;
  },
};
Localist.diagramm = DIAGRAMM;

function svgElement(tag, attribute, text) {
  var neu = document.createElementNS(SVG_NS, tag);
  for (var name in attribute) neu.setAttribute(name, attribute[name]);
  if (text !== undefined) neu.textContent = text;
  return neu;
}

function zahlText(zahl) {
  return zahl.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function kurz(text, laenge) {
  return text.length > laenge ? text.slice(0, laenge - 1) + "…" : text;
}

function achsenZeichnen(svg, daten, typ) {
  var alle = [];
  daten.zeilen.forEach(function (zeile) {
    zeile.werte.forEach(function (wert) {
      if (wert !== null) alle.push(wert);
    });
  });
  var skala = DIAGRAMM.skala(Math.min.apply(null, [0].concat(alle)), Math.max.apply(null, [0].concat(alle)));
  var flaecheB = BREITE - RAND.links - RAND.rechts;
  var flaecheH = HOEHE - RAND.oben - RAND.unten;
  var y = function (wert) {
    return RAND.oben + (1 - (wert - skala.von) / (skala.bis - skala.von)) * flaecheH;
  };
  skala.striche.forEach(function (wert) {
    svg.appendChild(svgElement("line", { x1: RAND.links, x2: BREITE - RAND.rechts, y1: y(wert), y2: y(wert), class: wert === 0 ? "l-diagramm-achse" : "l-diagramm-gitter" }));
    svg.appendChild(svgElement("text", { x: RAND.links - 8, y: y(wert) + 4, "text-anchor": "end", class: "l-diagramm-text" }, zahlText(wert)));
  });
  var anzahl = daten.zeilen.length;
  var gruppe = flaecheB / Math.max(anzahl, 1);
  // Linien: etwas Abstand zu den Rändern, damit die äußeren Beschriftungen ganz zu sehen sind
  var innenRand = 28;
  var mitte = function (i) {
    if (typ !== "linie") return RAND.links + gruppe * i + gruppe / 2;
    return anzahl === 1 ? RAND.links + flaecheB / 2 : RAND.links + innenRand + (i * (flaecheB - 2 * innenRand)) / (anzahl - 1);
  };
  daten.zeilen.forEach(function (zeile, i) {
    svg.appendChild(svgElement("text", { x: mitte(i), y: HOEHE - RAND.unten + 20, "text-anchor": "middle", class: "l-diagramm-text" }, kurz(zeile.beschriftung, 14)));
  });
  var reihen = daten.reihen.length;
  if (typ === "balken") {
    var innen = gruppe * 0.72;
    var balken = innen / Math.max(reihen, 1);
    daten.zeilen.forEach(function (zeile, i) {
      zeile.werte.forEach(function (wert, r) {
        if (wert === null) return;
        var x = RAND.links + gruppe * i + (gruppe - innen) / 2 + r * balken;
        var rechteck = svgElement("rect", {
          x: x + 1,
          y: Math.min(y(wert), y(0)),
          width: Math.max(balken - 2, 1),
          height: Math.max(Math.abs(y(wert) - y(0)), 0.5),
          rx: 2,
          class: "l-reihe l-reihe-" + ((r % 6) + 1),
        });
        rechteck.appendChild(svgElement("title", {}, zeile.beschriftung + " – " + daten.reihen[r] + ": " + zahlText(wert)));
        svg.appendChild(rechteck);
      });
    });
  } else {
    for (var r = 0; r < reihen; r++) {
      var punkte = [];
      var zeichneLinie = function () {
        if (punkte.length > 1) svg.appendChild(svgElement("polyline", { points: punkte.join(" "), class: "l-linie l-reihe-" + ((r % 6) + 1) }));
        punkte = [];
      };
      daten.zeilen.forEach(function (zeile, i) {
        var wert = zeile.werte[r];
        if (wert === null) return zeichneLinie(); // Lücke
        punkte.push(mitte(i) + "," + y(wert));
      });
      zeichneLinie();
      daten.zeilen.forEach(function (zeile, i) {
        var wert = zeile.werte[r];
        if (wert === null) return;
        var punkt = svgElement("circle", { cx: mitte(i), cy: y(wert), r: 4, class: "l-punkt l-reihe-" + ((r % 6) + 1) });
        punkt.appendChild(svgElement("title", {}, zeile.beschriftung + " – " + daten.reihen[r] + ": " + zahlText(wert)));
        svg.appendChild(punkt);
      });
    }
  }
}

function kreisZeichnen(svg, daten) {
  var stuecke = daten.zeilen
    .map(function (zeile, i) {
      return { beschriftung: zeile.beschriftung, wert: zeile.werte[0], farbe: (i % 6) + 1 };
    })
    .filter(function (stueck) {
      return stueck.wert !== null && stueck.wert > 0;
    });
  var summe = stuecke.reduce(function (s, stueck) {
    return s + stueck.wert;
  }, 0);
  if (summe <= 0) return;
  var cx = BREITE / 2;
  var cy = HOEHE / 2;
  var radius = HOEHE / 2 - 12;
  var winkel = -Math.PI / 2;
  stuecke.forEach(function (stueck) {
    var anteil = stueck.wert / summe;
    var titel = stueck.beschriftung + ": " + zahlText(stueck.wert) + " (" + zahlText(Math.round(anteil * 1000) / 10) + " %)";
    var form;
    if (anteil >= 0.9999) {
      form = svgElement("circle", { cx: cx, cy: cy, r: radius, class: "l-kreis-stueck l-reihe-" + stueck.farbe });
    } else {
      var ende = winkel + anteil * 2 * Math.PI;
      var punkt = function (w) {
        return cx + radius * Math.cos(w) + " " + (cy + radius * Math.sin(w));
      };
      form = svgElement("path", {
        d: "M " + cx + " " + cy + " L " + punkt(winkel) + " A " + radius + " " + radius + " 0 " + (anteil > 0.5 ? 1 : 0) + " 1 " + punkt(ende) + " Z",
        class: "l-kreis-stueck l-reihe-" + stueck.farbe,
      });
      winkel = ende;
    }
    form.appendChild(svgElement("title", {}, titel));
    svg.appendChild(form);
  });
}

/** Legende unter dem Diagramm (Reihen bzw. beim Kreis die Stücke mit Anteil). */
function legende(typ, daten) {
  var eintraege;
  if (typ === "kreis") {
    var summe = daten.zeilen.reduce(function (s, zeile) {
      return s + (zeile.werte[0] > 0 ? zeile.werte[0] : 0);
    }, 0);
    eintraege = daten.zeilen.map(function (zeile, i) {
      var anteil = summe > 0 && zeile.werte[0] > 0 ? " (" + zahlText(Math.round((zeile.werte[0] / summe) * 1000) / 10) + " %)" : "";
      return { text: zeile.beschriftung + anteil, farbe: (i % 6) + 1 };
    });
  } else {
    if (daten.reihen.length < 2) return null;
    eintraege = daten.reihen.map(function (name, i) {
      return { text: name, farbe: (i % 6) + 1 };
    });
  }
  var liste = element("div", "l-diagramm-legende");
  liste.setAttribute("aria-hidden", "true");
  eintraege.forEach(function (eintrag) {
    liste.appendChild(element("span", "l-legende-" + eintrag.farbe, eintrag.text));
  });
  return liste;
}

definiere(
  "l-diagramm",
  class extends HTMLElement {
    connectedCallback() {
      if (this._bereit) return;
      this._bereit = true;
      var tabelle = kinder(this, "table")[0];
      if (!tabelle) return;
      var daten = DIAGRAMM.daten(tabelle);
      if (daten.zeilen.length === 0 || daten.reihen.length === 0) return;
      var typ = ["balken", "linie", "kreis"].indexOf(this.getAttribute("typ")) >= 0 ? this.getAttribute("typ") : "balken";
      var titel = (this.getAttribute("titel") || "").trim();
      if (titel) this.insertBefore(element("div", "l-diagramm-titel", titel), tabelle);
      this.insertBefore(DIAGRAMM.zeichnen(typ, daten, titel), tabelle);
      var zeichen = legende(typ, daten);
      if (zeichen) this.insertBefore(zeichen, tabelle);
      this.setAttribute("data-gezeichnet", "");
    }
  },
);

/*! Localist-Bausteine 2.1.0+641f4e07 – Funktion (localist.js)
    Diese Datei verwaltet Localist. Sie entsteht aus src/bausteine/*.js und wird beim Öffnen des Vaults
    erneuert, wenn sie fehlt oder abweicht – eigene Änderungen hier gehen dabei verloren. */

(function () {
"use strict";
var VERSION = "2.1.0+641f4e07";

// ---- basis.js ----
// Gemeinsame Hilfen aller Bausteine. localist.js ist ein klassisches Skript ohne Framework: Es läuft in der
// App (abgeschottete Anzeige) und per Doppelklick im Browser (file://). Der Text jedes Bausteins steht schon
// als normaler Inhalt in der Datei; das Skript macht ihn nur interaktiv und ändert nie die Datei.

/** Registriert ein Custom Element nur einmal (falls eine Seite localist.js doppelt einbindet). */
function definiere(name, Klasse) {
  if (window.customElements && !window.customElements.get(name)) window.customElements.define(name, Klasse);
}

/** Führt `fn` aus, sobald das Dokument gelesen ist. */
function sobaldBereit(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

/** Neues Element mit Klasse (Texte immer über textContent, nie als HTML). */
function element(tag, klasse, text) {
  var neu = document.createElement(tag);
  if (klasse) neu.className = klasse;
  if (text !== undefined) neu.textContent = text;
  return neu;
}

function knopf(text, klasse) {
  var neu = element("button", "l-knopf" + (klasse ? " " + klasse : ""), text);
  neu.type = "button";
  return neu;
}

/** Direkte Kinder mit diesem Tag. */
function kinder(eltern, tag) {
  return Array.prototype.filter.call(eltern.children, function (kind) {
    return kind.localName === tag;
  });
}

/** Gemeinsamer Namensraum: Seiten (und Tests) können die Logik der Bausteine nutzen. */
var Localist = (window.Localist = window.Localist || {});
Localist.version = VERSION;

document.documentElement.setAttribute("data-localist-bausteine", VERSION);

// ---- callout.js ----
// Callout: Bildschirmleser erfahren die Art des Hinweises (das Symbol selbst kommt aus localist.css).
var CALLOUT_NAMEN = { info: "Info", tipp: "Tipp", warnung: "Warnung", fehler: "Fehler" };

definiere(
  "l-callout",
  class extends HTMLElement {
    static get observedAttributes() {
      return ["typ"];
    }
    connectedCallback() {
      this.beschriften();
    }
    attributeChangedCallback() {
      this.beschriften();
    }
    beschriften() {
      if (!this.hasAttribute("role")) this.setAttribute("role", "note");
      this.setAttribute("aria-label", CALLOUT_NAMEN[this.getAttribute("typ")] || CALLOUT_NAMEN.info);
    }
  },
);

// ---- checkliste.js ----
// Checkliste: Ein Klick auf den Text eines Punkts setzt auch das Häkchen (wie bei einem <label>).
// Gespeichert wird nur in der App (das Brücken-Skript meldet das Häkchen), im Browser bleibt es beim Klick.
document.addEventListener("click", function (event) {
  var ziel = event.target instanceof Element ? event.target : null;
  var punkt = ziel ? ziel.closest("ul.l-checkliste > li") : null;
  if (!punkt || ziel.closest("a, input, button, label, summary, select, textarea")) return;
  if (String(window.getSelection ? window.getSelection() : "") !== "") return; // Text wurde markiert
  var kaestchen = punkt.querySelector(":scope > input[type='checkbox']");
  if (kaestchen && !kaestchen.disabled) kaestchen.click();
});

// ---- code.js ----
// Code-Block: Die Sprache aus class="language-…" erscheint als kleine Beschriftung über dem Code (code.css).
var SPRACHEN = {
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  powershell: "PowerShell",
  ps1: "PowerShell",
  sql: "SQL",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  csharp: "C#",
  rust: "Rust",
  go: "Go",
  yaml: "YAML",
  md: "Markdown",
  markdown: "Markdown",
};

sobaldBereit(function () {
  var bloecke = document.querySelectorAll("pre > code[class*='language-']");
  for (var i = 0; i < bloecke.length; i++) {
    var treffer = /(?:^|\s)language-([\w+#.-]+)/.exec(bloecke[i].className);
    if (!treffer || treffer[1] === "text" || treffer[1] === "plain") continue;
    bloecke[i].parentElement.setAttribute("data-sprache", SPRACHEN[treffer[1].toLowerCase()] || treffer[1]);
  }
});

// ---- diagramm.js ----
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

// ---- karteikarte.js ----
// Karteikarte: vorne die Frage, hinten die Antwort. Umdrehen per Klick, Fingertipp, Leertaste oder Enter.

/** Dreht eine Karte um (oder legt die Seite fest: true = Antwort, false = Frage). */
function umdrehen(karte, an) {
  var neu = an === undefined ? !karte.hasAttribute("data-umgedreht") : an;
  if (neu) karte.setAttribute("data-umgedreht", "");
  else karte.removeAttribute("data-umgedreht");
  karte.setAttribute("aria-pressed", String(neu));
  karte.dispatchEvent(new CustomEvent("l-umgedreht", { bubbles: true, detail: { umgedreht: neu } }));
}
Localist.umdrehen = umdrehen;

definiere(
  "l-karteikarte",
  class extends HTMLElement {
    connectedCallback() {
      if (this._bereit) return;
      this._bereit = true;
      if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
      this.setAttribute("role", "button");
      this.setAttribute("aria-roledescription", "Karteikarte");
      this.setAttribute("aria-pressed", String(this.hasAttribute("data-umgedreht")));
      this.addEventListener("click", function (event) {
        var ziel = event.target instanceof Element ? event.target : null;
        if (ziel && ziel.closest("a, button, input, select, textarea, summary")) return;
        if (String(window.getSelection ? window.getSelection() : "") !== "") return; // Text wurde markiert
        umdrehen(this);
      });
      this.addEventListener("keydown", function (event) {
        if (event.target !== this || (event.key !== " " && event.key !== "Enter")) return;
        event.preventDefault();
        umdrehen(this);
      });
    }
  },
);

// ---- kartenstapel.js ----
// Kartenstapel: Lernmodus mit einer Karte nach der anderen. „Gewusst“ legt die Karte weg, „Nochmal“ legt sie
// ans Ende des Stapels, sie kommt also erneut dran. Am Ende zeigt eine Auswertung, was wiederholt werden musste.
// Die Lernlogik ist von der Anzeige getrennt (Localist.lernen), damit sie sich testen lässt.

var LERNEN = {
  /** Neuer Durchgang: alle Karten in der Reihenfolge der Seite. */
  starten: function (anzahl) {
    var reihe = [];
    for (var i = 0; i < anzahl; i++) reihe.push(i);
    return { reihe: reihe, versuche: reihe.map(function () { return 0; }), gewusst: [] };
  },
  /** Antwort auf die oberste Karte: gewusst → weg, sonst ans Ende. Der alte Zustand bleibt unverändert. */
  antworten: function (zustand, gewusst) {
    if (zustand.reihe.length === 0) return zustand;
    var karte = zustand.reihe[0];
    var versuche = zustand.versuche.slice();
    versuche[karte] += 1;
    var reihe = zustand.reihe.slice(1);
    var fertig = zustand.gewusst.slice();
    if (gewusst) fertig.push(karte);
    else reihe.push(karte);
    return { reihe: reihe, versuche: versuche, gewusst: fertig };
  },
  fertig: function (zustand) {
    return zustand.reihe.length === 0;
  },
  /** Wie viele Karten saßen beim ersten Mal, welche brauchten mehrere Versuche? */
  auswerten: function (zustand) {
    var sofort = 0;
    var wiederholt = [];
    var gesamt = 0;
    zustand.versuche.forEach(function (anzahl, karte) {
      gesamt += anzahl;
      if (anzahl === 1 && zustand.gewusst.indexOf(karte) >= 0) sofort += 1;
      else if (anzahl > 1) wiederholt.push({ karte: karte, versuche: anzahl });
    });
    return { karten: zustand.versuche.length, sofort: sofort, wiederholt: wiederholt, versuche: gesamt };
  },
};
Localist.lernen = LERNEN;

definiere(
  "l-kartenstapel",
  class extends HTMLElement {
    connectedCallback() {
      if (this._bereit) return;
      this._bereit = true;
      var stapel = this;
      var karten = kinder(stapel, "l-karteikarte");
      if (karten.length === 0) return;
      stapel.setAttribute("role", "group");
      stapel.setAttribute("aria-label", "Kartenstapel");

      var kopf = element("div", "l-stapel-kopf");
      var zaehler = element("span", "l-stapel-zaehler");
      var balken = element("span", "l-stapel-fortschritt");
      var fuellung = element("span");
      balken.appendChild(fuellung);
      kopf.appendChild(zaehler);
      kopf.appendChild(balken);
      var knoepfe = element("div", "l-stapel-knoepfe");
      var nochmal = knopf("Nochmal", "l-knopf--nochmal");
      var gewusst = knopf("Gewusst", "l-knopf--gewusst");
      var hinweis = element("p", "l-stapel-hinweis", "Erst die Karte umdrehen, dann bewerten.");
      knoepfe.appendChild(nochmal);
      knoepfe.appendChild(gewusst);
      var ergebnis = element("div", "l-stapel-ergebnis");
      ergebnis.setAttribute("aria-live", "polite");
      ergebnis.hidden = true;
      stapel.insertBefore(kopf, stapel.firstChild);
      stapel.appendChild(knoepfe);
      stapel.appendChild(hinweis);
      stapel.appendChild(ergebnis);

      var zustand = LERNEN.starten(karten.length);
      var aktuelleKarte = function () {
        return karten[zustand.reihe[0]];
      };
      var bewertbar = function (an) {
        nochmal.disabled = !an;
        gewusst.disabled = !an;
        hinweis.hidden = an;
      };
      var zeigen = function () {
        var fertig = LERNEN.fertig(zustand);
        karten.forEach(function (karte) {
          karte.hidden = fertig || karte !== aktuelleKarte();
        });
        kopf.hidden = fertig;
        knoepfe.hidden = fertig;
        ergebnis.hidden = !fertig;
        if (fertig) {
          auswertungZeigen();
          return;
        }
        umdrehen(aktuelleKarte(), false);
        bewertbar(false);
        zaehler.textContent = zustand.gewusst.length + " von " + karten.length + " gewusst";
        fuellung.style.width = (100 * zustand.gewusst.length) / karten.length + "%";
      };
      var auswertungZeigen = function () {
        var auswertung = LERNEN.auswerten(zustand);
        ergebnis.textContent = "";
        ergebnis.appendChild(element("strong", "", "Geschafft!"));
        ergebnis.appendChild(element("p", "", auswertung.sofort + " von " + auswertung.karten + " Karten beim ersten Mal gewusst."));
        if (auswertung.wiederholt.length > 0) {
          ergebnis.appendChild(element("p", "", "Wiederholt:"));
          var liste = element("ul");
          auswertung.wiederholt.forEach(function (eintrag) {
            var frage = karten[eintrag.karte].querySelector("l-frage");
            var text = (frage ? frage.textContent : "").replace(/\s+/g, " ").trim();
            liste.appendChild(element("li", "", "„" + text + "“ – " + eintrag.versuche + " Versuche"));
          });
          ergebnis.appendChild(liste);
        }
        var neu = knopf("Noch einmal lernen");
        neu.addEventListener("click", function () {
          zustand = LERNEN.starten(karten.length);
          zeigen();
          aktuelleKarte().focus();
        });
        ergebnis.appendChild(neu);
      };
      var antworten = function (gewusstWert) {
        zustand = LERNEN.antworten(zustand, gewusstWert);
        zeigen();
        var naechste = aktuelleKarte();
        if (naechste) naechste.focus();
      };
      nochmal.addEventListener("click", function () {
        antworten(false);
      });
      gewusst.addEventListener("click", function () {
        antworten(true);
      });
      stapel.addEventListener("l-umgedreht", function (event) {
        if (event.target === aktuelleKarte()) bewertbar(event.detail.umgedreht);
      });
      zeigen();
    }
  },
);

// ---- quiz.js ----
// Quiz: Multiple-Choice-Fragen. Ein Klick (oder Leertaste/Enter) auf eine Antwort zeigt sofort, ob sie
// stimmt, und markiert die richtige. Unten steht die Punktzahl, am Ende das Ergebnis.
// <l-quiz><l-quizfrage><l-frage>…</l-frage><ul><li>falsch</li><li data-richtig>richtig</li></ul></l-quizfrage></l-quiz>

var QUIZ = {
  /** antworten: je Frage true (richtig), false (falsch) oder null (noch offen). */
  auswerten: function (antworten) {
    var beantwortet = 0;
    var richtig = 0;
    antworten.forEach(function (antwort) {
      if (antwort !== null) beantwortet += 1;
      if (antwort === true) richtig += 1;
    });
    return { fragen: antworten.length, beantwortet: beantwortet, richtig: richtig, fertig: beantwortet === antworten.length };
  },
};
Localist.quiz = QUIZ;

definiere(
  "l-quiz",
  class extends HTMLElement {
    connectedCallback() {
      if (this._bereit) return;
      this._bereit = true;
      var quiz = this;
      var fragen = kinder(quiz, "l-quizfrage");
      if (fragen.length === 0) return;
      var antworten = fragen.map(function () {
        return null;
      });
      var fuss = element("div", "l-quiz-fuss");
      var punkte = element("span", "l-quiz-punkte");
      punkte.setAttribute("aria-live", "polite");
      var neu = knopf("Quiz wiederholen");
      neu.hidden = true;
      fuss.appendChild(punkte);
      fuss.appendChild(neu);
      quiz.appendChild(fuss);
      var aktualisieren = function () {
        var stand = QUIZ.auswerten(antworten);
        punkte.textContent = stand.fertig ? "Ergebnis: " + stand.richtig + " von " + stand.fragen + " richtig" : "Punkte: " + stand.richtig + " von " + stand.fragen;
        neu.hidden = !stand.fertig;
      };
      var zuruecksetzen = [];

      fragen.forEach(function (frage, nummer) {
        var liste = kinder(frage, "ul")[0] || kinder(frage, "ol")[0];
        if (!liste) return;
        var optionen = kinder(liste, "li");
        var loesung = optionen.filter(function (option) {
          return option.hasAttribute("data-richtig");
        });
        var rueckmeldung = element("p", "l-quiz-rueckmeldung");
        rueckmeldung.setAttribute("aria-live", "polite");
        frage.appendChild(rueckmeldung);
        var waehlen = function (option) {
          if (antworten[nummer] !== null) return;
          var richtig = option.hasAttribute("data-richtig");
          antworten[nummer] = richtig;
          option.setAttribute("data-gewaehlt", "");
          frage.setAttribute("data-ergebnis", richtig ? "richtig" : "falsch");
          optionen.forEach(function (andere) {
            andere.setAttribute("aria-disabled", "true");
            if (andere.hasAttribute("data-richtig")) andere.setAttribute("data-loesung", "");
          });
          var text = loesung
            .map(function (option) {
              return option.textContent.replace(/\s+/g, " ").trim();
            })
            .join(", ");
          rueckmeldung.textContent = richtig ? "Richtig!" : loesung.length > 0 ? "Leider falsch. Richtig ist: " + text : "Leider falsch.";
          aktualisieren();
        };
        optionen.forEach(function (option) {
          option.setAttribute("role", "button");
          option.tabIndex = 0;
          option.addEventListener("click", function () {
            waehlen(option);
          });
          option.addEventListener("keydown", function (event) {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            waehlen(option);
          });
        });
        zuruecksetzen.push(function () {
          frage.removeAttribute("data-ergebnis");
          rueckmeldung.textContent = "";
          optionen.forEach(function (option) {
            option.removeAttribute("data-gewaehlt");
            option.removeAttribute("data-loesung");
            option.removeAttribute("aria-disabled");
          });
        });
      });

      neu.addEventListener("click", function () {
        antworten = antworten.map(function () {
          return null;
        });
        zuruecksetzen.forEach(function (fn) {
          fn();
        });
        aktualisieren();
      });
      aktualisieren();
    }
  },
);

// ---- spalten.js ----
// Spalten: Das Layout macht localist.css. Die Elemente werden registriert, damit Seiten sie mit :defined
// erkennen können.
definiere("l-spalten", class extends HTMLElement {});
definiere("l-spalte", class extends HTMLElement {});
})();

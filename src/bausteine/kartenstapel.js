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

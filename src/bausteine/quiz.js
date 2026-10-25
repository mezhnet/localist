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

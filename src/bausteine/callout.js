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

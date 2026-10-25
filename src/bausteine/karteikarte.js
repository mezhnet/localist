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

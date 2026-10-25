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

document.documentElement.setAttribute("data-localist-bausteine", VERSION);

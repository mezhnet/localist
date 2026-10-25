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

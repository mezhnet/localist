/*! Localist-Bausteine 1.0.0+54775dba – Funktion (localist.js)
    Diese Datei verwaltet Localist. Sie entsteht aus src/bausteine/*.js und wird beim Öffnen des Vaults
    erneuert, wenn sie fehlt oder abweicht – eigene Änderungen hier gehen dabei verloren. */

(function () {
"use strict";
var VERSION = "1.0.0+54775dba";

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

// ---- spalten.js ----
// Spalten: Das Layout macht localist.css. Die Elemente werden registriert, damit Seiten sie mit :defined
// erkennen können.
definiere("l-spalten", class extends HTMLElement {});
definiere("l-spalte", class extends HTMLElement {});
})();

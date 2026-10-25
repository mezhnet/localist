// Brücke zwischen einer HTML-Seite und Localist. Die App fügt dieses Skript nur in die ausgelieferte Kopie
// der Seite ein, nie in die Datei. Die Seite läuft abgeschottet (iframe mit sandbox="allow-scripts", ohne
// allow-same-origin) und spricht mit der App nur über postMessage mit festen Nachrichtentypen.
(function () {
  "use strict";
  if (window.parent === window) return; // direkt im Browser geöffnet: keine App da
  var BASIS = "__LOCALIST_BASIS__";
  // Kennzeichen für localist.css: In der App steht die Seite schon in einer Spalte unter dem Titel.
  document.documentElement.setAttribute("data-localist", "app");
  var senden = function (nachricht) {
    nachricht.localist = 1;
    window.parent.postMessage(nachricht, "*");
  };

  // Links: Seiten im Vault öffnet die App, externe Adressen der Standardbrowser.
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    var link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.charAt(0) === "#") return; // Sprung innerhalb der Seite
    var url;
    try {
      url = new URL(href, location.href);
    } catch (fehler) {
      return;
    }
    event.preventDefault();
    if (url.protocol === location.protocol && url.host === location.host && url.pathname.indexOf(BASIS) === 0) {
      var pfad;
      try {
        pfad = decodeURIComponent(url.pathname.slice(BASIS.length));
      } catch (fehler) {
        return;
      }
      senden({ typ: "link", pfad: pfad, anker: url.hash ? url.hash.slice(1) : "" });
    } else if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      senden({ typ: "extern", url: url.href });
    }
  });

  // Tastenkürzel der App (Strg+P, Strg+Umschalt+F, Strg+E) wirken auch, wenn die Seite den Fokus hat.
  document.addEventListener(
    "keydown",
    function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      var taste = (event.key || "").toLowerCase();
      if ((taste === "p" && !event.shiftKey) || (taste === "f" && event.shiftKey) || (taste === "e" && !event.shiftKey)) {
        event.preventDefault();
        senden({ typ: "taste", taste: taste, umschalt: event.shiftKey });
      }
    },
    true,
  );

  // Bausteine ohne Code bearbeiten: Beim Überfahren erscheint ein Stift, ein Klick meldet der App, welcher
  // Baustein gemeint ist (Nummer in Dokument-Reihenfolge, gezählt wie in src/lib/baustein-formulare.ts).
  // Häkchen in Checklisten meldet die Brücke ebenfalls. Beides nur, wenn die App es erlaubt („stifte“).
  var BAUSTEINE = "l-callout, details, table, ul.l-checkliste, l-spalten, figure, hr, pre, a.l-seitenlink, l-karteikarte, l-kartenstapel, l-quiz, l-diagramm";
  var HAEKCHEN = 'ul.l-checkliste input[type="checkbox"]';
  var ARTEN = {
    "l-callout": "callout",
    details: "toggle",
    table: "tabelle",
    ul: "checkliste",
    "l-spalten": "spalten",
    figure: "bild",
    hr: "trennlinie",
    pre: "code",
    a: "seitenlink",
    "l-karteikarte": "karteikarte",
    "l-kartenstapel": "kartenstapel",
    "l-quiz": "quiz",
    "l-diagramm": "diagramm",
  };
  // Die Tabelle eines Diagramms gehört zum Diagramm und ist kein eigener Baustein.
  var zaehlt = function (element) {
    return element.localName !== "table" || !element.closest("l-diagramm");
  };
  var bearbeitbar = false;
  var werkzeug = null;
  var rahmen = null;
  var stift = null;
  var aktuell = null;
  var verbergen = 0;
  var bereich = function () {
    return document.querySelector("main") || document.body;
  };
  var alle = function (selektor) {
    var b = bereich();
    return b ? Array.prototype.slice.call(b.querySelectorAll(selektor)).filter(zaehlt) : [];
  };
  var werkzeugBauen = function () {
    // Eigenes Element außerhalb von <body> mit geschlossenem Shadow DOM: Die Styles der Seite erreichen es
    // nicht, und es zählt nicht als Baustein.
    werkzeug = document.createElement("localist-werkzeug");
    werkzeug.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;";
    var schatten = werkzeug.attachShadow({ mode: "closed" });
    schatten.innerHTML =
      "<style>" +
      "[hidden]{display:none!important}" +
      ".rahmen{position:absolute;box-sizing:border-box;border:2px solid var(--color-accent,#2f6be0);border-radius:6px;opacity:.35;pointer-events:none}" +
      ".stift{position:absolute;box-sizing:border-box;width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center;" +
      "border:1px solid var(--color-border-strong,rgba(43,42,39,.18));border-radius:6px;background:var(--color-surface-raised,#fff);" +
      "color:var(--color-text,#2b2a27);box-shadow:var(--shadow-md,0 4px 12px rgba(18,18,17,.1));cursor:pointer}" +
      ".stift:hover,.stift:focus-visible{color:var(--color-accent,#2f6be0);outline:none}" +
      ".stift svg{width:16px;height:16px}" +
      "</style>" +
      '<div class="rahmen" hidden></div>' +
      '<button type="button" class="stift" hidden title="Baustein bearbeiten" aria-label="Baustein bearbeiten">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/></svg>' +
      "</button>";
    rahmen = schatten.querySelector(".rahmen");
    stift = schatten.querySelector(".stift");
    stift.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!aktuell) return;
      var liste = alle(BAUSTEINE);
      var index = liste.indexOf(aktuell);
      if (index >= 0) senden({ typ: "bearbeiten", index: index, art: ARTEN[aktuell.localName] || "", anzahl: liste.length });
    });
    document.documentElement.appendChild(werkzeug);
  };
  // Ändert ein Baustein seine Größe (z. B. Quiz nach einer Antwort), wandern Rahmen und Stift mit.
  var groesse = typeof ResizeObserver === "function" ? new ResizeObserver(function () {
    if (aktuell) zeigen(aktuell);
  }) : null;
  var zeigen = function (element) {
    clearTimeout(verbergen);
    if (!werkzeug) return;
    if (groesse && element !== aktuell) {
      groesse.disconnect();
      if (element) {
        groesse.observe(element);
        groesse.observe(document.body);
      }
    }
    if (!element) {
      verbergen = setTimeout(function () {
        aktuell = null;
        rahmen.hidden = true;
        stift.hidden = true;
      }, 250);
      return;
    }
    aktuell = element;
    var r = element.getBoundingClientRect();
    var x = window.scrollX;
    var y = window.scrollY;
    rahmen.style.left = r.left + x - 4 + "px";
    rahmen.style.top = r.top + y - 4 + "px";
    rahmen.style.width = r.width + 8 + "px";
    rahmen.style.height = r.height + 8 + "px";
    // Schmale Bausteine (z. B. ein Seitenlink): Stift rechts daneben, sonst oben rechts in der Ecke.
    stift.style.left = (r.width < 160 ? r.right + x + 6 : r.right + x - 32) + "px";
    stift.style.top = (r.height < 36 ? r.top + y + (r.height - 28) / 2 : r.top + y + 4) + "px";
    rahmen.hidden = false;
    stift.hidden = false;
  };
  document.addEventListener("mouseover", function (event) {
    if (!bearbeitbar) return;
    var ziel = event.target;
    if (ziel === werkzeug) {
      clearTimeout(verbergen); // Maus auf dem Stift
      return;
    }
    var element = ziel instanceof Element ? ziel.closest(BAUSTEINE) : null;
    while (element && !zaehlt(element)) element = element.parentElement ? element.parentElement.closest(BAUSTEINE) : null;
    if (element && !bereich().contains(element)) element = null;
    zeigen(element);
  });
  document.documentElement.addEventListener("mouseleave", function () {
    if (bearbeitbar) zeigen(null);
  });
  window.addEventListener("resize", function () {
    if (aktuell) zeigen(aktuell);
  });
  document.addEventListener("change", function (event) {
    var ziel = event.target;
    if (!bearbeitbar || !(ziel instanceof HTMLInputElement) || ziel.type !== "checkbox") return;
    var index = alle(HAEKCHEN).indexOf(ziel);
    if (index >= 0) senden({ typ: "haekchen", index: index, an: ziel.checked });
  });

  // Von der App: Hell/Dunkel und die Scrollposition nach dem Neuladen (damit die Vorschau nicht springt).
  var gewuenscht = -1;
  var scrollen = function () {
    if (gewuenscht < 0) return;
    window.scrollTo(0, gewuenscht);
    // Sofort bestätigen, wo die Seite jetzt steht (die App zeigt sie erst dann).
    senden({ typ: "position", y: Math.round(window.scrollY) });
  };
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var daten = event.data;
    if (!daten || daten.localist !== 1) return;
    if (daten.typ === "thema" && (daten.wert === "hell" || daten.wert === "dunkel")) {
      var dunkel = daten.wert === "dunkel";
      document.documentElement.setAttribute("data-theme", dunkel ? "dark" : "light");
      document.documentElement.style.colorScheme = dunkel ? "dark" : "light";
    } else if (daten.typ === "anker" && typeof daten.id === "string" && /^[\w-]{1,100}$/.test(daten.id)) {
      var ziel = document.getElementById(daten.id);
      if (ziel) ziel.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (daten.typ === "stifte" && typeof daten.an === "boolean") {
      bearbeitbar = daten.an;
      if (bearbeitbar && !werkzeug) werkzeugBauen();
      if (!bearbeitbar) zeigen(null);
    } else if (daten.typ === "scrollen" && typeof daten.y === "number" && daten.y >= 0) {
      gewuenscht = daten.y;
      scrollen();
      // Nach dem ersten Zeichnen noch einmal, falls die Seite vorher noch nicht hoch genug war.
      requestAnimationFrame(scrollen);
    }
  });
  window.addEventListener("load", scrollen);

  // Scrollposition melden (seltener als jedes Ereignis).
  var positionGeplant = false;
  window.addEventListener("scroll", function () {
    if (positionGeplant) return;
    positionGeplant = true;
    setTimeout(function () {
      positionGeplant = false;
      // Hat der Nutzer selbst gescrollt, gilt die gewünschte Position nicht mehr (sonst springt "load" zurück).
      if (Math.abs(window.scrollY - gewuenscht) > 2) gewuenscht = -1;
      senden({ typ: "position", y: Math.round(window.scrollY) });
    }, 100);
  });

  // Höhe melden, damit die App die Seite ohne zweite Bildlaufleiste anzeigt.
  var gemeldet = 0;
  var hoeheMelden = function () {
    var hoehe = Math.ceil(document.documentElement.scrollHeight);
    if (hoehe !== gemeldet) {
      gemeldet = hoehe;
      senden({ typ: "groesse", hoehe: hoehe });
    }
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(hoeheMelden).observe(document.documentElement);
  window.addEventListener("load", hoeheMelden);
  document.addEventListener("DOMContentLoaded", function () {
    senden({ typ: "bereit" });
    hoeheMelden();
  });
})();

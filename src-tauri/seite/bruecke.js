// Brücke zwischen einer HTML-Seite und Localist. Die App fügt dieses Skript nur in die ausgelieferte Kopie
// der Seite ein, nie in die Datei. Die Seite läuft abgeschottet (iframe mit sandbox="allow-scripts", ohne
// allow-same-origin) und spricht mit der App nur über postMessage mit festen Nachrichtentypen.
(function () {
  "use strict";
  if (window.parent === window) return; // direkt im Browser geöffnet: keine App da
  var BASIS = "__LOCALIST_BASIS__";
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

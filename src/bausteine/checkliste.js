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

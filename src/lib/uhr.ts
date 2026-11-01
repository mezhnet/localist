// Die Uhr für Zeitgeber, die mit einem Endzeitpunkt rechnen (Pomodoro, Benachrichtigungen in der Vorschau).
// In der App ist sie einfach Date.now(). Nur die Browser-Vorschau stellt sie vor (`window.__devVault.vorspulen`),
// damit die Klickliste nicht minutenlang warten muss.
let versatz = 0;

export function jetzt(): number {
  return Date.now() + versatz;
}

export function vorspulen(ms: number): void {
  versatz += ms;
}

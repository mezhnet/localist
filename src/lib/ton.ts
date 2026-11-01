// Ein kurzer, ruhiger Ton am Ende einer Pomodoro-Phase, per Web Audio erzeugt (keine Tondatei, also kein Lizenzthema).
// Browser und WebView spielen Töne erst nach einem Klick. Deshalb wird der Ton beim Klick auf „Starten“ vorbereitet.
let kontext: AudioContext | null = null;

export function tonVorbereiten(): void {
  try {
    kontext ??= new window.AudioContext();
    if (kontext.state === "suspended") void kontext.resume().catch(() => {});
  } catch {
    kontext = null;
  }
}

/** Zwei weiche Sinustöne nacheinander, zusammen gut eine Sekunde. */
export function tonSpielen(): void {
  tonVorbereiten();
  if (!kontext) return;
  try {
    const beginn = kontext.currentTime + 0.02;
    [660, 880].forEach((frequenz, i) => {
      const ton = kontext!.createOscillator();
      const lautstaerke = kontext!.createGain();
      const t = beginn + i * 0.18;
      ton.type = "sine";
      ton.frequency.value = frequenz;
      lautstaerke.gain.setValueAtTime(0, t);
      lautstaerke.gain.linearRampToValueAtTime(0.12, t + 0.03);
      lautstaerke.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      ton.connect(lautstaerke).connect(kontext!.destination);
      ton.start(t);
      ton.stop(t + 1);
    });
  } catch {
    // ohne Ton geht es auch
  }
}

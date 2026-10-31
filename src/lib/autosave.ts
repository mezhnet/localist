// Automatisches Speichern kurz nach der letzten Eingabe.
// Jede Eingabe startet die Wartezeit neu; gespeichert wird nur, wenn sich der Text wirklich geändert hat.
// Speichervorgänge laufen nacheinander, damit eine ältere Fassung nie eine neuere überschreibt.

export const AUTOSAVE_DELAY_MS = 600;

/**
 * Speicherstatus der offenen Seite (für den Seitenkopf): „bereit“ (nichts geändert seit dem Öffnen), „speichert“
 * (Eingaben warten oder werden geschrieben), „gespeichert“ (mit Uhrzeit) oder „fehler“. Es gilt immer der zuletzt
 * angelegte AutoSaver, also der der offenen Seite.
 */
export type SpeicherZustand =
  | { art: "bereit" }
  | { art: "speichert" }
  | { art: "gespeichert"; zeit: number }
  | { art: "fehler"; meldung: string };

let speicherZustand: SpeicherZustand = { art: "bereit" };
let aktuellerSaver: AutoSaver | null = null;
const speicherHoerer = new Set<() => void>();

export function aktuellerSpeicherZustand(): SpeicherZustand {
  return speicherZustand;
}

export function speicherZustandAbonnieren(hoerer: () => void): () => void {
  speicherHoerer.add(hoerer);
  return () => {
    speicherHoerer.delete(hoerer);
  };
}

/** Neue Ansicht im Reiter: Meldungen älterer AutoSaver gelten nicht mehr. */
export function speicherZustandZuruecksetzen(): void {
  aktuellerSaver = null;
  setzen({ art: "bereit" });
}

function setzen(zustand: SpeicherZustand): void {
  speicherZustand = zustand;
  speicherHoerer.forEach((hoerer) => hoerer());
}

export class AutoSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private produce: (() => string) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private saving = 0;
  /** Meldung des letzten Speicherversuchs, falls er gescheitert ist (sonst null). */
  private fehler: string | null = null;
  /** Die letzten selbst geschriebenen Fassungen, um Meldungen des Dateiwächters darüber zu erkennen. */
  private recent: string[] = [];

  /**
   * @param lastSaved Text, der gerade in der Datei steht.
   * @param write     Schreibt den Text in die Datei.
   * @param onError   Wird mit einer deutschen Fehlermeldung aufgerufen, wenn das Speichern scheitert.
   */
  constructor(
    public lastSaved: string,
    private readonly write: (text: string) => Promise<void>,
    private readonly onError: (message: string) => void = () => {},
    private readonly delay = AUTOSAVE_DELAY_MS,
  ) {
    aktuellerSaver = this;
  }

  private melden(zustand: SpeicherZustand): void {
    if (aktuellerSaver === this) setzen(zustand);
  }

  /** Merkt eine Änderung vor. `produce` erzeugt den Dateiinhalt erst beim Speichern. */
  schedule(produce: () => string): void {
    this.produce = produce;
    this.melden({ art: "speichert" });
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  /** Stammt dieser Dateiinhalt von einer eigenen Speicherung (aktuell oder kurz davor)? */
  isOwnWrite(text: string): boolean {
    return text === this.lastSaved || this.recent.includes(text);
  }

  /** Gibt es Änderungen, die noch nicht in der Datei stehen? */
  get dirty(): boolean {
    return this.produce !== null || this.saving > 0;
  }

  /** Speichert sofort, z. B. vor dem Wechsel auf eine andere Seite oder beim Schließen. */
  flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const produce = this.produce;
    this.produce = null;
    if (produce) {
      this.saving++;
      this.queue = this.queue.then(() => this.save(produce)).finally(() => this.saving--);
    }
    return this.queue;
  }

  /**
   * Speichert sofort und meldet einen Fehler, statt ihn nur anzuzeigen: Das Versprechen scheitert, wenn danach noch
   * etwas nicht in der Datei steht (z. B. vor einem Update, bei dem sich die App beendet).
   */
  async sicherSpeichern(): Promise<void> {
    await this.flush();
    if (this.fehler !== null) throw new Error(this.fehler);
  }

  /** Verwirft vorgemerkte Änderungen (z. B. wenn die Datei von außen gelöscht wurde). */
  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.produce = null;
  }

  private async save(produce: () => string): Promise<void> {
    const text = produce();
    try {
      if (text !== this.lastSaved) {
        await this.write(text);
        this.lastSaved = text;
        this.recent = [text, ...this.recent].slice(0, 5);
      }
      this.fehler = null;
      if (this.produce === null) this.melden({ art: "gespeichert", zeit: Date.now() });
    } catch (error) {
      this.fehler = errorMessage(error);
      const meldung = `Speichern fehlgeschlagen: ${errorMessage(error)}`;
      this.melden({ art: "fehler", meldung });
      this.onError(meldung);
    }
  }
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

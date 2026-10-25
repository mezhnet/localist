// Automatisches Speichern kurz nach der letzten Eingabe.
// Jede Eingabe startet die Wartezeit neu; gespeichert wird nur, wenn sich der Text wirklich geändert hat.
// Speichervorgänge laufen nacheinander, damit eine ältere Fassung nie eine neuere überschreibt.

export const AUTOSAVE_DELAY_MS = 600;

export class AutoSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private produce: (() => string) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private saving = 0;

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
  ) {}

  /** Merkt eine Änderung vor. `produce` erzeugt den Dateiinhalt erst beim Speichern. */
  schedule(produce: () => string): void {
    this.produce = produce;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
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

  /** Verwirft vorgemerkte Änderungen (z. B. wenn die Datei von außen gelöscht wurde). */
  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.produce = null;
  }

  private async save(produce: () => string): Promise<void> {
    const text = produce();
    if (text === this.lastSaved) return;
    try {
      await this.write(text);
      this.lastSaved = text;
    } catch (error) {
      this.onError(`Speichern fehlgeschlagen: ${errorMessage(error)}`);
    }
  }
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

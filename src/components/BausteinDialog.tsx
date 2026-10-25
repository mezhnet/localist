// Formular zum Bearbeiten eines Bausteins ohne Code (geöffnet über das Stift-Symbol in „Lesen“ und „Geteilt“).
// Es zeigt die Werte aus der Datei; Speichern ändert nur diesen Baustein (src/lib/baustein-formulare.ts).
// Tabellen bekommen einen Tabellen-Editor zum Hinzufügen und Entfernen von Zeilen und Spalten.
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { bausteinInfo } from "../lib/bausteine";
import { LEER, type BausteinWerte, type Inhalt, type TabellenWerte } from "../lib/baustein-formulare";
import { encodePath, relativePath, resolveRelative } from "../lib/html";
import type { PageRef } from "../lib/links";
import { pageTitle, parentDir } from "../lib/tree";
import { importAttachment, pickImage } from "../lib/vault-api";
import { errorMessage } from "../lib/autosave";
import { BAUSTEIN_SYMBOLE } from "./BausteinLeiste";
import { Button, Checkbox, Dialog, Field, IconButton, Input, Segmented, Select, Textarea } from "./ui";

type Werte<A extends BausteinWerte["art"]> = Extract<BausteinWerte, { art: A }>;

interface Props {
  werte: BausteinWerte;
  /** Pfad der HTML-Seite (für relative Pfade von Bildern und Links). */
  pagePath: string;
  pages: PageRef[];
  onSave: (werte: BausteinWerte) => void;
  onRemove: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}

const FORM_ID = "baustein-formular";

const CALLOUT_TYPEN = [
  { value: "info", label: "Info" },
  { value: "tipp", label: "Tipp" },
  { value: "warnung", label: "Warnung" },
  { value: "fehler", label: "Fehler" },
];

/** Feld für einen Text, der auch HTML enthalten kann (dann mit Hinweis und Festbreitenschrift). */
function InhaltFeld({ label, inhalt, onChange, mehrzeilig = false, autoFocus = false }: { label: string; inhalt: Inhalt; onChange: (inhalt: Inhalt) => void; mehrzeilig?: boolean; autoFocus?: boolean }) {
  const name = inhalt.html ? `${label} (HTML)` : label;
  const props = { "aria-label": name, value: inhalt.wert, "data-autofocus": autoFocus || undefined };
  return (
    <Field label={name} hint={inhalt.html ? "Enthält HTML-Tags (z. B. <b>fett</b>); sie bleiben so erhalten." : undefined}>
      {mehrzeilig ? (
        <Textarea {...props} mono={inhalt.html} rows={inhalt.html ? 6 : 3} onChange={(event) => onChange({ ...inhalt, wert: event.target.value })} />
      ) : (
        <Input {...props} onChange={(event) => onChange({ ...inhalt, wert: event.target.value })} />
      )}
    </Field>
  );
}

function TabellenEditor<T extends TabellenWerte>({ werte, onChange }: { werte: T; onChange: (werte: T) => void }) {
  const breite = werte.spalten.length;
  const setZelle = (r: number, c: number, inhalt: Inhalt) =>
    onChange({ ...werte, zeilen: werte.zeilen.map((zeile, i) => (i === r ? { ...zeile, zellen: zeile.zellen.map((zelle, j) => (j === c ? inhalt : zelle)) } : zeile)) });
  return (
    <div className="tabellen-editor">
      <Checkbox label="Erste Zeile ist Überschrift" checked={werte.kopfzeile} onChange={(kopfzeile) => onChange({ ...werte, kopfzeile })} />
      <div className="tabellen-editor__raster">
        <table aria-label="Tabelle bearbeiten">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {werte.spalten.map((_, c) => (
                <th key={c}>
                  <IconButton
                    size="sm"
                    label={`Spalte ${c + 1} entfernen`}
                    disabled={breite <= 1}
                    onClick={() => onChange({ ...werte, spalten: werte.spalten.filter((_, j) => j !== c), zeilen: werte.zeilen.map((zeile) => ({ ...zeile, zellen: zeile.zellen.filter((_, j) => j !== c) })) })}
                  >
                    <Trash2 />
                  </IconButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {werte.zeilen.map((zeile, r) => (
              <tr key={r} className={werte.kopfzeile && r === 0 ? "is-head" : undefined}>
                <td>
                  <IconButton size="sm" label={`Zeile ${r + 1} entfernen`} disabled={werte.zeilen.length <= 1} onClick={() => onChange({ ...werte, zeilen: werte.zeilen.filter((_, i) => i !== r) })}>
                    <Trash2 />
                  </IconButton>
                </td>
                {zeile.zellen.map((zelle, c) => (
                  <td key={c}>
                    <Input inputSize="sm" aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`} value={zelle.wert} onChange={(event) => setZelle(r, c, { ...zelle, wert: event.target.value })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="baustein-formular__knoepfe">
        <Button size="sm" icon={<Plus />} onClick={() => onChange({ ...werte, zeilen: [...werte.zeilen, { quelle: null, zellen: werte.spalten.map(() => LEER) }] })}>
          Zeile hinzufügen
        </Button>
        <Button
          size="sm"
          icon={<Plus />}
          onClick={() => onChange({ ...werte, spalten: [...werte.spalten, null], zeilen: werte.zeilen.map((zeile) => ({ ...zeile, zellen: [...zeile.zellen, LEER] })) })}
        >
          Spalte hinzufügen
        </Button>
      </div>
    </div>
  );
}

function ChecklistenEditor({ werte, onChange }: { werte: Werte<"checkliste">; onChange: (werte: Werte<"checkliste">) => void }) {
  const setPunkt = (i: number, punkt: Werte<"checkliste">["punkte"][number]) => onChange({ ...werte, punkte: werte.punkte.map((p, j) => (j === i ? punkt : p)) });
  return (
    <div className="baustein-formular__liste">
      {werte.punkte.map((punkt, i) => (
        <div key={i} className="baustein-formular__zeile">
          <input type="checkbox" className="baustein-formular__haken" aria-label={`Punkt ${i + 1} erledigt`} checked={punkt.an} onChange={(event) => setPunkt(i, { ...punkt, an: event.target.checked })} />
          <Input aria-label={`Punkt ${i + 1}`} value={punkt.text.wert} data-autofocus={i === 0 || undefined} onChange={(event) => setPunkt(i, { ...punkt, text: { ...punkt.text, wert: event.target.value } })} />
          <IconButton size="sm" label={`Punkt ${i + 1} entfernen`} onClick={() => onChange({ ...werte, punkte: werte.punkte.filter((_, j) => j !== i) })}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <div className="baustein-formular__knoepfe">
        <Button size="sm" icon={<Plus />} onClick={() => onChange({ ...werte, punkte: [...werte.punkte, { quelle: null, an: false, text: LEER }] })}>
          Punkt hinzufügen
        </Button>
      </div>
    </div>
  );
}

function SpaltenEditor({ werte, onChange }: { werte: Werte<"spalten">; onChange: (werte: Werte<"spalten">) => void }) {
  return (
    <div className="baustein-formular__liste">
      {werte.spalten.map((spalte, i) => (
        <div key={i} className="baustein-formular__spalte">
          <InhaltFeld label={`Spalte ${i + 1}`} inhalt={spalte.inhalt} mehrzeilig autoFocus={i === 0} onChange={(inhalt) => onChange({ ...werte, spalten: werte.spalten.map((s, j) => (j === i ? { ...s, inhalt } : s)) })} />
          <IconButton size="sm" label={`Spalte ${i + 1} entfernen`} disabled={werte.spalten.length <= 1} onClick={() => onChange({ ...werte, spalten: werte.spalten.filter((_, j) => j !== i) })}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <div className="baustein-formular__knoepfe">
        <Button size="sm" icon={<Plus />} onClick={() => onChange({ ...werte, spalten: [...werte.spalten, { quelle: null, inhalt: LEER }] })}>
          Spalte hinzufügen
        </Button>
      </div>
    </div>
  );
}

const DIAGRAMM_TYPEN = [
  { value: "balken", label: "Balken" },
  { value: "linie", label: "Linie" },
  { value: "kreis", label: "Kreis" },
];

function KartenEditor({ werte, onChange }: { werte: Werte<"kartenstapel">; onChange: (werte: Werte<"kartenstapel">) => void }) {
  const setKarte = (i: number, karte: Werte<"kartenstapel">["karten"][number]) => onChange({ ...werte, karten: werte.karten.map((k, j) => (j === i ? karte : k)) });
  return (
    <div className="baustein-formular__liste">
      {werte.karten.map((karte, i) => (
        <div key={i} className="baustein-formular__karte">
          <span className="baustein-formular__nummer">{i + 1}</span>
          <Input aria-label={`Karte ${i + 1}: Frage`} placeholder="Frage" value={karte.frage.wert} data-autofocus={i === 0 || undefined} onChange={(event) => setKarte(i, { ...karte, frage: { ...karte.frage, wert: event.target.value } })} />
          <Input aria-label={`Karte ${i + 1}: Antwort`} placeholder="Antwort" value={karte.antwort.wert} onChange={(event) => setKarte(i, { ...karte, antwort: { ...karte.antwort, wert: event.target.value } })} />
          <IconButton size="sm" label={`Karte ${i + 1} entfernen`} disabled={werte.karten.length <= 1} onClick={() => onChange({ ...werte, karten: werte.karten.filter((_, j) => j !== i) })}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <div className="baustein-formular__knoepfe">
        <Button size="sm" icon={<Plus />} onClick={() => onChange({ ...werte, karten: [...werte.karten, { quelle: null, frage: LEER, antwort: LEER }] })}>
          Karte hinzufügen
        </Button>
      </div>
    </div>
  );
}

function QuizEditor({ werte, onChange }: { werte: Werte<"quiz">; onChange: (werte: Werte<"quiz">) => void }) {
  type Frage = Werte<"quiz">["fragen"][number];
  const setFrage = (i: number, frage: Frage) => onChange({ ...werte, fragen: werte.fragen.map((f, j) => (j === i ? frage : f)) });
  return (
    <div className="baustein-formular__liste">
      {werte.fragen.map((frage, i) => (
        <fieldset key={i} className="baustein-formular__quizfrage">
          <div className="baustein-formular__zeile">
            <Input aria-label={`Frage ${i + 1}`} placeholder="Frage" value={frage.frage.wert} data-autofocus={i === 0 || undefined} onChange={(event) => setFrage(i, { ...frage, frage: { ...frage.frage, wert: event.target.value } })} />
            <IconButton size="sm" label={`Frage ${i + 1} entfernen`} disabled={werte.fragen.length <= 1} onClick={() => onChange({ ...werte, fragen: werte.fragen.filter((_, j) => j !== i) })}>
              <Trash2 />
            </IconButton>
          </div>
          {frage.antworten.map((antwort, j) => (
            <div key={j} className="baustein-formular__zeile baustein-formular__antwort">
              <input
                type="radio"
                className="baustein-formular__haken"
                name={`richtig-${i}`}
                aria-label={`Frage ${i + 1}, Antwort ${j + 1} ist richtig`}
                checked={antwort.richtig}
                onChange={() => setFrage(i, { ...frage, antworten: frage.antworten.map((a, k) => ({ ...a, richtig: k === j })) })}
              />
              <Input
                inputSize="sm"
                aria-label={`Frage ${i + 1}, Antwort ${j + 1}`}
                value={antwort.text.wert}
                onChange={(event) => setFrage(i, { ...frage, antworten: frage.antworten.map((a, k) => (k === j ? { ...a, text: { ...a.text, wert: event.target.value } } : a)) })}
              />
              <IconButton size="sm" label={`Frage ${i + 1}, Antwort ${j + 1} entfernen`} disabled={frage.antworten.length <= 2} onClick={() => setFrage(i, { ...frage, antworten: frage.antworten.filter((_, k) => k !== j) })}>
                <Trash2 />
              </IconButton>
            </div>
          ))}
          <div className="baustein-formular__knoepfe baustein-formular__antwort">
            <Button size="sm" icon={<Plus />} onClick={() => setFrage(i, { ...frage, antworten: [...frage.antworten, { quelle: null, text: LEER, richtig: false }] })}>
              Antwort hinzufügen
            </Button>
          </div>
        </fieldset>
      ))}
      <div className="baustein-formular__knoepfe">
        <Button
          size="sm"
          icon={<Plus />}
          onClick={() =>
            onChange({
              ...werte,
              fragen: [
                ...werte.fragen,
                {
                  quelle: null,
                  frage: LEER,
                  antworten: [
                    { quelle: null, text: LEER, richtig: true },
                    { quelle: null, text: LEER, richtig: false },
                  ],
                },
              ],
            })
          }
        >
          Frage hinzufügen
        </Button>
      </div>
    </div>
  );
}

export function BausteinDialog({ werte: start, pagePath, pages, onSave, onRemove, onClose, onError }: Props) {
  const [werte, setWerte] = useState<BausteinWerte>(start);
  const info = bausteinInfo(start.art);
  const Symbol = BAUSTEIN_SYMBOLE[start.art];
  const dir = parentDir(pagePath);
  const set = <A extends BausteinWerte["art"]>(next: Werte<A>) => setWerte(next);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(werte);
  };

  let felder: ReactNode;
  switch (werte.art) {
    case "callout":
      felder = (
        <>
          <Segmented size="sm" label="Art" options={CALLOUT_TYPEN} value={werte.typ} onChange={(typ) => set({ ...werte, typ })} />
          <InhaltFeld label="Text" inhalt={werte.text} mehrzeilig autoFocus onChange={(text) => set({ ...werte, text })} />
        </>
      );
      break;
    case "toggle":
      felder = (
        <>
          <InhaltFeld label="Titel" inhalt={werte.titel} autoFocus onChange={(titel) => set({ ...werte, titel })} />
          <Checkbox label="Aufgeklappt anzeigen" checked={werte.offen} onChange={(offen) => set({ ...werte, offen })} />
          <InhaltFeld label="Inhalt" inhalt={werte.inhalt} mehrzeilig onChange={(inhalt) => set({ ...werte, inhalt })} />
        </>
      );
      break;
    case "tabelle":
      felder = <TabellenEditor werte={werte} onChange={set} />;
      break;
    case "checkliste":
      felder = <ChecklistenEditor werte={werte} onChange={set} />;
      break;
    case "spalten":
      felder = <SpaltenEditor werte={werte} onChange={set} />;
      break;
    case "bild": {
      const chooseImage = async () => {
        try {
          const source = await pickImage();
          if (source) set({ ...werte, src: encodePath(relativePath(dir, await importAttachment(source))) });
        } catch (error) {
          onError(errorMessage(error));
        }
      };
      felder = (
        <>
          <Field label="Bild" hint="Pfad relativ zu dieser Seite. „Bild auswählen“ kopiert ein Bild von außen nach „Anhänge“.">
            <div className="baustein-formular__zeile">
              <Input aria-label="Bild" value={werte.src} data-autofocus onChange={(event) => set({ ...werte, src: event.target.value })} />
              <Button size="sm" onClick={() => void chooseImage()}>
                Bild auswählen …
              </Button>
            </div>
          </Field>
          <Field label="Alternativtext" hint="Beschreibt das Bild, z. B. für Bildschirmleser.">
            <Input aria-label="Alternativtext" value={werte.alt} onChange={(event) => set({ ...werte, alt: event.target.value })} />
          </Field>
          <InhaltFeld label="Bildunterschrift" inhalt={werte.beschriftung} onChange={(beschriftung) => set({ ...werte, beschriftung })} />
        </>
      );
      break;
    }
    case "trennlinie":
      felder = <p className="muted">Eine Trennlinie hat keine Einstellungen. Du kannst sie hier entfernen.</p>;
      break;
    case "code":
      felder = (
        <>
          <Field label="Sprache" hint="Zum Beispiel html, css, js oder python. Leer lassen für einfachen Text.">
            <Input aria-label="Sprache" value={werte.sprache} onChange={(event) => set({ ...werte, sprache: event.target.value })} />
          </Field>
          <Field label="Code">
            <Textarea aria-label="Code" mono rows={10} value={werte.code} data-autofocus onChange={(event) => set({ ...werte, code: event.target.value })} />
          </Field>
        </>
      );
      break;
    case "seitenlink": {
      const pathPart = werte.href.split(/[?#]/)[0];
      const ziel = pathPart ? resolveRelative(dir, pathPart) : null;
      const bekannt = ziel !== null && pages.some((page) => page.path === ziel);
      const chooseTarget = (path: string) => {
        const page = pages.find((candidate) => candidate.path === path);
        if (!page) return;
        // Stand als Text noch der alte Seitenname, wandert er mit.
        const oldTitle = ziel ? pageTitle(ziel) : "";
        const text = werte.text.wert === "" || werte.text.wert === oldTitle ? { wert: page.title, html: false } : werte.text;
        set({ ...werte, href: encodePath(relativePath(dir, page.path)), text });
      };
      felder = (
        <>
          <Field label="Ziel">
            <Select aria-label="Ziel" value={bekannt ? ziel! : ""} onChange={(event) => chooseTarget(event.target.value)} data-autofocus>
              {!bekannt && <option value="">{werte.href ? `Anderes Ziel: ${werte.href}` : "Seite wählen …"}</option>}
              {pages
                .filter((page) => page.path !== pagePath)
                .map((page) => (
                  <option key={page.path} value={page.path}>
                    {page.title} – {parentDir(page.path) || "Vault"}
                  </option>
                ))}
            </Select>
          </Field>
          <InhaltFeld label="Text" inhalt={werte.text} onChange={(text) => set({ ...werte, text })} />
        </>
      );
      break;
    }
    case "karteikarte":
      felder = (
        <>
          <InhaltFeld label="Frage" inhalt={werte.frage} autoFocus onChange={(frage) => set({ ...werte, frage })} />
          <InhaltFeld label="Antwort" inhalt={werte.antwort} mehrzeilig onChange={(antwort) => set({ ...werte, antwort })} />
        </>
      );
      break;
    case "kartenstapel":
      felder = <KartenEditor werte={werte} onChange={set} />;
      break;
    case "quiz":
      felder = <QuizEditor werte={werte} onChange={set} />;
      break;
    case "diagramm":
      felder = (
        <>
          <Segmented size="sm" label="Diagrammart" options={DIAGRAMM_TYPEN} value={werte.typ} onChange={(typ) => set({ ...werte, typ })} />
          <Field label="Titel">
            <Input aria-label="Titel" value={werte.titel} data-autofocus onChange={(event) => set({ ...werte, titel: event.target.value })} />
          </Field>
          <Field label="Daten" hint="Erste Spalte: Beschriftung, weitere Spalten: Werte. Die erste Zeile nennt die Reihen. Beim Kreis zählt die erste Wertespalte.">
            <TabellenEditor werte={werte.daten} onChange={(daten) => set({ ...werte, daten })} />
          </Field>
        </>
      );
      break;
  }

  return (
    <Dialog
      label={`${info.name} bearbeiten`}
      title={
        <span className="baustein-dialog__titel">
          <Symbol aria-hidden="true" /> {info.name} bearbeiten
        </span>
      }
      size={["tabelle", "diagramm", "quiz", "kartenstapel"].includes(werte.art) ? "lg" : "md"}
      onClose={onClose}
      className="baustein-dialog"
      footer={
        <>
          <Button variant="danger" icon={<Trash2 />} className="baustein-dialog__entfernen" onClick={onRemove}>
            Baustein entfernen
          </Button>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form={FORM_ID}>
            Speichern
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="baustein-formular" onSubmit={submit}>
        {felder}
      </form>
    </Dialog>
  );
}

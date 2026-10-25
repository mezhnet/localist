// Dialog für eigene Bausteine („Code-Speicher“): neu anlegen aus markiertem Code, bearbeiten oder umbenennen.
// Gespeichert wird als `.localist/bausteine/eigene/<Name>.html` mit der Beschreibung in der ersten Zeile.
import { Puzzle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage } from "../lib/autosave";
import type { EigenerBaustein } from "../lib/eigene-bausteine";
import { saveEigenerBaustein } from "../lib/vault-api";
import { Button, Dialog, Field, Input, Textarea } from "./ui";

interface Props {
  /** Vorhandener Baustein (bearbeiten/umbenennen) oder null (neu). */
  baustein: EigenerBaustein | null;
  /** Code für einen neuen Baustein (die Markierung im Editor). */
  code?: string;
  /** Nur den Namen ändern (Umbenennen). */
  nurName?: boolean;
  onSaved: (name: string) => void;
  onClose: () => void;
}

const FORM_ID = "eigener-baustein-formular";

export function EigenerBausteinDialog({ baustein, code = "", nurName = false, onSaved, onClose }: Props) {
  const [name, setName] = useState(baustein?.name ?? "");
  const [beschreibung, setBeschreibung] = useState(baustein?.beschreibung ?? "");
  const [inhalt, setInhalt] = useState(baustein?.code ?? code);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const titel = baustein === null ? "Als eigenen Baustein speichern" : nurName ? `„${baustein.name}“ umbenennen` : `„${baustein.name}“ bearbeiten`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setFehler("Bitte gib dem Baustein einen Namen.");
    if (!inhalt.trim()) return setFehler("Der Baustein enthält keinen Code.");
    setSpeichert(true);
    try {
      onSaved(await saveEigenerBaustein(baustein?.name ?? null, name, beschreibung, inhalt));
    } catch (error) {
      setFehler(errorMessage(error));
      setSpeichert(false);
    }
  };

  return (
    <Dialog
      label={titel}
      title={
        <span className="baustein-dialog__titel">
          <Puzzle aria-hidden="true" /> {titel}
        </span>
      }
      size={nurName ? "sm" : "lg"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={speichert}>
            Speichern
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="baustein-formular" onSubmit={(event) => void submit(event)}>
        <Field label="Name" hint={nurName ? undefined : "Erscheint in der Werkzeugleiste und im „/“-Menü."}>
          <Input aria-label="Name" value={name} data-autofocus placeholder="z. B. Lernziel-Box" onChange={(event) => setName(event.target.value)} />
        </Field>
        {!nurName && (
          <>
            <Field label="Beschreibung">
              <Input aria-label="Beschreibung" value={beschreibung} placeholder="Wofür ist der Baustein?" onChange={(event) => setBeschreibung(event.target.value)} />
            </Field>
            <Field label="Code">
              <Textarea aria-label="Code" mono rows={10} value={inhalt} onChange={(event) => setInhalt(event.target.value)} />
            </Field>
          </>
        )}
        {fehler && (
          <p className="notice error" role="alert">
            {fehler}
          </p>
        )}
      </form>
    </Dialog>
  );
}

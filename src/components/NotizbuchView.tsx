// Notizbuch: Ein Ordner mit `_notizbuch.yaml` wirkt wie eine kleine Website – links das Inhaltsverzeichnis,
// rechts die Seite, unten „Zurück“ und „Weiter“. Notizen erscheinen fertig dargestellt in der abgeschotteten
// Anzeige wie HTML-Seiten (umgewandelt mit src/lib/notiz-html.ts, ausgeliefert vom Schema). „Bearbeiten“ öffnet
// die Seite im passenden Editor. Die Reihenfolge lässt sich per Drag & Drop (oder Alt+↑/↓) ändern.
import { BookOpen, ChevronLeft, ChevronRight, FileCode, FileText, GripVertical, Pencil } from "lucide-react";
import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { errorMessage } from "../lib/autosave";
import { isHtmlPath } from "../lib/html";
import type { PageRef } from "../lib/links";
import { seiteAlsHtml } from "../lib/notiz-darstellung";
import { NOTIZBUCH_DATEI, notizbuchLesen, notizbuchMitReihenfolge, notizbuchNeu, notizbuchReihenfolge, verschieben } from "../lib/notizbuch";
import { pageTitle, parentDir } from "../lib/tree";
import { notizDarstellungSetzen, readPage, writePage, type TreeNode } from "../lib/vault-api";
import { PagePreview } from "./PagePreview";
import { Button, cx } from "./ui";

interface Props {
  folder: string;
  node: TreeNode | null;
  pages: PageRef[];
  /** Wird erhöht, wenn sich im Vault etwas geändert hat. */
  version: number;
  onEdit: (path: string) => void;
  onOpenLink: (path: string) => void;
  onOpenExternal: (url: string) => void;
  onError: (message: string) => void;
}

export function NotizbuchView({ folder, node, pages, version, onEdit, onOpenLink, onOpenExternal, onError }: Props) {
  const yamlPfad = `${folder}/${NOTIZBUCH_DATEI}`;
  const [text, setText] = useState<string | null>(null);
  const [aktuell, setAktuell] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<{ pfad: string; version: number } | null>(null);
  const [ziehe, setZiehe] = useState<string | null>(null);
  const [ueber, setUeber] = useState<{ name: string; danach: boolean } | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    readPage(yamlPfad).then(
      (inhalt) => !abgebrochen && setText(inhalt),
      () => !abgebrochen && setText(""),
    );
    return () => {
      abgebrochen = true;
    };
  }, [yamlPfad, version]);

  const dateien = (node?.children ?? []).filter((kind) => kind.kind === "page").map((kind) => kind.path.slice(folder.length + 1));
  const notizbuch = notizbuchLesen(text ?? "");
  const reihenfolge = notizbuchReihenfolge(notizbuch, dateien);
  const auswahl = aktuell !== null && reihenfolge.includes(aktuell) ? aktuell : (reihenfolge[0] ?? null);
  const index = auswahl === null ? -1 : reihenfolge.indexOf(auswahl);
  const pfad = auswahl === null ? null : `${folder}/${auswahl}`;

  // Seite für die Anzeige vorbereiten: Notizen werden umgewandelt und dem Schema übergeben.
  useEffect(() => {
    if (pfad === null) return;
    let abgebrochen = false;
    (async () => {
      if (!isHtmlPath(pfad)) await notizDarstellungSetzen(pfad, await seiteAlsHtml(pfad, pfad, pages));
      if (!abgebrochen) setVorschau((alt) => ({ pfad, version: alt?.pfad === pfad ? alt.version + 1 : 1 }));
    })().catch((error) => onError(errorMessage(error)));
    return () => {
      abgebrochen = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu darstellen bei anderer Seite oder Änderungen im Vault
  }, [pfad, version]);

  const speichern = async (neu: string[]) => {
    try {
      const inhalt = text ? notizbuchMitReihenfolge(text, neu) : notizbuchNeu(pageTitle(folder), neu);
      await writePage(yamlPfad, inhalt);
      setText(inhalt);
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  const ablegen = (event: DragEvent, ziel: string) => {
    event.preventDefault();
    const quelle = ziehe ?? event.dataTransfer?.getData("text/plain");
    const danach = ueber?.name === ziel ? ueber.danach : false;
    setZiehe(null);
    setUeber(null);
    if (quelle && quelle !== ziel && reihenfolge.includes(quelle)) void speichern(verschieben(reihenfolge, quelle, ziel, danach));
  };

  /** Alt+↑/↓ verschiebt den Eintrag (Alternative zum Ziehen). */
  const tastatur = (event: KeyboardEvent, name: string) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const i = reihenfolge.indexOf(name);
    const j = event.key === "ArrowUp" ? i - 1 : i + 1;
    if (j < 0 || j >= reihenfolge.length) return;
    void speichern(verschieben(reihenfolge, name, reihenfolge[j], event.key === "ArrowDown"));
  };

  /** Links zwischen Seiten des Notizbuchs bleiben im Notizbuch, alles andere öffnet die App. */
  const link = (ziel: string) => {
    const name = ziel.slice(folder.length + 1);
    if (parentDir(ziel) === folder && reihenfolge.includes(name)) setAktuell(name);
    else onOpenLink(ziel);
  };

  const titel = notizbuch.titel ?? pageTitle(folder);
  const vorher = index > 0 ? reihenfolge[index - 1] : null;
  const nachher = index >= 0 && index < reihenfolge.length - 1 ? reihenfolge[index + 1] : null;

  return (
    <div className="page is-wide notizbuch-seite">
      <header className="notizbuch-kopf">
        <BookOpen aria-hidden="true" />
        <h1>{titel}</h1>
      </header>
      <div className="notizbuch">
        <nav className="notizbuch-inhalt" aria-label="Inhaltsverzeichnis">
          {reihenfolge.length === 0 ? (
            <p className="muted">Noch keine Seiten. Lege im Ordner eine Notiz oder HTML-Seite an.</p>
          ) : (
            <ol>
              {reihenfolge.map((name, i) => {
                const Symbol = isHtmlPath(name) ? FileCode : FileText;
                return (
                  <li
                    key={name}
                    draggable
                    className={cx(ziehe === name && "is-dragging", ueber?.name === name && (ueber.danach ? "drop-after" : "drop-before"))}
                    onDragStart={(event) => {
                      setZiehe(name);
                      event.dataTransfer?.setData("text/plain", name);
                      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      if (!ziehe || ziehe === name) return;
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      setUeber({ name, danach: event.clientY > rect.top + rect.height / 2 });
                    }}
                    onDragLeave={() => setUeber((alt) => (alt?.name === name ? null : alt))}
                    onDrop={(event) => ablegen(event, name)}
                    onDragEnd={() => {
                      setZiehe(null);
                      setUeber(null);
                    }}
                  >
                    <button
                      type="button"
                      className={cx("notizbuch-eintrag", name === auswahl && "active")}
                      aria-current={name === auswahl ? "page" : undefined}
                      title="Ziehen zum Umsortieren (oder Alt+↑/↓)"
                      onClick={() => setAktuell(name)}
                      onKeyDown={(event) => tastatur(event, name)}
                    >
                      <GripVertical className="notizbuch-griff" aria-hidden="true" />
                      <span className="notizbuch-nummer">{i + 1}</span>
                      <Symbol aria-hidden="true" />
                      <span className="notizbuch-titel">{pageTitle(name)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </nav>
        <article className="notizbuch-inhaltsseite" aria-label={pfad ? pageTitle(pfad) : "Seite"}>
          {pfad && (
            <div className="notizbuch-leiste">
              <h2>{pageTitle(pfad)}</h2>
              <Button size="sm" icon={<Pencil />} onClick={() => onEdit(pfad)}>
                Bearbeiten
              </Button>
            </div>
          )}
          {vorschau && pfad === vorschau.pfad && (
            <PagePreview key={vorschau.pfad} path={vorschau.pfad} version={vorschau.version} fitContent title={pageTitle(vorschau.pfad)} onOpenLink={link} onOpenExternal={onOpenExternal} />
          )}
          {pfad && (
            <nav className="notizbuch-blaettern" aria-label="Blättern">
              <Button icon={<ChevronLeft />} disabled={vorher === null} onClick={() => vorher && setAktuell(vorher)}>
                {vorher ? `Zurück: ${pageTitle(vorher)}` : "Zurück"}
              </Button>
              <Button trailing={<ChevronRight />} disabled={nachher === null} onClick={() => nachher && setAktuell(nachher)}>
                {nachher ? `Weiter: ${pageTitle(nachher)}` : "Weiter"}
              </Button>
            </nav>
          )}
        </article>
      </div>
    </div>
  );
}

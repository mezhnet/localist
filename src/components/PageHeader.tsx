// Kopf einer Seite wie bei Notion: Cover-Bild, Icon (Emoji) und Knöpfe zum Hinzufügen.
// Beides steht im Frontmatter der Seite (icon, cover); PageView übernimmt das Speichern.
import { Image, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Input } from "./ui";

const EMOJIS = [
  "📄", "📝", "📌", "📎", "📁", "🗂️", "📅", "🗓️", "✅", "☑️", "💡", "🔥",
  "🚀", "🎯", "⭐", "❤️", "🏠", "🏢", "🛒", "💰", "📈", "🧾", "🔧", "⚙️",
  "💻", "📱", "🎨", "🎵", "📚", "🎓", "✈️", "🚗", "🌍", "🌱", "🍀", "☕",
  "🍽️", "🏃", "🧠", "💬", "🔒", "🐞", "🧪", "📦", "🎁", "🙂", "🤝", "⚠️",
];

interface Props {
  icon: string | null;
  coverUrl: string | null;
  hasCover: boolean;
  onSetIcon: (icon: string | null) => void;
  onPickCover: () => void;
  onRemoveCover: () => void;
}

export function PageHeader({ icon, coverUrl, hasCover, onSetIcon, onPickCover, onRemoveCover }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className={`page-header${hasCover ? " with-cover" : ""}`}>
      {hasCover && (
        <div className="page-cover" style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}>
          <div className="page-cover-actions">
            <Button size="sm" variant="secondary" onClick={onPickCover}>
              Cover ändern
            </Button>
            <Button size="sm" variant="secondary" onClick={onRemoveCover}>
              Entfernen
            </Button>
          </div>
        </div>
      )}
      <div className="page-header-inner">
        {icon && (
          <button type="button" className="page-icon" aria-label="Icon ändern" title="Icon ändern" onClick={() => setPickerOpen(true)}>
            {icon}
          </button>
        )}
        <div className="page-header-actions">
          {!icon && (
            <Button variant="ghost" size="sm" icon={<Smile />} onClick={() => setPickerOpen(true)}>
              Icon hinzufügen
            </Button>
          )}
          {!hasCover && (
            <Button variant="ghost" size="sm" icon={<Image />} onClick={onPickCover}>
              Cover hinzufügen
            </Button>
          )}
        </div>
        {pickerOpen && (
          <EmojiPicker
            onPick={(emoji) => {
              setPickerOpen(false);
              onSetIcon(emoji);
            }}
            onRemove={
              icon
                ? () => {
                    setPickerOpen(false);
                    onSetIcon(null);
                  }
                : undefined
            }
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function EmojiPicker({ onPick, onRemove, onClose }: { onPick: (emoji: string) => void; onRemove?: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState("");

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="emoji-picker" role="dialog" aria-label="Icon auswählen">
      <div className="emoji-grid">
        {EMOJIS.map((emoji) => (
          <button key={emoji} type="button" aria-label={`Icon ${emoji}`} onClick={() => onPick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="emoji-own"
        onSubmit={(event) => {
          event.preventDefault();
          if (own.trim()) onPick(own.trim());
        }}
      >
        <Input
          inputSize="sm"
          aria-label="Eigenes Emoji"
          placeholder="Eigenes Emoji einfügen (Win + .)"
          value={own}
          maxLength={16}
          onChange={(event) => setOwn(event.target.value)}
        />
        <Button type="submit" size="sm">
          Übernehmen
        </Button>
      </form>
      {onRemove && (
        <Button variant="ghost" size="sm" className="emoji-remove" icon={<Trash2 />} onClick={onRemove}>
          Icon entfernen
        </Button>
      )}
    </div>
  );
}

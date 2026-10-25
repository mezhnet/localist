// Kopf einer Seite wie bei Notion: Cover-Bild, Icon (Emoji) und Knöpfe zum Hinzufügen.
// Beides steht im Frontmatter der Seite (icon, cover); PageView übernimmt das Speichern.
import { useEffect, useRef, useState } from "react";

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
            <button type="button" onClick={onPickCover}>
              Cover ändern
            </button>
            <button type="button" onClick={onRemoveCover}>
              Entfernen
            </button>
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
            <button type="button" onClick={() => setPickerOpen(true)}>
              🙂 Icon hinzufügen
            </button>
          )}
          {!hasCover && (
            <button type="button" onClick={onPickCover}>
              🖼️ Cover hinzufügen
            </button>
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
        <input
          aria-label="Eigenes Emoji"
          placeholder="Eigenes Emoji einfügen (Win + .)"
          value={own}
          maxLength={16}
          onChange={(event) => setOwn(event.target.value)}
        />
        <button type="submit">Übernehmen</button>
      </form>
      {onRemove && (
        <button type="button" className="emoji-remove" onClick={onRemove}>
          Icon entfernen
        </button>
      )}
    </div>
  );
}

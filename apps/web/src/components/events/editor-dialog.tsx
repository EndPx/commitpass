"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

export function EditorDialog({
  title,
  description,
  icon,
  onClose,
  children,
  wide = false,
  sheet = false,
  busy = false,
  anchor,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  sheet?: boolean;
  busy?: boolean;
  anchor?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [position, setPosition] = useState<CSSProperties>();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const place = () => {
      if (!anchor) return;
      const box = anchor.getBoundingClientRect();
      const width = Math.min(box.width, window.innerWidth - 32);
      const height = Math.min(dialog.scrollHeight, window.innerHeight - 32);
      const top = Math.max(
        16,
        box.bottom + height + 8 < window.innerHeight
          ? box.bottom + 8
          : box.top - height - 8,
      );
      setPosition({
        width,
        left: Math.min(Math.max(16, box.left), window.innerWidth - width - 16),
        top,
        maxHeight: window.innerHeight - top - 16,
        margin: 0,
      });
    };
    place();
    const resize = new ResizeObserver(place);
    if (anchor) resize.observe(dialog);
    window.addEventListener("resize", place);
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      window.removeEventListener("resize", place);
      resize.disconnect();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      style={position}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={`editor-dialog${wide ? " editor-dialog--wide" : ""}${sheet ? " editor-dialog--sheet" : ""}${anchor ? " editor-dialog--popover" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="editor-close"
        aria-label={`Close ${title}`}
        type="button"
        disabled={busy}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      {icon && <span className="editor-modal-icon">{icon}</span>}
      <h2 id={titleId}>{title}</h2>
      {description && (
        <p id={descriptionId} className="editor-modal-description">
          {description}
        </p>
      )}
      {children}
    </dialog>
  );
}
export function DialogActions({
  onCancel,
  disabled = false,
  label = "Confirm",
}: {
  onCancel: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="editor-dialog-actions">
      <button type="button" onClick={onCancel} disabled={disabled}>
        Cancel
      </button>
      <button type="submit" disabled={disabled}>
        {label}
      </button>
    </div>
  );
}

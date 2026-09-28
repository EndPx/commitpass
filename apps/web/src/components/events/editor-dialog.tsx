"use client";
import { useLayoutEffect, useId, useRef, type ReactNode } from "react";
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
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const place = () => {
      if (!anchor) return;
      let box = anchor.getBoundingClientRect();
      const width = Math.min(box.width, window.innerWidth - 32);
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      dialog.style.width = `${width}px`;
      // Keep the field visible below the sticky header, and make room below it.
      // Never flip the menu above the field where it covers the date controls.
      const height = Math.min(
        dialog.scrollHeight,
        360,
        Math.max(0, viewportBottom - 96 - box.height - 24),
      );
      const overflow = box.bottom + 8 + height + 16 - viewportBottom;
      if (overflow > 0 && box.top > 96) {
        window.scrollBy({
          top: Math.min(overflow, box.top - 96),
          behavior: "instant",
        });
        box = anchor.getBoundingClientRect();
      }
      dialog.style.left = `${Math.min(Math.max(16, box.left), window.innerWidth - width - 16)}px`;
      dialog.style.top = `${box.bottom + 8}px`;
      dialog.style.maxHeight = `${Math.max(0, viewportBottom - box.bottom - 24)}px`;
      dialog.style.margin = "0";
    };
    place();
    const resize = new ResizeObserver(place);
    if (anchor) resize.observe(dialog);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      resize.disconnect();
    };
  }, []);
  return (
    <dialog
      ref={ref}
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

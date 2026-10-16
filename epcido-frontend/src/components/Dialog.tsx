import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Okno na środku ekranu; w wąskim widoku wysuwa się od dołu. Escape i tło zamykają. */
export function Dialog({ title, description, onClose, children, footer }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".popover")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-root">
      <div className="dialog-backdrop" onClick={onClose} aria-hidden />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">{title}</h2>
            {description && <p className="dialog__desc">{description}</p>}
          </div>
          <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__foot">{footer}</footer>}
      </div>
    </div>
  );
}

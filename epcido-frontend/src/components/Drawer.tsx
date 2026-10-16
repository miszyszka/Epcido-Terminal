import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** zmienia się przy przełączeniu na inną treść — przewija panel na górę */
  contentKey?: string;
}

/** Panel wysuwany z prawej (brandbook 5). Escape i kliknięcie w tło zamykają. */
export function Drawer({ title, subtitle, onClose, children, footer, contentKey }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".popover")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("has-drawer");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("has-drawer");
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" tabIndex={-1} ref={panel}>
        <header className="drawer__head">
          <div className="drawer__titles">
            <h2 className="drawer__title">{title}</h2>
            {subtitle && <div className="drawer__subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Zamknij panel">
            <X size={20} />
          </button>
        </header>
        <div className="drawer__body" ref={body}>
          {children}
        </div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </div>
    </div>
  );
}

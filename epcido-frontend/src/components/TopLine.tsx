import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Database } from "lucide-react";
import { useData } from "../app/DataContext";

/** Zamiast górnego paska: znak po lewej, status bazy po prawej (brandbook 5). */
export function TopLine() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmClear(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const live = data.status.state === "ready";
  const sourceLabel = data.mode === "demo" ? "Tryb demo" : live ? "Firebase, na żywo" : "Firebase";
  const seeded = data.model?.snapshot.seeded ?? false;

  return (
    <div className="topline">
      <Link to="/mapa" className="wordmark" aria-label="Epcido Terminal, strona główna">
        <span className="wordmark__mark" aria-hidden>
          <i />
          <i />
          <i />
          <i className="is-open" />
        </span>
        <span className="wordmark__text">
          Epcido <span>Terminal</span>
        </span>
      </Link>

      <div className="topline__right" ref={root}>
        <Link to="/brandbook" className="topline__link">
          Brandbook
        </Link>
        <button
          type="button"
          className={`source ${data.mode === "demo" ? "source--demo" : ""} ${live ? "is-live" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="source__dot" aria-hidden />
          {sourceLabel}
        </button>

        {open && (
          <div className="popover source-menu" role="dialog" aria-label="Źródło danych">
            <div className="source-menu__head">
              <Database size={18} aria-hidden />
              <div>
                <strong>{data.mode === "demo" ? "Dane w tej przeglądarce" : "Baza Firebase: epcido-terminal"}</strong>
                <p>
                  {data.mode === "demo"
                    ? "Zmiany widzisz tylko Ty. Nic nie trafia do bazy."
                    : "Zmiany widzą od razu wszyscy, którzy mają otwartą aplikację."}
                </p>
              </div>
            </div>

            {data.model && (
              <div className="source-menu__actions">
                {!seeded && (
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => data.loadTestData()}>
                    Wgraj dane testowe
                  </button>
                )}
                {seeded && !confirmClear && (
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmClear(true)}>
                    Usuń dane testowe
                  </button>
                )}
                {confirmClear && (
                  <div className="confirm">
                    <p>Usunąć wszystkie projekty, osoby i godziny? Dziennik zmian zostanie.</p>
                    <div className="confirm__row">
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmClear(false)}>
                        Anuluj
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={async () => {
                          await data.clearData();
                          setConfirmClear(false);
                        }}
                      >
                        Usuń dane
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn btn--quiet btn--sm source-menu__switch"
              onClick={() => data.switchMode(data.mode === "demo" ? "firebase" : "demo")}
            >
              {data.mode === "demo" ? "Przełącz na Firebase" : "Przełącz na tryb demo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

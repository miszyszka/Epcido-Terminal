import { Link } from "react-router-dom";
import { Monitor, Plus, Smartphone } from "lucide-react";
import { useData } from "../app/DataContext";
import { useQueue, useRejectedOwn } from "../app/hooks";
import { useSession } from "../app/SessionContext";
import { useUi } from "../app/UiContext";
import { formatHoursTotal, ROLE_LABEL } from "../domain/labels";
import { can, canApprove, homeFor } from "../domain/permissions";
import { daysCount, positions } from "../lib/text";

/** Górna linia: powitanie, liczba pozycji do zatwierdzenia, główne akcje. Bez tła — leży na stronie. */
export function TopBar() {
  const { user } = useData();
  const { preview, setPreview } = useSession();
  const { openNewProject } = useUi();
  const queue = useQueue();
  const rejected = useRejectedOwn();

  return (
    <header className="topbar">
      <Link to={user ? homeFor(user) : "/"} className="wordmark" aria-label="Epcido Terminal, strona główna">
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

      {user && (
        <div className="topbar__hello">
          <span className="topbar__greeting">
            Cześć, <strong>{user.name}</strong>
          </span>
          <span className="topbar__role">{ROLE_LABEL[user.role]}</span>
        </div>
      )}

      <div className="topbar__actions">
        {user && canApprove(user) && (
          <Link to="/zatwierdzanie" className={`approvals-pill ${queue.items.length ? "has-items" : ""}`}>
            {queue.items.length ? (
              <>
                <span className="approvals-pill__dot" aria-hidden />
                <span>
                  Masz <strong>{positions(queue.items.length)}</strong> do zatwierdzenia
                </span>
                <small>{formatHoursTotal(queue.minutes)}</small>
              </>
            ) : (
              <span>Wszystko zatwierdzone</span>
            )}
          </Link>
        )}
        {user && rejected > 0 && can(user, "hours.own") && (
          <Link to="/moje-godziny" className="approvals-pill has-items approvals-pill--fix">
            <span className="approvals-pill__dot" aria-hidden />
            <span>
              Masz <strong>{daysCount(rejected)}</strong> do poprawy
            </span>
          </Link>
        )}
        {user && can(user, "project.create") && (
          <button type="button" className="btn btn--primary topbar__new" onClick={openNewProject}>
            <Plus size={18} aria-hidden />
            <span>Dodaj nowy projekt</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn--secondary topbar__preview"
          onClick={() => setPreview(preview === "mobile" ? "desktop" : "mobile")}
          aria-pressed={preview === "mobile"}
        >
          {preview === "mobile" ? <Monitor size={18} aria-hidden /> : <Smartphone size={18} aria-hidden />}
          <span>{preview === "mobile" ? "Wersja desktopowa" : "Wersja mobilna"}</span>
        </button>
      </div>
    </header>
  );
}

import { Link, useLocation } from "react-router-dom";
import { AlarmClock, Monitor, Plus, Smartphone } from "lucide-react";
import { useData } from "../app/DataContext";
import { useQueue } from "../app/hooks";
import { useSession } from "../app/SessionContext";
import { useUi } from "../app/UiContext";
import { ROLE_LABEL } from "../domain/labels";
import { can, canApprove, homeFor } from "../domain/permissions";
import { formatRemaining, timesheetsGen, timesheetsNom } from "../domain/workflow";
import { GlobalSearch } from "./GlobalSearch";

/** Górna linia: powitanie, wyszukiwarka, czas na zatwierdzenie, główne akcje. Bez tła — leży na stronie. */
export function TopBar() {
  const { user } = useData();
  const { preview, setPreview } = useSession();
  const { openNewProject } = useUi();
  const queue = useQueue();
  const location = useLocation();
  // Na zatwierdzaniu i pulpicie ten sam komunikat jest w banerze na stronie
  const pillHere = !location.pathname.startsWith("/zatwierdzanie") && !location.pathname.startsWith("/pulpit");
  const s = queue.summary;

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

      <GlobalSearch />

      <div className="topbar__actions">
        {user && canApprove(user) && s && pillHere && (
          <Link
            to="/zatwierdzanie"
            className={`approvals-pill ${s.timesheets || s.later ? "has-items" : ""} ${s.urgent && s.timesheets ? "is-urgent" : ""}`}
          >
            {s.timesheets > 0 ? (
              <>
                <AlarmClock size={16} aria-hidden />
                <span>
                  Masz <strong>{formatRemaining(s.remainingMs)}</strong> na zatwierdzenie <strong>{timesheetsGen(s.timesheets)}</strong>
                </span>
              </>
            ) : s.later > 0 ? (
              <span>
                <strong>{timesheetsNom(s.later)}</strong> do zatwierdzenia
              </span>
            ) : (
              <span>Wszystko zatwierdzone</span>
            )}
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
          aria-label={preview === "mobile" ? "Wersja desktopowa" : "Wersja mobilna"}
        >
          {preview === "mobile" ? <Monitor size={18} aria-hidden /> : <Smartphone size={18} aria-hidden />}
          <span>{preview === "mobile" ? "Wersja desktopowa" : "Wersja mobilna"}</span>
        </button>
      </div>
    </header>
  );
}

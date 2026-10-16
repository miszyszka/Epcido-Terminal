import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  PLANNING: "Planning",
  PM: "Project Manager",
  SUPERVISOR: "Supervisor",
  WORKER: "Pracownik / TL",
};

export function Layout() {
  const { user, logout } = useSession();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const canSeeTimeEntry = true; // wszyscy (pracownik, TL, SV, PM) rejestrują swój czas
  const canSeeSupervisorApproval = user.role === "SUPERVISOR" || user.role === "ADMIN";
  const canSeePmApproval = user.role === "PM" || user.role === "ADMIN";
  const canSeePlanning = user.role === "PLANNING" || user.role === "ADMIN";

  return (
    <>
      <header className="app-header">
        <div className="app-header__title">Epcido Terminal</div>
        <div className="app-header__user">
          {user.name}
          <br />
          <span style={{ opacity: 0.7 }}>{ROLE_LABELS[user.role]}</span>{" "}
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "none",
              color: "#93c5fd",
              cursor: "pointer",
              fontSize: "0.8rem",
              textDecoration: "underline",
            }}
          >
            wyloguj
          </button>
        </div>
      </header>
      <nav className="nav-tabs">
        {canSeeTimeEntry && (
          <NavLink to="/time-entry" className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}>
            Mój tydzień
          </NavLink>
        )}
        {canSeeSupervisorApproval && (
          <NavLink to="/approve-sv" className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}>
            Do akceptacji (SV)
          </NavLink>
        )}
        {canSeePmApproval && (
          <NavLink to="/approve-pm" className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}>
            Do akceptacji (PM)
          </NavLink>
        )}
        {canSeePlanning && (
          <NavLink to="/planning" className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}>
            Planning
          </NavLink>
        )}
      </nav>
      <Outlet />
    </>
  );
}

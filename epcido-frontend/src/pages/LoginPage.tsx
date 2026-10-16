import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { getEmployees } from "../data/store";
import type { Role } from "../types";

// Prototyp: logowanie przez wybór roli (zamiast hasła).
// Docelowo: Firebase Authentication (email + hasło / SSO), patrz PLAN_I_ARCHITEKTURA.md sekcja 10.1

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PLANNING: "Planning",
  PM: "Project Manager",
  SUPERVISOR: "Supervisor",
  WORKER: "Pracownik / Team Leader",
};

const ROLE_ORDER: Role[] = ["ADMIN", "PLANNING", "PM", "SUPERVISOR", "WORKER"];

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const employees = getEmployees();

  function handleLogin(employeeId: string) {
    login(employeeId);
    navigate("/");
  }

  return (
    <div className="app-main">
      <h1 className="page-title">Epcido Terminal — wybierz użytkownika testowego</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        To jest prototyp frontendowy. Docelowo logowanie będzie przez e-mail/hasło (Firebase Auth).
        Na razie wybierz, jako kto chcesz się zalogować, żeby zobaczyć widok danej roli.
      </p>
      {ROLE_ORDER.map((role) => {
        const roleEmployees = employees.filter((e) => e.role === role);
        if (roleEmployees.length === 0) return null;
        return (
          <div className="card" key={role}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{ROLE_LABELS[role]}</label>
            </div>
            <div className="role-grid">
              {roleEmployees.map((e) => (
                <button key={e.id} className="role-option" onClick={() => handleLogin(e.id)}>
                  <span className="role-option__name">{e.name}</span>
                  <span className="role-option__role">{e.trade === "ELECTRICIAN" ? "Elektryk" : e.trade === "MECHANIC" ? "Mechanik" : ""}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  getProjects,
  getEmployees,
  getAssignmentsForProject,
  assignEmployee,
  removeAssignment,
  createProject,
} from "../data/store";
import type { Trade } from "../types";

export function PlanningPage() {
  const [refreshTick, setRefreshTick] = useState(0);
  const projects = useMemo(() => getProjects(), [refreshTick]);
  const employees = useMemo(() => getEmployees(), []);
  const pms = employees.filter((e) => e.role === "PM");
  const supervisors = employees.filter((e) => e.role === "SUPERVISOR");
  const workers = employees.filter((e) => e.role === "WORKER");

  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");

  // Formularz nowego projektu
  const [showNewProject, setShowNewProject] = useState(false);
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [pmId, setPmId] = useState(pms[0]?.id ?? "");
  const [supervisorIds, setSupervisorIds] = useState<string[]>([]);

  function toggleSupervisor(id: string) {
    setSupervisorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !pmId || supervisorIds.length === 0) return;
    const project = createProject({ name, customerName, siteAddress, pmId, supervisorIds });
    setName("");
    setCustomerName("");
    setSiteAddress("");
    setSupervisorIds([]);
    setShowNewProject(false);
    setSelectedProjectId(project.id);
    setRefreshTick((t) => t + 1);
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const assignments = selectedProjectId ? getAssignmentsForProject(selectedProjectId) : [];
  const assignedIds = new Set(assignments.map((a) => a.employeeId));

  function handleAssign(employeeId: string, trade: Trade) {
    if (!selectedProjectId) return;
    assignEmployee(selectedProjectId, employeeId, trade);
    setRefreshTick((t) => t + 1);
  }

  function handleUnassign(assignmentId: string) {
    removeAssignment(assignmentId);
    setRefreshTick((t) => t + 1);
  }

  return (
    <div className="app-main app-main--wide">
      <h1 className="page-title">Planning — projekty i zespoły</h1>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong>Projekty</strong>
          <button className="btn btn-outline btn-sm" onClick={() => setShowNewProject((v) => !v)}>
            {showNewProject ? "Anuluj" : "+ Nowy projekt"}
          </button>
        </div>

        {showNewProject && (
          <form className="card" style={{ background: "var(--color-surface-muted)" }} onSubmit={handleCreateProject}>
            <div className="field">
              <label>Nazwa projektu</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. P26080-Klient-Lokalizacja" />
            </div>
            <div className="row">
              <div className="field">
                <label>Klient</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="field">
                <label>Adres budowy</label>
                <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Project Manager</label>
              <select value={pmId} onChange={(e) => setPmId(e.target.value)}>
                {pms.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Supervisorzy przypisani do projektu</label>
              <div className="checkbox-list">
                {supervisors.map((sv) => (
                  <label className="checkbox-item" key={sv.id}>
                    <input
                      type="checkbox"
                      checked={supervisorIds.includes(sv.id)}
                      onChange={() => toggleSupervisor(sv.id)}
                    />
                    {sv.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Utwórz projekt
            </button>
          </form>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Klient</th>
              <th>PM</th>
              <th>Supervisorzy</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                style={{ cursor: "pointer", background: p.id === selectedProjectId ? "var(--color-surface-muted)" : undefined }}
              >
                <td>{p.name}</td>
                <td>{p.customerName}</td>
                <td>{employees.find((e) => e.id === p.pmId)?.name}</td>
                <td>{p.supervisorIds.map((id) => employees.find((e) => e.id === id)?.name).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProject && (
        <div className="card">
          <strong>Zespół projektu: {selectedProject.name}</strong>
          <p className="hint">Przypisz pracowników z podziałem na mechaników i elektryków.</p>

          <div className="entry-row" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
            <div className="entry-row__main" style={{ fontWeight: 600 }}>Przypisani:</div>
          </div>
          {assignments.length === 0 && <div className="empty-state">Brak przypisanych pracowników.</div>}
          {assignments.map((a) => {
            const employee = employees.find((e) => e.id === a.employeeId);
            return (
              <div className="entry-row" key={a.id}>
                <div className="entry-row__main">
                  <div className="entry-row__title">{employee?.name}</div>
                  <div className="entry-row__meta">{a.trade === "ELECTRICIAN" ? "Elektryk" : "Mechanik"}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => handleUnassign(a.id)}>
                  Usuń
                </button>
              </div>
            );
          })}

          <div className="entry-row" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12, marginTop: 12 }}>
            <div className="entry-row__main" style={{ fontWeight: 600 }}>Dostępni pracownicy:</div>
          </div>
          {workers
            .filter((w) => !assignedIds.has(w.id))
            .map((w) => (
              <div className="entry-row" key={w.id}>
                <div className="entry-row__main">
                  <div className="entry-row__title">{w.name}</div>
                  <div className="entry-row__meta">{w.trade === "ELECTRICIAN" ? "Elektryk" : "Mechanik"}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAssign(w.id, w.trade ?? "MECHANIC")}
                >
                  Przypisz
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

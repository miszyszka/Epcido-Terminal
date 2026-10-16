import { useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import { getPendingForSupervisor, getEmployee, getProject, supervisorApprove, supervisorReject } from "../data/store";

export function SupervisorApprovalPage() {
  const { user } = useSession();
  const [refreshTick, setRefreshTick] = useState(0);
  const pending = useMemo(() => (user ? getPendingForSupervisor(user.id) : []), [user, refreshTick]);

  if (!user) return null;

  function approve(entryId: string) {
    supervisorApprove(entryId, user!.id);
    setRefreshTick((t) => t + 1);
  }

  function reject(entryId: string) {
    const reason = window.prompt("Powód odrzucenia:");
    if (reason === null) return; // anulowano
    supervisorReject(entryId, reason || "Brak uzasadnienia");
    setRefreshTick((t) => t + 1);
  }

  return (
    <div className="app-main">
      <h1 className="page-title">Do akceptacji (Supervisor)</h1>

      <div className="card">
        {pending.length === 0 && <div className="empty-state">Wszystko zaakceptowane 🎉</div>}
        {pending.map((entry) => {
          const employee = getEmployee(entry.employeeId);
          const project = getProject(entry.projectId);
          return (
            <div className="entry-row" key={entry.id}>
              <div className="entry-row__main">
                <div className="entry-row__title">
                  {employee?.name} — {entry.date}
                </div>
                <div className="entry-row__meta">
                  {project?.name} · {entry.workStart}–{entry.workEnd} (przerwa {entry.breakMinutes} min)
                </div>
                {entry.note && <div className="entry-row__meta">Notatka: {entry.note}</div>}
              </div>
              <div className="entry-actions">
                <button className="btn btn-success btn-sm" onClick={() => approve(entry.id)}>
                  Akceptuj
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => reject(entry.id)}>
                  Odrzuć
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import { getPendingForPM, getEmployee, getProject, pmApprove, pmReject } from "../data/store";

export function PmApprovalPage() {
  const { user } = useSession();
  const [refreshTick, setRefreshTick] = useState(0);
  const pending = useMemo(() => (user ? getPendingForPM(user.id) : []), [user, refreshTick]);

  if (!user) return null;

  // Grupowanie po projekcie — PM widzi zbiorczo, ile ma do akceptacji na każdym projekcie
  const byProject = useMemo(() => {
    const map = new Map<string, typeof pending>();
    for (const entry of pending) {
      const list = map.get(entry.projectId) ?? [];
      list.push(entry);
      map.set(entry.projectId, list);
    }
    return map;
  }, [pending]);

  function approve(entryId: string) {
    pmApprove(entryId, user!.id);
    setRefreshTick((t) => t + 1);
  }

  function reject(entryId: string) {
    const reason = window.prompt("Powód odrzucenia:");
    if (reason === null) return;
    pmReject(entryId, reason || "Brak uzasadnienia");
    setRefreshTick((t) => t + 1);
  }

  function approveAllInProject(projectId: string) {
    const list = byProject.get(projectId) ?? [];
    list.forEach((entry) => pmApprove(entry.id, user!.id));
    setRefreshTick((t) => t + 1);
  }

  return (
    <div className="app-main">
      <h1 className="page-title">Do akceptacji (Project Manager)</h1>

      {byProject.size === 0 && (
        <div className="card">
          <div className="empty-state">Wszystko zaakceptowane 🎉</div>
        </div>
      )}

      {Array.from(byProject.entries()).map(([projectId, list]) => {
        const project = getProject(projectId);
        return (
          <div className="card" key={projectId}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <strong>{project?.name}</strong>
                <div className="hint">{list.length} wpis(ów) zaakceptowanych przez SV, czeka na Ciebie</div>
              </div>
              <button className="btn btn-success btn-sm" onClick={() => approveAllInProject(projectId)}>
                Akceptuj wszystko
              </button>
            </div>

            {list.map((entry) => {
              const employee = getEmployee(entry.employeeId);
              return (
                <div className="entry-row" key={entry.id}>
                  <div className="entry-row__main">
                    <div className="entry-row__title">
                      {employee?.name} — {entry.date}
                    </div>
                    <div className="entry-row__meta">
                      {entry.workStart}–{entry.workEnd} (przerwa {entry.breakMinutes} min) · zaakceptował SV:{" "}
                      {getEmployee(entry.supervisorApprovedBy ?? "")?.name ?? "—"}
                    </div>
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
        );
      })}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useSession } from "../context/SessionContext";
import { getProjectsForEmployee, getTimeEntriesForEmployee, submitTimeEntry } from "../data/store";
import { StatusBadge } from "../components/StatusBadge";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function TimeEntryPage() {
  const { user } = useSession();
  const [refreshTick, setRefreshTick] = useState(0);

  const projects = useMemo(() => (user ? getProjectsForEmployee(user.id) : []), [user, refreshTick]);
  const entries = useMemo(() => (user ? getTimeEntriesForEmployee(user.id) : []), [user, refreshTick]);

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [workStart, setWorkStart] = useState("07:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [note, setNote] = useState("");

  if (!user) return null;

  if (projects.length === 0) {
    return (
      <div className="app-main">
        <h1 className="page-title">Mój tydzień</h1>
        <div className="empty-state">
          Nie masz jeszcze przypisanego żadnego projektu. Skontaktuj się z Planning.
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    submitTimeEntry({
      employeeId: user!.id,
      projectId,
      date,
      workStart,
      workEnd,
      breakMinutes,
      note: note || undefined,
    });
    setNote("");
    setRefreshTick((t) => t + 1);
  }

  return (
    <div className="app-main">
      <h1 className="page-title">Mój tydzień</h1>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Projekt</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="row">
          <div className="field">
            <label>Start pracy</label>
            <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Koniec pracy</label>
            <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Przerwa (minuty)</label>
          <input
            type="number"
            min={0}
            step={5}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>Notatka (opcjonalnie)</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary">
          Wyślij dzień do akceptacji
        </button>
      </form>

      <h2 className="page-title" style={{ fontSize: "1.05rem" }}>
        Historia wpisów
      </h2>
      <div className="card">
        {entries.length === 0 && <div className="empty-state">Brak wpisów.</div>}
        {entries.map((entry) => (
          <div className="entry-row" key={entry.id}>
            <div className="entry-row__main">
              <div className="entry-row__title">{entry.date}</div>
              <div className="entry-row__meta">
                {entry.workStart}–{entry.workEnd} (przerwa {entry.breakMinutes} min)
              </div>
              {entry.status === "REJECTED" && entry.rejectionReason && (
                <div className="entry-row__meta" style={{ color: "var(--color-danger)" }}>
                  Powód odrzucenia: {entry.rejectionReason}
                </div>
              )}
            </div>
            <StatusBadge status={entry.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

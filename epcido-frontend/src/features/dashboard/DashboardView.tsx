import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useModel, useUser } from "../../app/DataContext";
import { useQueue } from "../../app/hooks";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { formatHoursTotal } from "../../domain/labels";
import { visibleProjects } from "../../domain/permissions";
import { supervisorStats } from "../../domain/workflow";
import { todayISO } from "../../lib/dates";
import { matches } from "../../lib/search";
import { positions } from "../../lib/text";
import { DeadlineNote } from "../approvals/DeadlineNote";

/** Pulpit Installation Managera (i administratora): supervisorzy i ich zaległości w zatwierdzaniu. */
export function DashboardView() {
  const model = useModel();
  const user = useUser();
  const { search } = useUi();
  const queue = useQueue();
  const today = todayISO();

  const stats = useMemo(() => {
    const projects = visibleProjects(model, user);
    const svIds = [...new Set(projects.map((p) => p.supervisorId).filter((id): id is string => Boolean(id)))];
    return svIds
      .map((id) => model.employeeById.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((sv) => supervisorStats(model, sv, today))
      .sort((a, b) => b.overdue - a.overdue || b.pending - a.pending);
  }, [model, user, today]);

  const rows = stats.filter((s) =>
    matches(search, s.supervisor.name, ...s.projectIds.map((id) => model.projectById.get(id)?.name))
  );
  const teamPending = stats.reduce((n, s) => n + s.pending, 0);
  const teamPendingMin = stats.reduce((n, s) => n + s.pendingMinutes, 0);
  const teamOverdue = stats.reduce((n, s) => n + s.overdue, 0);

  return (
    <div className="page">
      <PageHeader
        title="Pulpit"
        description={
          user.role === "ADMIN"
            ? "Wszyscy supervisorzy i to, co jeszcze muszą zatwierdzić."
            : "Supervisorzy w Twoich projektach i to, co jeszcze muszą zatwierdzić."
        }
      />

      <section className="dash-summary">
        <div className="dash-tile">
          <span className="dash-tile__label">Supervisorzy mają do zatwierdzenia</span>
          <span className="big-stat__value">{teamPending}</span>
          <span className="dash-tile__sub">
            {positions(teamPending).replace(/^\d+ /, "")}, {formatHoursTotal(teamPendingMin)}
            {teamOverdue > 0 && <span className="badge badge--absent">po terminie: {teamOverdue}</span>}
          </span>
        </div>
        <div className="dash-tile dash-tile--mine">
          <span className="dash-tile__label">Czeka na Ciebie</span>
          <span className="big-stat__value">{queue.items.length}</span>
          <span className="dash-tile__sub">
            {positions(queue.items.length).replace(/^\d+ /, "")}, {formatHoursTotal(queue.minutes)}
          </span>
          <Link to="/zatwierdzanie" className="btn btn--primary btn--sm dash-tile__cta">
            Przejdź do zatwierdzania
          </Link>
        </div>
        <div className="dash-tile">
          <span className="dash-tile__label">Najbliższy termin</span>
          <DeadlineNote />
        </div>
      </section>

      <div className="table-card">
        <table className="table table--dash">
          <thead>
            <tr>
              <th scope="col">Supervisor</th>
              <th scope="col">Projekty</th>
              <th scope="col">Do zatwierdzenia przez supervisora</th>
              <th scope="col">Po terminie</th>
              <th scope="col">Ten tydzień</th>
              <th scope="col">Czeka na Ciebie</th>
              <th scope="col">
                <span className="sr-only">Akcje</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const pct = s.weekTotal ? Math.round((s.weekApproved / s.weekTotal) * 100) : 0;
              return (
                <tr key={s.supervisor.id}>
                  <th scope="row">
                    <span className="person-cell">
                      <PositionMark employee={s.supervisor} />
                      {s.supervisor.name}
                    </span>
                  </th>
                  <td>
                    <span className="project-list">
                      {s.projectIds.map((id) => {
                        const p = model.projectById.get(id)!;
                        return (
                          <span key={id} className="project-tag">
                            <ProjectDot color={p.color} />
                            {p.name}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td>
                    {s.pending > 0 ? (
                      <span className="count-cell">
                        <strong>{s.pending}</strong>
                        <span>{formatHoursTotal(s.pendingMinutes)}</span>
                      </span>
                    ) : (
                      <span className="muted">Wszystko zatwierdzone</span>
                    )}
                  </td>
                  <td>{s.overdue > 0 ? <span className="badge badge--absent">{s.overdue}</span> : <span className="muted">—</span>}</td>
                  <td>
                    <div className="progress" aria-label={`Zatwierdzono ${pct}% wpisów z tego tygodnia`}>
                      <span className="progress__bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="progress__label">
                        {s.weekApproved}/{s.weekTotal}
                      </span>
                    </div>
                  </td>
                  <td>
                    {s.awaitingFinal > 0 ? (
                      <span className="count-cell">
                        <strong>{s.awaitingFinal}</strong>
                        <span>{formatHoursTotal(s.awaitingFinalMinutes)}</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="cell-action">
                    {s.awaitingFinal > 0 && (
                      <Link to={`/zatwierdzanie?sv=${s.supervisor.id}`} className="btn btn--secondary btn--sm">
                        Przejrzyj i zatwierdź
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty empty--inline">Brak supervisorów w Twoich projektach.</p>}
      </div>
    </div>
  );
}

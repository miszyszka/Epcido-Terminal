import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useModel, useUser } from "../../app/DataContext";
import { useNow, useQueue } from "../../app/hooks";
import { MissedMark } from "../../components/DayCell";
import { DeadlineBanner } from "../../components/DeadlineBanner";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { visibleProjects } from "../../domain/permissions";
import { supervisorStats, timesheetsNom } from "../../domain/workflow";

/** Pulpit Installation Managera (i administratora): supervisorzy i to, co jeszcze muszą zatwierdzić. */
export function DashboardView() {
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const queue = useQueue();

  const stats = useMemo(() => {
    const projects = visibleProjects(model, user);
    const svIds = [...new Set(projects.map((p) => p.supervisorId).filter((id): id is string => Boolean(id)))];
    return svIds
      .map((id) => model.employeeById.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((sv) => supervisorStats(model, sv, now))
      .sort((a, b) => b.pending - a.pending || b.missed - a.missed || a.supervisor.name.localeCompare(b.supervisor.name, "pl", { numeric: true }));
  }, [model, user, now]);

  return (
    <div className="page">
      <PageHeader title="Pulpit" />
      {queue.summary && <DeadlineBanner summary={queue.summary} isAdmin={user.role === "ADMIN"} />}

      <div className="table-card">
        <table className="table table--dash">
          <thead>
            <tr>
              <th scope="col">Supervisor</th>
              <th scope="col">Projekty</th>
              <th scope="col">Supervisor ma do zatwierdzenia</th>
              <th scope="col">Ten tydzień</th>
              <th scope="col">Czeka na Ciebie</th>
              <th scope="col">Nie wysłane</th>
              <th scope="col">
                <span className="sr-only">Akcje</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
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
                      <span className="count-cell count-cell--pending">{timesheetsNom(s.pending)}</span>
                    ) : (
                      <span className="muted">Wszystko zatwierdzone</span>
                    )}
                  </td>
                  <td>
                    <div className="progress" aria-label={`Zatwierdzono ${pct}% dni z tego tygodnia`}>
                      <span className="progress__bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="progress__label">{pct}%</span>
                    </div>
                  </td>
                  <td>{s.awaitingFinal > 0 ? <span className="count-cell">{timesheetsNom(s.awaitingFinal)}</span> : <span className="muted">—</span>}</td>
                  <td>
                    {s.missed > 0 ? (
                      <span className="badge badge--missed" data-tip="Nie zatwierdzone do poniedziałku 23:59. Zatwierdzić może tylko administrator.">
                        <MissedMark size={10} />
                        {s.missed}
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
        {stats.length === 0 && <p className="empty empty--inline">Brak supervisorów w Twoich projektach.</p>}
      </div>
    </div>
  );
}

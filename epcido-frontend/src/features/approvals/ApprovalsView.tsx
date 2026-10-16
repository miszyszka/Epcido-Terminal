import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useNow, useQueue } from "../../app/hooks";
import { useUi } from "../../app/UiContext";
import { DayCard, MissedMark } from "../../components/DayCell";
import { DeadlineBanner } from "../../components/DeadlineBanner";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import {
  approvalNote,
  dayView,
  deadlineSummary,
  editRight,
  missedInScope,
  timesheetsGen,
  timesheetsNom,
  type QueueItem,
} from "../../domain/workflow";
import { addDays, eachDay, formatDate, isoWeek, parseISO, WEEKDAYS_SHORT, type ISODate } from "../../lib/dates";

/**
 * Zatwierdzanie godzin — supervisor (zespół), Installation Manager (po supervisorach), administrator (wszystko, także po terminie).
 * Jeden wiersz = jeden timesheet (tydzień osoby w projekcie). Kliknięcie dnia otwiera jego edycję.
 */
export function ApprovalsView() {
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const queue = useQueue();
  const [params, setParams] = useSearchParams();
  const svFilter = params.get("sv");

  const items = useMemo(
    () =>
      queue.items.filter((it) => {
        if (!svFilter) return true;
        return model.projectById.get(it.projectId)?.supervisorId === svFilter;
      }),
    [queue.items, model, svFilter]
  );
  const summary = useMemo(() => deadlineSummary(items, now), [items, now]);
  const groups = useMemo(() => group(items), [items]);
  const svName = svFilter ? model.employeeById.get(svFilter)?.name : null;
  const isAdmin = user.role === "ADMIN";
  const missedHere = isAdmin ? 0 : missedInScope(model, user, now);

  return (
    <div className="page">
      <PageHeader title="Zatwierdzanie godzin" />
      <DeadlineBanner summary={summary} isAdmin={isAdmin} />

      {missedHere > 0 && (
        <p className="missed-note">
          <MissedMark size={12} />
          W Twoich projektach nie zatwierdzono na czas {timesheetsGen(missedHere)} — nie poszły do Dataverse. Zatwierdzić je może
          już tylko administrator.
        </p>
      )}

      {svName && (
        <div className="map-bar">
          <button
            type="button"
            className="chip chip--filter"
            onClick={() => {
              params.delete("sv");
              setParams(params);
            }}
          >
            Tylko projekty: {svName}
            <span className="chip__x" aria-hidden>
              ×
            </span>
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty empty--done">
          <p>
            <strong>Nic nie czeka na Ciebie.</strong> Nowe godziny pojawią się tutaj, gdy zespół je wpisze.
          </p>
        </div>
      ) : (
        <div className="pcards">
          {groups.map((g) => {
            const project = model.projectById.get(g.projectId)!;
            const sv = project.supervisorId ? model.employeeById.get(project.supervisorId) : null;
            const sheets = g.weeks.reduce((n, w) => n + w.people.length, 0);
            return (
              <article key={g.projectId} className="pcard">
                <header className="pcard__head">
                  <div className="pcard__id">
                    <span className="pcard__title is-static">
                      <ProjectDot color={project.color} />
                      <span>{project.name}</span>
                    </span>
                    <span className="pcard__number">{project.number}</span>
                  </div>
                  <div className="pcard__meta">
                    {sv && (
                      <span className="pcard__lead">
                        <PositionMark employee={sv} />
                        {sv.name}
                      </span>
                    )}
                  </div>
                  <div className="pcard__stats">
                    <span className="badge badge--pending">{timesheetsNom(sheets)} do zatwierdzenia</span>
                  </div>
                </header>
                {g.weeks.map((w) => (
                  <WeekBlock key={w.week} projectId={g.projectId} week={w.week} people={w.people} />
                ))}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekBlock({ projectId, week, people }: { projectId: string; week: ISODate; people: { employeeId: string; items: QueueItem[] }[] }) {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const now = useNow();
  const { openEntry } = useUi();
  const days = eachDay(week, addDays(week, 6));
  const locked = people.some((p) => p.items.some((i) => i.locked));
  return (
    <section className="week-block">
      <div className="week-block__head">
        <strong>
          tydz. {isoWeek(week).week} <span>· {formatDate(week).replace(/ \d{4}$/, "")} – {formatDate(addDays(week, 6))}</span>
        </strong>
        {locked && (
          <span className="badge badge--missed">
            <MissedMark size={10} />
            Po terminie · nie wysłane do Dataverse
          </span>
        )}
      </div>
      <div className="pcard__scroll">
        <table className="days days--detailed days--approve">
          <thead>
            <tr className="days__numbers">
              <th className="days__corner" scope="col">
                <span className="sr-only">Osoba</span>
              </th>
              {days.map((d, i) => (
                <th key={d} scope="col" className={i >= 5 ? "is-weekend" : ""}>
                  <span className="days__dow">{WEEKDAYS_SHORT[i]}</span>
                  <b>{parseISO(d).getDate()}</b>
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Zatwierdź</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map(({ employeeId, items }) => {
              const e = model.employeeById.get(employeeId);
              return (
                <tr key={employeeId}>
                  <th scope="row" className="days__person">
                    {e && <PositionMark employee={e} />}
                    <span className="days__name">{e?.name ?? employeeId}</span>
                  </th>
                  {days.map((d, i) => {
                    const entry = model.entry(projectId, employeeId, d);
                    const v = dayView(entry, d, now);
                    const right = editRight(model, user, projectId, employeeId, d, entry, now);
                    const open = entry || right.can ? () => openEntry({ projectId, employeeId, date: d }) : undefined;
                    return (
                      <td key={d} className={i >= 5 ? "is-weekend" : ""}>
                        <DayCard
                          entry={entry}
                          state={v.state}
                          sent={v.sent}
                          onClick={open}
                          tip={entry ? approvalNote(model, employeeId, d, entry, now) : undefined}
                          label={`${e?.name}, ${formatDate(d)}`}
                        />
                      </td>
                    );
                  })}
                  <td className="days__actions">
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => data.approve(items)}>
                      <Check size={16} aria-hidden />
                      Zatwierdź
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function group(items: QueueItem[]) {
  const projects = new Map<string, Map<ISODate, Map<string, QueueItem[]>>>();
  for (const it of items) {
    const weeks = projects.get(it.projectId) ?? new Map();
    const people = weeks.get(it.week) ?? new Map();
    people.set(it.employeeId, [...(people.get(it.employeeId) ?? []), it]);
    weeks.set(it.week, people);
    projects.set(it.projectId, weeks);
  }
  return [...projects.entries()].map(([projectId, weeks]) => ({
    projectId,
    weeks: [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, people]) => ({
        week,
        people: [...people.entries()]
          .map(([employeeId, list]) => ({ employeeId, items: list }))
          .sort((a, b) => a.employeeId.localeCompare(b.employeeId, "pl", { numeric: true })),
      })),
  }));
}

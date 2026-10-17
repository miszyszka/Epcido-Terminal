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
import { cellView, expectedDays, problemSummary, sheetsFor, WITHHELD_MESSAGE, type SheetInfo } from "../../domain/timesheets";
import {
  approvalNote,
  deadlineSummary,
  editRight,
  timesheetsNom,
  withheldInScope,
  type QueueItem,
} from "../../domain/workflow";
import { addDays, eachDay, formatDate, formatDay, isoWeek, parseISO, toISO, WEEKDAYS_SHORT, type ISODate } from "../../lib/dates";

/**
 * Zatwierdzanie godzin — supervisor (zespół), Installation Manager (po supervisorach), administrator (wszystko).
 * Timesheet = projekt × tydzień. W timesheecie zatwierdza się osoby (wiersze) albo pojedyncze dni (okno dnia).
 * Administrator poprawia też wstrzymane timesheety (zamknięte z błędami).
 */
export function ApprovalsView() {
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const queue = useQueue();
  const [params, setParams] = useSearchParams();
  const svFilter = params.get("sv");
  const isAdmin = user.role === "ADMIN";

  const items = useMemo(
    () => queue.items.filter((it) => !it.locked && (!svFilter || model.projectById.get(it.projectId)?.supervisorId === svFilter)),
    [queue.items, svFilter, model]
  );
  const withheld = useMemo(
    () => withheldInScope(model, user, now).filter((s) => !svFilter || model.projectById.get(s.projectId)?.supervisorId === svFilter),
    [model, user, now, svFilter]
  );
  const summary = useMemo(() => deadlineSummary(items, now, withheld.length), [items, now, withheld.length]);
  const groups = useMemo(
    () => group(items, (id) => POSITION_ORDER.indexOf(model.employeeById.get(id)?.position ?? "MECHANIC")),
    [items, model]
  );
  const svName = svFilter ? model.employeeById.get(svFilter)?.name : null;

  return (
    <div className="page">
      <PageHeader title="Zatwierdzanie godzin" />
      <DeadlineBanner summary={summary} isAdmin={isAdmin} />

      {!isAdmin && withheld.length > 0 && (
        <section className="withheld-note" aria-label="Timesheety nie wysłane">
          <MissedMark size={12} />
          <div>
            <strong>
              {withheld.length === 1 ? "1 timesheet nie został wysłany" : `${timesheetsNom(withheld.length)} nie zostało wysłanych`} do Dataverse.
            </strong>
            <ul>
              {withheld.map((s) => (
                <li key={`${s.projectId}-${s.week}`}>
                  {model.projectById.get(s.projectId)?.name} · tydz. {isoWeek(s.week).week}: {problemSummary(s)}
                </li>
              ))}
            </ul>
            <p>{WITHHELD_MESSAGE}</p>
          </div>
        </section>
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

      {isAdmin && withheld.length > 0 && (
        <section className="withheld-list" aria-label="Wstrzymane timesheety">
          <h2 className="section-title">Wstrzymane timesheety</h2>
          <p className="section-lead">
            Zamknięte z błędami — nic z nich nie poszło do Dataverse. Uzupełnij brakujące dni i zatwierdź; kompletny timesheet pójdzie we wtorek.
          </p>
          <div className="pcards">
            {withheld.map((s) => (
              <WithheldSheet key={`${s.projectId}-${s.week}`} sheet={s} queue={queue.items} />
            ))}
          </div>
        </section>
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
                    <span className="badge badge--pending">{timesheetsNom(g.weeks.length)} do zatwierdzenia</span>
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

/** Jeden timesheet (projekt × tydzień): osoby w wierszach, dni w kolumnach. */
function WeekBlock({ projectId, week, people }: { projectId: string; week: ISODate; people: { employeeId: string; items: QueueItem[] }[] }) {
  const model = useModel();
  const now = useNow();
  const project = model.projectById.get(projectId)!;
  const today = toISO(now);
  // Braki wpisów do wczoraj — supervisor widzi, kogo upomnieć, zanim minie termin
  const missing = useMemo(() => {
    const out: { name: string; dates: ISODate[] }[] = [];
    const people = new Set<string>([project.supervisorId ?? "", ...(model.assignmentsByProject.get(projectId) ?? []).map((a) => a.employeeId)]);
    for (const id of people) {
      if (!id) continue;
      const dates = expectedDays(model, project, id, week).filter((d) => d < today && !model.entry(projectId, id, d));
      if (dates.length) out.push({ name: model.employeeById.get(id)?.name ?? id, dates });
    }
    return out;
  }, [model, project, projectId, week, today]);

  return (
    <section className="week-block">
      <div className="week-block__head">
        <strong>
          Timesheet · tydz. {isoWeek(week).week} <span>· {formatDate(week).replace(/ \d{4}$/, "")} – {formatDate(addDays(week, 6))}</span>
        </strong>
        {missing.length > 0 && (
          <span className="week-block__missing">
            Brak wpisu: {missing.map((m) => `${m.name} (${m.dates.map((d) => formatDay(d).split(", ")[0]).join(", ")})`).join(" · ")}
          </span>
        )}
      </div>
      <PeopleDays projectId={projectId} week={week} rows={people} />
    </section>
  );
}

/** Wstrzymany timesheet dla administratora: tylko osoby z błędami, kliknięcie dnia otwiera poprawkę. */
function WithheldSheet({ sheet, queue }: { sheet: SheetInfo; queue: QueueItem[] }) {
  const model = useModel();
  const project = model.projectById.get(sheet.projectId)!;
  const ids = [...new Set(sheet.problems.map((p) => p.employeeId))];
  const rows = ids.map((employeeId) => ({
    employeeId,
    items: queue.filter((q) => q.projectId === sheet.projectId && q.employeeId === employeeId && q.week === sheet.week),
  }));
  return (
    <article className="pcard pcard--withheld">
      <header className="pcard__head">
        <div className="pcard__id">
          <span className="pcard__title is-static">
            <ProjectDot color={project.color} />
            <span>{project.name}</span>
          </span>
          <span className="pcard__number">tydz. {isoWeek(sheet.week).week}</span>
        </div>
        <div className="pcard__stats">
          <span className="badge badge--missed">
            <MissedMark size={10} />
            Nie wysłany · {problemSummary(sheet)}
          </span>
        </div>
      </header>
      <PeopleDays projectId={sheet.projectId} week={sheet.week} rows={rows} />
    </article>
  );
}

function PeopleDays({ projectId, week, rows }: { projectId: string; week: ISODate; rows: { employeeId: string; items: QueueItem[] }[] }) {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const now = useNow();
  const { openEntry } = useUi();
  const sheets = sheetsFor(model, now);
  const days = eachDay(week, addDays(week, 6));
  return (
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
          {rows.map(({ employeeId, items }) => {
            const e = model.employeeById.get(employeeId);
            return (
              <tr key={employeeId}>
                <th scope="row" className="days__person">
                  {e && <PositionMark employee={e} />}
                  <span className="days__name">{e?.name ?? employeeId}</span>
                </th>
                {days.map((d, i) => {
                  const entry = model.entry(projectId, employeeId, d);
                  const v = cellView(sheets, projectId, employeeId, d, entry);
                  const right = editRight(model, user, projectId, employeeId, d, entry, now);
                  const open = entry || right.can || v.missing ? () => openEntry({ projectId, employeeId, date: d }) : undefined;
                  return (
                    <td key={d} className={i >= 5 ? "is-weekend" : ""}>
                      <DayCard
                        entry={entry}
                        state={v.state}
                        sent={v.sent}
                        closed={v.closed}
                        missing={v.missing}
                        onClick={open}
                        tip={entry || v.missing ? approvalNote(model, projectId, employeeId, d, entry, now) : undefined}
                        label={`${e?.name}, ${formatDate(d)}`}
                      />
                    </td>
                  );
                })}
                <td className="days__actions">
                  {items.length > 0 && (
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => data.approve(items)}>
                      <Check size={16} aria-hidden />
                      Zatwierdź
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const POSITION_ORDER = ["SUPERVISOR", "TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

function group(items: QueueItem[], rank: (employeeId: string) => number) {
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
          .sort((a, b) => rank(a.employeeId) - rank(b.employeeId) || a.employeeId.localeCompare(b.employeeId, "pl", { numeric: true })),
      })),
  }));
}

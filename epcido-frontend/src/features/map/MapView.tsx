import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useModel, type Model } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DayCell } from "../../components/DayCell";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { WeekNav } from "../../components/WeekNav";
import { describeProjectDay, projectDay, teamPeopleIds } from "../../domain/aggregate";
import { dayStateOf, PROJECT_STATUS_LABEL } from "../../domain/labels";
import type { Project } from "../../domain/types";
import {
  addDays,
  formatDate,
  formatDay,
  MONTHS_SHORT,
  parseISO,
  startOfWeek,
  todayISO,
  WEEKDAYS_SHORT,
  type ISODate,
} from "../../lib/dates";
import { cityOf, searchProjects } from "../../lib/search";
import { absences, people as peopleCount } from "../../lib/text";

const WEEKS = 12;
const WEEKS_BACK = 9;

/** Mapa wszystkich projektów: każdy projekt jako siatka 7 dni × 12 tygodni. */
export function MapView() {
  const model = useModel();
  const { search } = useUi();
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const from = addDays(currentWeek, (offset - WEEKS_BACK) * 7);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from]);

  const matches = searchProjects(model, search);
  const summary = useMemo(() => summarize(model, today, currentWeek), [model, today, currentWeek]);
  const active = model.projects.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="page">
      <PageHeader
        title="Plan projektów"
        description={`Projekty w realizacji: ${active}. W zespołach: ${peopleCount(summary.people)}. Kliknij siatkę projektu, żeby zobaczyć dni każdej osoby.`}
        actions={
          <WeekNav
            from={from}
            weeks={WEEKS}
            onShift={(d) => setOffset((o) => o + d)}
            onToday={() => setOffset(0)}
            isCurrent={offset === 0}
          />
        }
      />

      <div className="map-bar">
        <Legend />
        <div className="map-bar__attention">
          {summary.pending > 0 ? (
            <p className="attn">
              <DayCell state="pending" size="mini" label="Czeka na zatwierdzenie" />
              <span>
                Czeka na zatwierdzenie: <strong>{summary.pending}</strong> dni pracy
                {summary.overdue > 0 && (
                  <>
                    , w tym <strong>{summary.overdue}</strong> sprzed tego tygodnia
                  </>
                )}
              </span>
            </p>
          ) : (
            <p className="attn">Wszystkie wpisane dni są zatwierdzone.</p>
          )}
          {summary.absentToday > 0 && (
            <p className="attn">
              <DayCell state="absent" size="mini" label="Nieobecni dziś" />
              <span>
                Dziś nieobecnych: <strong>{summary.absentToday}</strong>
              </span>
            </p>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty">
          <p>Żaden projekt ani osoba nie pasuje do „{search}".</p>
        </div>
      ) : (
        <div className="tiles">
          {matches.map(({ project }) => (
            <ProjectTile key={project.id} project={project} weeks={weeks} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectTile({ project, weeks, today }: { project: Project; weeks: ISODate[]; today: ISODate }) {
  const model = useModel();
  const { openProject } = useUi();
  const team = model.team(project.id)!;

  const { cells, pending, absent } = useMemo(() => {
    const people = teamPeopleIds(model.team(project.id)!);
    let pending = 0;
    let absent = 0;
    const cells: { date: ISODate; week: number; day: ReturnType<typeof projectDay> }[] = [];
    for (let d = 0; d < 7; d++) {
      weeks.forEach((weekStart, w) => {
        const date = addDays(weekStart, d);
        const day = projectDay(model, project.id, people, date);
        pending += day.pending;
        absent += day.absent;
        cells.push({ date, week: w, day });
      });
    }
    return { cells, pending, absent };
  }, [model, project.id, weeks]);

  const headcount = team.members.length + (team.supervisor ? 1 : 0);
  const planned = project.status === "PLANNED";

  return (
    <article className="tile">
      <header className="tile__head">
        <button type="button" className="tile__title" onClick={() => openProject(project.id)}>
          <ProjectDot color={project.color} />
          <span>{project.name}</span>
        </button>
        <span className="tile__number">{project.number}</span>
      </header>
      <p className="tile__meta">
        {project.customerName}, {cityOf(project)}
      </p>
      <p className="tile__lead">
        {team.supervisor ? (
          <>
            <PositionMark employee={team.supervisor} />
            {team.supervisor.name}
          </>
        ) : (
          <span className="muted">Bez supervisora</span>
        )}
      </p>

      <Link
        to={`/os-czasu?projekt=${project.id}`}
        className="matrix"
        aria-label={`${project.name}: otwórz dni zespołu na osi czasu`}
        style={{ gridTemplateColumns: `22px repeat(${weeks.length}, var(--cell-map))` }}
      >
        <span className="matrix__corner" />
        {monthLabels(weeks).map((label, i) => (
          <span key={weeks[i]} className="matrix__month">
            {label}
          </span>
        ))}
        {WEEKDAYS_SHORT.map((label, row) => (
          <Row key={label} label={label} row={row} cells={cells} today={today} project={project} />
        ))}
      </Link>

      <footer className="tile__foot">
        {planned ? (
          <span>
            {PROJECT_STATUS_LABEL.PLANNED}, start {formatDate(project.startDate)}
          </span>
        ) : (
          <>
            <span>{peopleCount(headcount)}</span>
            {pending > 0 && <span className="badge badge--pending">{pending} czeka</span>}
            {absent > 0 && <span className="badge badge--absent">{absences(absent)}</span>}
          </>
        )}
      </footer>
    </article>
  );
}

function Row({
  label,
  row,
  cells,
  today,
  project,
}: {
  label: string;
  row: number;
  cells: { date: ISODate; week: number; day: ReturnType<typeof projectDay> }[];
  today: ISODate;
  project: Project;
}) {
  const rowCells = cells.slice(row * (cells.length / 7), (row + 1) * (cells.length / 7));
  return (
    <>
      <span className="matrix__dow">{row % 2 === 0 ? label : ""}</span>
      {rowCells.map(({ date, week, day }) => (
        <DayCell
          key={date}
          state={day.state}
          flag={day.hasAbsence}
          today={date === today}
          future={date > today}
          label={`${project.name}, ${formatDay(date)}\n${describeProjectDay(day)}`}
          style={{ "--i": week } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/** Nazwa miesiąca nad tygodniem, w którym zaczyna się miesiąc (i nad pierwszą kolumną). */
function monthLabels(weeks: ISODate[]): string[] {
  const startsMonth = weeks.map((w) => {
    const mon = parseISO(w);
    const sun = parseISO(addDays(w, 6));
    if (mon.getDate() === 1) return MONTHS_SHORT[mon.getMonth()];
    return sun.getMonth() !== mon.getMonth() ? MONTHS_SHORT[sun.getMonth()] : "";
  });
  if (!startsMonth[0] && !startsMonth[1]) startsMonth[0] = MONTHS_SHORT[parseISO(weeks[0]).getMonth()];
  return startsMonth;
}

function summarize(model: Model, today: ISODate, currentWeek: ISODate) {
  let pending = 0;
  let overdue = 0;
  let absentToday = 0;
  for (const [, perPerson] of model.entries) {
    for (const [, days] of perPerson) {
      for (const [date, entry] of days) {
        const s = dayStateOf(entry);
        if (s === "pending") {
          pending++;
          if (date < currentWeek) overdue++;
        } else if (s === "absent" && date === today) absentToday++;
      }
    }
  }
  return { pending, overdue, absentToday, people: model.assignmentByEmployee.size };
}

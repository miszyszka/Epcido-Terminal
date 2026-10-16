import { useModel, type Row } from "../../app/DataContext";
import { DayCard, DayCell } from "../../components/DayCell";
import { PositionMark } from "../../components/PersonBadge";
import { dayStateOf, describeEntry } from "../../domain/labels";
import type { Project } from "../../domain/types";
import { formatDay, isWeekend, MONTHS_LONG, parseISO, weekdayIndex, WEEKDAYS_SHORT, type ISODate } from "../../lib/dates";

interface ProjectDaysProps {
  project: Project;
  rows: Row[];
  days: ISODate[];
  today: ISODate;
  variant: "compact" | "detailed";
}

/**
 * Siatka dni projektu: wiersze = ludzie, kolumny = dni.
 * Nagłówek: miesiąc, a pod nim numery dni. Weekendy na piaskowym tle.
 * Przerywana kreska między poniedziałkiem a wtorkiem = koniec edycji godzin poprzedniego tygodnia.
 */
export function ProjectDays({ project, rows, days, today, variant }: ProjectDaysProps) {
  const model = useModel();
  const months = monthSpans(days);
  const detailed = variant === "detailed";

  return (
    <table className={`days days--${variant}`}>
      <thead>
        <tr className="days__months">
          <th className="days__corner" rowSpan={2} scope="col">
            <span className="sr-only">Osoba</span>
          </th>
          {months.map((m) => (
            <th key={m.key} colSpan={m.span} scope="colgroup" className="days__month">
              <span>{m.label}</span>
            </th>
          ))}
        </tr>
        <tr className="days__numbers">
          {days.map((d) => (
            <th key={d} scope="col" className={colClass(d, today)}>
              {detailed && <span className="days__dow">{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>}
              <b>{parseISO(d).getDate()}</b>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <th scope="row" className="days__person">
              <span className="muted">Brak zespołu w tym okresie</span>
            </th>
            {days.map((d) => (
              <td key={d} className={colClass(d, today)} />
            ))}
          </tr>
        )}
        {rows.map(({ employee, periods }) => (
          <tr key={employee.id}>
            <th scope="row" className="days__person">
              <PositionMark employee={employee} />
              <span className="days__name">{employee.name}</span>
            </th>
            {days.map((d) => {
              const inPeriod = periods.some((p) => p.from <= d && (!p.to || p.to >= d)) && d >= project.startDate;
              const entry = model.entry(project.id, employee.id, d);
              const cls = colClass(d, today);
              if (!inPeriod && !entry) return <td key={d} className={`${cls} is-outside`} />;
              const future = d > today;
              const label = `${employee.name}, ${formatDay(d)}\n${future && !entry ? "Zaplanowany dzień pracy" : describeEntry(entry)}`;
              return (
                <td key={d} className={cls}>
                  {detailed ? (
                    <DayCard
                      entry={entry}
                      planned={future && inPeriod && !isWeekend(d)}
                      expected={!future && !isWeekend(d)}
                      label={label}
                    />
                  ) : (
                    <DayCell
                      state={dayStateOf(entry)}
                      sent={entry?.exported}
                      planned={future && inPeriod && !isWeekend(d)}
                      today={d === today}
                      label={label}
                    />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function colClass(d: ISODate, today: ISODate): string {
  const wd = weekdayIndex(d);
  return [
    isWeekend(d) ? "is-weekend" : "",
    d === today ? "is-today" : "",
    wd === 0 ? "is-cutoff" : "",
    wd === 6 ? "is-week-end" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function monthSpans(days: ISODate[]) {
  const spans: { key: string; label: string; span: number }[] = [];
  for (const d of days) {
    const dt = parseISO(d);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    const last = spans[spans.length - 1];
    if (last && last.key === key) last.span++;
    else spans.push({ key, label: `${MONTHS_LONG[dt.getMonth()]} ${dt.getFullYear()}`, span: 1 });
  }
  return spans.map((s) => ({ ...s, label: s.span < 4 ? s.label.slice(0, 3) : s.label }));
}


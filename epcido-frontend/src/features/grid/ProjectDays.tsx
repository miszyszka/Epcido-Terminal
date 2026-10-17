import { useModel, useUser, type Row } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { useUi } from "../../app/UiContext";
import { DayCard, DayCell } from "../../components/DayCell";
import { PositionMark } from "../../components/PersonBadge";
import type { Project } from "../../domain/types";
import { cellView, sheetsFor } from "../../domain/timesheets";
import { approvalNote, describeHours, editRight } from "../../domain/workflow";
import { formatDay, isWeekend, MONTHS_LONG, parseISO, weekdayIndex, WEEKDAYS_SHORT, type ISODate } from "../../lib/dates";

interface ProjectDaysProps {
  project: Project;
  rows: Row[];
  days: ISODate[];
  today: ISODate;
  variant: "compact" | "detailed";
  /** Bez nagłówka — wspólny nagłówek dni jest przyklejony u góry strony (mapa) */
  hideHead?: boolean;
}

/**
 * Siatka dni projektu: wiersze = ludzie, kolumny = dni.
 * Nagłówek: miesiąc, a pod nim numery dni. Weekendy na piaskowym tle.
 * Przerywana kreska między poniedziałkiem a wtorkiem = koniec zatwierdzania poprzedniego tygodnia.
 * Zakreskowane pole między zadaniami osoby = przerwa (np. wyjazd do domu) — wtedy nie ma wpisu godzin.
 */
export function ProjectDays({ project, rows, days, today, variant, hideHead }: ProjectDaysProps) {
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const { openEntry } = useUi();
  const detailed = variant === "detailed";
  const sheets = sheetsFor(model, now);

  return (
    <table
      className={`days days--${variant} ${hideHead ? "days--fixed" : ""}`}
      style={hideHead ? { width: `calc(var(--name-col) + ${days.length} * var(--col-map))` } : undefined}
    >
      {hideHead ? <DaysColgroup days={days} /> : <DaysHead days={days} today={today} detailed={detailed} />}
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
        {rows.map(({ employee, periods }) => {
          const first = periods.reduce((m, p) => (p.from < m ? p.from : m), periods[0]?.from ?? "9999-12-31");
          const last = periods.reduce((m, p) => ((p.to ?? "9999-12-31") > m ? p.to ?? "9999-12-31" : m), "0000-01-01");
          return (
            <tr key={employee.id}>
              <th scope="row" className="days__person">
                <PositionMark employee={employee} />
                <span className="days__name">{employee.name}</span>
              </th>
              {days.map((d) => {
                const inPeriod = periods.some((p) => p.from <= d && (!p.to || p.to >= d)) && d >= project.startDate;
                const entry = model.entry(project.id, employee.id, d);
                const cls = colClass(d, today);
                if (!inPeriod && !entry) {
                  const onBreak = d > first && d < last;
                  return <td key={d} className={`${cls} ${onBreak ? "is-break" : "is-outside"}`} data-tip={onBreak ? "Przerwa — bez zadania" : undefined} />;
                }
                const future = d > today;
                const v = cellView(sheets, project.id, employee.id, d, entry);
                const planned = future && inPeriod && !isWeekend(d);
                if (!detailed) {
                  const note = approvalNote(model, project.id, employee.id, d, entry, now);
                  const label = `${employee.name}, ${formatDay(d)}\n${
                    planned && !entry ? "Zaplanowany dzień pracy" : entry ? `${describeHours(entry)}\n${note}` : note
                  }`;
                  return (
                    <td key={d} className={cls}>
                      <DayCell state={v.state} sent={v.sent} closed={v.closed} planned={planned} today={d === today} label={label} />
                    </td>
                  );
                }
                const right = editRight(model, user, project.id, employee.id, d, entry, now);
                const clickable = (entry && (right.can || right.reason)) || (!entry && right.can && right.asApprover) || v.missing;
                return (
                  <td key={d} className={cls}>
                    <DayCard
                      entry={entry}
                      state={v.state}
                      sent={v.sent}
                      closed={v.closed}
                      missing={v.missing}
                      planned={planned}
                      expected={!future && !isWeekend(d)}
                      onClick={clickable ? () => openEntry({ projectId: project.id, employeeId: employee.id, date: d }) : undefined}
                      tip={entry || v.missing ? approvalNote(model, project.id, employee.id, d, entry, now) : undefined}
                      label={`${employee.name}, ${formatDay(d)}: ${describeHours(entry)}`}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Nagłówek siatki dni: miesiące, pod nimi numery dni (i skróty dni tygodnia w widoku szczegółowym). */
export function DaysHead({ days, today, detailed }: { days: ISODate[]; today: ISODate; detailed?: boolean }) {
  const months = monthSpans(days);
  return (
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
  );
}

/** Szerokości kolumn, gdy tabela nie ma własnego nagłówka. */
function DaysColgroup({ days }: { days: ISODate[] }) {
  return (
    <colgroup>
      <col className="days__col-person" />
      {days.map((d) => (
        <col key={d} />
      ))}
    </colgroup>
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

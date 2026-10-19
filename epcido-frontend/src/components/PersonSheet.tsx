import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Coffee, Mail, MapPin, Plane, X } from "lucide-react";
import { useData, useModel } from "../app/DataContext";
import { useNow } from "../app/hooks";
import { useUi } from "../app/UiContext";
import { categories, formatDuration, formatHoursTotal, formatMonths, POSITION_LABEL, TRADE_LABEL, workedMinutes } from "../domain/labels";
import { assignmentEnd, availableFrom, experienceIn, leavesBetween, outlookOf, workChains } from "../domain/staffing";
import { cellView, sheetsFor } from "../domain/timesheets";
import type { DayEntry, Employee } from "../domain/types";
import { approvalNote, describeHours, isComplete, leaveNote, statusText } from "../domain/workflow";
import { addDays, daysBetween, eachDay, formatDate, formatDay, isoWeek, startOfWeek, todayISO, toISO, type ISODate } from "../lib/dates";
import { DayCell } from "./DayCell";
import { EmploymentTag, PositionMark, ProjectDot } from "./PersonBadge";

/** Szerokość kolumny tygodnia w pasku „gdzie jest" (px). */
const COL = 54;
const PX_DAY = COL / 7;
/** Ile tygodni naprzód pokazuje pasek. */
const WEEKS = 12;
/** Ile tygodni wstecz liczymy godziny. */
const HOURS_WEEKS = 4;

/** Host podglądu osoby — montowany raz, na poziomie aplikacji. */
export function PersonSheetHost() {
  const { personId, closePerson } = useUi();
  const { model } = useData();
  if (!personId || !model) return null;
  const employee = model.employeeById.get(personId);
  if (!employee) return null;
  return <PersonSheet key={personId} employee={employee} onClose={closePerson} />;
}

/**
 * Lekkie okno osoby: gdzie jest teraz, kiedy kończy, kiedy ma przerwę i dokąd leci dalej —
 * w ujęciu tygodniowym — oraz jej godziny (zatwierdzone i nie) i dane.
 * Otwiera się kliknięciem w nazwisko w dowolnym widoku i nie zabiera z bieżącego ekranu.
 */
function PersonSheet({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const model = useModel();
  const now = useNow();
  const { openProject, openEntry } = useUi();
  const today = todayISO();
  const [tab, setTab] = useState<"plan" | "hours" | "data">("plan");

  const from = startOfWeek(today);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from]);
  const to = addDays(from, WEEKS * 7 - 1);
  const x = (d: ISODate) => daysBetween(from, d) * PX_DAY;

  const outlook = useMemo(() => outlookOf(model, employee, today), [model, employee, today]);
  const chains = useMemo(() => workChains(model, employee.id), [model, employee.id]);
  const bars = (model.assignmentsByEmployee.get(employee.id) ?? []).filter((a) => a.from <= to && assignmentEnd(model, a) >= from);
  const leaves = leavesBetween(model, employee.id, from, to);
  const free = availableFrom(model, employee, today);

  const hours = useMemo(() => summarize(model, employee, now), [model, employee, now]);

  return createPortal(
    <div className="psheet-root" role="dialog" aria-modal="true" aria-label={`Podgląd: ${employee.name}`}>
      <div className="psheet-backdrop" onClick={onClose} aria-hidden />
      <article className="psheet">
        <header className="psheet__head">
          <PositionMark employee={employee} />
          <div className="psheet__id">
            <h2>{employee.name}</h2>
            <p>
              {POSITION_LABEL[employee.position]}
              {employee.trade ? ` · ${TRADE_LABEL[employee.trade]}` : ""}
              {employee.employment ? " · " : ""}
              {employee.employment && <EmploymentTag employee={employee} />}
            </p>
          </div>
          <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Zamknij podgląd">
            <X size={18} />
          </button>
        </header>

        <p className="psheet__now">
          {outlook.currentProject ? (
            <>
              <MapPin size={15} aria-hidden />
              <span>
                Teraz: <b>{outlook.currentProject.name}</b>
                {outlook.current?.task ? ` · ${outlook.current.task}` : ""}
                {outlook.releaseDate ? ` · kończy ${formatDay(outlook.releaseDate)}` : outlook.chain?.to === "9999-12-31" ? " · do końca projektu" : ""}
              </span>
            </>
          ) : outlook.next ? (
            <>
              <Plane size={15} aria-hidden />
              <span>
                Bez przydziału · startuje <b>{formatDate(outlook.next.from)}</b> w projekcie{" "}
                {model.projectById.get(outlook.next.projectId)?.name ?? "—"}
              </span>
            </>
          ) : (
            <>
              <Coffee size={15} aria-hidden />
              <span>Bez przydziału{free <= today ? " — wolny od zaraz" : ` — wolny od ${formatDay(free)}`}</span>
            </>
          )}
        </p>

        <div className="psheet__tabs" role="tablist" aria-label="Zakładki podglądu">
          {(
            [
              ["plan", "Plan tygodniowy"],
              ["hours", `Godziny${hours.pendingDays ? ` · ${hours.pendingDays} do zatwierdzenia` : ""}`],
              ["data", "Dane i doświadczenie"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`psheet__tab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        <div className="psheet__body">
          {tab === "plan" && (
            <>
              <div className="psheet__scroll">
                <div className="ptl" style={{ width: WEEKS * COL }}>
                  <div className="ptl__head">
                    {weeks.map((w) => (
                      <span key={w} className={`ptl__week ${w === from ? "is-now" : ""}`} style={{ width: COL }}>
                        <b>{isoWeek(w).week}</b>
                      </span>
                    ))}
                  </div>
                  <div className="ptl__track">
                    {chains.slice(1).map((c, i) => {
                      const gapFrom = addDays(chains[i].to, 1);
                      const gapTo = addDays(c.from, -1);
                      if (gapTo < from || gapFrom > to) return null;
                      const a = gapFrom < from ? from : gapFrom;
                      const b = gapTo > to ? to : gapTo;
                      return (
                        <span
                          key={`gap-${c.from}`}
                          className="ptl__gap"
                          style={{ left: x(a), width: (daysBetween(a, b) + 1) * PX_DAY }}
                          data-tip={`Przerwa — wyjazd do domu\n${formatDate(gapFrom)} – ${formatDate(gapTo)}`}
                        >
                          <Coffee size={11} aria-hidden />
                        </span>
                      );
                    })}
                    {bars.map((a) => {
                      const p = model.projectById.get(a.projectId);
                      if (!p) return null;
                      const end = assignmentEnd(model, a);
                      const s = a.from < from ? from : a.from;
                      const e = end > to ? to : end;
                      const width = (daysBetween(s, e) + 1) * PX_DAY;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className="ptl__bar"
                          style={{ left: x(s), width, ["--project" as string]: p.color }}
                          data-tip={`${p.name} (${p.category})${a.task ? ` · ${a.task}` : ""}\n${formatDate(a.from)} – ${end.startsWith("9999") ? "bez końca" : formatDate(end)}\nKliknij, żeby otworzyć projekt`}
                          onClick={() => {
                            onClose();
                            openProject(p.id, "team", true);
                          }}
                        >
                          {width > 50 && <span>{width > 110 ? p.name : p.number}</span>}
                        </button>
                      );
                    })}
                    {leaves.map((l) => {
                      const a = l.from < from ? from : l.from;
                      const b = l.to > to ? to : l.to;
                      return (
                        <span
                          key={l.id}
                          className={`ptl__leave ptl__leave--${l.status === "PENDING" ? "pending" : l.type === "SICK" ? "sick" : "leave"}`}
                          style={{ left: x(a), width: Math.max(PX_DAY, (daysBetween(a, b) + 1) * PX_DAY) }}
                          data-tip={`${formatDate(l.from)} – ${formatDate(l.to)}\n${leaveNote(l)}`}
                        />
                      );
                    })}
                    <span className="ptl__today" style={{ left: x(today) + PX_DAY / 2 }} aria-hidden />
                  </div>
                </div>
              </div>

              <ol className="psheet__steps">
                {steps(model, employee, today).map((s) => (
                  <li key={s.key} className={`psheet__step psheet__step--${s.tone}`}>
                    <s.icon size={15} aria-hidden />
                    <span>
                      <b>{s.when}</b> {s.what}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {tab === "hours" && (
            <>
              <div className="psheet__stats">
                <Stat label="Przepracowane" value={formatHoursTotal(hours.minutes)} hint={`ostatnie ${HOURS_WEEKS} tygodnie`} />
                <Stat label="Zatwierdzone" value={`${hours.approvedDays} dni`} tone={hours.approvedDays ? "good" : undefined} />
                <Stat label="Do zatwierdzenia" value={`${hours.pendingDays} dni`} tone={hours.pendingDays ? "warn" : undefined} />
                <Stat label="Nieobecności" value={`${hours.absentDays} dni`} />
                {hours.missedDays > 0 && <Stat label="Nie wysłane" value={`${hours.missedDays} dni`} tone="bad" />}
              </div>
              <div className="psheet__weeks">
                {hours.weeks.map((w) => (
                  <div key={w.week} className="psheet__wrow">
                    <span className="psheet__wlabel">
                      tydz. {isoWeek(w.week).week}
                      <em>{formatDate(w.week).replace(/ \d{4}$/, "")}</em>
                    </span>
                    <span className="psheet__wdays">
                      {w.days.map((d) => (
                        <DayCell
                          key={d.date}
                          state={d.view.state}
                          size="mini"
                          sent={d.view.sent}
                          closed={d.view.closed}
                          today={d.date === today}
                          label={`${formatDay(d.date)}\n${describeHours(d.entry)}${d.projectId ? `\n${approvalNote(model, d.projectId, employee.id, d.date, d.entry, now)}` : ""}`}
                        />
                      ))}
                    </span>
                    <span className="psheet__wsum">{w.minutes ? formatDuration(w.minutes) : "—"}</span>
                  </div>
                ))}
              </div>
              {hours.open.length > 0 && (
                <div className="psheet__open">
                  <h3>Czeka na zatwierdzenie</h3>
                  <ul>
                    {hours.open.map((o) => {
                      const p = model.projectById.get(o.projectId);
                      return (
                        <li key={`${o.projectId}-${o.date}`}>
                          <button type="button" className="link-btn" onClick={() => openEntry({ projectId: o.projectId, employeeId: employee.id, date: o.date })}>
                            {p && <ProjectDot color={p.color} />}
                            {formatDay(o.date)} · {describeHours(o.entry)}
                          </button>
                          <em>{statusText(model, o.projectId, employee.id, o.date, o.entry, now)}</em>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === "data" && (
            <dl className="psheet__data">
              <Row label="Stanowisko" value={`${POSITION_LABEL[employee.position]}${employee.trade ? `, ${TRADE_LABEL[employee.trade]}` : ""}`} />
              <Row label="Forma zatrudnienia" value={employee.employment ? <EmploymentTag employee={employee} /> : "—"} />
              <Row label="Numer Enova" value={employee.enovaNumber ?? "—"} />
              <Row
                label="Konto"
                value={
                  employee.email ? (
                    <span className="psheet__mail">
                      <Mail size={14} aria-hidden />
                      {employee.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Doświadczenie łącznie" value={employee.experience ? formatMonths(employee.experience.totalMonths) : "—"} />
              {employee.experience && (
                <Row
                  label="W kategoriach"
                  value={
                    <span className="psheet__cats">
                      {categories()
                        .filter((c) => experienceIn(employee, c) > 0)
                        .sort((a, b) => experienceIn(employee, b) - experienceIn(employee, a))
                        .map((c) => (
                          <span key={c} className="psheet__cat">
                            {c} <b>{formatMonths(experienceIn(employee, c))}</b>
                          </span>
                        ))}
                      {categories().every((c) => experienceIn(employee, c) === 0) && "brak"}
                    </span>
                  }
                />
              )}
              <Row label="Projekty teraz" value={model.projectsOf(employee.id).map((p) => p.name).join(", ") || "bez zespołu"} />
              <Row label="Wolny od" value={free.startsWith("9999") ? "zajęty bez daty końca" : free <= today ? "od zaraz" : formatDate(free)} />
              <Row label="Status konta" value={employee.active === false ? "nieaktywne" : "aktywne"} />
            </dl>
          )}
        </div>
      </article>
    </div>,
    document.getElementById("epcido-overlay") ?? document.body
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`psheet__stat ${tone ? `is-${tone}` : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <em>{hint}</em>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** Kolejne kroki osoby: koniec zadania, przerwa, wyjazd na następny projekt. */
function steps(model: ReturnType<typeof useModel>, employee: Employee, today: ISODate) {
  const list = (model.assignmentsByEmployee.get(employee.id) ?? []).filter((a) => assignmentEnd(model, a) >= today).slice(0, 6);
  const out: { key: string; when: string; what: string; tone: "now" | "next" | "break"; icon: typeof MapPin }[] = [];
  list.forEach((a, i) => {
    const p = model.projectById.get(a.projectId);
    if (!p) return;
    const end = assignmentEnd(model, a);
    const current = a.from <= today;
    out.push({
      key: `a-${a.id}`,
      when: current ? "teraz" : formatDay(a.from),
      what: current
        ? `${p.name}${end.startsWith("9999") ? " — bez daty końca" : ` — do ${formatDay(end)}`}`
        : `start w ${p.name}${end.startsWith("9999") ? "" : `, do ${formatDay(end)}`}`,
      tone: current ? "now" : "next",
      icon: current ? MapPin : Plane,
    });
    const next = list[i + 1];
    if (next && daysBetween(end, next.from) > 1) {
      out.push({
        key: `g-${a.id}`,
        when: formatDay(addDays(end, 1)),
        what: `przerwa — wyjazd do domu na ${daysBetween(end, next.from) - 1} dni`,
        tone: "break",
        icon: Coffee,
      });
    }
  });
  if (out.length === 0) out.push({ key: "none", when: "teraz", what: "brak zaplanowanych zadań", tone: "break", icon: CalendarClock });
  return out;
}

/** Godziny osoby w ostatnich tygodniach: ile przepracowała, co zatwierdzone, co czeka. */
function summarize(model: ReturnType<typeof useModel>, employee: Employee, now: Date) {
  const today = toISO(now);
  const sheets = sheetsFor(model, now);
  const all = model.entriesOf(employee.id);
  const firstWeek = addDays(startOfWeek(today), -7 * (HOURS_WEEKS - 1));
  const weeks: { week: ISODate; minutes: number; days: { date: ISODate; entry: DayEntry | undefined; projectId: string | null; view: ReturnType<typeof cellView> }[] }[] = [];
  let minutes = 0;
  let approvedDays = 0;
  let pendingDays = 0;
  let absentDays = 0;
  let missedDays = 0;
  const open: { projectId: string; date: ISODate; entry: DayEntry }[] = [];

  for (let i = 0; i < HOURS_WEEKS; i++) {
    const week = addDays(firstWeek, i * 7);
    const days = eachDay(week, addDays(week, 6)).map((date) => {
      const rec = all.get(date);
      const entry = rec?.entry;
      const projectId = rec?.projectId ?? null;
      const view = projectId
        ? cellView(sheets, projectId, employee.id, date, entry)
        : { state: "off" as const, sent: false, closed: false, missing: false };
      if (entry) {
        minutes += workedMinutes(entry);
        if (entry.kind === "ABSENCE") absentDays++;
        else {
          const project = projectId ? model.projectById.get(projectId) : null;
          if (project && isComplete(project, employee.id, entry)) approvedDays++;
          else {
            pendingDays++;
            if (projectId) open.push({ projectId, date, entry });
          }
        }
        if (view.state === "missed") missedDays++;
      }
      return { date, entry, projectId, view };
    });
    weeks.push({ week, minutes: days.reduce((s, d) => s + workedMinutes(d.entry), 0), days });
  }
  return { weeks, minutes, approvedDays, pendingDays, absentDays, missedDays, open: open.slice(-8).reverse() };
}

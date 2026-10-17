import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Scissors, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DatePicker } from "../../components/DatePicker";
import { EmploymentTag, PositionMark } from "../../components/PersonBadge";
import type { DraftAssignment } from "../../data/commands";
import { defaultTask, TASK_SUGGESTIONS } from "../../domain/labels";
import { needOf } from "../../domain/staffing";
import type { DemandPhase, Employee, LeaveRequest } from "../../domain/types";
import { leaveNote } from "../../domain/workflow";
import {
  addDays,
  daysBetween,
  eachDay,
  formatDate,
  MONTHS_LONG,
  parseISO,
  startOfWeek,
  todayISO,
  weekdayIndex,
  type ISODate,
} from "../../lib/dates";
import { newId } from "../../lib/random";
import { daysCount } from "../../lib/text";

const DAY = 24;
/** Kolumna nazwisk: mieści pełne imię i nazwisko w dwóch liniach (tokens: --plan-name) */
const NAME_W = 300;
/** Oś sięga tyle tygodni za najdalej zaplanowane zadanie (≈ 3 miesiące). */
const AHEAD_WEEKS = 13;
const BREAK_LENGTHS = [7, 10, 14];

interface TeamTimelineProps {
  projectId: string | null;
  start: ISODate;
  end: ISODate | null;
  supervisorId: string | null;
  draft: DraftAssignment[];
  onChange: (next: DraftAssignment[]) => void;
  editable: boolean;
  onAssign: () => void;
  /** Zapotrzebowanie projektu (fazy) — wiersz z obsadą tydzień po tygodniu */
  demand?: DemandPhase[];
  /** Propozycja obsady (Planning) */
  onPropose?: () => void;
}

type DragMode = "move" | "start" | "end";

/**
 * Plan zespołu na poziomej osi czasu. Każdy kafelek = zadanie osoby w projekcie (od–do).
 * Osoba może mieć kilka zadań; luka między nimi to przerwa (np. wyjazd do domu) — wtedy nie wpisuje godzin.
 * Przeciągnij kafelek, żeby go przesunąć; chwyć za brzeg, żeby zmienić start lub koniec; kliknij, żeby edytować.
 * Kliknięcie w puste miejsce wiersza dodaje osobie kolejne zadanie. Oś sięga zawsze ~3 miesiące
 * za najdalej zaplanowane zadanie i rośnie razem z planem.
 */
export function TeamTimeline({ projectId, start, end, supervisorId, draft, onChange, editable, onAssign, demand = [], onPropose }: TeamTimelineProps) {
  const model = useModel();
  const { toast } = useUi();
  const today = todayISO();
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; mode: DragMode; x: number; from: ISODate; to: ISODate; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Początek osi ustalony przy otwarciu (stabilne przeciąganie), cofa się tylko, gdy start projektu jest wcześniej
  const [initialStart] = useState(() => {
    const earliest = draft.reduce((m, d) => (d.from < m ? d.from : m), start < today ? start : today);
    return addDays(startOfWeek(earliest), -7);
  });
  const rangeStart = start && addDays(startOfWeek(start), -7) < initialStart ? addDays(startOfWeek(start), -7) : initialStart;
  const latest = draft.reduce((m, d) => {
    const to = d.to ?? end ?? d.from;
    return to > m ? to : m;
  }, [end ?? start, today].sort()[1]);
  const rangeEnd = addDays(startOfWeek(latest), AHEAD_WEEKS * 7 + 6);
  const openEnd = end ?? rangeEnd;
  const days = useMemo(() => eachDay(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const x = (date: ISODate) => daysBetween(rangeStart, date) * DAY;

  // Po otwarciu: tydzień przed dziś (albo przed startem projektu, gdy jest w przyszłości)
  useLayoutEffect(() => {
    const anchor = start > today ? start : today;
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(addDays(startOfWeek(anchor), -7)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrollTo = (date: ISODate) =>
    scroller.current?.scrollTo({ left: Math.max(0, x(addDays(startOfWeek(date), -7))), behavior: "smooth" });

  const sections = useMemo(() => {
    const byEmployee = new Map<string, DraftAssignment[]>();
    for (const d of draft) byEmployee.set(d.employeeId, [...(byEmployee.get(d.employeeId) ?? []), d]);
    const rows = [...byEmployee.entries()]
      .map(([id, bars]) => ({ employee: model.employeeById.get(id), bars: [...bars].sort((a, b) => a.from.localeCompare(b.from)) }))
      .filter((r): r is { employee: Employee; bars: DraftAssignment[] } => Boolean(r.employee))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name, "pl", { numeric: true }));
    return [
      { label: "Team Leaderzy", rows: rows.filter((r) => r.employee.position === "TEAM_LEADER") },
      { label: "Elektrycy", rows: rows.filter((r) => r.employee.position === "ELECTRICIAN") },
      { label: "Mechanicy", rows: rows.filter((r) => r.employee.position === "MECHANIC") },
    ];
  }, [draft, model.employeeById]);

  const supervisor = supervisorId ? model.employeeById.get(supervisorId) : null;

  const span = (from: ISODate, to: ISODate) => {
    const a = from < rangeStart ? rangeStart : from;
    const b = to > rangeEnd ? rangeEnd : to;
    if (b < rangeStart || a > rangeEnd) return null;
    return { left: x(a), width: (daysBetween(a, b) + 1) * DAY, cutStart: from < rangeStart, cutEnd: to > rangeEnd };
  };

  const update = (key: string, patch: Partial<DraftAssignment>) => onChange(draft.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const onDown = (e: React.PointerEvent, bar: DraftAssignment, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editable) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { key: bar.key, mode, x: e.clientX, from: bar.from, to: bar.to ?? openEnd, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(d.key);
    }
    const delta = Math.round(dx / DAY);
    const clampStart = (v: ISODate) => (v < rangeStart ? rangeStart : v);
    if (d.mode === "move") {
      const from = clampStart(addDays(d.from, delta));
      update(d.key, { from, to: addDays(d.to, daysBetween(d.from, from)) });
    } else if (d.mode === "start") {
      const from = clampStart(addDays(d.from, delta));
      update(d.key, { from: from > d.to ? d.to : from });
    } else {
      const to = addDays(d.to, delta);
      update(d.key, { to: to < d.from ? d.from : to });
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (d && !d.moved && d.mode === "move") setSelected(d.key);
  };
  const nudge = (bar: DraftAssignment, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSelected(bar.key);
      return;
    }
    if (!editable) return;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = bar.to ?? openEnd;
    if (e.shiftKey) update(bar.key, { to: addDays(to, step) < bar.from ? bar.from : addDays(to, step) });
    else update(bar.key, { from: addDays(bar.from, step), to: addDays(to, step) });
  };

  /** Kliknięcie w puste miejsce wiersza: nowe zadanie od tego dnia (2 tygodnie albo do następnego zadania). */
  const addTaskAt = (e: React.MouseEvent<HTMLDivElement>, employee: Employee, bars: DraftAssignment[]) => {
    if (!editable || (e.target as Element).closest(".bar:not(.bar--ghost)")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let from = addDays(rangeStart, Math.floor((e.clientX - rect.left) / DAY));
    if (from < start) from = start;
    if (bars.some((b) => b.from <= from && (b.to ?? openEnd) >= from)) return;
    const next = bars.find((b) => b.from > from);
    let to = addDays(from, 13);
    if (next && to >= next.from) to = addDays(next.from, -1);
    if (end && to > end) to = end;
    if (to < from) return;
    const task = bars[bars.length - 1]?.task ?? defaultTask(employee.trade);
    const key = newId("draft");
    onChange([...draft, { key, employeeId: employee.id, from, to, task }]);
    setSelected(key);
  };

  const months = monthSpans(days);
  const weekendBg = `repeating-linear-gradient(90deg, transparent 0 ${5 * DAY}px, var(--sand-50) ${5 * DAY}px ${7 * DAY}px)`;
  const cutoffBg = `repeating-linear-gradient(90deg, transparent 0 ${DAY - 1}px, var(--cutoff) ${DAY - 1}px ${DAY + 0.5}px, transparent ${DAY + 0.5}px ${7 * DAY}px)`;
  const weekOffset = (weekdayIndex(rangeStart) * DAY) % (7 * DAY);
  const selectedBar = selected ? draft.find((d) => d.key === selected) : undefined;

  return (
    <div className="plan">
      <div className="plan__toolbar">
        <div className="plan__nav">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => scrollTo(start)}>
            Start projektu
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => scrollTo(today)}>
            Dziś
          </button>
          {end && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => scrollTo(addDays(end, -42))}>
              Koniec projektu
            </button>
          )}
          <span className="plan__range">
            Oś do {formatDate(rangeEnd)} · 3 miesiące za ostatnim zadaniem
          </span>
        </div>
        {editable && (
          <div className="plan__actions">
            {onPropose && (
              <button type="button" className="btn btn--secondary" onClick={onPropose}>
                <Sparkles size={17} aria-hidden />
                Zaproponuj obsadę
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={onAssign}>
              <UserPlus size={18} aria-hidden />
              Przypisz pracowników
            </button>
          </div>
        )}
      </div>

      {selectedBar && (
        <TaskPanel
          key={selectedBar.key}
          bar={selectedBar}
          employee={model.employeeById.get(selectedBar.employeeId)!}
          projectStart={start}
          projectEnd={end}
          editable={editable}
          onChange={(patch) => update(selectedBar.key, patch)}
          onSplit={(breakStart, length) => {
            const to = selectedBar.to ?? openEnd;
            if (breakStart <= selectedBar.from || breakStart > to) {
              toast("Przerwa musi zaczynać się w trakcie zadania.", "error");
              return;
            }
            const back = addDays(breakStart, length);
            const rest = back <= to || !selectedBar.to ? [{ key: newId("draft"), employeeId: selectedBar.employeeId, from: back, to: selectedBar.to, task: selectedBar.task }] : [];
            onChange([...draft.map((d) => (d.key === selectedBar.key ? { ...d, to: addDays(breakStart, -1) } : d)), ...rest]);
          }}
          onRemove={() => {
            onChange(draft.filter((d) => d.key !== selectedBar.key));
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="plan__scroll" ref={scroller}>
        <div className="plan__canvas" style={{ width: NAME_W + days.length * DAY }}>
          <div className="plan__headrow">
          <div className="plan__corner">Osoba</div>
          <div className="plan__head" style={{ width: days.length * DAY }}>
            <div className="plan__months">
              {months.map((m) => (
                <span key={m.key} style={{ width: m.span * DAY }}>
                  <b>{m.label}</b>
                </span>
              ))}
            </div>
            <div className="plan__days">
              {days.map((d) => (
                <span key={d} className={`${weekdayIndex(d) >= 5 ? "is-weekend" : ""} ${d === today ? "is-today" : ""}`}>
                  {parseISO(d).getDate()}
                </span>
              ))}
            </div>
          </div>
          </div>

          <div
            className="plan__bg"
            style={{ left: NAME_W, width: days.length * DAY, backgroundImage: `${cutoffBg}, ${weekendBg}`, backgroundPositionX: -weekOffset }}
          >
            {start > rangeStart && <span className="plan__outside" style={{ left: 0, width: Math.min(x(start), days.length * DAY) }} />}
            {end && end < rangeEnd && <span className="plan__outside" style={{ left: x(addDays(end, 1)), right: 0 }} />}
            {end && end < rangeEnd && <span className="plan__end" style={{ left: x(addDays(end, 1)) }}>koniec projektu</span>}
            {today >= rangeStart && today <= rangeEnd && <span className="plan__today" style={{ left: x(today) + DAY / 2 }} />}
          </div>

          {/* Zapotrzebowanie: ilu potrzeba i ilu jest w planie, tydzień po tygodniu (słupki E i M) */}
          {demand.length > 0 && (
            <div className="plan__row plan__row--demand">
              <div className="plan__name plan__name--demand">
                <span className="plan__who">
                  <span className="plan__person">Zapotrzebowanie</span>
                  <span className="plan__meta">w planie / potrzeba</span>
                </span>
              </div>
              <div className="plan__track">
                {weeksIn(rangeStart, rangeEnd).map((w) => {
                  const need = needOf(demand, w);
                  if (!need.defined) return null;
                  const friday = addDays(w, 4);
                  const present = (trade: Employee["trade"]) =>
                    new Set(
                      draft
                        .filter((d) => d.from <= friday && (d.to ?? openEnd) >= w && model.employeeById.get(d.employeeId)?.trade === trade)
                        .map((d) => d.employeeId)
                    ).size;
                  const el = present("ELECTRICAL");
                  const me = present("MECHANICAL");
                  return (
                    <span
                      key={w}
                      className="plan-need"
                      style={{ left: x(w) + 3, width: 7 * DAY - 6 }}
                      data-tip={`Tydzień od ${formatDate(w)}\nElektrycy: ${el} z ${need.electricians}\nMechanicy: ${me} z ${need.mechanics}`}
                    >
                      <NeedBar trade="el" have={el} need={need.electricians} />
                      <NeedBar trade="me" have={me} need={need.mechanics} />
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supervisor: cały projekt */}
          <div className="plan__row">
          <div className="plan__name">
            {supervisor ? (
              <>
                <PositionMark employee={supervisor} />
                <span className="plan__who">
                  <span className="plan__person">{supervisor.name}</span>
                </span>
              </>
            ) : (
              <span className="muted">Supervisor nie wybrany</span>
            )}
          </div>
          <div className="plan__track">
            {supervisor &&
              (() => {
                const s = span(start, openEnd);
                return s ? (
                  <span className="bar bar--fixed" style={{ left: s.left, width: s.width }}>
                    <span className="bar__label">Nadzór · cały projekt</span>
                  </span>
                ) : null;
              })()}
            {supervisor && <Leaves leaves={model.leavesOf(supervisor.id)} span={span} />}
          </div>
          </div>

          {sections.map((section) => (
            <Fragment key={section.label}>
              <div className="plan__section">
                <span>
                  {section.label} <em>{section.rows.length}</em>
                </span>
              </div>
              {section.rows.length === 0 && (
                <div className="plan__row">
                  <div className="plan__name plan__name--empty">
                    <span className="muted">Nikogo jeszcze nie ma</span>
                  </div>
                  <div className="plan__track" />
                </div>
              )}
              {section.rows.map(({ employee, bars }) => {
                const others = (model.assignmentsByEmployee.get(employee.id) ?? []).filter((a) => a.projectId !== projectId);
                return (
                  <div className="plan__row" key={employee.id}>
                    <div className="plan__name">
                      <PositionMark employee={employee} />
                      <span className="plan__who">
                        <span className="plan__person" title={employee.name}>
                          {employee.name}
                        </span>
                        <span className="plan__meta">
                          <EmploymentTag employee={employee} />
                          {bars.length > 1 && <em className="plan__count">{bars.length} zadania</em>}
                        </span>
                      </span>
                      {editable && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm plan__remove"
                          onClick={() => onChange(draft.filter((d) => d.employeeId !== employee.id))}
                          aria-label={`Usuń ${employee.name} z planu`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div
                      className={`plan__track ${editable ? "is-editable" : ""}`}
                      onClick={(e) => addTaskAt(e, employee, bars)}
                    >
                      {others.map((o) => {
                        const s = span(o.from, o.to ?? model.projectById.get(o.projectId)?.endDate ?? rangeEnd);
                        const p = model.projectById.get(o.projectId);
                        if (!s || !p) return null;
                        return (
                          <span
                            key={o.id}
                            className="bar bar--ghost"
                            style={{ left: s.left, width: s.width, ["--project" as string]: p.color }}
                            data-tip={`${p.name}${o.task ? ` · ${o.task}` : ""}: ${formatDate(o.from)} – ${o.to ? formatDate(o.to) : "koniec projektu"}`}
                          >
                            <span className="bar__label">{p.name}</span>
                          </span>
                        );
                      })}
                      {bars.slice(1).map((bar, i) => {
                        const prevEnd = bars[i].to ?? openEnd;
                        const gap = daysBetween(prevEnd, bar.from) - 1;
                        if (gap < 1) return null;
                        const s = span(addDays(prevEnd, 1), addDays(bar.from, -1));
                        if (!s) return null;
                        return (
                          <span key={`gap-${bar.key}`} className="gap" style={{ left: s.left, width: s.width }} data-tip={`Przerwa: ${daysCount(gap)} bez zadania — bez wpisu godzin`}>
                            {s.width > 70 && <span>przerwa · {daysCount(gap)}</span>}
                          </span>
                        );
                      })}
                      {bars.map((bar) => {
                        const to = bar.to ?? openEnd;
                        const s = span(bar.from, to);
                        const conflict = others.find((o) => o.from <= to && (o.to ?? "9999-12-31") >= bar.from);
                        const conflictProject = conflict ? model.projectById.get(conflict.projectId) : null;
                        const overlapsOwn = bars.some((b) => b.key !== bar.key && b.from <= to && (b.to ?? openEnd) >= bar.from);
                        const dates = `${short(bar.from)} – ${bar.to ? short(to) : "koniec"}`;
                        const task = bar.task ?? defaultTask(employee.trade);
                        const tip = conflictProject
                          ? `Koliduje z ${conflictProject.name} (${formatDate(conflict!.from)} – ${conflict!.to ? formatDate(conflict!.to) : "koniec"})`
                          : overlapsOwn
                            ? "Nachodzi na inne zadanie tej osoby"
                            : `${task}: ${formatDate(bar.from)} – ${bar.to ? formatDate(to) : "koniec projektu"}`;
                        if (!s) return null;
                        return (
                          <span
                            key={bar.key}
                            role="button"
                            tabIndex={0}
                            aria-label={`${employee.name}, ${task}, ${dates}. Enter otwiera zadanie, strzałki przesuwają, Shift ze strzałką zmienia koniec.`}
                            className={`bar ${conflict || overlapsOwn ? "bar--conflict" : ""} ${dragging === bar.key ? "is-dragging" : ""} ${editable ? "is-editable" : ""} ${selected === bar.key ? "is-selected" : ""}`}
                            style={{ left: s.left, width: s.width }}
                            data-tip={dragging ? undefined : tip}
                            onPointerDown={(e) => onDown(e, bar, "move")}
                            onPointerMove={onMove}
                            onPointerUp={onUp}
                            onPointerCancel={onUp}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!editable) setSelected(bar.key);
                            }}
                            onKeyDown={(e) => nudge(bar, e)}
                          >
                            {editable && !s.cutStart && (
                              <span
                                className="bar__handle bar__handle--start"
                                onPointerDown={(e) => onDown(e, bar, "start")}
                                onPointerMove={onMove}
                                onPointerUp={onUp}
                                aria-hidden
                              />
                            )}
                            {s.width > 64 && (
                              <span className="bar__label">
                                {s.width > 150 ? (
                                  <>
                                    <b>{task}</b> {dates}
                                  </>
                                ) : (
                                  dates
                                )}
                              </span>
                            )}
                            {editable && !s.cutEnd && (
                              <span
                                className="bar__handle bar__handle--end"
                                onPointerDown={(e) => onDown(e, bar, "end")}
                                onPointerMove={onMove}
                                onPointerUp={onUp}
                                aria-hidden
                              />
                            )}
                          </span>
                        );
                      })}
                      <Leaves leaves={model.leavesOf(employee.id)} span={span} />
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="plan__hint">
        {editable
          ? "Kliknij zadanie, żeby zmienić nazwę, daty albo wstawić przerwę. Przeciągnij, żeby przesunąć; chwyć za brzeg, żeby zmienić start lub koniec. Kliknij puste miejsce w wierszu, żeby dodać osobie kolejne zadanie. Szare paski to ta sama osoba w innych projektach."
          : "Plan zespołu ustala Planning. Tutaj widzisz, kto i kiedy pracuje w projekcie i gdzie ma przerwy."}
      </p>
    </div>
  );
}

/** Panel wybranego zadania: nazwa, od–do, przerwa (podział zadania), usunięcie. */
function TaskPanel({
  bar,
  employee,
  projectStart,
  projectEnd,
  editable,
  onChange,
  onSplit,
  onRemove,
  onClose,
}: {
  bar: DraftAssignment;
  employee: Employee;
  projectStart: ISODate;
  projectEnd: ISODate | null;
  editable: boolean;
  onChange: (patch: Partial<DraftAssignment>) => void;
  onSplit: (breakStart: ISODate, length: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const [splitting, setSplitting] = useState(false);
  const suggestedBreak = (() => {
    const base = bar.from > today ? addDays(bar.from, 14) : addDays(today, 7);
    const monday = addDays(startOfWeek(base), 7);
    return monday;
  })();
  const [breakStart, setBreakStart] = useState<ISODate>(suggestedBreak);
  const [length, setLength] = useState(7);
  const listId = `tasks-${bar.key}`;

  return (
    <section className="plan__task" aria-label={`Zadanie: ${employee.name}`}>
      <div className="plan__task-who">
        <PositionMark employee={employee} />
        <strong>{employee.name}</strong>
      </div>
      <label className="plan__task-field plan__task-field--name">
        <span>Zadanie</span>
        <input
          className="control"
          list={listId}
          value={bar.task ?? ""}
          placeholder={defaultTask(employee.trade)}
          onChange={(e) => onChange({ task: e.target.value || null })}
          disabled={!editable}
        />
        <datalist id={listId}>
          {TASK_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <div className="plan__task-field">
        <span>Od</span>
        <DatePicker value={bar.from} onChange={(v) => v && onChange({ from: v })} min={projectStart} />
      </div>
      <div className="plan__task-field">
        <span>Do</span>
        <DatePicker
          value={bar.to}
          onChange={(v) => onChange({ to: v })}
          min={bar.from}
          rangeStart={bar.from}
          placeholder={projectEnd ? "Do końca projektu" : "Bez końca"}
          clearable
        />
      </div>
      {editable && (
        <div className="plan__task-actions">
          <button type="button" className={`btn btn--secondary btn--sm ${splitting ? "is-active" : ""}`} onClick={() => setSplitting((v) => !v)}>
            <Scissors size={15} aria-hidden />
            Wstaw przerwę
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onRemove}>
            <Trash2 size={15} aria-hidden />
            Usuń zadanie
          </button>
        </div>
      )}
      <button type="button" className="icon-btn icon-btn--sm plan__task-close" onClick={onClose} aria-label="Zamknij zadanie">
        <X size={16} />
      </button>
      {splitting && editable && (
        <div className="plan__split">
          <span>Przerwa (np. wyjazd do domu) od</span>
          <DatePicker value={breakStart} onChange={(v) => v && setBreakStart(v)} min={addDays(bar.from, 1)} />
          <span>na</span>
          <div className="reasons">
            {BREAK_LENGTHS.map((n) => (
              <button key={n} type="button" className={`chip chip--choice ${length === n ? "is-selected" : ""}`} onClick={() => setLength(n)}>
                {n} dni
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              onSplit(breakStart, length);
              setSplitting(false);
            }}
          >
            Wstaw przerwę
          </button>
          <span className="muted">Wraca {formatDate(addDays(breakStart, length))}. W przerwie nie wpisuje godzin.</span>
        </div>
      )}
    </section>
  );
}

/** Urlopy osoby na jej wierszu: zaakceptowane (z osobą akceptującą), L4, wnioski czekające — kreskowane. */
function Leaves({ leaves, span }: { leaves: LeaveRequest[]; span: (from: ISODate, to: ISODate) => { left: number; width: number } | null }) {
  return (
    <>
      {leaves
        .filter((l) => l.status === "APPROVED" || l.status === "PENDING")
        .map((l) => {
          const s = span(l.from, l.to);
          if (!s) return null;
          const kind = l.status === "PENDING" ? "pending" : l.type === "SICK" ? "sick" : "leave";
          const label = l.type === "SICK" ? "L4" : l.status === "PENDING" ? "Wniosek o urlop" : l.type === "OTHER" ? "Nieobecność" : "Urlop";
          const who = l.status === "APPROVED" && l.type !== "SICK" && l.decidedByName ? ` · ${l.decidedByName}` : "";
          return (
            <span
              key={l.id}
              className={`plan-leave plan-leave--${kind}`}
              style={{ left: s.left, width: s.width }}
              data-tip={`${label}: ${formatDate(l.from)} – ${formatDate(l.to)}\n${leaveNote(l)}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {s.width > 40 && (
                <span>
                  {label}
                  {s.width > 150 ? who : ""}
                </span>
              )}
            </span>
          );
        })}
    </>
  );
}

/** Słupek obsady jednej branży: wypełnienie = w planie, obrys = potrzeba. */
function NeedBar({ trade, have, need }: { trade: "el" | "me"; have: number; need: number }) {
  if (!need && !have) return <span className={`need-bar need-bar--${trade} is-empty`} />;
  const max = Math.max(need, have, 1);
  return (
    <span className={`need-bar need-bar--${trade} ${need && have < need ? "is-short" : ""}`}>
      <b>{trade === "el" ? "E" : "M"}</b>
      <span className="need-bar__track">
        <span className="need-bar__need" style={{ width: `${(need / max) * 100}%` }} />
        <span className="need-bar__fill" style={{ width: `${(have / max) * 100}%` }} />
      </span>
      <em>
        {have}/{need}
      </em>
    </span>
  );
}

function weeksIn(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function short(d: ISODate) {
  return formatDate(d).replace(/ \d{4}$/, "");
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
  return spans.map((s) => ({ ...s, label: s.span < 5 ? s.label.slice(0, 3) : s.label }));
}

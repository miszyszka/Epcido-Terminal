import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus, X } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { PositionMark } from "../../components/PersonBadge";
import type { DraftAssignment } from "../../data/commands";
import type { Employee } from "../../domain/types";
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

const DAY = 24;
const WEEKS = 12;

interface TeamTimelineProps {
  projectId: string | null;
  start: ISODate;
  end: ISODate | null;
  supervisorId: string | null;
  draft: DraftAssignment[];
  onChange: (next: DraftAssignment[]) => void;
  editable: boolean;
  onAssign: () => void;
}

type DragMode = "move" | "start" | "end";

/**
 * Plan zespołu na poziomej osi czasu. Każdy pasek = okres pracy osoby w projekcie.
 * Przeciągnij pasek, żeby go przesunąć; chwyć za brzeg, żeby zmienić start lub koniec.
 * Szare paski w tle = ta sama osoba w innych projektach (pomaga uniknąć kolizji).
 */
export function TeamTimeline({ projectId, start, end, supervisorId, draft, onChange, editable, onAssign }: TeamTimelineProps) {
  const model = useModel();
  const today = todayISO();
  const projectEnd = end ?? addDays(start, WEEKS * 7);
  const [windowStart, setWindowStart] = useState(() => {
    if (!projectId || start > today) return addDays(startOfWeek(start), -7);
    return addDays(startOfWeek(today), -7);
  });
  const days = useMemo(() => eachDay(windowStart, addDays(windowStart, WEEKS * 7 - 1)), [windowStart]);
  const windowEnd = days[days.length - 1];
  const drag = useRef<{ key: string; mode: DragMode; x: number; from: ISODate; to: ISODate } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const sections = useMemo(() => {
    const byEmployee = new Map<string, DraftAssignment[]>();
    for (const d of draft) byEmployee.set(d.employeeId, [...(byEmployee.get(d.employeeId) ?? []), d]);
    const rows = [...byEmployee.entries()]
      .map(([id, bars]) => ({ employee: model.employeeById.get(id), bars }))
      .filter((r): r is { employee: Employee; bars: DraftAssignment[] } => Boolean(r.employee))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name, "pl", { numeric: true }));
    return [
      { label: "Team Leaderzy", rows: rows.filter((r) => r.employee.position === "TEAM_LEADER") },
      { label: "Elektrycy", rows: rows.filter((r) => r.employee.position === "ELECTRICIAN") },
      { label: "Mechanicy", rows: rows.filter((r) => r.employee.position === "MECHANIC") },
    ];
  }, [draft, model.employeeById]);

  const supervisor = supervisorId ? model.employeeById.get(supervisorId) : null;
  const rowCount = 1 + sections.reduce((n, s) => n + 1 + Math.max(1, s.rows.length), 0);

  const x = (date: ISODate) => daysBetween(windowStart, date) * DAY;
  const span = (from: ISODate, to: ISODate) => {
    const a = from < windowStart ? windowStart : from;
    const b = to > windowEnd ? windowEnd : to;
    if (b < windowStart || a > windowEnd) return null;
    return { left: x(a), width: (daysBetween(a, b) + 1) * DAY, cutStart: from < windowStart, cutEnd: to > windowEnd };
  };

  const update = (key: string, patch: Partial<DraftAssignment>) =>
    onChange(draft.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const onDown = (e: React.PointerEvent, bar: DraftAssignment, mode: DragMode) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { key: bar.key, mode, x: e.clientX, from: bar.from, to: bar.to ?? projectEnd };
    setDragging(bar.key);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x) / DAY);
    if (d.mode === "move") update(d.key, { from: addDays(d.from, delta), to: addDays(d.to, delta) });
    else if (d.mode === "start") {
      const from = addDays(d.from, delta);
      update(d.key, { from: from > d.to ? d.to : from });
    } else {
      const to = addDays(d.to, delta);
      update(d.key, { to: to < d.from ? d.from : to });
    }
  };
  const onUp = () => {
    drag.current = null;
    setDragging(null);
  };
  const nudge = (bar: DraftAssignment, e: React.KeyboardEvent) => {
    if (!editable) return;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = bar.to ?? projectEnd;
    if (e.shiftKey) update(bar.key, { to: addDays(to, step) < bar.from ? bar.from : addDays(to, step) });
    else update(bar.key, { from: addDays(bar.from, step), to: addDays(to, step) });
  };

  const months = monthSpans(days);
  const weekendBg = `repeating-linear-gradient(90deg, transparent 0 ${5 * DAY}px, var(--sand-50) ${5 * DAY}px ${7 * DAY}px)`;
  const cutoffBg = `repeating-linear-gradient(90deg, transparent 0 ${DAY - 1}px, var(--cutoff) ${DAY - 1}px ${DAY + 0.5}px, transparent ${DAY + 0.5}px ${7 * DAY}px)`;
  let rowIndex = 2;

  return (
    <div className="plan">
      <div className="plan__toolbar">
        <div className="plan__nav">
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => setWindowStart(addDays(windowStart, -28))} aria-label="4 tygodnie wcześniej">
            <ChevronLeft size={18} />
          </button>
          <span className="plan__range">
            {formatDate(windowStart).replace(/ \d{4}$/, "")} – {formatDate(windowEnd)}
          </span>
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => setWindowStart(addDays(windowStart, 28))} aria-label="4 tygodnie później">
            <ChevronRight size={18} />
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setWindowStart(addDays(startOfWeek(start), -7))}>
            Start projektu
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setWindowStart(addDays(startOfWeek(today), -7))}>
            Dziś
          </button>
        </div>
        {editable && (
          <button type="button" className="btn btn--primary" onClick={onAssign}>
            <UserPlus size={18} aria-hidden />
            Przypisz pracowników
          </button>
        )}
      </div>

      <div className="plan__scroll">
        <div className="plan__grid" style={{ gridTemplateColumns: `220px ${days.length * DAY}px` }}>
          <div className="plan__corner">Osoba</div>
          <div className="plan__head">
            <div className="plan__months">
              {months.map((m) => (
                <span key={m.key} style={{ width: m.span * DAY }}>
                  {m.label}
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

          <div className="plan__bg" style={{ gridRow: `2 / span ${rowCount}`, backgroundImage: `${cutoffBg}, ${weekendBg}` }}>
            {start > windowStart && <span className="plan__outside" style={{ left: 0, width: Math.min(x(start), days.length * DAY) }} />}
            {end && end < windowEnd && <span className="plan__outside" style={{ left: x(addDays(end, 1)), right: 0 }} />}
            {today >= windowStart && today <= windowEnd && <span className="plan__today" style={{ left: x(today) + DAY / 2 }} />}
          </div>

          {/* Supervisor: cały projekt */}
          <div className="plan__name" style={{ gridRow: rowIndex }}>
            {supervisor ? (
              <>
                <PositionMark employee={supervisor} />
                <span>{supervisor.name}</span>
              </>
            ) : (
              <span className="muted">Supervisor nie wybrany</span>
            )}
          </div>
          <div className="plan__track" style={{ gridRow: rowIndex++ }}>
            {supervisor &&
              (() => {
                const s = span(start, projectEnd);
                return s ? (
                  <span className="bar bar--fixed" style={{ left: s.left, width: s.width }}>
                    <span className="bar__label">cały projekt</span>
                  </span>
                ) : null;
              })()}
          </div>

          {sections.map((section) => (
            <Section key={section.label}>
              <div className="plan__section" style={{ gridRow: rowIndex++ }}>
                <span>
                  {section.label} <em>{section.rows.length}</em>
                </span>
              </div>
              {section.rows.length === 0 && (
                <>
                  <div className="plan__name plan__name--empty" style={{ gridRow: rowIndex }}>
                    <span className="muted">Nikogo jeszcze nie ma</span>
                  </div>
                  <div className="plan__track" style={{ gridRow: rowIndex++ }} />
                </>
              )}
              {section.rows.map(({ employee, bars }) => {
                const row = rowIndex++;
                const others = (model.assignmentsByEmployee.get(employee.id) ?? []).filter((a) => a.projectId !== projectId);
                return (
                  <Section key={employee.id}>
                    <div className="plan__name" style={{ gridRow: row }}>
                      <PositionMark employee={employee} />
                      <span>{employee.name}</span>
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
                    <div className="plan__track" style={{ gridRow: row }}>
                      {others.map((o) => {
                        const s = span(o.from, o.to ?? windowEnd);
                        const p = model.projectById.get(o.projectId);
                        if (!s || !p) return null;
                        return (
                          <span
                            key={o.id}
                            className="bar bar--ghost"
                            style={{ left: s.left, width: s.width }}
                            data-tip={`${p.name}: ${formatDate(o.from)} – ${o.to ? formatDate(o.to) : "koniec projektu"}`}
                          >
                            <span className="bar__label">{p.name}</span>
                          </span>
                        );
                      })}
                      {bars.map((bar) => {
                        const to = bar.to ?? projectEnd;
                        const s = span(bar.from, to);
                        const conflict = others.find((o) => o.from <= to && (!o.to || o.to >= bar.from));
                        const conflictProject = conflict ? model.projectById.get(conflict.projectId) : null;
                        const label = `${short(bar.from)} – ${short(to)}`;
                        const tip = conflictProject
                          ? `Koliduje z ${conflictProject.name} (${formatDate(conflict!.from)} – ${conflict!.to ? formatDate(conflict!.to) : "koniec"})`
                          : `${employee.name}: ${formatDate(bar.from)} – ${formatDate(to)}`;
                        if (!s) return null;
                        return (
                          <span
                            key={bar.key}
                            role={editable ? "slider" : undefined}
                            tabIndex={editable ? 0 : undefined}
                            aria-label={`${employee.name}, okres pracy ${label}. Strzałki przesuwają, Shift ze strzałką zmienia koniec.`}
                            aria-valuetext={label}
                            className={`bar ${conflict ? "bar--conflict" : ""} ${dragging === bar.key ? "is-dragging" : ""} ${editable ? "is-editable" : ""}`}
                            style={{ left: s.left, width: s.width }}
                            data-tip={dragging ? undefined : tip}
                            onPointerDown={(e) => onDown(e, bar, "move")}
                            onPointerMove={onMove}
                            onPointerUp={onUp}
                            onPointerCancel={onUp}
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
                            {s.width > 88 && <span className="bar__label">{label}</span>}
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
                    </div>
                  </Section>
                );
              })}
            </Section>
          ))}
        </div>
      </div>
      <p className="plan__hint">
        {editable
          ? "Przeciągnij pasek, żeby przesunąć okres pracy. Chwyć za lewy lub prawy brzeg, żeby zmienić start albo koniec. Szare paski to ta sama osoba w innych projektach."
          : "Plan zespołu ustala Planning. Tutaj widzisz, kto i kiedy pracuje w projekcie."}
      </p>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
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

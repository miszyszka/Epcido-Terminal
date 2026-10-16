import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  formatDate,
  MONTHS_LONG,
  parseISO,
  startOfWeek,
  toISO,
  todayISO,
  weekdayIndex,
  WEEKDAYS_SHORT,
  type ISODate,
} from "../lib/dates";

interface DatePickerProps {
  value: ISODate | null;
  onChange: (value: ISODate | null) => void;
  placeholder?: string;
  min?: ISODate | null;
  /** Data startu zakresu — zaznaczana delikatnie przy wyborze daty końca */
  rangeStart?: ISODate | null;
  clearable?: boolean;
  invalid?: boolean;
  id?: string;
}

/** Kalendarz zgodny z brandbookiem (6): tydzień od poniedziałku, wybrany dzień = kropka Deep Forest. */
export function DatePicker({ value, onChange, placeholder = "Wybierz datę", min, rangeStart, clearable, invalid, id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => firstOfMonth(value ?? rangeStart ?? todayISO()));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const titleId = useId();

  // Kalendarz renderuje się w <body>, żeby nie przycinał go przewijany panel. Otwiera się w górę, gdy brak miejsca.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const h = pop.current?.offsetHeight ?? 380;
      const w = pop.current?.offsetWidth ?? 304;
      const below = window.innerHeight - r.bottom >= h + 16;
      setPos({
        top: below ? r.bottom + 8 : Math.max(8, r.top - h - 8),
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const today = todayISO();
  const m = parseISO(month);
  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const visible = days.slice(0, days[35] && parseISO(days[35]).getMonth() !== m.getMonth() ? 35 : 42);

  return (
    <div className="datepicker" ref={root}>
      <button
        type="button"
        id={id}
        ref={trigger}
        className={`control control--button ${invalid ? "is-invalid" : ""}`}
        onClick={() => {
          if (!open) setMonth(firstOfMonth(value ?? rangeStart ?? todayISO()));
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "control__placeholder"}>{value ? formatDate(value) : placeholder}</span>
        <CalendarDays size={18} aria-hidden className="control__icon" />
      </button>

      {open &&
        createPortal(
        <div
          className="popover calendar"
          role="dialog"
          aria-labelledby={titleId}
          ref={pop}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        >
          <div className="calendar__head">
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Poprzedni miesiąc">
              <ChevronLeft size={18} />
            </button>
            <div className="calendar__title" id={titleId}>
              {MONTHS_LONG[m.getMonth()]} {m.getFullYear()}
            </div>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Następny miesiąc">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="calendar__grid" role="grid">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="calendar__dow" role="columnheader">
                {d}
              </div>
            ))}
            {visible.map((d) => {
              const inMonth = parseISO(d).getMonth() === m.getMonth();
              const disabled = Boolean(min && d < min);
              const selected = d === value;
              const inRange = Boolean(rangeStart && value && d > rangeStart && d < value);
              const cls = [
                "calendar__day",
                inMonth ? "" : "is-outside",
                selected ? "is-selected" : "",
                d === today ? "is-today" : "",
                d === rangeStart ? "is-range-start" : "",
                inRange ? "is-in-range" : "",
                weekdayIndex(d) >= 5 ? "is-weekend" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={d}
                  type="button"
                  className={cls}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={formatDate(d)}
                  onClick={() => {
                    onChange(d);
                    setOpen(false);
                  }}
                >
                  {parseISO(d).getDate()}
                </button>
              );
            })}
          </div>
          <div className="calendar__foot">
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              disabled={Boolean(min && today < min)}
            >
              Dziś
            </button>
            {clearable && value && (
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}

function firstOfMonth(iso: ISODate): ISODate {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

function shiftMonth(iso: ISODate, delta: number): ISODate {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDate, isoWeek, type ISODate } from "../lib/dates";

interface WeekNavProps {
  from: ISODate;
  weeks: number;
  onShift: (deltaWeeks: number) => void;
  onToday: () => void;
  isCurrent: boolean;
}

export function WeekNav({ from, weeks, onShift, onToday, isCurrent }: WeekNavProps) {
  const to = addDays(from, weeks * 7 - 1);
  const w1 = isoWeek(from).week;
  const w2 = isoWeek(to).week;
  return (
    <div className="weeknav">
      <button type="button" className="icon-btn" onClick={() => onShift(-1)} aria-label="Tydzień wcześniej">
        <ChevronLeft size={18} />
      </button>
      <div className="weeknav__label">
        <strong>
          tydz. {w1}–{w2}
        </strong>
        <span>
          {formatDate(from).replace(/ \d{4}$/, "")} – {formatDate(to)}
        </span>
      </div>
      <button type="button" className="icon-btn" onClick={() => onShift(1)} aria-label="Tydzień później">
        <ChevronRight size={18} />
      </button>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onToday} disabled={isCurrent}>
        Dziś
      </button>
    </div>
  );
}

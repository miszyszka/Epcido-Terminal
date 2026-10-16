import { ABSENCE_SHORT, dayStateOf, describeEntry, statusLabel } from "../domain/labels";
import type { DayEntry, DayState } from "../domain/types";
import { formatMinutes } from "../lib/dates";

/** Ptaszek „wysłane do Dataverse" (brandbook 2.3). */
export function SentMark({ size = 10 }: { size?: number }) {
  return (
    <svg className="sent-mark" width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <path d="M2.2 6.4 4.8 9 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface DayCellProps {
  state: DayState;
  size?: "map" | "mini" | "legend";
  /** Wysłane do Dataverse — zielony ptaszek */
  sent?: boolean;
  /** Dzień w zaplanowanym okresie pracy, jeszcze bez wpisu (przyszłość) */
  planned?: boolean;
  today?: boolean;
  /** Treść dymka i opisu dla czytników ekranu */
  label: string;
}

/** Kropka dnia — ten sam obiekt na mapie, w legendzie i przy osobach (brandbook 2.3 i 6). */
export function DayCell({ state, size = "map", sent, planned, today, label }: DayCellProps) {
  const cls = [
    "day",
    `day--${state}`,
    `day--${size}`,
    planned && state === "off" ? "day--planned" : "",
    today ? "day--today" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} data-tip={label} role="img" aria-label={label}>
      {sent && <SentMark size={size === "mini" ? 8 : 10} />}
    </span>
  );
}

interface DayCardProps {
  entry: DayEntry | undefined;
  /** Dzień w okresie pracy bez wpisu — pokazuje „brak wpisu" zamiast pustego pola */
  expected?: boolean;
  planned?: boolean;
  selected?: boolean;
  onClick?: () => void;
  label?: string;
}

/**
 * Duża komórka dnia (oś czasu, zatwierdzanie): od–do, przerwa, powód nieobecności.
 * Kolor wypełnienia = stan dnia, ptaszek = wysłane do Dataverse.
 */
export function DayCard({ entry, expected, planned, selected, onClick, label }: DayCardProps) {
  const state = dayStateOf(entry);
  const rejected = entry?.status === "REJECTED";
  const cls = [
    "daycard",
    `daycard--${state}`,
    rejected ? "daycard--rejected" : "",
    planned && !entry ? "daycard--planned" : "",
    selected ? "is-selected" : "",
    onClick ? "is-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let main: string = "";
  let sub: string = "";
  if (entry?.kind === "ABSENCE") {
    main = ABSENCE_SHORT[entry.absence ?? "OTHER"];
    sub = entry.absence === "SICK" ? "zwolnienie" : entry.absence === "LEAVE" ? "nieobecny" : "nieobecny";
  } else if (entry && entry.start != null && entry.end != null) {
    main = `${formatMinutes(entry.start)}–${formatMinutes(entry.end)}`;
    sub = `przerwa ${entry.breakMin ?? 0} min`;
  } else if (planned) {
    sub = "plan";
  } else if (expected) {
    sub = "brak wpisu";
  }
  if (rejected) sub = "do poprawy";

  const content = (
    <>
      {main && <b>{main}</b>}
      {sub && <span>{sub}</span>}
      {entry?.exported && (
        <i className="daycard__sent" aria-hidden>
          <SentMark size={9} />
        </i>
      )}
    </>
  );
  const tip = label ?? (entry ? `${describeEntry(entry)}` : statusLabel(entry));

  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected} aria-label={tip} data-tip={tip}>
      {content}
    </button>
  ) : (
    <div className={cls} aria-label={tip}>
      {content}
    </div>
  );
}

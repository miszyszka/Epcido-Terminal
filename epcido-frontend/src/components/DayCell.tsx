import { ABSENCE_SHORT } from "../domain/labels";
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

/** Wykrzyknik „nie wysłane do Dataverse" (brandbook 2.3). */
export function MissedMark({ size = 10 }: { size?: number }) {
  return (
    <svg className="missed-mark" width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <path d="M6 2.4v4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="6" cy="9.4" r="1.15" fill="currentColor" />
    </svg>
  );
}

interface DayCellProps {
  state: DayState;
  size?: "map" | "mini" | "legend";
  /** Wysłane do Dataverse — zielony ptaszek */
  sent?: boolean;
  /** Dzień w zaplanowanym zadaniu, jeszcze bez wpisu (przyszłość) */
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
      {state === "missed" && <MissedMark size={size === "mini" ? 8 : 10} />}
    </span>
  );
}

interface DayCardProps {
  entry: DayEntry | undefined;
  state: DayState;
  sent?: boolean;
  /** Dzień w zadaniu bez wpisu — pokazuje „brak wpisu" zamiast pustego pola */
  expected?: boolean;
  planned?: boolean;
  /** Po kliknięciu: otwórz edycję dnia */
  onClick?: () => void;
  /** Dymek: kto i kiedy zatwierdził */
  tip?: string;
  /** Opis dla czytników ekranu */
  label?: string;
}

/**
 * Duża komórka dnia (oś czasu, zatwierdzanie): od–do, przerwa, powód nieobecności.
 * Kolor wypełnienia = stan dnia, ptaszek = wysłane do Dataverse, wykrzyknik = nie wysłane,
 * kropka w rogu = zmienione przez osobę zatwierdzającą (szczegóły w notatce dnia).
 */
export function DayCard({ entry, state, sent, expected, planned, onClick, tip, label }: DayCardProps) {
  const edited = Boolean(entry?.history?.length);
  const cls = [
    "daycard",
    `daycard--${state}`,
    planned && !entry ? "daycard--planned" : "",
    onClick ? "is-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let main = "";
  let sub = "";
  if (entry?.kind === "ABSENCE") {
    main = ABSENCE_SHORT[entry.absence ?? "OTHER"];
    sub = entry.absence === "SICK" ? "zwolnienie" : "nieobecny";
  } else if (entry && entry.start != null && entry.end != null) {
    main = `${formatMinutes(entry.start)}–${formatMinutes(entry.end)}`;
    sub = `przerwa ${entry.breakMin ?? 0} min`;
  } else if (planned) {
    sub = "plan";
  } else if (expected) {
    sub = "brak wpisu";
  }

  const content = (
    <>
      {main && <b>{main}</b>}
      {sub && <span>{sub}</span>}
      {sent && (
        <i className="daycard__sent" aria-hidden>
          <SentMark size={9} />
        </i>
      )}
      {state === "missed" && (
        <i className="daycard__missed" aria-hidden>
          <MissedMark size={9} />
        </i>
      )}
      {edited && <i className="daycard__edited" aria-hidden />}
    </>
  );
  const aria = label ?? tip;

  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={aria} data-tip={tip}>
      {content}
    </button>
  ) : (
    <div className={cls} aria-label={aria} data-tip={tip}>
      {content}
    </div>
  );
}

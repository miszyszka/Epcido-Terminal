import { AlarmClock, CheckCircle2 } from "lucide-react";
import { approveTime, exportTime, formatRemaining, timesheetsGen, timesheetsNom, type DeadlineSummary } from "../domain/workflow";
import { formatDay, toISO } from "../lib/dates";
import { plural } from "../lib/text";
import { MissedMark } from "./DayCell";

/**
 * Ile czasu zostało do terminu i ile timesheetów jest do zatwierdzenia. Płaska karta: po lewej stan,
 * po prawej termin i wysyłka. Gdy zostały już tylko godziny (mniej niż doba) — ikona i liczba na czerwono.
 */
export function DeadlineBanner({ summary, isAdmin }: { summary: DeadlineSummary; isAdmin?: boolean }) {
  const done = summary.timesheets === 0 && summary.later === 0;
  const urgent = summary.urgent && summary.timesheets > 0;
  return (
    <section className={`deadline-banner ${urgent ? "is-urgent" : ""} ${done ? "is-done" : ""}`} aria-live="polite">
      <span className="deadline-banner__icon" aria-hidden>
        {done ? <CheckCircle2 size={22} strokeWidth={1.9} /> : <AlarmClock size={22} strokeWidth={1.9} />}
      </span>
      <div className="deadline-banner__text">
        {done ? (
          <p className="deadline-banner__main">
            <strong>Wszystko zatwierdzone.</strong>
          </p>
        ) : summary.timesheets > 0 ? (
          <p className="deadline-banner__main">
            Masz <strong>{formatRemaining(summary.remainingMs)}</strong> na zatwierdzenie <strong>{timesheetsGen(summary.timesheets)}</strong>
          </p>
        ) : (
          <p className="deadline-banner__main">
            <strong>{timesheetsNom(summary.later)}</strong> do zatwierdzenia do {formatDay(summary.laterApproveBy!)}, {approveTime()}
          </p>
        )}
        {summary.timesheets > 0 && summary.later > 0 && summary.laterApproveBy && (
          <p className="deadline-banner__sub">
            Potem {timesheetsNom(summary.later)} do {formatDay(summary.laterApproveBy)}, {approveTime()}
          </p>
        )}
        {isAdmin && summary.missed > 0 && (
          <p className="deadline-banner__missed">
            <MissedMark size={12} />
            {timesheetsNom(summary.missed)} {plural(summary.missed, "wstrzymany", "wstrzymane", "wstrzymanych")} — nie poszły do Dataverse. Poprawić i zatwierdzić je możesz tylko Ty;
            pójdą w najbliższą wysyłkę.
          </p>
        )}
      </div>
      <div className="deadline-banner__when">
        <span>Termin</span>
        <b>
          {formatDay(summary.approveBy)}, {approveTime()}
        </b>
        <span>
          wysyłka do Dataverse {formatDay(toISO(summary.exportAt))}, {exportTime()}
        </span>
      </div>
    </section>
  );
}

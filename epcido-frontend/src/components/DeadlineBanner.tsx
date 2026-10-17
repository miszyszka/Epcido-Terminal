import { AlarmClock, CheckCircle2 } from "lucide-react";
import { formatRemaining, timesheetsGen, timesheetsNom, type DeadlineSummary } from "../domain/workflow";
import { formatDay, toISO } from "../lib/dates";
import { plural } from "../lib/text";
import { MissedMark } from "./DayCell";

/**
 * Ile czasu zostało do terminu i ile timesheetów jest do zatwierdzenia.
 * Gdy zostały już tylko godziny (mniej niż doba do poniedziałku 23:59) — baner jest czerwony.
 */
export function DeadlineBanner({ summary, isAdmin }: { summary: DeadlineSummary; isAdmin?: boolean }) {
  const done = summary.timesheets === 0 && summary.later === 0;
  const urgent = summary.urgent && summary.timesheets > 0;
  return (
    <section className={`deadline-banner ${urgent ? "is-urgent" : ""} ${done ? "is-done" : ""}`} aria-live="polite">
      <span className="deadline-banner__icon" aria-hidden>
        {done ? <CheckCircle2 size={26} strokeWidth={1.8} /> : <AlarmClock size={26} strokeWidth={1.8} />}
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
            <strong>{timesheetsNom(summary.later)}</strong> do zatwierdzenia do {formatDay(summary.laterApproveBy!)}, 23:59
          </p>
        )}
        <p className="deadline-banner__sub">
          Termin: <strong>{formatDay(summary.approveBy)}, 23:59</strong>
          <span aria-hidden> · </span>
          wysyłka do Dataverse: <strong>{formatDay(toISO(summary.exportAt))}, 23:00</strong>
          {summary.timesheets > 0 && summary.later > 0 && summary.laterApproveBy && (
            <>
              <span aria-hidden> · </span>
              potem {timesheetsNom(summary.later)} do {formatDay(summary.laterApproveBy)}
            </>
          )}
        </p>
        {isAdmin && summary.missed > 0 && (
          <p className="deadline-banner__missed">
            <MissedMark size={12} />
            {timesheetsNom(summary.missed)} {plural(summary.missed, "wstrzymany", "wstrzymane", "wstrzymanych")} — nie poszły do Dataverse. Poprawić i zatwierdzić je możesz tylko Ty; pójdą w najbliższy
            wtorek.
          </p>
        )}
      </div>
    </section>
  );
}

import { closingWeek } from "../../domain/workflow";
import { formatDay, isoWeek, toISO } from "../../lib/dates";

/** Najbliższy termin zatwierdzenia i wysyłki do Dataverse. */
export function DeadlineNote() {
  const c = closingWeek();
  return (
    <div className="deadline">
      <span className="deadline__label">Tydzień {isoWeek(c.week).week}</span>
      <span>
        Zatwierdź do: <strong>{formatDay(c.approveBy)}</strong>
      </span>
      <span>
        Wysyłka do Dataverse: <strong>{formatDay(toISO(c.exportAt))}, 23:00</strong>
      </span>
    </div>
  );
}

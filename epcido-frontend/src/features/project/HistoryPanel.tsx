import { useModel } from "../../app/DataContext";
import { formatTimestamp } from "../../lib/dates";

/** Dziennik zmian projektu — kto, kiedy, co zmienił. Wpisów nie da się edytować ani usunąć. */
export function HistoryPanel({ projectId }: { projectId: string }) {
  const model = useModel();
  const events = model.snapshot.audit.filter((e) => e.projectId === projectId);

  if (events.length === 0) {
    return (
      <p className="team-section__empty">
        Brak zapisanych zmian. Każda zmiana danych lub zespołu pojawi się tutaj z autorem i godziną.
      </p>
    );
  }

  return (
    <ol className="history">
      {events.map((e) => (
        <li key={e.id} className="history__item">
          <div className="history__when">
            {formatTimestamp(e.at)}
            <span>{e.actorName}</span>
          </div>
          <p className="history__what">{e.summary}</p>
          {e.changes && (
            <dl className="history__changes">
              {e.changes.map((c) => (
                <div key={c.field}>
                  <dt>{c.field}</dt>
                  <dd>
                    <s>{c.before}</s> <span aria-hidden>→</span>
                    <span className="sr-only">zmieniono na</span> {c.after}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}

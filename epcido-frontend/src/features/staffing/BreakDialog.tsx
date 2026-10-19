import { useState } from "react";
import { useData, useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DatePicker } from "../../components/DatePicker";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { PositionMark } from "../../components/PersonBadge";
import { assignmentEnd, type PersonOutlook } from "../../domain/staffing";
import { addDays, formatDate, startOfWeek, todayISO, type ISODate } from "../../lib/dates";

const LENGTHS = [7, 10, 14];

/** Przerwa w trakcie zadania (wyjazd do domu): zadanie dzieli się na dwa, w przerwie nie ma wpisu godzin. */
export function BreakDialog({ outlook: o, onClose }: { outlook: PersonOutlook; onClose: () => void }) {
  const model = useModel();
  const data = useData();
  const { confirm } = useUi();
  const today = todayISO();
  const [from, setFrom] = useState<ISODate>(addDays(startOfWeek(today), 14));
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const target = (model.assignmentsByEmployee.get(o.employee.id) ?? []).find((a) => a.from < from && assignmentEnd(model, a) >= from);
  const project = target ? model.projectById.get(target.projectId) : null;

  return (
    <Dialog
      title={`Przerwa: ${o.employee.name}`}
      description={
        <span className="entry__context">
          <PositionMark employee={o.employee} />
          {o.stretchWeeks > 0 ? `Pracuje bez przerwy od ${o.stretchWeeks} tyg.` : "Zaplanuj wyjazd do domu w trakcie zadania"}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!target || saving}
            onClick={async () => {
              if (!target) return;
              const agreed = await confirm({
                title: "Wstawić przerwę?",
                lines: [
                  `${o.employee.name} — ${days} dni w domu`,
                  `Od ${formatDate(from)}, wraca ${formatDate(addDays(from, days))}`,
                  `Zadanie w ${project?.name ?? "projekcie"} zostanie podzielone na dwa.`,
                ],
                confirmLabel: "Wstaw przerwę",
              });
              if (!agreed) return;
              setSaving(true);
              const ok = await data.insertBreak({ assignmentId: target.id, from, days });
              setSaving(false);
              if (ok) onClose();
            }}
          >
            Wstaw przerwę
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Przerwa od" htmlFor="br-from">
          <DatePicker id="br-from" value={from} onChange={(v) => v && setFrom(v)} min={addDays(today, 1)} />
        </Field>
        <div className="field">
          <span className="field__label">Długość</span>
          <div className="reasons">
            {LENGTHS.map((n) => (
              <button key={n} type="button" className={`chip chip--choice ${days === n ? "is-selected" : ""}`} onClick={() => setDays(n)}>
                {n} dni
              </button>
            ))}
          </div>
        </div>
      </div>
      {target && project ? (
        <p className="notice notice--quiet">
          <span>
            {project.name}: zadanie kończy się {formatDate(addDays(from, -1))}, wraca {formatDate(addDays(from, days))}. W przerwie nie wpisuje godzin.
          </span>
        </p>
      ) : (
        <p className="notice notice--warn">
          <span>W tym dniu {o.employee.name} nie ma zadania — wybierz datę w trakcie pracy.</span>
        </p>
      )}
    </Dialog>
  );
}

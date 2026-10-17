import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { ProjectDot } from "../../components/PersonBadge";
import { ABSENCE_LABEL } from "../../domain/labels";
import { leaveProjects } from "../../domain/permissions";
import type { AbsenceType, Employee } from "../../domain/types";
import { eachDay, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { daysCount } from "../../lib/text";

const TYPES: AbsenceType[] = ["LEAVE", "SICK", "OTHER"];

/** Dni robocze (pn–pt) w okresie. */
export function workdays(from: ISODate, to: ISODate): number {
  if (!from || !to || to < from) return 0;
  return eachDay(from, to).filter((d) => weekdayIndex(d) < 5).length;
}

/**
 * Wniosek o nieobecność. Urlop i inną nieobecność akceptuje supervisor albo Installation Manager projektu,
 * albo HR; L4 obowiązuje od zgłoszenia, a HR potwierdza dokument. Osoba akceptująca może zgłosić
 * nieobecność za kogoś ze swoich projektów (`employee`).
 */
export function LeaveDialog({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const data = useData();
  const model = useModel();
  const user = useUser();
  const person = employee ?? user;
  const own = person.id === user.id;
  const today = todayISO();
  const [type, setType] = useState<AbsenceType>("LEAVE");
  const [from, setFrom] = useState<ISODate>(today);
  const [to, setTo] = useState<ISODate>(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const days = workdays(from, to);
  const projects = useMemo(() => leaveProjects(model, { employeeId: person.id, from, to }), [model, person.id, from, to]);
  const min = type === "SICK" ? null : startOfWeek(today);

  return (
    <Dialog
      title={own ? "Zgłoś nieobecność" : `Nieobecność: ${person.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving || days === 0}
            onClick={async () => {
              setSaving(true);
              const ok = await data.requestLeave({ employeeId: person.id, from, to, type, note: note.trim() || undefined });
              setSaving(false);
              if (ok) onClose();
            }}
          >
            {type === "SICK" ? "Zgłoś L4" : "Wyślij wniosek"}
          </button>
        </>
      }
    >
      <div className="reasons" role="radiogroup" aria-label="Rodzaj nieobecności">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            className={`chip chip--choice ${type === t ? "is-selected" : ""}`}
            onClick={() => {
              setType(t);
              if (t !== "SICK" && min && from < min) setFrom(min);
            }}
          >
            {ABSENCE_LABEL[t]}
          </button>
        ))}
      </div>
      <p className="leave-info">
        <Info size={16} aria-hidden />
        {type === "SICK"
          ? "L4 obowiązuje od razu — dni trafią do timesheetu jako nieobecność. Dokument dostarcz do HR; potwierdzą go w systemie."
          : "Wniosek zaakceptuje supervisor albo Installation Manager projektu, albo HR. Do tego czasu dni są oznaczone jako „czeka na akceptację”."}
      </p>
      <div className="form-grid">
        <Field label="Od" htmlFor="lv-from">
          <DatePicker
            id="lv-from"
            value={from}
            min={min}
            onChange={(v) => {
              if (!v) return;
              setFrom(v);
              if (v > to) setTo(v);
            }}
          />
        </Field>
        <Field label="Do" htmlFor="lv-to">
          <DatePicker id="lv-to" value={to} onChange={(v) => v && setTo(v)} min={from} rangeStart={from} />
        </Field>
      </div>
      <p className="leave-summary">
        <strong>{daysCount(days)} roboczych</strong>
        {projects.length > 0 ? (
          <>
            {" "}
            · w tym czasie{" "}
            {projects.map((p) => (
              <span key={p.id} className="project-tag">
                <ProjectDot color={p.color} />
                {p.name}
              </span>
            ))}
          </>
        ) : (
          " · bez zadania w projekcie w tym czasie"
        )}
      </p>
      <label className="field">
        <span className="field__label">
          Uwagi <span className="field__optional">(opcjonalnie)</span>
        </span>
        <textarea className="control control--area" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Dialog>
  );
}

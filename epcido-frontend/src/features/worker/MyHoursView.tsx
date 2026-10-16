import { useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, Lock, Minus, Plus, Send } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { DayCell } from "../../components/DayCell";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { ProjectDot } from "../../components/PersonBadge";
import { ABSENCE_LABEL, dayStateOf, formatDuration, statusLabel, workedMinutes } from "../../domain/labels";
import { editDeadline, workerCanEdit } from "../../domain/workflow";
import type { AbsenceType, DayEntry, Project } from "../../domain/types";
import { addDays, eachDay, formatDay, formatMinutes, isoWeek, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { cityOf } from "../../lib/search";

const BREAKS = [0, 15, 30, 45, 60];

/** Ekran pracownika (i Team Leadera): wpis dnia w kilku dotknięciach, tydzień w kolorach, nieobecność. */
export function MyHoursView() {
  const model = useModel();
  const user = useUser();
  const today = todayISO();
  const [date, setDate] = useState<ISODate>(today);
  const [absence, setAbsence] = useState(false);
  const week = startOfWeek(date);
  const days = eachDay(week, addDays(week, 6));
  const mine = model.entriesOf(user.id);

  const projectFor = (d: ISODate): Project | null => {
    const a = model.activeAssignment(user.id, d);
    if (a) return model.projectById.get(a.projectId) ?? null;
    return model.projects.find((p) => p.supervisorId === user.id && p.startDate <= d) ?? null;
  };
  const project = projectFor(date);
  const record = mine.get(date);
  const entry = record?.entry;
  const weekMinutes = days.reduce((s, d) => s + workedMinutes(mine.get(d)?.entry), 0);

  return (
    <div className="page worker">
      <section className="worker__project">
        {project ? (
          <>
            <ProjectDot color={project.color} />
            <div>
              <strong>{project.name}</strong>
              <span>
                {project.customerName}, {cityOf(project)}
              </span>
            </div>
          </>
        ) : (
          <p>Nie masz projektu na ten dzień. Zapytaj supervisora albo Planning.</p>
        )}
      </section>

      <DayEditor
        key={`${date}-${entry?.status ?? "none"}-${entry?.start ?? ""}-${entry?.end ?? ""}`}
        date={date}
        today={today}
        entry={entry}
        project={project}
      />

      <button type="button" className="btn btn--secondary btn--block worker__absence" onClick={() => setAbsence(true)}>
        <CalendarOff size={18} aria-hidden />
        Zgłoś nieobecność
      </button>

      <section className="worker__week" aria-label="Tydzień">
        <header className="worker__week-head">
          <button type="button" className="icon-btn" onClick={() => setDate(addDays(week, -7))} aria-label="Poprzedni tydzień">
            <ChevronLeft size={20} />
          </button>
          <div>
            <strong>Tydzień {isoWeek(week).week}</strong>
            <span>{formatDuration(weekMinutes)} pracy</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setDate(addDays(week, 7) > today ? today : addDays(week, 7))}
            aria-label="Następny tydzień"
            disabled={addDays(week, 7) > today}
          >
            <ChevronRight size={20} />
          </button>
        </header>
        <ul className="worker__days">
          {days.map((d) => {
            const e = mine.get(d)?.entry;
            const future = d > today;
            return (
              <li key={d}>
                <button
                  type="button"
                  className={`wday ${d === date ? "is-selected" : ""} ${weekdayIndex(d) >= 5 ? "is-weekend" : ""}`}
                  onClick={() => setDate(d)}
                  disabled={future}
                >
                  <DayCell state={dayStateOf(e)} size="map" sent={e?.exported} today={d === today} label={statusLabel(e)} />
                  <span className="wday__date">{formatDay(d)}</span>
                  <span className="wday__hours">{describe(e)}</span>
                  <span className={`wday__status ${e?.status === "REJECTED" ? "is-rejected" : ""}`}>{e ? short(e) : future ? "" : "brak wpisu"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {absence && <AbsenceDialog onClose={() => setAbsence(false)} />}
    </div>
  );
}

function DayEditor({ date, today, entry, project }: { date: ISODate; today: ISODate; entry: DayEntry | undefined; project: Project | null }) {
  const data = useData();
  const user = useUser();
  const [start, setStart] = useState(entry?.start ?? 420);
  const [end, setEnd] = useState(entry?.end ?? 1020);
  const [breakMin, setBreakMin] = useState(entry?.breakMin ?? 30);
  const [saving, setSaving] = useState(false);
  const editable = Boolean(project) && workerCanEdit(date, entry, today) && entry?.kind !== "ABSENCE";
  const worked = Math.max(0, end - start - breakMin);
  const deadline = editDeadline(startOfWeek(date));

  return (
    <section className={`worker__day ${entry ? `is-${dayStateOf(entry)}` : ""}`} aria-label="Wybrany dzień">
      <header className="worker__day-head">
        <h2>
          {formatDay(date)}
          {date === today && <span>, dziś</span>}
        </h2>
        {entry && <span className={`badge ${badgeClass(entry)}`}>{statusLabel(entry)}</span>}
      </header>

      {entry?.status === "REJECTED" && (
        <p className="worker__reject">
          Odrzucone: <strong>{entry.rejectionReason ?? "bez powodu"}</strong>. Popraw godziny i wyślij ponownie.
        </p>
      )}

      {entry?.kind === "ABSENCE" ? (
        <p className="worker__absent">Nieobecność: {ABSENCE_LABEL[entry.absence ?? "OTHER"].toLowerCase()}</p>
      ) : editable ? (
        <>
          <div className="time-pair">
            <TimeStepper label="Start" value={start} onChange={setStart} />
            <span className="time-pair__arrow" aria-hidden>
              →
            </span>
            <TimeStepper label="Koniec" value={end} onChange={setEnd} />
          </div>
          <div className="break-choice" role="radiogroup" aria-label="Przerwa">
            <span className="break-choice__label">Przerwa (minuty)</span>
            <div className="break-choice__options">
              {BREAKS.map((b) => (
                <button key={b} type="button" role="radio" aria-checked={breakMin === b} className={breakMin === b ? "is-selected" : ""} onClick={() => setBreakMin(b)}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <p className="worker__total">
            Czas pracy: <strong>{formatDuration(worked)}</strong>
          </p>
          <button
            type="button"
            className="btn btn--primary btn--xl btn--block"
            disabled={saving || worked <= 0}
            onClick={async () => {
              setSaving(true);
              await data.submitHours({ projectId: project!.id, employeeId: user.id, date, start, end, breakMin });
              setSaving(false);
            }}
          >
            <Send size={20} aria-hidden />
            {entry ? "Wyślij poprawione godziny" : "Wyślij do zatwierdzenia"}
          </button>
          <p className="worker__hint">Możesz poprawiać do {formatDay(deadline)}, dopóki supervisor nie zatwierdzi.</p>
        </>
      ) : entry ? (
        <div className="worker__readonly">
          <p className="time-readonly">
            {formatMinutes(entry.start ?? 0)} <span aria-hidden>→</span> {formatMinutes(entry.end ?? 0)}
          </p>
          <p className="worker__total">
            Przerwa {entry.breakMin ?? 0} min, czas pracy <strong>{formatDuration(workedMinutes(entry))}</strong>
          </p>
          <p className="worker__hint">
            <Lock size={14} aria-hidden /> Zatwierdzone godziny nie mogą być zmienione.
          </p>
        </div>
      ) : (
        <p className="worker__hint">
          <Lock size={14} aria-hidden /> {project ? "Termin na wpis tego dnia minął. Napisz do supervisora." : "Brak projektu na ten dzień."}
        </p>
      )}
    </section>
  );
}

function TimeStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(24 * 60 - 15, Math.max(0, v)));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <span className="stepper__value" aria-live="polite">
        {formatMinutes(value)}
      </span>
      <div className="stepper__buttons">
        <button type="button" onClick={() => set(value - 15)} aria-label={`${label}: 15 minut wcześniej`}>
          <Minus size={20} />
        </button>
        <button type="button" onClick={() => set(value + 15)} aria-label={`${label}: 15 minut później`}>
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

function AbsenceDialog({ onClose }: { onClose: () => void }) {
  const data = useData();
  const user = useUser();
  const today = todayISO();
  const [type, setType] = useState<AbsenceType>("LEAVE");
  const [from, setFrom] = useState<ISODate>(today);
  const [to, setTo] = useState<ISODate>(today);
  const [note, setNote] = useState("");
  const types = useMemo(() => Object.keys(ABSENCE_LABEL) as AbsenceType[], []);
  return (
    <Dialog
      title="Zgłoś nieobecność"
      description="Supervisor zatwierdzi ją razem z godzinami. Weekendy są pomijane."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              if (await data.reportAbsence({ employeeId: user.id, from, to, type, note: note.trim() || undefined })) onClose();
            }}
          >
            Zgłoś nieobecność
          </button>
        </>
      }
    >
      <div className="reasons" role="radiogroup" aria-label="Rodzaj">
        {types.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className={`chip chip--choice ${type === t ? "is-selected" : ""}`} onClick={() => setType(t)}>
            {ABSENCE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <Field label="Od" htmlFor="ab-from">
          <DatePicker
            id="ab-from"
            value={from}
            onChange={(v) => {
              if (!v) return;
              setFrom(v);
              if (v > to) setTo(v);
            }}
          />
        </Field>
        <Field label="Do" htmlFor="ab-to">
          <DatePicker id="ab-to" value={to} onChange={(v) => v && setTo(v)} min={from} rangeStart={from} />
        </Field>
      </div>
      <label className="field">
        <span className="field__label">Uwagi (opcjonalnie)</span>
        <textarea className="control control--area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Dialog>
  );
}

function describe(e: DayEntry | undefined) {
  if (!e) return "";
  if (e.kind === "ABSENCE") return ABSENCE_LABEL[e.absence ?? "OTHER"];
  return `${formatMinutes(e.start ?? 0)}–${formatMinutes(e.end ?? 0)}`;
}

function short(e: DayEntry) {
  if (e.exported) return "wysłane";
  if (e.status === "REJECTED") return "do poprawy";
  if (e.status === "SUBMITTED") return "do zatwierdzenia";
  return "zatwierdzone";
}

function badgeClass(e: DayEntry) {
  if (e.status === "REJECTED") return "badge--absent";
  if (e.status === "SUBMITTED") return "badge--pending";
  return "badge--approved";
}

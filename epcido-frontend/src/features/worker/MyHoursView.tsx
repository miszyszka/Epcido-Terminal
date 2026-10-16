import { useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, History, Lock, Send } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { DatePicker } from "../../components/DatePicker";
import { DayCell } from "../../components/DayCell";
import { Dialog } from "../../components/Dialog";
import { Field } from "../../components/Field";
import { ProjectDot } from "../../components/PersonBadge";
import { BreakChoice, TimeStepper } from "../../components/TimeStepper";
import { ABSENCE_LABEL, formatDuration, workedMinutes } from "../../domain/labels";
import { approvalNote, approveByDay, dayView, editRight, statusText } from "../../domain/workflow";
import type { AbsenceType, DayEntry, DayState, Project } from "../../domain/types";
import { addDays, eachDay, formatDay, formatMinutes, formatTimestamp, isoWeek, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { cityOf } from "../../lib/search";

/**
 * Ekran pracownika (i Team Leadera): wpis dnia w kilku dotknięciach, tydzień w kolorach, nieobecność.
 * Dzień można poprawiać, dopóki nikt go nie zatwierdził. W przerwie (brak zadania) nie ma wpisu godzin.
 */
export function MyHoursView() {
  const model = useModel();
  const user = useUser();
  const now = useNow();
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
  const record = mine.get(date);
  const entry = record?.entry;
  const project = record ? model.projectById.get(record.projectId) ?? null : projectFor(date);
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
          <p>
            <strong>Przerwa.</strong> W tym dniu nie masz zadania w projekcie, więc nie wpisujesz godzin.
          </p>
        )}
      </section>

      <DayEditor
        key={`${date}-${entry?.status ?? "none"}-${entry?.start ?? ""}-${entry?.end ?? ""}-${entry?.kind ?? ""}`}
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
            const v = dayView(e, d, now);
            const onBreak = !e && !projectFor(d);
            return (
              <li key={d}>
                <button
                  type="button"
                  className={`wday ${d === date ? "is-selected" : ""} ${weekdayIndex(d) >= 5 ? "is-weekend" : ""}`}
                  onClick={() => setDate(d)}
                  disabled={future}
                >
                  <DayCell state={v.state} size="map" sent={v.sent} today={d === today} label={statusText(e, d, now)} />
                  <span className="wday__date">{formatDay(d)}</span>
                  <span className="wday__hours">{describe(e)}</span>
                  <span className={`wday__status ${v.state === "missed" ? "is-missed" : ""}`}>
                    {e ? short(v.state, v.sent) : future ? "" : onBreak ? "przerwa" : "brak wpisu"}
                  </span>
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
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const [start, setStart] = useState(entry?.start ?? 420);
  const [end, setEnd] = useState(entry?.end ?? 1020);
  const [breakMin, setBreakMin] = useState(entry?.breakMin ?? 30);
  const [saving, setSaving] = useState(false);
  const right = project ? editRight(model, user, project.id, user.id, date, entry, now) : null;
  const editable = Boolean(right?.can) && entry?.kind !== "ABSENCE";
  const worked = Math.max(0, end - start - breakMin);
  const unchanged = entry?.kind === "WORK" && entry.start === start && entry.end === end && (entry.breakMin ?? 0) === breakMin;
  const v = dayView(entry, date, now);
  const changes = (entry?.history ?? []).filter((h) => h.byId !== user.id);
  const lockText = entry && !editable ? right?.reason ?? approvalNote(model, user.id, date, entry, now).split("\n")[0] : null;

  return (
    <section className={`worker__day ${entry ? `is-${v.state}` : ""}`} aria-label="Wybrany dzień">
      <header className="worker__day-head">
        <h2>
          {formatDay(date)}
          {date === today && <span>, dziś</span>}
        </h2>
        {entry && <span className={`badge ${badgeClass(v.state)}`}>{statusText(entry, date, now)}</span>}
      </header>

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
          <BreakChoice value={breakMin} onChange={setBreakMin} />
          <p className="worker__total">
            Czas pracy: <strong>{formatDuration(worked)}</strong>
          </p>
          <button
            type="button"
            className="btn btn--primary btn--xl btn--block"
            disabled={saving || worked <= 0 || unchanged}
            onClick={async () => {
              setSaving(true);
              await data.submitHours({ projectId: project!.id, employeeId: user.id, date, start, end, breakMin });
              setSaving(false);
            }}
          >
            <Send size={20} aria-hidden />
            {!entry ? "Wyślij do zatwierdzenia" : unchanged ? "Wysłane — czeka na supervisora" : "Wyślij poprawione godziny"}
          </button>
          <p className="worker__hint">
            Możesz poprawiać, dopóki supervisor nie zatwierdzi — najpóźniej do {formatDay(approveByDay(startOfWeek(date)))}, 23:59.
          </p>
        </>
      ) : entry ? (
        <div className="worker__readonly">
          <p className="time-readonly">
            {formatMinutes(entry.start ?? 0)} <span aria-hidden>→</span> {formatMinutes(entry.end ?? 0)}
          </p>
          <p className="worker__total">
            Przerwa {entry.breakMin ?? 0} min, czas pracy <strong>{formatDuration(workedMinutes(entry))}</strong>
          </p>
        </div>
      ) : null}

      {lockText && (
        <p className={`worker__hint ${v.state === "missed" ? "worker__hint--missed" : ""}`}>
          <Lock size={14} aria-hidden /> {lockText}
        </p>
      )}
      {!entry && !editable && (
        <p className="worker__hint">
          <Lock size={14} aria-hidden /> {project ? right?.reason ?? "Tego dnia nie można już wpisać." : "Przerwa — bez zadania w projekcie."}
        </p>
      )}

      {changes.length > 0 && (
        <div className="worker__changes">
          <h3>
            <History size={14} aria-hidden /> Zmiany od supervisora
          </h3>
          <ul>
            {changes.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <span>
                  {h.byName} · {formatTimestamp(h.at)}
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
      description="Supervisor zatwierdzi ją razem z godzinami. Weekendy i dni bez zadania są pomijane."
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

function short(state: DayState, sent: boolean) {
  if (sent) return "wysłane";
  if (state === "missed") return "nie wysłane";
  if (state === "pending") return "do zatwierdzenia";
  if (state === "absent") return "nieobecność";
  return "zatwierdzone";
}

function badgeClass(state: DayState) {
  if (state === "missed") return "badge--missed";
  if (state === "pending") return "badge--pending";
  if (state === "absent") return "badge--absent";
  return "badge--approved";
}

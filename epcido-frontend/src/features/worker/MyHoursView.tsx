import { useMemo, useState } from "react";
import { CalendarOff, Check, ChevronLeft, ChevronRight, History, Lock, Send, TriangleAlert, X } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { DayCell } from "../../components/DayCell";
import { ProjectDot } from "../../components/PersonBadge";
import { BreakChoice, TimeStepper } from "../../components/TimeStepper";
import { ABSENCE_LABEL, formatDuration, workedMinutes } from "../../domain/labels";
import { cellView, sheetsFor, WITHHELD_MESSAGE, type CellView } from "../../domain/timesheets";
import { approvalNote, approveByDay, approveTime, editRight, leaveNote, statusText } from "../../domain/workflow";
import { seesDispatch } from "../../domain/permissions";
import type { DayEntry, DayState, LeaveRequest, Project } from "../../domain/types";
import { addDays, eachDay, formatDay, formatMinutes, formatTimestamp, isoWeek, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { LeaveDialog, workdays } from "../leaves/LeaveDialog";
import { leaveDates, LeaveKind, LeaveStatusBadge } from "../leaves/LeaveParts";
import { cityOf } from "../../lib/search";

/**
 * Ekran pracownika (i Team Leadera): wpis dnia w kilku dotknięciach, tydzień w kolorach, wnioski o nieobecność.
 * Dzień można poprawiać, dopóki nikt go nie zatwierdził. W przerwie (brak zadania) nie ma wpisu godzin.
 * Pracownik i TL nie widzą wysyłki do Dataverse ani wstrzymanych timesheetów — to zadanie osób zatwierdzających.
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
  const sheets = sheetsFor(model, now);
  const dispatch = seesDispatch(user);
  const viewOf = (d: ISODate): CellView => {
    const pid = mine.get(d)?.projectId ?? projectFor(d)?.id;
    return pid ? cellView(sheets, pid, user.id, d, mine.get(d)?.entry, !dispatch) : { state: "off", sent: false, closed: false, missing: false };
  };
  // Wstrzymane timesheety z ostatnich tygodni — tylko dla osób, które zatwierdzają (np. supervisor na swoim ekranie)
  const withheld = useMemo(() => {
    const out: { week: ISODate; project: Project }[] = [];
    if (!dispatch) return out;
    for (let i = 1; i <= 4; i++) {
      const w = addDays(startOfWeek(today), -7 * i);
      const ids = new Set(eachDay(w, addDays(w, 6)).map((d) => mine.get(d)?.projectId ?? projectFor(d)?.id).filter((x): x is string => Boolean(x)));
      for (const id of ids) if (sheets.get(id, w)?.status === "withheld") out.push({ week: w, project: model.projectById.get(id)! });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, sheets, today, user.id, dispatch]);
  const myLeaves = model
    .leavesOf(user.id)
    .filter((l) => l.status === "PENDING" || (l.status === "APPROVED" && l.to >= addDays(today, -14)) || (l.status === "REJECTED" && (l.decidedAt ?? "") >= addDays(today, -30)))
    .sort((a, b) => b.from.localeCompare(a.from));

  return (
    <div className="page worker">
      {withheld.map((w) => (
        <button key={`${w.project.id}-${w.week}`} type="button" className="worker__withheld" onClick={() => setDate(w.week)}>
          <TriangleAlert size={18} aria-hidden />
          <span>
            <strong>
              Tydzień {isoWeek(w.week).week} · {w.project.name}: timesheet nie został wysłany.
            </strong>{" "}
            {WITHHELD_MESSAGE}
          </span>
        </button>
      ))}
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
        dispatch={dispatch}
        leave={model.leaveOn(user.id, date)}
      />

      <button type="button" className="btn btn--secondary btn--block worker__absence" onClick={() => setAbsence(true)}>
        <CalendarOff size={18} aria-hidden />
        Zgłoś urlop albo L4
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
            const v = viewOf(d);
            const onBreak = !e && !projectFor(d);
            return (
              <li key={d}>
                <button
                  type="button"
                  className={`wday ${d === date ? "is-selected" : ""} ${weekdayIndex(d) >= 5 ? "is-weekend" : ""}`}
                  onClick={() => setDate(d)}
                  disabled={future}
                >
                  <DayCell
                    state={v.state}
                    size="map"
                    sent={v.sent}
                    closed={v.closed}
                    today={d === today}
                    label={statusText(model, mine.get(d)?.projectId ?? projectFor(d)?.id ?? null, user.id, d, e, now, user)}
                  />
                  <span className="wday__date">{formatDay(d)}</span>
                  <span className="wday__hours">{describe(e)}</span>
                  <span className={`wday__status ${v.state === "missed" ? "is-missed" : ""} ${pendingLeave(d) ? "is-pending-leave" : ""}`}>
                    {v.missing
                      ? "brak wpisu — nie wysłany"
                      : e
                        ? short(v.state, v.sent, v.closed, e)
                        : pendingLeave(d)
                          ? "urlop — czeka"
                          : future
                            ? ""
                            : onBreak
                              ? "przerwa"
                              : "brak wpisu"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <MyLeaves leaves={myLeaves} />

      {absence && <LeaveDialog onClose={() => setAbsence(false)} />}
    </div>
  );

  function pendingLeave(d: ISODate) {
    return model.leaveOn(user.id, d)?.status === "PENDING" && weekdayIndex(d) < 5;
  }
}

/** Moje wnioski: czekające, zaakceptowane (kto i kiedy), odrzucone (z powodem). Czekający można anulować. */
function MyLeaves({ leaves }: { leaves: LeaveRequest[] }) {
  const data = useData();
  if (leaves.length === 0) return null;
  return (
    <section className="worker__leaves" aria-label="Moje wnioski">
      <h2>Moje wnioski</h2>
      <ul>
        {leaves.map((l) => (
          <li key={l.id} className="my-leave">
            <LeaveKind leave={l} />
            <div className="my-leave__main">
              <strong>{leaveDates(l)}</strong>
              <span>
                {workdays(l.from, l.to)} dni rob.
                {l.decidedAt && l.status !== "PENDING" ? ` · ${formatTimestamp(l.decidedAt)}` : ` · wniosek z ${formatTimestamp(l.createdAt)}`}
              </span>
              {l.status === "REJECTED" && l.decisionNote && <em>„{l.decisionNote}”</em>}
            </div>
            <LeaveStatusBadge leave={l} />
            {l.status === "PENDING" && (
              <button type="button" className="icon-btn icon-btn--sm" aria-label="Anuluj wniosek" data-tip="Anuluj wniosek" onClick={() => data.cancelLeave({ leaveId: l.id })}>
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DayEditor({
  date,
  today,
  entry,
  project,
  dispatch,
  leave,
}: {
  date: ISODate;
  today: ISODate;
  entry: DayEntry | undefined;
  project: Project | null;
  dispatch: boolean;
  leave: LeaveRequest | undefined;
}) {
  const data = useData();
  const model = useModel();
  const user = useUser();
  const now = useNow();
  const [start, setStart] = useState(entry?.start ?? 420);
  const [end, setEnd] = useState(entry?.end ?? 1020);
  const [breakMin, setBreakMin] = useState(entry?.breakMin ?? 30);
  const [saving, setSaving] = useState(false);
  const right = project ? editRight(model, user, project.id, user.id, date, entry, now) : null;
  const editable = Boolean(right?.can) && entry?.kind !== "ABSENCE" && leave?.status !== "PENDING";
  const worked = Math.max(0, end - start - breakMin);
  const unchanged = entry?.kind === "WORK" && entry.start === start && entry.end === end && (entry.breakMin ?? 0) === breakMin;
  const v: CellView = project
    ? cellView(sheetsFor(model, now), project.id, user.id, date, entry, !dispatch)
    : { state: "off", sent: false, closed: false, missing: false };
  const changes = (entry?.history ?? []).filter((h) => h.byId !== user.id && !entry?.leaveId);
  const lockText =
    entry && !editable
      ? entry.leaveId && leave
        ? leaveNote(leave)
        : right?.reason ?? approvalNote(model, project!.id, user.id, date, entry, now).split("\n")[0]
      : !entry && leave?.status === "PENDING"
        ? leaveNote(leave)
        : null;

  return (
    <section className={`worker__day ${entry ? `is-${v.state}` : ""}`} aria-label="Wybrany dzień">
      <header className="worker__day-head">
        <h2>
          {formatDay(date)}
          {date === today && <span>, dziś</span>}
        </h2>
        {(entry || v.missing) && <span className={`badge ${badgeClass(v.state)}`}>{statusText(model, project?.id ?? null, user.id, date, entry, now, user)}</span>}
        {!entry && leave?.status === "PENDING" && <span className="badge badge--pending">Urlop — czeka na akceptację</span>}
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
            {unchanged ? <Check size={20} aria-hidden /> : <Send size={20} aria-hidden />}
            {!entry ? "Wyślij do zatwierdzenia" : unchanged ? "Wysłane do supervisora" : "Wyślij poprawione godziny"}
          </button>
          <p className="worker__hint">
            Możesz poprawiać, dopóki supervisor nie zatwierdzi — najpóźniej do {formatDay(approveByDay(startOfWeek(date)))}, {approveTime()}.
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
          <Lock size={14} aria-hidden />
          <span>{lockText}</span>
        </p>
      )}
      {!entry && !editable && leave?.status !== "PENDING" && (
        <p className="worker__hint">
          <Lock size={14} aria-hidden />
          <span>{project ? right?.reason ?? "Tego dnia nie można już wpisać." : "Przerwa — bez zadania w projekcie."}</span>
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

function describe(e: DayEntry | undefined) {
  if (!e) return "";
  if (e.kind === "ABSENCE") return ABSENCE_LABEL[e.absence ?? "OTHER"];
  return `${formatMinutes(e.start ?? 0)}–${formatMinutes(e.end ?? 0)}`;
}

function short(state: DayState, sent: boolean, closed: boolean, e: DayEntry) {
  if (e.kind === "ABSENCE" && e.leaveId) return e.absence === "SICK" ? "L4" : "urlop";
  if (sent) return "wysłane";
  if (closed && state !== "missed") return "zamknięte";
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

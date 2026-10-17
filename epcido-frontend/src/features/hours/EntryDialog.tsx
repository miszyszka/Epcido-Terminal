import { useMemo, useState } from "react";
import { Check, History, Lock } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { useUi } from "../../app/UiContext";
import { MissedMark, SentMark } from "../../components/DayCell";
import { Dialog } from "../../components/Dialog";
import { ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { BreakChoice, TimeStepper } from "../../components/TimeStepper";
import { ABSENCE_LABEL, formatDuration } from "../../domain/labels";
import type { AbsenceType, EntryKind } from "../../domain/types";
import { cellView, sheetsFor } from "../../domain/timesheets";
import { approvalLevel, approvalNote, describeHours, editRight, statusText } from "../../domain/workflow";
import { formatDay, formatTimestamp } from "../../lib/dates";

/** Otwarty dzień z siatki (oś czasu, zatwierdzanie). Okno żyje w układzie aplikacji. */
export function EntryDialogHost() {
  const { entryEditor, closeEntry } = useUi();
  if (!entryEditor) return null;
  return <EntryDialog key={`${entryEditor.projectId}-${entryEditor.employeeId}-${entryEditor.date}`} {...entryEditor} onClose={closeEntry} />;
}

/**
 * Dzień jednej osoby: godziny, przerwa albo nieobecność, notatka zmian.
 * Supervisor, Installation Manager i administrator zmieniają także dni zatwierdzone —
 * każda zmiana zapisuje się w notatce dnia (kto, kiedy, co było, co jest).
 */
function EntryDialog({ projectId, employeeId, date, onClose }: { projectId: string; employeeId: string; date: string; onClose: () => void }) {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const now = useNow();
  const entry = model.entry(projectId, employeeId, date);
  const project = model.projectById.get(projectId);
  const employee = model.employeeById.get(employeeId);
  const right = editRight(model, user, projectId, employeeId, date, entry, now);
  const view = cellView(sheetsFor(model, now), projectId, employeeId, date, entry);
  // Nowy wpis od osoby zatwierdzającej: może go od razu zatwierdzić na swoim poziomie
  const level = useMemo(() => {
    if (!project || !right.asApprover) return null;
    if (right.level) return right.level;
    if (!entry) return approvalLevel(project, user, employeeId, { kind: "WORK", status: "SUBMITTED" });
    return null;
  }, [project, right, entry, user, employeeId]);

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? "WORK");
  const [start, setStart] = useState(entry?.start ?? 420);
  const [end, setEnd] = useState(entry?.end ?? 1020);
  const [breakMin, setBreakMin] = useState(entry?.breakMin ?? 30);
  const [absence, setAbsence] = useState<AbsenceType>(entry?.absence ?? "LEAVE");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  if (!project || !employee) return null;

  const input = { kind, start, end, breakMin, absence };
  const draftText = describeHours({ kind, status: "SUBMITTED", start, end, breakMin, absence });
  const changed = !entry || describeHours(entry) !== draftText;
  const worked = Math.max(0, end - start - breakMin);
  const history = entry?.history ?? [];

  async function save(approveNow: boolean) {
    setSaving(true);
    const ok = await data.editEntry({
      projectId,
      employeeId,
      date,
      input,
      comment: comment.trim() || undefined,
      approveLevel: approveNow ? level : null,
    });
    setSaving(false);
    if (ok) onClose();
  }

  const statusBadge = (
    <span className={`badge badge--${view.state === "missed" ? "missed" : view.state === "pending" ? "pending" : view.state === "off" ? "neutral" : view.state === "absent" ? "absent" : "approved"}`}>
      {view.sent && <SentMark size={10} />}
      {view.state === "missed" && <MissedMark size={10} />}
      {statusText(model, projectId, employeeId, date, entry, now)}
    </span>
  );

  return (
    <Dialog
      title={employee.name}
      description={
        <span className="entry__context">
          <ProjectDot color={project.color} />
          {project.name} · {formatDay(date)}
        </span>
      }
      onClose={onClose}
      footer={
        right.can ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={onClose}>
              Anuluj
            </button>
            {level ? (
              <>
                <button type="button" className="btn btn--secondary" disabled={saving || (!changed && !comment.trim())} onClick={() => save(false)}>
                  Zapisz zmianę
                </button>
                <button type="button" className="btn btn--primary" disabled={saving} onClick={() => save(true)}>
                  <Check size={18} aria-hidden />
                  {changed ? "Zapisz i zatwierdź" : "Zatwierdź"}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--primary" disabled={saving || (!changed && !comment.trim())} onClick={() => save(false)}>
                Zapisz zmianę
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Zamknij
          </button>
        )
      }
    >
      <div className="entry">
        <div className="entry__status">
          {statusBadge}
          {entry && <p className="entry__note">{approvalNote(model, projectId, employeeId, date, entry, now)}</p>}
        </div>

        {!right.can ? (
          <>
            {(entry || !view.missing) && <p className="entry__readonly">{describeHours(entry)}</p>}
            {right.reason && (
              <p className="notice notice--quiet">
                <Lock size={16} aria-hidden />
                <span>{right.reason}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <Segmented<EntryKind>
              label="Rodzaj dnia"
              value={kind}
              onChange={setKind}
              options={[
                { value: "WORK", label: "Praca" },
                { value: "ABSENCE", label: "Nieobecność" },
              ]}
            />
            {kind === "WORK" ? (
              <div className="entry__work">
                <div className="time-pair time-pair--compact">
                  <TimeStepper compact label="Start" value={start} onChange={setStart} />
                  <span className="time-pair__arrow" aria-hidden>
                    →
                  </span>
                  <TimeStepper compact label="Koniec" value={end} onChange={setEnd} />
                </div>
                <BreakChoice value={breakMin} onChange={setBreakMin} />
                <p className="entry__total">
                  Czas pracy: <strong>{formatDuration(worked)}</strong>
                </p>
              </div>
            ) : (
              <div className="reasons" role="radiogroup" aria-label="Rodzaj nieobecności">
                {(Object.keys(ABSENCE_LABEL) as AbsenceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={absence === t}
                    className={`chip chip--choice ${absence === t ? "is-selected" : ""}`}
                    onClick={() => setAbsence(t)}
                  >
                    {ABSENCE_LABEL[t]}
                  </button>
                ))}
              </div>
            )}
            {right.asApprover && (
              <label className="field">
                <span className="field__label">
                  Komentarz do zmiany <span className="field__optional">opcjonalnie</span>
                </span>
                <textarea
                  className="control control--area"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Np. wyjazd z projektu o 15:30"
                />
              </label>
            )}
            {right.asApprover && entry && (
              <p className="entry__hint">Zmiana zapisze się w notatce dnia razem z Twoim imieniem i godziną.</p>
            )}
          </>
        )}

        {history.length > 0 && (
          <section className="entry__history" aria-label="Notatka dnia">
            <h3>
              <History size={15} aria-hidden /> Notatka dnia
            </h3>
            <ol>
              {[...history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span className="entry__history-meta">
                    {formatTimestamp(h.at)} · <strong>{h.byName}</strong>
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Dialog>
  );
}

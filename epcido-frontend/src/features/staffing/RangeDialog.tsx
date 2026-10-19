import { useMemo, useState } from "react";
import { CalendarPlus, Coffee } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DatePicker } from "../../components/DatePicker";
import { Dialog } from "../../components/Dialog";
import { ProjectDot } from "../../components/PersonBadge";
import { SelectMenu } from "../../components/SelectMenu";
import { defaultTask, TASK_SUGGESTIONS } from "../../domain/labels";
import { assignmentEnd, suggestTargets } from "../../domain/staffing";
import type { Employee } from "../../domain/types";
import { addDays, daysBetween, formatDate, todayISO, type ISODate } from "../../lib/dates";
import { daysCount } from "../../lib/text";

export interface RangeDraft {
  employee: Employee;
  from: ISODate;
  to: ISODate;
  /** Projekt podpowiadany z kontekstu (plan projektu) */
  projectId?: string | null;
}

type Mode = "assign" | "home";

/**
 * Co zrobić z zaznaczonym kawałkiem osi osoby: przypisać ją na ten czas do projektu
 * albo zaplanować powrót do domu (przerwa w trwającym zadaniu).
 * Zapis zawsze przechodzi przez potwierdzenie — planista widzi dokładnie, co zmieni.
 */
export function RangeDialog({ draft, onClose, onSaved }: { draft: RangeDraft; onClose: () => void; onSaved?: () => void }) {
  const model = useModel();
  const data = useData();
  const { confirm, toast } = useUi();
  const today = todayISO();
  const [from, setFrom] = useState<ISODate>(draft.from);
  const [to, setTo] = useState<ISODate>(draft.to);
  const [mode, setMode] = useState<Mode>(draft.projectId ? "assign" : "assign");
  const [task, setTask] = useState(defaultTask(draft.employee.trade));
  const [saving, setSaving] = useState(false);

  /** Zadanie, w które wpada zaznaczenie — tylko w nim da się wstawić przerwę. */
  const covering = useMemo(
    () => (model.assignmentsByEmployee.get(draft.employee.id) ?? []).find((a) => a.from <= from && assignmentEnd(model, a) >= from),
    [model, draft.employee.id, from]
  );

  const options = useMemo(() => {
    const suggestions = suggestTargets(model, draft.employee, from);
    return suggestions
      .filter((s) => s.project.startDate <= to && (s.project.endDate ?? "9999-12-31") >= from)
      .map((s) => ({
        value: s.project.id,
        label: s.project.name,
        hint: s.shortage > 0 ? `brakuje ${s.shortage}` : s.need !== null ? `obsadzony ${s.planned}/${s.need}` : "bez zapotrzebowania",
        icon: <ProjectDot color={s.project.color} />,
      }));
  }, [model, draft.employee, from, to]);

  const [projectId, setProjectId] = useState<string | null>(draft.projectId ?? options[0]?.value ?? null);
  const project = projectId ? model.projectById.get(projectId) : null;
  const days = daysBetween(from, to) + 1;

  const clash = useMemo(() => {
    if (mode !== "assign") return null;
    const a = (model.assignmentsByEmployee.get(draft.employee.id) ?? []).find((x) => x.from <= to && assignmentEnd(model, x) >= from);
    return a ? model.projectById.get(a.projectId)?.name ?? "inny projekt" : null;
  }, [mode, model, draft.employee.id, from, to]);

  async function save() {
    if (to < from) {
      toast("Koniec jest przed początkiem.", "error");
      return;
    }
    if (mode === "home") {
      if (!covering) {
        toast("Powrót do domu planuje się w trwającym zadaniu — zaznacz kawałek paska projektu.", "error");
        return;
      }
      const ok = await confirm({
        title: "Zaplanować powrót do domu?",
        lines: [
          `${draft.employee.name} — ${daysCount(days)}`,
          `${formatDate(from)} – ${formatDate(to)}`,
          `Zadanie w ${model.projectById.get(covering.projectId)?.name ?? "projekcie"} zostanie podzielone na dwa.`,
          "W przerwie osoba nie wpisuje godzin.",
        ],
        confirmLabel: "Zaplanuj przerwę",
      });
      if (!ok) return;
      setSaving(true);
      const done = await data.insertBreak({ assignmentId: covering.id, from, days });
      setSaving(false);
      if (done) {
        onSaved?.();
        onClose();
      }
      return;
    }
    if (!project) {
      toast("Wybierz projekt.", "error");
      return;
    }
    const ok = await confirm({
      title: "Zapisać przypisanie?",
      lines: [
        `${draft.employee.name} → ${project.name}`,
        `${task.trim() || defaultTask(draft.employee.trade)}: ${formatDate(from)} – ${formatDate(to)} (${daysCount(days)})`,
        ...(clash ? [`Uwaga: w tym czasie ma już zadanie w ${clash}.`] : []),
      ],
      confirmLabel: "Zapisz przypisanie",
      tone: clash ? "danger" : "default",
    });
    if (!ok) return;
    setSaving(true);
    const done = await data.planAssignment({ employeeId: draft.employee.id, projectId: project.id, from, to, task });
    setSaving(false);
    if (done) {
      onSaved?.();
      onClose();
    }
  }

  return (
    <Dialog
      title={draft.employee.name}
      description={`Zaznaczony okres: ${formatDate(from)} – ${formatDate(to)} · ${daysCount(days)}`}
      onClose={onClose}
      footer={
        <>
          <span className="dialog__count">{mode === "assign" ? (project ? project.name : "wybierz projekt") : covering ? "przerwa w trwającym zadaniu" : "brak zadania w tym dniu"}</span>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
            Dalej
          </button>
        </>
      }
    >
      <div className="rangemode">
        <button type="button" className={`rangemode__btn ${mode === "assign" ? "is-active" : ""}`} onClick={() => setMode("assign")}>
          <CalendarPlus size={17} aria-hidden />
          <span>
            <b>Przypisz do projektu</b>
            <em>osoba pracuje w tym okresie</em>
          </span>
        </button>
        <button type="button" className={`rangemode__btn ${mode === "home" ? "is-active" : ""}`} onClick={() => setMode("home")} disabled={!covering}>
          <Coffee size={17} aria-hidden />
          <span>
            <b>Powrót do domu</b>
            <em>{covering ? "przerwa w trwającym zadaniu" : "tu nie ma zadania do przerwania"}</em>
          </span>
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Od</span>
          <DatePicker value={from} onChange={(v) => v && setFrom(v)} />
        </label>
        <label className="field">
          <span className="field__label">Do</span>
          <DatePicker value={to} onChange={(v) => v && setTo(v)} min={from} rangeStart={from} />
        </label>
      </div>

      {mode === "assign" && (
        <>
          <div className="field">
            <span className="field__label">Projekt</span>
            <SelectMenu
              value={projectId}
              options={options}
              onChange={setProjectId}
              placeholder="Wybierz projekt"
              ariaLabel="Projekt docelowy"
            />
          </div>
          <label className="field">
            <span className="field__label">Zadanie</span>
            <input className="control" list="range-tasks" value={task} onChange={(e) => setTask(e.target.value)} placeholder={defaultTask(draft.employee.trade)} />
            <datalist id="range-tasks">
              {TASK_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          {clash && <p className="notice notice--warn">W tym czasie {draft.employee.name} ma już zadanie w {clash}. Zapis się nie uda, dopóki okresy się nakładają.</p>}
          {from < today && <p className="notice">Okres zaczyna się w przeszłości ({formatDate(from)}).</p>}
        </>
      )}

      {mode === "home" && covering && (
        <p className="notice">
          Zadanie {model.projectById.get(covering.projectId)?.name} zostanie przycięte do {formatDate(addDays(from, -1))}, a dalsza część ruszy{" "}
          {formatDate(addDays(to, 1))}.
        </p>
      )}
    </Dialog>
  );
}

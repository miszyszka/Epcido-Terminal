import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DatePicker } from "../../components/DatePicker";
import { Dialog } from "../../components/Dialog";
import { Field, TextInput } from "../../components/Field";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { defaultTask, TASK_SUGGESTIONS } from "../../domain/labels";
import { restartDate, suggestTargets, type PersonOutlook } from "../../domain/staffing";
import { addDays, daysBetween, formatDate, formatDay, todayISO, type ISODate } from "../../lib/dates";

const BREAKS = [
  { days: 0, label: "Bez przerwy" },
  { days: 7, label: "1 tydzień" },
  { days: 14, label: "2 tygodnie" },
  { days: 21, label: "3 tygodnie" },
];

/**
 * „Zaplanuj dalej": osoba kończy zadanie → przerwa na wyjazd do domu → projekt, w którym brakuje jej branży.
 * Jedno okno zamiast szukania po kilku projektach.
 */
export function PlanNextDialog({
  outlook: o,
  onClose,
  preset,
}: {
  outlook: PersonOutlook;
  onClose: () => void;
  /** Upuszczenie osoby na projekt w Obsadzie: projekt i tydzień */
  preset?: { projectId: string; from: ISODate };
}) {
  const model = useModel();
  const data = useData();
  const { confirm } = useUi();
  const today = todayISO();
  const chainEnd = o.chain && !o.chain.to.startsWith("9999") ? o.chain.to : null;
  const lastDay = o.releaseDate ?? (o.chain ? chainEnd : addDays(today, -1));
  const base = lastDay ?? addDays(today, -1);
  const [breakDays, setBreakDays] = useState(o.stretchWeeksAtEnd >= 6 ? 7 : 0);
  const [from, setFrom] = useState<ISODate>(() => {
    const earliest = restartDate(base, o.stretchWeeksAtEnd >= 6 ? 7 : 0);
    return preset && preset.from > earliest ? preset.from : earliest;
  });
  const [to, setTo] = useState<ISODate | null>(null);
  // Projekt z przeciągnięcia na górze listy — od razu widać, co jest wybrane
  const targets = useMemo(() => {
    const list = suggestTargets(model, o.employee, from, null);
    if (!preset) return list;
    const hit = list.find((t) => t.project.id === preset.projectId);
    return hit ? [hit, ...list.filter((t) => t !== hit)] : list;
  }, [model, o.employee, from, preset]);
  const [projectId, setProjectId] = useState<string | null>(
    () => preset?.projectId ?? targets.find((t) => t.shortage > 0)?.project.id ?? targets[0]?.project.id ?? null
  );
  const [task, setTask] = useState(defaultTask(o.employee.trade));
  const [saving, setSaving] = useState(false);
  const trade = o.employee.trade === "MECHANICAL" ? "mechaników" : "elektryków";
  const chosen = targets.find((t) => t.project.id === projectId);
  const realBreak = lastDay ? daysBetween(lastDay, from) - 1 : 0;

  const pickBreak = (days: number) => {
    setBreakDays(days);
    setFrom(restartDate(base, days));
  };

  return (
    <Dialog
      title={`Zaplanuj dalej: ${o.employee.name}`}
      description={
        <span className="entry__context">
          <PositionMark employee={o.employee} />
          {o.currentProject && o.releaseDate
            ? `Teraz ${o.currentProject.name}, ostatni dzień ${formatDay(o.releaseDate)}`
            : o.currentProject
              ? `Teraz ${o.currentProject.name}`
              : "Bez przydziału"}
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
            disabled={!projectId || saving}
            onClick={async () => {
              if (!projectId) return;
              const agreed = await confirm({
                title: "Zapisać plan?",
                lines: [
                  `${o.employee.name} → ${chosen?.project.name ?? "projekt"}`,
                  `${task.trim() || defaultTask(o.employee.trade)}: ${formatDate(from)} – ${to ? formatDate(to) : "koniec projektu"}`,
                  ...(realBreak > 0 ? [`Wcześniej przerwa: ${realBreak} dni`] : []),
                ],
                confirmLabel: "Zapisz plan",
              });
              if (!agreed) return;
              setSaving(true);
              const ok = await data.planAssignment({ employeeId: o.employee.id, projectId, from, to, task, breakDays: realBreak > 0 ? realBreak : undefined });
              setSaving(false);
              if (ok) onClose();
            }}
          >
            {chosen ? `Zaplanuj: ${chosen.project.name}` : "Zaplanuj"}
          </button>
        </>
      }
    >
      <div className="plan-next">
        {o.stretchWeeksAtEnd >= 6 && (
          <p className="notice notice--warn">
            <TriangleAlert size={16} aria-hidden />
            <span>
              Do końca zadania przepracuje <strong>{o.stretchWeeksAtEnd} tygodni bez przerwy</strong>. Zaplanuj wyjazd do domu.
            </span>
          </p>
        )}

        <div className="field">
          <span className="field__label">Przerwa na wyjazd do domu</span>
          <div className="reasons" role="radiogroup" aria-label="Przerwa">
            {BREAKS.map((b) => (
              <button
                key={b.days}
                type="button"
                role="radio"
                aria-checked={breakDays === b.days}
                className={`chip chip--choice ${breakDays === b.days ? "is-selected" : ""}`}
                onClick={() => pickBreak(b.days)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <Field label="Start w nowym projekcie" htmlFor="pn-from" hint={lastDay ? `Przerwa wyjdzie: ${Math.max(0, realBreak)} dni` : undefined}>
            <DatePicker id="pn-from" value={from} onChange={(v) => v && setFrom(v)} min={today} />
          </Field>
          <Field label="Do" htmlFor="pn-to" optional>
            <DatePicker id="pn-to" value={to} onChange={setTo} min={from} rangeStart={from} placeholder="Do końca projektu" clearable />
          </Field>
        </div>

        <div className="field">
          <span className="field__label">Projekt — najpierw te, gdzie brakuje {trade}</span>
          <ul className="target-list" role="radiogroup" aria-label="Projekt">
            {targets.map((t) => {
              const ends = t.project.endDate ? formatDate(t.project.endDate) : "bez końca";
              const notStarted = t.project.startDate > from;
              return (
                <li key={t.project.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={projectId === t.project.id}
                    className={`target ${projectId === t.project.id ? "is-selected" : ""}`}
                    onClick={() => setProjectId(t.project.id)}
                  >
                    <ProjectDot color={t.project.color} />
                    <span className="target__name">
                      {t.project.name} <span className={`cat cat--${t.project.category.toLowerCase()}`}>{t.project.category}</span>
                      {t.project.id === o.currentProject?.id && <em> · obecny</em>}
                    </span>
                    <span className="target__when">{notStarted ? `start ${formatDate(t.project.startDate)}` : `do ${ends}`}</span>
                    {t.shortage > 0 ? (
                      <span className="target__need is-short">brakuje {t.shortage}</span>
                    ) : t.need ? (
                      <span className="target__need is-ok">
                        obsadzony {t.planned}/{t.need}
                      </span>
                    ) : (
                      <span className="target__need">{t.planned} os.</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <Field label="Zadanie" htmlFor="pn-task">
          <TextInput id="pn-task" list="pn-task-list" value={task} onChange={(e) => setTask(e.target.value)} />
          <datalist id="pn-task-list">
            {TASK_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
      </div>
    </Dialog>
  );
}

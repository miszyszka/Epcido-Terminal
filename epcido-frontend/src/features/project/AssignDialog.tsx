import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { Dialog } from "../../components/Dialog";
import { Field, TextInput } from "../../components/Field";
import { EmploymentTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { TASK_SUGGESTIONS } from "../../domain/labels";
import type { Position } from "../../domain/types";
import { formatDate, todayISO, type ISODate } from "../../lib/dates";
import { matches } from "../../lib/search";
import { people as peopleCount } from "../../lib/text";

type Filter = "all" | Extract<Position, "TEAM_LEADER" | "ELECTRICIAN" | "MECHANIC">;

interface AssignDialogProps {
  projectId: string | null;
  projectStart: ISODate;
  projectEnd: ISODate | null;
  alreadyPlanned: Set<string>;
  onClose: () => void;
  onAssign: (employeeIds: string[], from: ISODate, to: ISODate | null, task: string | null) => void;
}

/** Wybór pracowników do planu: widać, kto jest wolny w wybranym okresie, a kto pracuje gdzie indziej. */
export function AssignDialog({ projectId, projectStart, projectEnd, alreadyPlanned, onClose, onAssign }: AssignDialogProps) {
  const model = useModel();
  const today = todayISO();
  const [from, setFrom] = useState<ISODate>(projectStart > today ? projectStart : today);
  const [to, setTo] = useState<ISODate | null>(projectEnd);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [task, setTask] = useState("");

  const candidates = useMemo(() => {
    const field = model.employees.filter((e) => e.position === "TEAM_LEADER" || e.position === "ELECTRICIAN" || e.position === "MECHANIC");
    return field
      .filter((e) => (filter === "all" || e.position === filter) && matches(query, e.name))
      .map((e) => {
        const busy = (model.assignmentsByEmployee.get(e.id) ?? []).filter(
          (a) => a.projectId !== projectId && a.from <= (to ?? "9999-12-31") && (!a.to || a.to >= from)
        );
        const current = model.activeAssignment(e.id, today);
        return { employee: e, busy, current };
      })
      .sort((a, b) => a.busy.length - b.busy.length || a.employee.name.localeCompare(b.employee.name, "pl", { numeric: true }));
  }, [model, filter, query, from, to, projectId, today]);

  const count = (f: Filter) =>
    model.employees.filter((e) => (f === "all" ? ["TEAM_LEADER", "ELECTRICIAN", "MECHANIC"].includes(e.position) : e.position === f)).length;

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog
      title="Przypisz pracowników"
      description="Wybierz zadanie, okres i osoby. Każde zadanie zmienisz potem na planie: przeciągnij kafelek albo wstaw przerwę."
      onClose={onClose}
      footer={
        <>
          <span className="dialog__count">{chosen.size > 0 ? `Wybrano: ${peopleCount(chosen.size)}` : "Nikogo nie wybrano"}</span>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn--primary" disabled={chosen.size === 0} onClick={() => onAssign([...chosen], from, to, task.trim() || null)}>
            Przypisz ({chosen.size})
          </button>
        </>
      }
    >
      <div className="assign">
        <Field label="Zadanie" htmlFor="as-task" optional hint="Puste = według branży: prace elektryczne albo mechaniczne.">
          <TextInput id="as-task" list="as-task-list" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Np. Montaż tras kablowych" />
          <datalist id="as-task-list">
            {TASK_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <div className="form-grid">
          <Field label="Od" htmlFor="as-from">
            <DatePicker id="as-from" value={from} onChange={(v) => v && setFrom(v)} />
          </Field>
          <Field label="Do" htmlFor="as-to" optional>
            <DatePicker id="as-to" value={to} onChange={setTo} min={from} rangeStart={from} placeholder="Do końca projektu" clearable />
          </Field>
        </div>
        <div className="assign__filters">
          <Segmented<Filter>
            label="Stanowisko"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Wszyscy", count: count("all") },
              { value: "TEAM_LEADER", label: "Team Leaderzy", count: count("TEAM_LEADER") },
              { value: "ELECTRICIAN", label: "Elektrycy", count: count("ELECTRICIAN") },
              { value: "MECHANIC", label: "Mechanicy", count: count("MECHANIC") },
            ]}
          />
          <label className="picker__search assign__search">
            <Search size={16} aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po nazwisku" aria-label="Szukaj osoby" />
          </label>
        </div>
        <ul className="assign__list">
          {candidates.map(({ employee, busy, current }) => {
            const planned = alreadyPlanned.has(employee.id);
            const checked = chosen.has(employee.id);
            const where = busy[0] ? model.projectById.get(busy[0].projectId) : null;
            const currentProject = current ? model.projectById.get(current.projectId) : null;
            return (
              <li key={employee.id}>
                <label className={`assign__item ${planned ? "is-disabled" : ""} ${checked ? "is-checked" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={planned} onChange={() => toggle(employee.id)} />
                  <PositionMark employee={employee} />
                  <span className="assign__name">{employee.name}</span>
                  <EmploymentTag employee={employee} />
                  {planned ? (
                    <span className="assign__status">już w planie — kolejne zadanie dodasz na osi</span>
                  ) : where ? (
                    <span className="assign__status assign__status--busy">
                      <ProjectDot color={where.color} />
                      Kolizja: {where.name} do {busy[0].to ? formatDate(busy[0].to) : "końca"}
                    </span>
                  ) : (
                    <span className="assign__status assign__status--free">
                      wolny
                      {currentProject && current?.to ? `, teraz ${currentProject.name} do ${formatDate(current.to)}` : ""}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}

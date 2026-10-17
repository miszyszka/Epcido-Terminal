import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, TriangleAlert, X } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { CategoryTag, EmploymentTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { defaultTask, formatMonths, isOurs } from "../../domain/labels";
import { assignmentEnd, candidatesFor, weeklyStaffing } from "../../domain/staffing";
import type { DemandPhase, Employee, Project, Trade } from "../../domain/types";
import { addDays, formatDate, formatDay, startOfWeek, todayISO } from "../../lib/dates";

const SHOW = 8;

/**
 * Panel „Obsadź projekt": fazy zapotrzebowania z brakami, proporcja nasi / agencja,
 * kandydaci dopasowani do fazy (dostępność, doświadczenie w kategorii projektu, forma zatrudnienia)
 * i dodawanie jednym kliknięciem — z cofnięciem w komunikacie.
 */
export function StaffPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const model = useModel();
  const data = useData();
  const { openProject } = useUi();
  const today = todayISO();

  // Fazy z obsadą: najsłabszy tydzień fazy (ilu jest w najgorszym tygodniu)
  const phases = useMemo(() => {
    const list: DemandPhase[] = project.demand.length
      ? project.demand
      : [{ id: "all", from: project.startDate, to: project.endDate ?? addDays(project.startDate, 90), electricians: 0, mechanics: 0 }];
    return list
      .filter((d) => d.to >= today)
      .map((d) => {
        const weeks: string[] = [];
        for (let w = startOfWeek(d.from < today ? today : d.from); w <= d.to; w = addDays(w, 7)) weeks.push(w);
        const ws = weeklyStaffing(model, project, weeks.length ? weeks : [startOfWeek(d.from)]);
        const minE = Math.min(...ws.map((w) => w.electrical));
        const minM = Math.min(...ws.map((w) => w.mechanical));
        return { phase: d, electrical: minE, mechanical: minM, shortE: Math.max(0, d.electricians - minE), shortM: Math.max(0, d.mechanics - minM) };
      });
  }, [model, project, today]);

  const [phaseId, setPhaseId] = useState<string | null>(null);
  const current = phases.find((p) => p.phase.id === phaseId) ?? phases.find((p) => p.shortE + p.shortM > 0) ?? phases[0];
  const [trade, setTrade] = useState<Trade | null>(null);
  const activeTrade: Trade = trade ?? (current && current.shortM > current.shortE ? "MECHANICAL" : "ELECTRICAL");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".dialog, .popover")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Zespół w fazie i proporcja nasi / agencja
  const team = useMemo(() => {
    if (!current) return [];
    return (model.assignmentsByProject.get(project.id) ?? [])
      .filter((a) => a.from <= current.phase.to && assignmentEnd(model, a) >= current.phase.from)
      .map((a) => ({ a, e: model.employeeById.get(a.employeeId)! }))
      .filter((x) => x.e)
      .sort((x, y) => x.e.name.localeCompare(y.e.name, "pl", { numeric: true }));
  }, [model, project.id, current]);
  const ours = new Set(team.filter((t) => isOurs(t.e)).map((t) => t.e.id)).size;
  const agency = new Set(team.filter((t) => !isOurs(t.e)).map((t) => t.e.id)).size;
  const preferOurs = agency >= ours;

  const candidates = useMemo(
    () => (current ? candidatesFor(model, project, current.phase, activeTrade, today, preferOurs) : []),
    [model, project, current, activeTrade, today, preferOurs]
  );
  const shown = showAll ? candidates : candidates.slice(0, SHOW);
  const shortHere = activeTrade === "ELECTRICAL" ? current?.shortE ?? 0 : current?.shortM ?? 0;

  return (
    <aside className="staff-panel" aria-label={`Obsadź: ${project.name}`}>
      <header className="staff-panel__head">
        <div>
          <h2>
            <ProjectDot color={project.color} />
            {project.name}
            <CategoryTag category={project.category} />
          </h2>
          <p>
            {project.startDate > today ? `start ${formatDay(project.startDate)}` : `od ${formatDate(project.startDate)}`} ·{" "}
            {project.endDate ? `koniec ${formatDate(project.endDate)}` : "bez daty końca"} · {project.customerName}
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Zamknij panel">
          <X size={18} />
        </button>
      </header>

      <div className="staff-panel__body">
        <section className="ours-bar" aria-label="Nasi i agencja">
          <div className="ours-bar__track">
            <span className="ours-bar__ours" style={{ flex: ours || 0.0001 }} />
            <span className="ours-bar__agency" style={{ flex: agency || 0.0001 }} />
            <i className="ours-bar__mid" aria-hidden />
          </div>
          <p className={agency > ours ? "is-warn" : ""}>
            {agency > ours ? <TriangleAlert size={14} aria-hidden /> : null}
            Nasi (UoP, B2B): <strong>{ours}</strong> · agencja: <strong>{agency}</strong>
            {agency > ours ? " — za dużo agencji, cel: co najmniej połowa naszych" : ""}
          </p>
        </section>

        {phases.length === 0 ? (
          <p className="notice notice--quiet">Projekt nie ma przyszłych faz zapotrzebowania. PM dodaje je w danych projektu.</p>
        ) : (
          <section aria-label="Fazy zapotrzebowania">
            <h3 className="staff-panel__h3">Fazy zapotrzebowania</h3>
            <ul className="phase-list">
              {phases.map((p, i) => {
                const active = p.phase.id === current?.phase.id;
                return (
                  <li key={p.phase.id}>
                    <button type="button" className={`phase-card ${active ? "is-active" : ""}`} onClick={() => setPhaseId(p.phase.id)} aria-pressed={active}>
                      <span className="phase-card__when">
                        <strong>Faza {i + 1}</strong> {formatDate(p.phase.from).replace(/ \d{4}$/, "")} – {formatDate(p.phase.to)}
                      </span>
                      <span className="phase-card__need">
                        <Need label="Elektrycy" have={p.electrical} need={p.phase.electricians} />
                        <Need label="Mechanicy" have={p.mechanical} need={p.phase.mechanics} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {current && (
          <section aria-label="Kandydaci">
            <div className="staff-panel__row">
              <h3 className="staff-panel__h3">
                Kandydaci {shortHere > 0 ? <em className="is-short">brakuje {shortHere}</em> : <em>faza obsadzona</em>}
              </h3>
              <Segmented<Trade>
                label="Branża"
                value={activeTrade}
                onChange={(t) => {
                  setTrade(t);
                  setShowAll(false);
                }}
                options={[
                  { value: "ELECTRICAL", label: "Elektrycy", count: current.shortE },
                  { value: "MECHANICAL", label: "Mechanicy", count: current.shortM },
                ]}
              />
            </div>
            <p className="staff-panel__hint">
              Najpierw ci, którzy mogą zacząć od początku fazy, potem {preferOurs ? "nasi przed agencją, potem " : ""}doświadczenie w {project.category}.
            </p>
            {candidates.length === 0 ? (
              <p className="notice notice--warn">Nikt z tej branży nie jest wolny w tej fazie. Trzeba szukać poza obecną załogą.</p>
            ) : (
              <ul className="cand-list">
                {shown.map((c) => (
                  <li key={c.employee.id} className="cand">
                    <div className="cand__who">
                      <PositionMark employee={c.employee} />
                      <strong>{c.employee.name}</strong>
                      <EmploymentTag employee={c.employee} />
                    </div>
                    <div className="cand__facts">
                      <span className={c.experience > 0 ? "cand__exp" : "cand__exp is-none"}>
                        {project.category} {formatMonths(c.experience)}
                      </span>
                      <span>łącznie {formatMonths(c.employee.experience?.totalMonths ?? 0)}</span>
                      <span className={c.lateDays ? "cand__late" : "cand__ok"}>
                        {c.lateDays ? `od ${formatDate(c.start).replace(/ \d{4}$/, "")}` : "od startu fazy"}
                        {c.breakDays ? `, po przerwie ${c.breakDays} dni` : ""}
                      </span>
                      {c.outlook.currentProject && <span className="muted">teraz {c.outlook.currentProject.name}</span>}
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm cand__add"
                      onClick={() =>
                        data.quickAssign({
                          employeeId: c.employee.id,
                          projectId: project.id,
                          from: c.start,
                          to: current.phase.to,
                          task: defaultTask(activeTrade),
                          breakDays: c.breakDays || undefined,
                        })
                      }
                    >
                      <Plus size={15} aria-hidden />
                      Dodaj
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {candidates.length > SHOW && (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Pokaż mniej" : `Pokaż wszystkich (${candidates.length})`}
              </button>
            )}
          </section>
        )}

        {current && (
          <section aria-label="Zespół w fazie">
            <h3 className="staff-panel__h3">
              Zespół w tej fazie <em>{team.length}</em>
            </h3>
            <ul className="team-list">
              {team.map(({ a, e }) => (
                <TeamRow key={a.id} employee={e} from={a.from} to={a.to} future={a.from > today} onRemove={() => data.removeAssignment(a.id)} />
              ))}
              {team.length === 0 && <li className="muted">Nikogo jeszcze nie ma.</li>}
            </ul>
          </section>
        )}

        <button type="button" className="btn btn--secondary btn--block" onClick={() => openProject(project.id)}>
          <ExternalLink size={16} aria-hidden />
          Otwórz plan zespołu (zadania, przerwy)
        </button>
      </div>
    </aside>
  );
}

function Need({ label, have, need }: { label: string; have: number; need: number }) {
  const short = Math.max(0, need - have);
  return (
    <span className={`need ${need ? (short ? "is-short" : "is-ok") : ""}`}>
      {label} <b>{have}</b>/{need}
    </span>
  );
}

function TeamRow({ employee, from, to, future, onRemove }: { employee: Employee; from: string; to: string | null; future: boolean; onRemove: () => void }) {
  return (
    <li className="team-row">
      <PositionMark employee={employee} />
      <span className="team-row__name">{employee.name}</span>
      <EmploymentTag employee={employee} />
      <span className="team-row__when">
        {formatDate(from).replace(/ \d{4}$/, "")} – {to ? formatDate(to).replace(/ \d{4}$/, "") : "koniec"}
      </span>
      {future && (
        <button type="button" className="icon-btn icon-btn--sm" onClick={onRemove} aria-label={`Usuń ${employee.name} z planu`} data-tip="Usuń z planu (zadanie jeszcze się nie zaczęło)">
          <X size={14} />
        </button>
      )}
    </li>
  );
}

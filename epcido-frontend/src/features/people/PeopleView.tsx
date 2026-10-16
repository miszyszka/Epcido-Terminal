import { useMemo, useState } from "react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DayCell } from "../../components/DayCell";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { SelectMenu } from "../../components/SelectMenu";
import { dayStateOf, describeEntry, POSITION_LABEL, TRADE_LABEL } from "../../domain/labels";
import { can, canEditProject, visibleProjects } from "../../domain/permissions";
import type { Employee } from "../../domain/types";
import { addDays, eachDay, formatDate, formatDay, startOfWeek, todayISO } from "../../lib/dates";
import { matches } from "../../lib/search";

type Filter = "all" | "TEAM_LEADER" | "ELECTRICIAN" | "MECHANIC" | "SUPERVISOR" | "INSTALLATION_MANAGER" | "bench";

const FIELD_POSITIONS: Employee["position"][] = ["TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

export function PeopleView() {
  const model = useModel();
  const user = useUser();
  const { assignToProject } = useData();
  const { search, openProject } = useUi();
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayISO();
  const week = eachDay(startOfWeek(today), addDays(startOfWeek(today), 6));
  const canPlan = can(user, "team.plan");
  const targets = visibleProjects(model, user).filter((p) => p.status !== "CLOSED");

  const staff = useMemo(
    () => model.employees.filter((e) => !["PLANNER", "ADMIN", "PROJECT_MANAGER"].includes(e.position)),
    [model]
  );

  function passes(e: Employee, f: Filter) {
    if (f === "all") return true;
    if (f === "bench") return FIELD_POSITIONS.includes(e.position) && !model.activeAssignment(e.id, today);
    return e.position === f;
  }
  const count = (f: Filter) => staff.filter((e) => passes(e, f)).length;
  const rows = staff.filter((e) => passes(e, filter) && matches(search, e.name, ...model.projectsOf(e.id).map((p) => p.name)));

  return (
    <div className="page">
      <PageHeader
        title="Ludzie"
        description="Wszyscy pracownicy, ich projekty i bieżący tydzień. Okresy pracy ustawisz dokładnie w planie zespołu projektu."
      />

      <Segmented<Filter>
        label="Filtr stanowisk"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Wszyscy", count: count("all") },
          { value: "ELECTRICIAN", label: "Elektrycy", count: count("ELECTRICIAN") },
          { value: "MECHANIC", label: "Mechanicy", count: count("MECHANIC") },
          { value: "TEAM_LEADER", label: "Team Leaderzy", count: count("TEAM_LEADER") },
          { value: "SUPERVISOR", label: "Supervisorzy", count: count("SUPERVISOR") },
          { value: "INSTALLATION_MANAGER", label: "Installation Managerowie", count: count("INSTALLATION_MANAGER") },
          { value: "bench", label: "Bez zespołu", count: count("bench") },
        ]}
      />

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Osoba</th>
              <th scope="col">Stanowisko</th>
              <th scope="col">Projekt teraz</th>
              <th scope="col">Następnie</th>
              <th scope="col">Ten tydzień</th>
              <th scope="col">
                <span className="sr-only">Przydział</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const projects = model.projectsOf(e.id);
              const main = projects[0];
              const next = (model.assignmentsByEmployee.get(e.id) ?? []).find((a) => a.from > today);
              const nextProject = next ? model.projectById.get(next.projectId) : null;
              return (
                <tr key={e.id}>
                  <th scope="row">
                    <span className="person-cell">
                      <PositionMark employee={e} />
                      {e.name}
                    </span>
                  </th>
                  <td className="muted">
                    {POSITION_LABEL[e.position]}
                    {e.position === "TEAM_LEADER" && e.trade ? `, ${TRADE_LABEL[e.trade]}` : ""}
                  </td>
                  <td>
                    {projects.length === 0 ? (
                      <span className="muted">Bez zespołu</span>
                    ) : (
                      <span className="project-list">
                        {projects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="link-btn"
                            onClick={() => canEditProject(user, p) && openProject(p.id)}
                          >
                            <ProjectDot color={p.color} />
                            {p.name}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="muted">
                    {nextProject ? (
                      <span className="project-tag">
                        <ProjectDot color={nextProject.color} />
                        {nextProject.name} od {formatDate(next!.from).replace(/ \d{4}$/, "")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className="week-strip">
                      {week.map((d) => {
                        const entry = model.entriesOf(e.id).get(d)?.entry;
                        return (
                          <DayCell
                            key={d}
                            state={dayStateOf(entry)}
                            size="mini"
                            sent={entry?.exported}
                            today={d === today}
                            label={`${e.name}, ${formatDay(d)}\n${describeEntry(entry)}`}
                          />
                        );
                      })}
                    </span>
                  </td>
                  <td className="cell-action">
                    {canPlan && FIELD_POSITIONS.includes(e.position) && (
                      <SelectMenu
                        variant="action"
                        compact
                        actionLabel={main ? "Przenieś do…" : "Przypisz do…"}
                        ariaLabel={`Przydział: ${e.name}`}
                        value={null}
                        options={targets
                          .filter((p) => p.id !== main?.id)
                          .map((p) => ({
                            value: p.id,
                            label: p.name,
                            hint: p.startDate > today ? `od ${formatDate(p.startDate).replace(/ \d{4}$/, "")}` : "od dziś",
                            icon: <ProjectDot color={p.color} />,
                          }))}
                        onChange={(projectId) => assignToProject(e.id, projectId)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty empty--inline">Nikt nie pasuje do wyszukiwania i filtra.</p>}
      </div>
    </div>
  );
}

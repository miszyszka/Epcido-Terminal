import { useMemo, useState } from "react";
import { useModel } from "../../app/DataContext";
import { useData } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DayCell } from "../../components/DayCell";
import { Select } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { dayStateOf, describeEntry, POSITION_LABEL, TRADE_LABEL } from "../../domain/labels";
import type { Employee } from "../../domain/types";
import { addDays, eachDay, formatDay, startOfWeek, todayISO } from "../../lib/dates";
import { matches } from "../../lib/search";

type Filter = "all" | "TEAM_LEADER" | "ELECTRICIAN" | "MECHANIC" | "SUPERVISOR" | "INSTALLATION_MANAGER" | "bench";

const FIELD_POSITIONS: Employee["position"][] = ["TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

export function PeopleView() {
  const model = useModel();
  const { addMember, moveMember } = useData();
  const { search, openProject } = useUi();
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayISO();
  const week = eachDay(startOfWeek(today), addDays(startOfWeek(today), 6));

  const staff = useMemo(() => model.employees.filter((e) => e.position !== "PLANNER"), [model]);
  const count = (f: Filter) => staff.filter((e) => passes(e, f)).length;

  function passes(e: Employee, f: Filter) {
    if (f === "all") return true;
    if (f === "bench") return FIELD_POSITIONS.includes(e.position) && !model.assignmentByEmployee.has(e.id);
    return e.position === f;
  }

  const rows = staff.filter((e) => passes(e, filter) && matches(search, e.name, ...model.projectsOf(e.id).map((p) => p.name)));

  return (
    <div className="page">
      <PageHeader
        title="Ludzie"
        description="Wszyscy pracownicy, ich projekty i bieżący tydzień. Przypisanie lub przeniesienie zapisuje się od razu."
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
              <th scope="col">Projekt</th>
              <th scope="col">Podlega</th>
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
              const team = main ? model.team(main.id) : null;
              const boss =
                e.position === "SUPERVISOR"
                  ? team?.installationManager
                  : FIELD_POSITIONS.includes(e.position)
                    ? team?.supervisor
                    : null;
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
                          <button key={p.id} type="button" className="link-btn" onClick={() => openProject(p.id)}>
                            <ProjectDot color={p.color} />
                            {p.name}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="muted">{boss?.name ?? "—"}</td>
                  <td>
                    <span className="week-strip">
                      {week.map((d) => {
                        const entry = main ? model.entry(main.id, e.id, d) : undefined;
                        return (
                          <DayCell
                            key={d}
                            state={dayStateOf(entry)}
                            size="mini"
                            today={d === today}
                            future={d > today}
                            label={`${e.name}, ${formatDay(d)}\n${describeEntry(entry)}`}
                          />
                        );
                      })}
                    </span>
                  </td>
                  <td className="cell-action">
                    {FIELD_POSITIONS.includes(e.position) && (
                      <Select
                        aria-label={`Przydział: ${e.name}`}
                        value=""
                        onChange={(ev) => {
                          const target = ev.target.value;
                          if (!target) return;
                          if (model.assignmentByEmployee.has(e.id)) moveMember(e.id, target);
                          else addMember(target, e.id);
                        }}
                        className="control--compact control--quiet"
                      >
                        <option value="">{main ? "Przenieś do…" : "Przypisz do…"}</option>
                        {model.projects
                          .filter((p) => p.id !== main?.id && p.status !== "CLOSED")
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </Select>
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

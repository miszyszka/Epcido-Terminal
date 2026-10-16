import { useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { DayCell } from "../../components/DayCell";
import { Select } from "../../components/Field";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { dayStateOf, describeEntry } from "../../domain/labels";
import type { Employee, Position } from "../../domain/types";
import { addDays, eachDay, formatDate, formatDay, startOfWeek, todayISO } from "../../lib/dates";
import { matches } from "../../lib/search";
import { projectToInput } from "./ProjectForm";

export function TeamPanel({ projectId }: { projectId: string }) {
  const model = useModel();
  const data = useData();
  const team = model.team(projectId);
  if (!team) return null;
  const { project } = team;
  const svs = model.employees.filter((e) => e.position === "SUPERVISOR");

  return (
    <div className="team">
      <section className="team-section">
        <h3 className="team-section__title">Kierownictwo</h3>
        <div className="member member--static">
          {team.installationManager && <PositionMark employee={team.installationManager} />}
          <div className="member__main">
            <span className="member__name">{team.installationManager?.name ?? "Brak Installation Managera"}</span>
            <span className="member__meta">Installation Manager, zatwierdza godziny supervisora</span>
          </div>
        </div>
        <div className="member member--static">
          {team.supervisor && <PositionMark employee={team.supervisor} />}
          <div className="member__main">
            <label className="member__meta" htmlFor="team-sv">
              Supervisor, zatwierdza godziny zespołu
            </label>
            <Select
              id="team-sv"
              className="control--compact"
              value={project.supervisorId ?? ""}
              onChange={(e) => data.updateProject(project.id, { ...projectToInput(project), supervisorId: e.target.value || null })}
            >
              <option value="">Jeszcze nie wybrany</option>
              {svs.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <MemberSection projectId={projectId} title="Team Leaderzy" position="TEAM_LEADER" people={team.teamLeaders} addLabel="Dodaj Team Leadera" />
      <MemberSection projectId={projectId} title="Elektrycy" position="ELECTRICIAN" people={team.electricians} addLabel="Dodaj elektryka" />
      <MemberSection projectId={projectId} title="Mechanicy" position="MECHANIC" people={team.mechanics} addLabel="Dodaj mechanika" />
    </div>
  );
}

function MemberSection({
  projectId,
  title,
  position,
  people,
  addLabel,
}: {
  projectId: string;
  title: string;
  position: Position;
  people: Employee[];
  addLabel: string;
}) {
  const model = useModel();
  const data = useData();
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const week = eachDay(startOfWeek(today), addDays(startOfWeek(today), 6));

  return (
    <section className="team-section">
      <div className="team-section__head">
        <h3 className="team-section__title">
          {title} <span>{people.length}</span>
        </h3>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
          <UserPlus size={16} aria-hidden />
          {addLabel}
        </button>
      </div>

      {adding && <AddPicker projectId={projectId} position={position} onDone={() => setAdding(false)} />}

      {people.length === 0 && !adding && <p className="team-section__empty">Nikogo jeszcze nie ma.</p>}

      <ul className="members">
        {people.map((person) => {
          const assignment = model.assignmentByEmployee.get(person.id);
          return (
            <li key={person.id} className="member">
              <PositionMark employee={person} />
              <div className="member__main">
                <span className="member__name">{person.name}</span>
                {assignment && <span className="member__meta">w zespole od {formatDate(assignment.since)}</span>}
              </div>
              <span className="week-strip" aria-label="Ten tydzień">
                {week.map((d) => {
                  const entry = model.entry(projectId, person.id, d);
                  return (
                    <DayCell
                      key={d}
                      state={dayStateOf(entry)}
                      size="mini"
                      today={d === today}
                      future={d > today}
                      label={`${person.name}, ${formatDay(d)}\n${describeEntry(entry)}`}
                    />
                  );
                })}
              </span>
              {assignment && (
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => data.removeMember(assignment.id)}
                  aria-label={`Usuń ${person.name} z zespołu`}
                  data-tip="Usuń z zespołu"
                >
                  <X size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AddPicker({ projectId, position, onDone }: { projectId: string; position: Position; onDone: () => void }) {
  const model = useModel();
  const data = useData();
  const [query, setQuery] = useState("");
  const candidates = model.employees.filter((e) => e.position === position && matches(query, e.name));
  const free = candidates.filter((e) => !model.assignmentByEmployee.has(e.id));
  const busy = candidates.filter((e) => {
    const a = model.assignmentByEmployee.get(e.id);
    return a && a.projectId !== projectId;
  });

  return (
    <div className="picker">
      <label className="picker__search">
        <Search size={16} aria-hidden />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po nazwisku" aria-label="Szukaj osoby" />
      </label>
      <div className="picker__list">
        <div className="picker__group">Bez zespołu ({free.length})</div>
        {free.length === 0 && <p className="picker__empty">Wszyscy są już w zespołach. Możesz kogoś przenieść.</p>}
        {free.map((e) => (
          <button key={e.id} type="button" className="picker__item" onClick={() => data.addMember(projectId, e.id)}>
            <PositionMark employee={e} />
            <span>{e.name}</span>
            <span className="picker__action">Dodaj</span>
          </button>
        ))}
        {busy.length > 0 && <div className="picker__group">W innych zespołach</div>}
        {busy.map((e) => {
          const from = model.projectById.get(model.assignmentByEmployee.get(e.id)!.projectId);
          return (
            <button key={e.id} type="button" className="picker__item" onClick={() => data.moveMember(e.id, projectId)}>
              <PositionMark employee={e} />
              <span>{e.name}</span>
              <span className="picker__from">
                {from && <ProjectDot color={from.color} />}
                {from?.name}
              </span>
              <span className="picker__action">Przenieś</span>
            </button>
          );
        })}
      </div>
      <div className="picker__foot">
        <button type="button" className="btn btn--quiet btn--sm" onClick={onDone}>
          Gotowe
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useModel, useUser } from "../../app/DataContext";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { ProjectDot } from "../../components/PersonBadge";
import { ScopeFilter, useScope } from "../../components/ScopeFilter";
import { WeekNav } from "../../components/WeekNav";
import { visibleProjects } from "../../domain/permissions";
import { addDays, eachDay, startOfWeek, todayISO } from "../../lib/dates";
import { ProjectCard } from "../grid/ProjectCard";

const WEEKS = 2;

/** Oś czasu: duże komórki z godzinami od–do, przerwą i powodem nieobecności. */
export function TimelineView() {
  const model = useModel();
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const focus = params.get("projekt");
  const personId = params.get("osoba");
  const person = personId ? model.employeeById.get(personId) : null;
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const from = addDays(currentWeek, (offset - (WEEKS - 1)) * 7);
  const days = useMemo(() => eachDay(from, addDays(from, WEEKS * 7 - 1)), [from]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const scope = useScope(model, user);
  let matches = visibleProjects(model, user)
    .filter((p) => scope.pass(p))
    .map((project) => ({ project, people: null as Set<string> | null }));
  if (focus) matches = matches.filter((m) => m.project.id === focus);
  if (person) {
    const only = new Set([person.id]);
    matches = matches
      .filter((m) => model.rows(m.project.id, days[0], days[days.length - 1]).some((r) => r.employee.id === person.id))
      .map((m) => ({ ...m, people: only }));
  }
  const focusProject = focus ? model.projectById.get(focus) : null;

  useEffect(() => {
    document.querySelector(".app-scroll")?.scrollTo({ top: 0 });
  }, [focus, personId]);

  const allCollapsed = matches.length > 0 && matches.every((m) => collapsed.has(m.project.id));
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="page">
      <PageHeader
        title="Oś czasu"
        actions={
          <WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d)} onToday={() => setOffset(0)} isCurrent={offset === 0} />
        }
      />
      <div className="map-bar">
        <Legend />
        <div className="map-bar__tools">
          <ScopeFilter scope={scope} />
          {focusProject && (
            <button
              type="button"
              className="chip chip--filter"
              onClick={() => {
                params.delete("projekt");
                setParams(params);
              }}
            >
              <ProjectDot color={focusProject.color} />
              Tylko {focusProject.name}
              <span className="chip__x" aria-hidden>
                ×
              </span>
              <span className="sr-only">, pokaż wszystkie projekty</span>
            </button>
          )}
          {person && (
            <button
              type="button"
              className="chip chip--filter"
              onClick={() => {
                params.delete("osoba");
                setParams(params);
              }}
            >
              Tylko {person.name}
              <span className="chip__x" aria-hidden>
                ×
              </span>
              <span className="sr-only">, pokaż wszystkich</span>
            </button>
          )}
          {matches.length > 1 && (
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(matches.map((m) => m.project.id)))}
            >
              {allCollapsed ? "Rozwiń wszystkie" : "Zwiń wszystkie"}
            </button>
          )}
        </div>
      </div>
      {matches.length === 0 ? (
        <div className="empty">
          <p>{person ? `${person.name} nie ma zadań w tych tygodniach.` : "Nie masz jeszcze żadnych projektów."}</p>
        </div>
      ) : (
        <div className="pcards">
          {matches.map(({ project, people }) => (
            <ProjectCard
              key={project.id}
              project={project}
              days={days}
              today={today}
              variant="detailed"
              only={people}
              collapsed={collapsed.has(project.id)}
              onToggle={() => toggle(project.id)}
              scope={scope}
            />
          ))}
        </div>
      )}
    </div>
  );
}

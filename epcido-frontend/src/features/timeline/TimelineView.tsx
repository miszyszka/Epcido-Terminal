import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { ProjectDot } from "../../components/PersonBadge";
import { WeekNav } from "../../components/WeekNav";
import { visibleProjects } from "../../domain/permissions";
import { addDays, eachDay, startOfWeek, todayISO } from "../../lib/dates";
import { searchProjects } from "../../lib/search";
import { ProjectCard } from "../grid/ProjectCard";

const WEEKS = 2;

/** Oś czasu: duże komórki z godzinami od–do, przerwą i powodem nieobecności. */
export function TimelineView() {
  const model = useModel();
  const user = useUser();
  const { search } = useUi();
  const [params, setParams] = useSearchParams();
  const focus = params.get("projekt");
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const from = addDays(currentWeek, (offset - (WEEKS - 1)) * 7);
  const days = useMemo(() => eachDay(from, addDays(from, WEEKS * 7 - 1)), [from]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allowed = new Set(visibleProjects(model, user).map((p) => p.id));
  let matches = searchProjects(model, search).filter((m) => allowed.has(m.project.id));
  if (focus) matches = matches.filter((m) => m.project.id === focus);
  const focusProject = focus ? model.projectById.get(focus) : null;

  useEffect(() => {
    document.querySelector(".app-scroll")?.scrollTo({ top: 0 });
  }, [focus]);

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
        description="Godziny od–do, przerwa i powód nieobecności każdej osoby, dzień po dniu."
        actions={
          <WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d)} onToday={() => setOffset(0)} isCurrent={offset === 0} />
        }
      />
      <div className="map-bar">
        <Legend />
        <div className="map-bar__tools">
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
          <p>{search ? `Żaden projekt ani osoba nie pasuje do „${search}".` : "Nie masz jeszcze żadnych projektów."}</p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

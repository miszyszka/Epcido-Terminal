import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, PanelRightOpen } from "lucide-react";
import { useModel, type Team } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { DayCell } from "../../components/DayCell";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { WeekNav } from "../../components/WeekNav";
import { describeProjectDay, projectDay, teamPeopleIds } from "../../domain/aggregate";
import { dayStateOf, describeEntry } from "../../domain/labels";
import type { Employee } from "../../domain/types";
import {
  addDays,
  eachDay,
  formatDay,
  isoWeek,
  isWeekend,
  parseISO,
  startOfWeek,
  todayISO,
  weekdayIndex,
  WEEKDAYS_SHORT,
} from "../../lib/dates";
import { searchProjects } from "../../lib/search";

const WEEKS = 6;

/** Oś czasu: projekty jako grupy, w środku każda osoba dzień po dniu. */
export function TimelineView() {
  const model = useModel();
  const { search, openProject } = useUi();
  const [params, setParams] = useSearchParams();
  const focus = params.get("projekt");
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const from = addDays(currentWeek, (offset - (WEEKS - 1)) * 7);
  const days = useMemo(() => eachDay(from, addDays(from, WEEKS * 7 - 1)), [from]);
  const weekStarts = days.filter((_, i) => i % 7 === 0);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const focusRow = useRef<HTMLTableSectionElement>(null);

  let matches = searchProjects(model, search);
  if (focus) matches = matches.filter((m) => m.project.id === focus);

  useEffect(() => {
    focusRow.current?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const allCollapsed = matches.length > 0 && matches.every((m) => collapsed.has(m.project.id));
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const focusProject = focus ? model.projectById.get(focus) : null;

  return (
    <div className="page page--wide">
      <PageHeader
        title="Oś czasu"
        description="Każdy wiersz to jedna osoba, każda kropka to jeden dzień. W wierszu projektu widać, ile osób pracowało danego dnia."
        actions={
          <WeekNav
            from={from}
            weeks={WEEKS}
            onShift={(d) => setOffset((o) => o + d)}
            onToday={() => setOffset(0)}
            isCurrent={offset === 0}
          />
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
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(matches.map((m) => m.project.id)))}
          >
            {allCollapsed ? "Rozwiń wszystkie" : "Zwiń wszystkie"}
          </button>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty">
          <p>Żaden projekt ani osoba nie pasuje do „{search}".</p>
        </div>
      ) : (
        <div className="timeline-scroll">
          <table className="timeline" style={{ "--days": days.length } as React.CSSProperties}>
            <thead>
              <tr className="timeline__weeks">
                <th className="timeline__corner" rowSpan={2} scope="col">
                  Projekt i zespół
                </th>
                {weekStarts.map((w) => (
                  <th key={w} colSpan={7} scope="colgroup" className={w === currentWeek ? "is-current" : ""}>
                    tydz. {isoWeek(w).week}
                  </th>
                ))}
              </tr>
              <tr className="timeline__days">
                {days.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className={colClass(d, today)}
                  >
                    <span>{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
                    <b>{parseISO(d).getDate()}</b>
                  </th>
                ))}
              </tr>
            </thead>

            {matches.map(({ project, people }) => {
              const team = model.team(project.id)!;
              const isCollapsed = collapsed.has(project.id);
              const rows = orderedRows(team).filter((e) => !people || people.has(e.id));
              const allIds = teamPeopleIds(team);
              return (
                <tbody key={project.id} ref={project.id === focus ? focusRow : undefined}>
                  <tr className="group-row">
                    <th scope="rowgroup" className="group-row__head">
                      <div className="group-row__inner">
                        <button
                          type="button"
                          className={`disclosure ${isCollapsed ? "is-collapsed" : ""}`}
                          onClick={() => toggle(project.id)}
                          aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? "Rozwiń" : "Zwiń"} ${project.name}`}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <ProjectDot color={project.color} />
                        <span className="group-row__name">{project.name}</span>
                        <span className="group-row__count">{allIds.length} os.</span>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm group-row__open"
                          onClick={() => openProject(project.id)}
                          aria-label={`Zespół i dane: ${project.name}`}
                          data-tip="Zespół i dane projektu"
                        >
                          <PanelRightOpen size={16} />
                        </button>
                      </div>
                    </th>
                    {days.map((d) => {
                      const agg = projectDay(model, project.id, allIds, d);
                      const working = agg.approved + agg.pending;
                      return (
                        <td key={d} className={colClass(d, today)}>
                          <span
                            className={`headcount headcount--${agg.state}`}
                            data-tip={`${project.name}, ${formatDay(d)}\n${describeProjectDay(agg)}`}
                          >
                            {working > 0 ? working : ""}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {!isCollapsed &&
                    rows.map((person) => (
                      <tr key={person.id} className="person-row">
                        <th scope="row" className="person-row__head">
                          <PositionMark employee={person} />
                          <span className="person-row__name">{person.name}</span>
                        </th>
                        {days.map((d) => {
                          const entry = model.entry(project.id, person.id, d);
                          return (
                            <td key={d} className={colClass(d, today)}>
                              <DayCell
                                state={dayStateOf(entry)}
                                size="timeline"
                                future={d > today}
                                label={`${person.name}, ${formatDay(d)}\n${describeEntry(entry)}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  {!isCollapsed && rows.length === 0 && (
                    <tr className="person-row person-row--empty">
                      <th scope="row" className="person-row__head">
                        <span className="person-row__name">Brak zespołu</span>
                      </th>
                      <td colSpan={days.length}>
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => openProject(project.id)}>
                          Dodaj osoby do zespołu
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}

function colClass(d: string, today: string): string {
  return [isWeekend(d) ? "is-weekend" : "", d === today ? "is-today" : "", weekdayIndex(d) === 0 ? "is-week-start" : ""]
    .filter(Boolean)
    .join(" ");
}

const ORDER: Employee["position"][] = ["SUPERVISOR", "TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

function orderedRows(team: Team): Employee[] {
  const rows = [...(team.supervisor ? [team.supervisor] : []), ...team.members];
  return rows.sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position));
}

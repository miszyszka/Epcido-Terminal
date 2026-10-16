import { useEffect, useMemo, useRef, useState } from "react";
import { useModel, useUser } from "../../app/DataContext";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { WeekNav } from "../../components/WeekNav";
import { visibleProjects } from "../../domain/permissions";
import { addDays, eachDay, startOfWeek, todayISO } from "../../lib/dates";
import { DaysHead } from "../grid/ProjectDays";
import { ProjectCard } from "../grid/ProjectCard";

const COL = 20; // szerokość kolumny dnia (--col-map)
const NAME_COL = 188;
const NARROW = 720;

/** Ile tygodni zmieści się w szerokości strony (3–10). */
function useWeeksThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ weeks: 8, narrow: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth - 64; // wewnętrzne marginesy karty
      const weeks = Math.max(3, Math.min(10, Math.floor((width - NAME_COL) / (7 * COL))));
      const narrow = el.clientWidth < NARROW;
      setSize((s) => (s.weeks === weeks && s.narrow === narrow ? s : { weeks, narrow }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

/**
 * Mapa: wszystkie widoczne projekty, w każdym ludzie w wierszach i dni w kolumnach.
 * Nawigacja tygodni i nagłówek dni są przyklejone u góry — widać je przy przewijaniu projektów.
 */
export function MapView() {
  const model = useModel();
  const user = useUser();
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const { ref, weeks: WEEKS, narrow } = useWeeksThatFit();
  // bieżący tydzień i jeden następny zawsze widoczne, reszta wstecz
  const from = addDays(currentWeek, (offset - (WEEKS - 2)) * 7);
  const days = useMemo(() => eachDay(from, addDays(from, WEEKS * 7 - 1)), [from, WEEKS]);
  const projects = visibleProjects(model, user);

  return (
    <div className="page" ref={ref}>
      <PageHeader title="Plan projektów" />
      <div className="map-sticky">
        <div className="map-sticky__bar">
          <Legend />
          <WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d)} onToday={() => setOffset(0)} isCurrent={offset === 0} />
        </div>
        {!narrow && projects.length > 0 && (
          <div className="pcard pcard--ruler" aria-hidden>
            <div className="pcard__scroll">
              <table className="days days--compact days--ruler" style={{ width: `calc(var(--name-col) + ${days.length} * var(--col-map))` }}>
                <colgroup>
                  <col className="days__col-person" />
                  {days.map((d) => (
                    <col key={d} />
                  ))}
                </colgroup>
                <DaysHead days={days} today={today} />
              </table>
            </div>
          </div>
        )}
      </div>
      {projects.length === 0 ? (
        <div className="empty">
          <p>Nie masz jeszcze żadnych projektów.</p>
        </div>
      ) : (
        <div className="pcards">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} days={days} today={today} variant="compact" hideDaysHead={!narrow} />
          ))}
        </div>
      )}
    </div>
  );
}

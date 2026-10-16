import { useEffect, useMemo, useRef, useState } from "react";
import { useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { Legend } from "../../components/Legend";
import { PageHeader } from "../../components/PageHeader";
import { WeekNav } from "../../components/WeekNav";
import { visibleProjects } from "../../domain/permissions";
import { addDays, eachDay, startOfWeek, todayISO } from "../../lib/dates";
import { searchProjects } from "../../lib/search";
import { ProjectCard } from "../grid/ProjectCard";

const COL = 20; // szerokość kolumny dnia (--col-map)
const NAME_COL = 188;

/** Ile tygodni zmieści się w szerokości strony (3–10). */
function useWeeksThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(8);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth - 64; // wewnętrzne marginesy karty
      setWeeks(Math.max(3, Math.min(10, Math.floor((width - NAME_COL) / (7 * COL)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, weeks };
}

/** Mapa: wszystkie widoczne projekty, w każdym ludzie w wierszach i dni w kolumnach (8 tygodni). */
export function MapView() {
  const model = useModel();
  const user = useUser();
  const { search } = useUi();
  const today = todayISO();
  const currentWeek = startOfWeek(today);
  const [offset, setOffset] = useState(0);
  const { ref, weeks: WEEKS } = useWeeksThatFit();
  // bieżący tydzień i jeden następny zawsze widoczne, reszta wstecz
  const from = addDays(currentWeek, (offset - (WEEKS - 2)) * 7);
  const days = useMemo(() => eachDay(from, addDays(from, WEEKS * 7 - 1)), [from, WEEKS]);

  const allowed = new Set(visibleProjects(model, user).map((p) => p.id));
  const matches = searchProjects(model, search).filter((m) => allowed.has(m.project.id));

  return (
    <div className="page" ref={ref}>
      <PageHeader
        title="Plan projektów"
        description="Każdy wiersz to osoba, każda kolumna to dzień. Kliknij nazwę projektu, żeby otworzyć jego plan."
        actions={
          <WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d)} onToday={() => setOffset(0)} isCurrent={offset === 0} />
        }
      />
      <div className="map-bar">
        <Legend />
      </div>
      {matches.length === 0 ? (
        <div className="empty">
          <p>{search ? `Żaden projekt ani osoba nie pasuje do „${search}".` : "Nie masz jeszcze żadnych projektów."}</p>
        </div>
      ) : (
        <div className="pcards">
          {matches.map(({ project, people }) => (
            <ProjectCard key={project.id} project={project} days={days} today={today} variant="compact" only={people} />
          ))}
        </div>
      )}
    </div>
  );
}

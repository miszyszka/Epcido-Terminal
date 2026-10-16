import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Coffee, TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { WeekNav } from "../../components/WeekNav";
import {
  assignmentEnd,
  FIELD_POSITIONS,
  LONG_STRETCH_WEEKS,
  needsBreak,
  outlookOf,
  suggestTargets,
  restartDate,
  weeklyStaffing,
  workChains,
  type PersonOutlook,
} from "../../domain/staffing";
import type { Project } from "../../domain/types";
import { addDays, daysBetween, eachDay, formatDate, formatDay, isoWeek, parseISO, startOfWeek, todayISO, weekdayIndex, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { BreakDialog } from "./BreakDialog";
import { PlanNextDialog } from "./PlanNextDialog";

const COL = 56; // px na tydzień = 8 px na dzień
const PX_DAY = COL / 7;

type PeopleFilter = "releasing" | "free" | "long" | "all";
type TradeFilter = "all" | "ELECTRICAL" | "MECHANICAL";

/**
 * Obsada — narzędzie Planningu. Na jednym ekranie:
 *  1. projekty w kolejnych tygodniach: ilu elektryków i mechaników jest vs ilu trzeba, kiedy projekt się kończy,
 *  2. ludzie w czasie: kto się zwalnia, kto jest bez przydziału, kto długo pracuje bez przerwy,
 *  3. jedno okno „Zaplanuj dalej": przerwa na wyjazd + projekt z brakami jego branży.
 */
/** Ile tygodni zmieści się obok kolumny nazw i kolumny „co dalej" (6–16). */
function useWeeksThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(12);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const css = getComputedStyle(el);
      const name = parseFloat(css.getPropertyValue("--staff-name")) || 250;
      const side = parseFloat(css.getPropertyValue("--staff-side")) || 250;
      const pad = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
      const free = el.clientWidth - pad - 28 - name - side;
      setWeeks(Math.max(6, Math.min(16, Math.floor(free / COL))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, weeks };
}

export function StaffingView() {
  const model = useModel();
  const { openProject } = useUi();
  const today = todayISO();
  const { ref, weeks: WEEKS } = useWeeksThatFit();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), (offset - 1) * 7);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from, WEEKS]);
  const rangeEnd = addDays(from, WEEKS * 7 - 1);
  const [filter, setFilter] = useState<PeopleFilter>("releasing");
  const [trade, setTrade] = useState<TradeFilter>("all");
  const [onlyShort, setOnlyShort] = useState(false);
  const [planning, setPlanning] = useState<PersonOutlook | null>(null);
  const [breaking, setBreaking] = useState<PersonOutlook | null>(null);

  const projects = useMemo(
    () =>
      model.projects
        .filter((p) => p.status !== "CLOSED" && (p.endDate ?? "9999-12-31") >= from && p.startDate <= rangeEnd)
        .map((p) => ({ project: p, weeks: weeklyStaffing(model, p, weeks) }))
        .sort((a, b) => (a.project.endDate ?? "9999").localeCompare(b.project.endDate ?? "9999")),
    [model, weeks, from, rangeEnd]
  );
  const shortNow = (w: { shortElectrical: number; shortMechanical: number }[]) => w.slice(1, 6).some((x) => x.shortElectrical + x.shortMechanical > 0);
  const projectsShort = projects.filter((p) => shortNow(p.weeks));

  const people = useMemo(
    () => model.employees.filter((e) => FIELD_POSITIONS.includes(e.position)).map((e) => outlookOf(model, e, today)),
    [model, today]
  );
  const groups = {
    releasing: people.filter((o) => o.status === "releasing").sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!)),
    free: people.filter((o) => o.status === "free"),
    long: people.filter((o) => needsBreak(o, today)).sort((a, b) => b.stretchWeeks - a.stretchWeeks),
    all: [...people].sort((a, b) => a.employee.name.localeCompare(b.employee.name, "pl", { numeric: true })),
  };
  const rows = groups[filter].filter((o) => trade === "all" || o.employee.trade === trade);
  const x = (d: ISODate) => daysBetween(from, d) * PX_DAY;

  return (
    <div className="page staffing" ref={ref}>
      <PageHeader
        title="Obsada"
        actions={<WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d * 4)} onToday={() => setOffset(0)} isCurrent={offset === 0} />}
      />

      <section className="staff-tiles" aria-label="Na co zwrócić uwagę">
        <Tile active={filter === "releasing"} onClick={() => setFilter("releasing")} value={groups.releasing.length} label="zwalnia się w ciągu 8 tygodni" />
        <Tile active={filter === "free"} onClick={() => setFilter("free")} value={groups.free.length} label="bez przydziału" />
        <Tile
          active={filter === "long"}
          onClick={() => setFilter("long")}
          value={groups.long.length}
          label={`${plural(groups.long.length, "pracuje", "pracują", "pracuje")} ${LONG_STRETCH_WEEKS}+ tygodni bez przerwy`}
          tone="warn"
        />
        <Tile active={onlyShort} onClick={() => setOnlyShort((v) => !v)} value={projectsShort.length} label={`${plural(projectsShort.length, "projekt", "projekty", "projektów")} z brakami ludzi`} tone="alert" />
      </section>

      {/* ---------- Projekty ---------- */}
      <section className="staff-card" aria-label="Projekty w kolejnych tygodniach">
        <header className="staff-card__head">
          <h2>Projekty</h2>
          <p className="staff-legend">
            <span>
              <b className="is-ok">E 6/6</b> obsadzony
            </span>
            <span>
              <b className="is-short">E 4/7</b> brakuje ludzi
            </span>
            <span>
              <b>M 5</b> bez zapotrzebowania
            </span>
          </p>
        </header>
        <div className="staff-scroll">
          <div className="staff-grid" style={{ gridTemplateColumns: `var(--staff-name) repeat(${WEEKS}, ${COL}px) var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner="Projekt" trailing=" " />
            {(onlyShort ? projectsShort : projects).map(({ project, weeks: ws }) => {
              const endWeek = project.endDate ? startOfWeek(project.endDate) : null;
              return (
                <div key={project.id} className="staff-row" style={{ ["--project" as string]: project.color }}>
                  <div className="staff-name">
                    <button type="button" className="staff-name__btn" onClick={() => openProject(project.id)}>
                      <ProjectDot color={project.color} />
                      <span>{project.name}</span>
                    </button>
                    <span className="staff-name__sub">{projectWhen(project, today)}</span>
                  </div>
                  {ws.map((w, i) => {
                    const isEnd = endWeek === w.week;
                    const isStart = startOfWeek(project.startDate) === w.week;
                    return (
                      <div
                        key={w.week}
                        className={`staff-cell ${w.active ? "is-active" : ""} ${isEnd ? "is-end" : ""} ${isStart ? "is-start" : ""} ${i === 1 ? "is-now" : ""}`}
                        data-tip={w.active ? cellTip(project, w) : undefined}
                      >
                        {w.active && (
                          <>
                            <Count label="E" have={w.electrical} need={project.needElectricians} short={w.shortElectrical} />
                            <Count label="M" have={w.mechanical} need={project.needMechanics} short={w.shortMechanical} />
                          </>
                        )}
                        {isEnd && project.endDate && (
                          <span className="staff-cell__end" style={{ left: (weekdayIndex(project.endDate) + 1) * PX_DAY }} aria-label={`Koniec ${formatDate(project.endDate)}`} />
                        )}
                      </div>
                    );
                  })}
                  <div className="staff-side staff-side--project">
                    <ProjectNeed project={project} weeks={ws} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Ludzie ---------- */}
      <section className="staff-card" aria-label="Ludzie w czasie">
        <header className="staff-card__head">
          <h2>Ludzie</h2>
          <div className="staff-card__tools">
            <Segmented<PeopleFilter>
              label="Kogo pokazać"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "releasing", label: "Zwalniają się", count: groups.releasing.length },
                { value: "free", label: "Bez przydziału", count: groups.free.length },
                { value: "long", label: "Bez przerwy", count: groups.long.length },
                { value: "all", label: "Wszyscy", count: groups.all.length },
              ]}
            />
            <Segmented<TradeFilter>
              label="Branża"
              value={trade}
              onChange={setTrade}
              options={[
                { value: "all", label: "Obie branże" },
                { value: "ELECTRICAL", label: "Elektrycy" },
                { value: "MECHANICAL", label: "Mechanicy" },
              ]}
            />
          </div>
        </header>
        <div className="staff-scroll">
          <div className="staff-grid staff-grid--people" style={{ gridTemplateColumns: `var(--staff-name) ${WEEKS * COL}px var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner="Osoba" single trailing="Co dalej" />
            {rows.length === 0 && <p className="staff-empty">Nikt nie pasuje do filtra.</p>}
            {rows.map((o) => (
              <PersonRow
                key={o.employee.id}
                outlook={o}
                from={from}
                to={rangeEnd}
                x={x}
                today={today}
                onPlan={() => setPlanning(o)}
                onBreak={() => setBreaking(o)}
              />
            ))}
          </div>
        </div>
      </section>

      {planning && <PlanNextDialog outlook={planning} onClose={() => setPlanning(null)} />}
      {breaking && <BreakDialog outlook={breaking} onClose={() => setBreaking(null)} />}
    </div>
  );
}

function Tile({ value, label, active, onClick, tone }: { value: number; label: string; active: boolean; onClick: () => void; tone?: "warn" | "alert" }) {
  return (
    <button type="button" className={`staff-tile ${active ? "is-active" : ""} ${tone ? `staff-tile--${tone}` : ""}`} onClick={onClick} aria-pressed={active}>
      <strong>{value}</strong>
      <span>{label}</span>
    </button>
  );
}

function WeekHeader({ weeks, today, corner, single, trailing }: { weeks: ISODate[]; today: ISODate; corner: string; single?: boolean; trailing?: string }) {
  const cells = weeks.map((w) => {
    const d = parseISO(w);
    const isNow = w === startOfWeek(today);
    return (
      <div key={w} className={`staff-week ${isNow ? "is-now" : ""}`}>
        <b>tydz. {isoWeek(w).week}</b>
        <span>
          {d.getDate()}.{String(d.getMonth() + 1).padStart(2, "0")}
        </span>
      </div>
    );
  });
  return (
    <>
      <div className="staff-corner">{corner}</div>
      {single ? <div className="staff-weeks">{cells}</div> : cells}
      {trailing && <div className="staff-corner staff-corner--side">{trailing}</div>}
    </>
  );
}

/** Najbliższy brak w projekcie — od kiedy i ilu brakuje. */
function ProjectNeed({ project, weeks }: { project: Project; weeks: { week: ISODate; shortElectrical: number; shortMechanical: number }[] }) {
  const first = weeks.slice(1).find((w) => w.shortElectrical + w.shortMechanical > 0);
  if (!project.needElectricians && !project.needMechanics) return <span className="muted">Bez zapotrzebowania</span>;
  if (!first) return <span className="staff-ok">Obsadzony</span>;
  const parts = [
    first.shortElectrical ? `${first.shortElectrical} el.` : "",
    first.shortMechanical ? `${first.shortMechanical} mech.` : "",
  ].filter(Boolean);
  return (
    <span className="staff-need">
      Brakuje {parts.join(" i ")} <em>od {formatDate(first.week).replace(/ \d{4}$/, "")}</em>
    </span>
  );
}

function Count({ label, have, need, short }: { label: string; have: number; need: number | null | undefined; short: number }) {
  const cls = need ? (short > 0 ? "is-short" : "is-ok") : "";
  return (
    <span className={`staff-count ${cls}`}>
      {label} {have}
      {need ? `/${need}` : ""}
    </span>
  );
}

function PersonRow({
  outlook: o,
  from,
  to,
  x,
  today,
  onPlan,
  onBreak,
}: {
  outlook: PersonOutlook;
  from: ISODate;
  to: ISODate;
  x: (d: ISODate) => number;
  today: ISODate;
  onPlan: () => void;
  onBreak: () => void;
}) {
  const model = useModel();
  const chains = workChains(model, o.employee.id);
  const list = (model.assignmentsByEmployee.get(o.employee.id) ?? []).filter((a) => a.from <= to && assignmentEnd(model, a) >= from);
  const suggestion = o.status === "releasing" || o.status === "free" ? bestTarget(model, o, today) : null;
  const long = needsBreak(o, today);

  return (
    <>
      <div className="staff-name">
        <span className="staff-name__person">
          <PositionMark employee={o.employee} />
          <span>{o.employee.name}</span>
        </span>
        <span className="staff-name__sub">{personWhen(o)}</span>
      </div>
      <div className="staff-track">
        {chains.slice(1).map((c, i) => {
          const gapFrom = addDays(chains[i].to, 1);
          const gapTo = addDays(c.from, -1);
          if (gapTo < from || gapFrom > to) return null;
          const a = gapFrom < from ? from : gapFrom;
          const b = gapTo > to ? to : gapTo;
          return (
            <span key={`gap-${c.from}`} className="staff-gap" style={{ left: x(a), width: (daysBetween(a, b) + 1) * PX_DAY }} data-tip={`Przerwa ${formatDate(gapFrom)} – ${formatDate(gapTo)}`}>
              <Coffee size={12} aria-hidden />
            </span>
          );
        })}
        {list.map((a) => {
          const p = model.projectById.get(a.projectId);
          if (!p) return null;
          const end = assignmentEnd(model, a);
          const s = a.from < from ? from : a.from;
          const e = end > to ? to : end;
          const width = (daysBetween(s, e) + 1) * PX_DAY;
          return (
            <span
              key={a.id}
              className="staff-bar"
              style={{ left: x(s), width, ["--project" as string]: p.color }}
              data-tip={`${p.name}${a.task ? ` · ${a.task}` : ""}: ${formatDate(a.from)} – ${end.startsWith("9999") ? "bez końca" : formatDate(end)}`}
            >
              {width > 44 && <span>{width > 110 ? p.name : p.number}</span>}
            </span>
          );
        })}
        {today >= from && today <= to && <span className="staff-today" style={{ left: x(today) + PX_DAY / 2 }} />}
      </div>
      <div className="staff-side">
        <div className="staff-side__info">
          {long && (
            <span className="staff-flag staff-flag--long" data-tip="Ciąg pracy bez przerwy na wyjazd do domu">
              <TriangleAlert size={13} aria-hidden />
              {o.stretchWeeks} tyg. bez przerwy
            </span>
          )}
          {suggestion && (
            <span className="staff-suggest" data-tip={`W tygodniu startu brakuje: ${suggestion.shortage}`}>
              <ProjectDot color={suggestion.project.color} />
              {suggestion.project.name}
              <em>brak {suggestion.shortage}</em>
            </span>
          )}
        </div>
        <div className="staff-side__actions">
          {(o.status === "releasing" || o.status === "free" || o.status === "later") && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onPlan}>
              <CalendarPlus size={15} aria-hidden />
              Zaplanuj dalej
            </button>
          )}
          {o.chain && (long || o.status === "working") && (
            <button type="button" className={`btn btn--sm ${long ? "btn--secondary" : "btn--quiet"}`} onClick={onBreak}>
              <Coffee size={15} aria-hidden />
              Przerwa
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function bestTarget(model: ReturnType<typeof useModel>, o: PersonOutlook, today: ISODate) {
  const start = restartDate(o.releaseDate ?? addDays(today, -1), o.stretchWeeksAtEnd >= 6 ? 7 : 0);
  const best = suggestTargets(model, o.employee, start, o.currentProject?.id)[0];
  return best && best.shortage > 0 ? best : null;
}

function projectWhen(p: Project, today: ISODate): string {
  if (p.startDate > today) return `start ${formatDay(p.startDate)} · za ${weeksTo(today, p.startDate)}`;
  if (!p.endDate) return "bez daty końca";
  return `koniec ${formatDay(p.endDate)} · za ${weeksTo(today, p.endDate)}`;
}

function personWhen(o: PersonOutlook): string {
  if (o.status === "free") return o.next ? `od ${formatDate(o.next.from)} w kolejnym projekcie` : "bez przydziału";
  if (o.status === "later") return `startuje ${formatDate(o.next!.from)}`;
  const p = o.currentProject?.name ?? "projekt";
  if (o.releaseDate) return `${p} · kończy ${formatDay(o.releaseDate)}`;
  return `${p} · do końca projektu`;
}

function weeksTo(from: ISODate, to: ISODate): string {
  const days = daysBetween(from, to);
  if (days < 7) return `${days} dni`;
  const w = Math.round(days / 7);
  return `${w} tyg.`;
}

function cellTip(p: Project, w: { week: ISODate; electrical: number; mechanical: number; shortElectrical: number; shortMechanical: number }) {
  const line = (name: string, have: number, need: number | null | undefined, short: number) =>
    `${name}: ${have}${need ? ` z ${need}` : ""}${short ? ` — brakuje ${short}` : ""}`;
  const days = eachDay(w.week, addDays(w.week, 6));
  return [
    `${p.name}, ${formatDate(days[0]).replace(/ \d{4}$/, "")} – ${formatDate(days[6])}`,
    line("Elektrycy", w.electrical, p.needElectricians, w.shortElectrical),
    line("Mechanicy", w.mechanical, p.needMechanics, w.shortMechanical),
  ].join("\n");
}

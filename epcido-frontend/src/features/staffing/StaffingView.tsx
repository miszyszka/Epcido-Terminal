import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, Coffee, GripVertical, TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { PageHeader } from "../../components/PageHeader";
import { CategoryTag, EmploymentTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { WeekNav } from "../../components/WeekNav";
import { CATEGORIES, formatMonths, formatMonthsShort } from "../../domain/labels";
import {
  assignmentEnd,
  availableFrom,
  experienceIn,
  FIELD_POSITIONS,
  needsBreak,
  oursShare,
  outlookOf,
  restartDate,
  suggestTargets,
  weeklyStaffing,
  workChains,
  type PersonOutlook,
  type WeekStaffing,
} from "../../domain/staffing";
import type { Project, ProjectCategory, Trade } from "../../domain/types";
import { addDays, daysBetween, eachDay, formatDate, formatDay, isoWeek, parseISO, startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { BreakDialog } from "./BreakDialog";
import { PlanNextDialog } from "./PlanNextDialog";
import { StaffPanel } from "./StaffPanel";

const COL = 56; // px na tydzień = 8 px na dzień
const PX_DAY = COL / 7;

type PeopleFilter = "releasing" | "free" | "long" | "all";
type TradeFilter = "all" | Trade;
type CategoryFilter = "all" | ProjectCategory;
type SortKey = "available" | "experience";

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
      setWeeks(Math.max(6, Math.min(18, Math.floor(free / COL))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, weeks };
}

/**
 * Obsada — narzędzie pracy Planningu:
 *  1. siła robocza w tygodniach: ile ludzi potrzeba, ilu jest, ilu brakuje, ilu jest wolnych,
 *  2. projekty (także przyszłe) z zapotrzebowaniem z faz PM: kliknij projekt → panel „Obsadź",
 *  3. ludzie: kto się zwalnia, kto wolny, kto długo bez przerwy — z doświadczeniem i formą zatrudnienia.
 * Osobę można przeciągnąć na tydzień projektu albo dodać jednym kliknięciem z panelu (z cofnięciem).
 */
export function StaffingView() {
  const model = useModel();
  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const { ref, weeks: WEEKS } = useWeeksThatFit();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), offset * 7);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from, WEEKS]);
  const rangeEnd = addDays(from, WEEKS * 7 - 1);
  const [trade, setTrade] = useState<TradeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [filter, setFilter] = useState<PeopleFilter>("releasing");
  const [sort, setSort] = useState<SortKey>("available");
  const [planning, setPlanning] = useState<{ outlook: PersonOutlook; preset?: { projectId: string; from: ISODate } } | null>(null);
  const [breaking, setBreaking] = useState<PersonOutlook | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const selectedId = params.get("projekt");
  const select = (id: string | null) => {
    if (id) params.set("projekt", id);
    else params.delete("projekt");
    setParams(params, { replace: true });
  };

  const projects = useMemo(
    () =>
      model.projects
        .filter((p) => p.status !== "CLOSED" && (p.endDate ?? "9999-12-31") >= from && p.startDate <= rangeEnd)
        .filter((p) => category === "all" || p.category === category)
        .map((p) => ({ project: p, weeks: weeklyStaffing(model, p, weeks) }))
        .sort(
          (a, b) =>
            Number(a.project.startDate > today) - Number(b.project.startDate > today) ||
            (a.project.startDate > today
              ? a.project.startDate.localeCompare(b.project.startDate)
              : (a.project.endDate ?? "9999").localeCompare(b.project.endDate ?? "9999"))
        ),
    [model, weeks, from, rangeEnd, category, today]
  );

  const field = useMemo(() => model.employees.filter((e) => FIELD_POSITIONS.includes(e.position)), [model]);
  const people = useMemo(() => field.map((e) => outlookOf(model, e, today)), [model, field, today]);

  // Siła robocza w tygodniach (dla wybranej branży i kategorii)
  const workforce = useMemo(() => {
    const trades: Trade[] = trade === "all" ? ["ELECTRICAL", "MECHANICAL"] : [trade];
    return weeks.map((week, i) => {
      let need = 0;
      let planned = 0;
      let short = 0;
      for (const { weeks: ws } of projects) {
        const w = ws[i];
        if (trades.includes("ELECTRICAL")) {
          need += w.needElectrical;
          planned += w.electrical;
          short += w.shortElectrical;
        }
        if (trades.includes("MECHANICAL")) {
          need += w.needMechanical;
          planned += w.mechanical;
          short += w.shortMechanical;
        }
      }
      const friday = addDays(week, 4);
      const free = field.filter(
        (e) =>
          e.trade &&
          trades.includes(e.trade) &&
          !(model.assignmentsByEmployee.get(e.id) ?? []).some((a) => a.from <= friday && assignmentEnd(model, a) >= week)
      ).length;
      return { week, need, planned, short, free, balance: free - short };
    });
  }, [weeks, projects, trade, field, model]);

  const byTrade = (o: PersonOutlook) => trade === "all" || o.employee.trade === trade;
  const groups = {
    releasing: people.filter((o) => o.status === "releasing" && byTrade(o)),
    free: people.filter((o) => (o.status === "free" || o.status === "later") && byTrade(o)),
    long: people.filter((o) => needsBreak(o, today) && byTrade(o)),
    all: people.filter(byTrade),
  };
  const expKey = (o: PersonOutlook) => (category === "all" ? o.employee.experience?.totalMonths ?? 0 : experienceIn(o.employee, category));
  const avail = (o: PersonOutlook) => availableFrom(model, o.employee, today);
  const rows = [...groups[filter]].sort((a, b) =>
    sort === "experience" ? expKey(b) - expKey(a) : avail(a).localeCompare(avail(b)) || expKey(b) - expKey(a)
  );
  const x = (d: ISODate) => daysBetween(from, d) * PX_DAY;
  const shortProjects = projects.filter((p) => p.weeks.some((w) => w.shortElectrical + w.shortMechanical > 0)).length;
  const deficitWeeks = workforce.filter((w) => w.balance < 0).length;

  const drop = (project: Project, week: ISODate) => {
    const o = people.find((p) => p.employee.id === dragged);
    setDropTarget(null);
    setDragged(null);
    if (!o) return;
    setPlanning({ outlook: o, preset: { projectId: project.id, from: week < today ? today : week } });
  };

  return (
    <div className="page staffing" ref={ref}>
      <PageHeader
        title="Obsada"
        actions={<WeekNav from={from} weeks={WEEKS} onShift={(d) => setOffset((o) => o + d * 4)} onToday={() => setOffset(0)} isCurrent={offset === 0} />}
      />

      <div className="staff-filters">
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
        <Segmented<CategoryFilter>
          label="Kategoria"
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "Wszystkie" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <p className="staff-filters__hint">
          {deficitWeeks > 0
            ? `W ${deficitWeeks} ${plural(deficitWeeks, "tygodniu", "tygodniach", "tygodniach")} brakuje ludzi nawet po obsadzeniu wszystkich wolnych.`
            : "Wolni ludzie pokrywają braki we wszystkich tygodniach."}{" "}
          Przeciągnij osobę z listy na tydzień projektu albo kliknij projekt.
        </p>
      </div>

      {/* ---------- Siła robocza ---------- */}
      <section className="staff-card" aria-label="Siła robocza w tygodniach">
        <header className="staff-card__head">
          <h2>Siła robocza</h2>
          <p className="staff-legend">Bilans = wolni − brakujący. Ujemny: trzeba szukać ludzi spoza obecnej załogi.</p>
        </header>
        <div className="staff-scroll">
          <div className="staff-grid staff-grid--force" style={{ gridTemplateColumns: `var(--staff-name) repeat(${WEEKS}, ${COL}px) var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner=" " trailing=" " />
            {(
              [
                ["need", "Potrzeba", "Suma faz zapotrzebowania z projektów"],
                ["planned", "Obsadzone", "Ludzie z zadaniem w projektach"],
                ["short", "Brakuje", "Brakujący ludzie w projektach"],
                ["free", "Wolni", "Ludzie bez zadania w tym tygodniu"],
                ["balance", "Bilans", "Wolni minus brakujący"],
              ] as const
            ).map(([key, label, tip]) => (
              <div key={key} className={`staff-row staff-row--${key}`}>
                <div className="staff-name staff-name--force" data-tip={tip}>
                  {label}
                </div>
                {workforce.map((w) => {
                  const v = w[key];
                  const tone = key === "short" ? (v > 0 ? "is-bad" : "") : key === "balance" ? (v < 0 ? "is-bad" : "is-good") : "";
                  return (
                    <div key={w.week} className={`staff-cell staff-cell--force ${tone}`}>
                      {key === "balance" && v > 0 ? `+${v}` : v}
                    </div>
                  );
                })}
                <div className="staff-side staff-side--force" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Projekty ---------- */}
      <section className="staff-card" aria-label="Projekty w kolejnych tygodniach">
        <header className="staff-card__head">
          <h2>
            Projekty <em>{shortProjects ? `${shortProjects} z brakami` : "obsadzone"}</em>
          </h2>
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
            <WeekHeader weeks={weeks} today={today} corner="Projekt" trailing="Najbliższy brak" />
            {projects.map(({ project, weeks: ws }) => {
              const endWeek = project.endDate ? startOfWeek(project.endDate) : null;
              const selected = selectedId === project.id;
              const share = oursShare(model, (model.team(project.id)?.members ?? []).map((m) => m.id));
              const dropProps = (week: ISODate) => ({
                onDragOver: (e: React.DragEvent) => {
                  if (!dragged) return;
                  e.preventDefault();
                  if (dropTarget !== project.id) setDropTarget(project.id);
                },
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  drop(project, week);
                },
              });
              return (
                <div
                  key={project.id}
                  className={`staff-row staff-row--project ${selected ? "is-selected" : ""} ${dropTarget === project.id ? "is-drop" : ""} ${project.startDate > today ? "is-future" : ""}`}
                  style={{ ["--project" as string]: project.color }}
                >
                  <div className="staff-name" {...dropProps(weeks[0])}>
                    <button type="button" className="staff-name__btn" onClick={() => select(selected ? null : project.id)} aria-pressed={selected}>
                      <ProjectDot color={project.color} />
                      <span>{project.name}</span>
                      <CategoryTag category={project.category} />
                    </button>
                    <span className="staff-name__sub">
                      {projectWhen(project, today)}
                      {share.ours + share.agency > 0 && (
                        <span className={`ours ${share.ok ? "" : "is-warn"}`} data-tip={`Nasi (UoP, B2B): ${share.ours} · agencja: ${share.agency}`}>
                          {" "}
                          · nasi {Math.round((share.ours / (share.ours + share.agency)) * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                  {ws.map((w, i) => {
                    const isEnd = endWeek === w.week;
                    const isStart = startOfWeek(project.startDate) === w.week;
                    return (
                      <div
                        key={w.week}
                        className={`staff-cell ${w.active ? "is-active" : ""} ${isEnd ? "is-end" : ""} ${isStart ? "is-start" : ""} ${i === 0 && offset === 0 ? "is-now" : ""}`}
                        data-tip={w.active ? cellTip(project, w) : undefined}
                        onClick={() => select(project.id)}
                        {...dropProps(w.week)}
                      >
                        {w.active && (
                          <>
                            <Count label="E" have={w.electrical} need={w.needDefined ? w.needElectrical : null} short={w.shortElectrical} />
                            <Count label="M" have={w.mechanical} need={w.needDefined ? w.needMechanical : null} short={w.shortMechanical} />
                          </>
                        )}
                        {isEnd && project.endDate && (
                          <span className="staff-cell__end" style={{ left: (parseISO(project.endDate).getDay() || 7) * PX_DAY }} aria-label={`Koniec ${formatDate(project.endDate)}`} />
                        )}
                      </div>
                    );
                  })}
                  <div className="staff-side staff-side--project" {...dropProps(weeks[0])}>
                    <ProjectNeed weeks={ws} />
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
                { value: "free", label: "Wolni", count: groups.free.length },
                { value: "long", label: "Bez przerwy", count: groups.long.length },
                { value: "all", label: "Wszyscy", count: groups.all.length },
              ]}
            />
            <Segmented<SortKey>
              label="Kolejność"
              value={sort}
              onChange={setSort}
              options={[
                { value: "available", label: "Od kiedy wolni" },
                { value: "experience", label: category === "all" ? "Doświadczenie" : `Doświadczenie ${category}` },
              ]}
            />
          </div>
        </header>
        <div className="staff-scroll">
          <div className="staff-grid staff-grid--people" style={{ gridTemplateColumns: `var(--staff-name) ${WEEKS * COL}px var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner="Osoba" single trailing="Dostępność i doświadczenie" />
            {rows.length === 0 && <p className="staff-empty">Nikt nie pasuje do filtra.</p>}
            {rows.map((o) => (
              <PersonRow
                key={o.employee.id}
                outlook={o}
                from={from}
                to={rangeEnd}
                x={x}
                today={today}
                category={category === "all" ? null : category}
                dragging={dragged === o.employee.id}
                onDragStart={() => setDragged(o.employee.id)}
                onDragEnd={() => {
                  setDragged(null);
                  setDropTarget(null);
                }}
                onPlan={() => setPlanning({ outlook: o })}
                onBreak={() => setBreaking(o)}
              />
            ))}
          </div>
        </div>
      </section>

      {selectedId && model.projectById.get(selectedId) && (
        <StaffPanel project={model.projectById.get(selectedId)!} onClose={() => select(null)} />
      )}
      {planning && <PlanNextDialog outlook={planning.outlook} preset={planning.preset} onClose={() => setPlanning(null)} />}
      {breaking && <BreakDialog outlook={breaking} onClose={() => setBreaking(null)} />}
    </div>
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

/** Najbliższy tydzień z brakiem — od kiedy i ilu brakuje. */
function ProjectNeed({ weeks }: { weeks: WeekStaffing[] }) {
  const defined = weeks.some((w) => w.needDefined);
  const first = weeks.find((w) => w.shortElectrical + w.shortMechanical > 0);
  if (!defined) return <span className="muted">Bez zapotrzebowania</span>;
  if (!first) return <span className="staff-ok">Obsadzony</span>;
  const parts = [first.shortElectrical ? `${first.shortElectrical} el.` : "", first.shortMechanical ? `${first.shortMechanical} mech.` : ""].filter(Boolean);
  return (
    <span className="staff-need">
      Brakuje {parts.join(" i ")} <em>od {formatDate(first.week).replace(/ \d{4}$/, "")}</em>
    </span>
  );
}

function Count({ label, have, need, short }: { label: string; have: number; need: number | null; short: number }) {
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
  category,
  dragging,
  onDragStart,
  onDragEnd,
  onPlan,
  onBreak,
}: {
  outlook: PersonOutlook;
  from: ISODate;
  to: ISODate;
  x: (d: ISODate) => number;
  today: ISODate;
  category: ProjectCategory | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onPlan: () => void;
  onBreak: () => void;
}) {
  const model = useModel();
  const chains = workChains(model, o.employee.id);
  const list = (model.assignmentsByEmployee.get(o.employee.id) ?? []).filter((a) => a.from <= to && assignmentEnd(model, a) >= from);
  const suggestion = o.status === "releasing" || o.status === "free" ? bestTarget(model, o, today) : null;
  const long = needsBreak(o, today);
  const free = availableFrom(model, o.employee, today);
  const exp = o.employee.experience;
  const topCategory = exp ? (Object.entries(exp.byCategory) as [ProjectCategory, number][]).sort((a, b) => b[1] - a[1])[0] : null;

  return (
    <>
      <div
        className={`staff-name staff-name--drag ${dragging ? "is-dragging" : ""}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", o.employee.id);
          e.dataTransfer.effectAllowed = "copy";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        data-tip="Przeciągnij na tydzień projektu"
      >
        <span className="staff-name__person">
          <GripVertical size={14} className="staff-grip" aria-hidden />
          <PositionMark employee={o.employee} />
          <span>{o.employee.name}</span>
          <EmploymentTag employee={o.employee} />
        </span>
        <span className="staff-name__sub">{personWhen(o)}</span>
        {exp && (
          <span
            className="staff-name__sub staff-exp"
            data-tip={CATEGORIES.map((c) => `${c}: ${formatMonths(exp.byCategory[c])}`).join("\n") + `\nŁącznie: ${formatMonths(exp.totalMonths)}`}
          >
            {category
              ? `${category} ${formatMonthsShort(exp.byCategory[category])}`
              : topCategory && topCategory[1] > 0
                ? `${topCategory[0]} ${formatMonthsShort(topCategory[1])}`
                : "bez kategorii"}{" "}
            · łącznie {formatMonthsShort(exp.totalMonths)}
          </span>
        )}
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
              data-tip={`${p.name} (${p.category})${a.task ? ` · ${a.task}` : ""}: ${formatDate(a.from)} – ${end.startsWith("9999") ? "bez końca" : formatDate(end)}`}
            >
              {width > 44 && <span>{width > 110 ? p.name : p.number}</span>}
            </span>
          );
        })}
        {today >= from && today <= to && <span className="staff-today" style={{ left: x(today) + PX_DAY / 2 }} />}
      </div>
      <div className="staff-side">
        <div className="staff-side__info">
          <span className={`staff-free ${free <= today ? "is-now" : ""}`}>
            {free.startsWith("9999") ? "zajęty bez końca" : free <= today ? "wolny teraz" : `wolny od ${formatDay(free)}`}
          </span>
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
            <button type="button" className="btn btn--primary btn--sm" onClick={onPlan} data-tip="Zaplanuj kolejny projekt po obecnym">
              <CalendarPlus size={15} aria-hidden />
              Zaplanuj
            </button>
          )}
          {o.chain && (long || o.status === "working") && (
            <button type="button" className={`btn btn--sm ${long ? "btn--secondary" : "btn--quiet"}`} onClick={onBreak} data-tip="Wstaw przerwę na wyjazd do domu">
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
  return `${Math.round(days / 7)} tyg.`;
}

function cellTip(p: Project, w: WeekStaffing) {
  const line = (name: string, have: number, need: number | null, short: number) => `${name}: ${have}${need ? ` z ${need}` : ""}${short ? ` — brakuje ${short}` : ""}`;
  const days = eachDay(w.week, addDays(w.week, 6));
  return [
    `${p.name}, ${formatDate(days[0]).replace(/ \d{4}$/, "")} – ${formatDate(days[6])}`,
    line("Elektrycy", w.electrical, w.needDefined ? w.needElectrical : null, w.shortElectrical),
    line("Mechanicy", w.mechanical, w.needDefined ? w.needMechanical : null, w.shortMechanical),
    "Kliknij, żeby obsadzić",
  ].join("\n");
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CalendarPlus, Coffee, GripVertical, Sparkles, TriangleAlert, UserX, Users } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { EMPTY_PEOPLE_FILTER, PeopleFilters, passesPeopleFilter, type PeopleFilterValue } from "../../components/PeopleFilters";
import { CategoryTag, EmploymentTag, PositionMark, ProjectDot } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { WeekNav } from "../../components/WeekNav";
import { categories, defaultTask, formatMonths, formatMonthsShort, isEpcido } from "../../domain/labels";
import {
  assignmentEnd,
  availableFrom,
  epcidoShare,
  experienceIn,
  FIELD_POSITIONS,
  leavesBetween,
  longStretchWeeks,
  needsBreak,
  outlookOf,
  restartDate,
  suggestTargets,
  weeklyStaffing,
  workChains,
  type PersonOutlook,
  type WeekStaffing,
} from "../../domain/staffing";
import type { Project, ProjectCategory, Trade } from "../../domain/types";
import { leaveNote } from "../../domain/workflow";
import { addDays, daysBetween, eachDay, formatDate, formatDay, isoWeek, parseISO, startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { AutoStaffDialog } from "./AutoStaffDialog";
import { BreakDialog } from "./BreakDialog";
import { PlanNextDialog } from "./PlanNextDialog";

const COL = 56; // px na tydzień = 8 px na dzień
const PX_DAY = COL / 7;
const OPEN_END = "9999-12-31";

type PeopleFilter = "releasing" | "free" | "long" | "all";
type TradeFilter = "all" | Trade;
type CategoryFilter = "all" | ProjectCategory;
type SortKey = "available" | "experience";

/** Ile tygodni zmieści się obok kolumny nazw i kolumny bocznej (6–18). */
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
 *  1. „Wymaga uwagi": braki przed startem projektów, tygodnie bez rezerwy, udział EPCIDO, długo bez przerwy, urlopy,
 *  2. siła robocza: słupki elektryków (czerwień) i mechaników (błękit) — potrzeba, w planie, wolni,
 *  3. projekty: w każdym tygodniu dwa słupki — ilu potrzeba (obrys) i ilu jest w planie (wypełnienie),
 *  4. ludzie: kto się zwalnia, wolni, długo bez przerwy — ze stażem, umową i urlopami; filtry i suwaki stażu.
 * Przeciągnij osobę na tydzień projektu: dodaje się od tego tygodnia do końca fazy (z „Cofnij");
 * z klawiszem Shift — otwiera okno z opcjami. Kliknięcie projektu otwiera jego plan zespołu.
 */
export function StaffingView() {
  const model = useModel();
  const data = useData();
  const { openProject } = useUi();
  const navigate = useNavigate();
  const today = todayISO();
  const { ref, weeks: WEEKS } = useWeeksThatFit();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), offset * 7);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from, WEEKS]);
  const rangeEnd = addDays(from, WEEKS * 7 - 1);
  const [trade, setTrade] = useState<TradeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [filter, setFilter] = useState<PeopleFilter>("releasing");
  const [sort, setSort] = useState<SortKey>("available");
  const [pf, setPf] = useState<PeopleFilterValue>(EMPTY_PEOPLE_FILTER);
  const [planning, setPlanning] = useState<{ outlook: PersonOutlook; preset?: { projectId: string; from: ISODate } } | null>(null);
  const [breaking, setBreaking] = useState<PersonOutlook | null>(null);
  const [proposing, setProposing] = useState<Project | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropCell, setDropCell] = useState<string | null>(null);
  const peopleRef = useRef<HTMLElement>(null);
  const trades: Trade[] = trade === "all" ? ["ELECTRICAL", "MECHANICAL"] : [trade];

  const projects = useMemo(
    () =>
      model.projects
        .filter((p) => p.status !== "CLOSED" && (p.endDate ?? OPEN_END) >= from && p.startDate <= rangeEnd)
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

  const field = useMemo(() => model.employees.filter((e) => FIELD_POSITIONS.includes(e.position) && e.active !== false), [model]);
  const people = useMemo(() => field.map((e) => outlookOf(model, e, today)), [model, field, today]);

  // Siła robocza w tygodniach, osobno dla branż
  const workforce = useMemo(
    () =>
      weeks.map((week, i) => {
        const friday = addDays(week, 4);
        const per = (t: Trade) => {
          let need = 0;
          let planned = 0;
          let short = 0;
          let away = 0;
          for (const { weeks: ws } of projects) {
            const w = ws[i];
            need += t === "ELECTRICAL" ? w.needElectrical : w.needMechanical;
            planned += t === "ELECTRICAL" ? w.electrical : w.mechanical;
            short += t === "ELECTRICAL" ? w.shortElectrical : w.shortMechanical;
            away += t === "ELECTRICAL" ? w.leaveElectrical : w.leaveMechanical;
          }
          const free = field.filter(
            (e) => e.trade === t && !(model.assignmentsByEmployee.get(e.id) ?? []).some((a) => a.from <= friday && assignmentEnd(model, a) >= week)
          ).length;
          return { need, planned, short, free, away };
        };
        const el = per("ELECTRICAL");
        const me = per("MECHANICAL");
        const pick = (a: number, b: number) => (trade === "all" ? a + b : trade === "ELECTRICAL" ? a : b);
        return { week, el, me, short: pick(el.short, me.short), free: pick(el.free, me.free), balance: pick(el.free, me.free) - pick(el.short, me.short) };
      }),
    [weeks, projects, field, model, trade]
  );

  const byTrade = (o: PersonOutlook) => trade === "all" || o.employee.trade === trade;
  const byFilters = (o: PersonOutlook) => byTrade(o) && passesPeopleFilter(o.employee, { ...pf, category: category === "all" ? pf.category : category });
  const groups = {
    releasing: people.filter((o) => o.status === "releasing" && byFilters(o)),
    free: people.filter((o) => (o.status === "free" || o.status === "later") && byFilters(o)),
    long: people.filter((o) => needsBreak(o, today) && byFilters(o)),
    all: people.filter(byFilters),
  };
  const expKey = (o: PersonOutlook) => (category === "all" ? o.employee.experience?.totalMonths ?? 0 : experienceIn(o.employee, category));
  const avail = (o: PersonOutlook) => availableFrom(model, o.employee, today);
  const rows = [...groups[filter]].sort((a, b) =>
    sort === "experience" ? expKey(b) - expKey(a) : avail(a).localeCompare(avail(b)) || expKey(b) - expKey(a)
  );
  const pfCounts = useMemo(() => {
    const base = people.filter((o) => byTrade(o) && passesPeopleFilter(o.employee, { ...pf, employment: "all", category: category === "all" ? pf.category : category }));
    return { all: base.length, epcido: base.filter((o) => isEpcido(o.employee)).length, agency: base.filter((o) => !isEpcido(o.employee)).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, pf, trade, category]);
  const x = (d: ISODate) => daysBetween(from, d) * PX_DAY;
  const shortProjects = projects.filter((p) => p.weeks.some((w) => shortOf(w, trades) > 0)).length;
  const deficitWeeks = workforce.filter((w) => w.balance < 0);

  /** Upuszczenie osoby na tydzień projektu: od tego tygodnia (albo od kiedy wolna) do końca fazy. */
  const drop = (project: Project, week: ISODate, withDialog: boolean) => {
    const o = people.find((p) => p.employee.id === dragged);
    setDropCell(null);
    setDragged(null);
    if (!o) return;
    const start = week < today ? today : week;
    if (withDialog) {
      setPlanning({ outlook: o, preset: { projectId: project.id, from: start } });
      return;
    }
    const plan = dropPlan(o, project, start);
    if (!plan) {
      setPlanning({ outlook: o, preset: { projectId: project.id, from: start } });
      return;
    }
    void data.quickAssign({ employeeId: o.employee.id, projectId: project.id, from: plan.from, to: plan.to, task: defaultTask(o.employee.trade), breakDays: plan.breakDays || undefined });
  };
  const dropPlan = (o: PersonOutlook, project: Project, start: ISODate) => {
    const longRun = o.stretchWeeksAtEnd >= longStretchWeeks() - 2;
    let fromDate = start;
    let breakDays = 0;
    if (o.chain && o.chain.from <= addDays(start, 6)) {
      if (o.chain.to === OPEN_END) return null;
      breakDays = longRun ? 7 : 0;
      const restart = restartDate(o.chain.to, breakDays);
      if (restart > fromDate) fromDate = restart;
    }
    if (fromDate < project.startDate) fromDate = project.startDate;
    const phase = project.demand.find((d) => d.from <= addDays(fromDate, 4) && d.to >= fromDate);
    const to = phase?.to ?? project.endDate ?? null;
    if (to && to < fromDate) return null;
    return { from: fromDate, to, breakDays };
  };
  const preview = (project: Project, week: ISODate) => {
    const o = people.find((p) => p.employee.id === dragged);
    if (!o) return null;
    const plan = dropPlan(o, project, week < today ? today : week);
    return plan ? `${o.employee.name}: ${short(plan.from)} – ${plan.to ? short(plan.to) : "koniec"}${plan.breakDays ? " (po przerwie)" : ""}` : "Otworzy okno z opcjami";
  };

  // ---------- Wymaga uwagi ----------
  const alerts = useMemo(() => {
    const out: { key: string; tone: "bad" | "warn" | "info"; icon: typeof TriangleAlert; text: React.ReactNode; action?: { label: string; run: () => void } }[] = [];
    const soon = addDays(today, 28);
    for (const { project } of projects) {
      if (project.startDate <= today || project.startDate > soon) continue;
      const w = weeklyStaffing(model, project, [startOfWeek(project.startDate)])[0];
      const s = shortOf(w, trades);
      if (!s) continue;
      out.push({
        key: `start-${project.id}`,
        tone: "bad",
        icon: CalendarClock,
        text: (
          <>
            <b>{project.name}</b> startuje {formatDay(project.startDate)} — brakuje {shortText(w, trades)}
          </>
        ),
        action: { label: "Zaproponuj obsadę", run: () => setProposing(project) },
      });
    }
    if (deficitWeeks.length) {
      const worst = deficitWeeks.reduce((m, w) => (w.balance < m.balance ? w : m));
      out.push({
        key: "deficit",
        tone: "bad",
        icon: Users,
        text: (
          <>
            W {deficitWeeks.length} {plural(deficitWeeks.length, "tygodniu", "tygodniach", "tygodniach")} braki są większe niż liczba wolnych — najgorzej w tyg. {isoWeek(worst.week).week} (
            {worst.balance}). Potrzebni ludzie spoza obecnej załogi.
          </>
        ),
      });
    }
    const lowShare = projects
      .filter(({ project }) => project.startDate <= today)
      .map(({ project }) => ({ project, share: epcidoShare(model, (model.team(project.id)?.members ?? []).map((m) => m.id)) }))
      .filter((p) => !p.share.ok && p.share.epcido + p.share.agency > 0);
    if (lowShare.length)
      out.push({
        key: "share",
        tone: "warn",
        icon: TriangleAlert,
        text: (
          <>
            Za mało EPCIDO (cel {model.settings.minEpcidoShare}%): {lowShare.map((p) => `${p.project.name} ${p.share.pct}%`).join(", ")}
          </>
        ),
        action: { label: `Otwórz ${lowShare[0].project.name}`, run: () => openProject(lowShare[0].project.id, "team", true) },
      });
    const longCount = people.filter((o) => needsBreak(o, today)).length;
    if (longCount)
      out.push({
        key: "long",
        tone: "warn",
        icon: Coffee,
        text: (
          <>
            {longCount} {plural(longCount, "osoba pracuje", "osoby pracują", "osób pracuje")} {longStretchWeeks()}+ tygodni bez przerwy na wyjazd
          </>
        ),
        action: { label: "Pokaż", run: () => showPeople("long") },
      });
    const leaveLoss = projects.reduce((s, p) => s + p.weeks.slice(0, 4).reduce((m, w) => Math.max(m, w.leaveElectrical + w.leaveMechanical), 0), 0);
    if (leaveLoss)
      out.push({
        key: "leave",
        tone: "info",
        icon: CalendarClock,
        text: (
          <>
            Urlopy w najbliższych 4 tygodniach zabierają z projektów do {leaveLoss} {plural(leaveLoss, "osoby", "osób", "osób")} w jednym tygodniu
          </>
        ),
        action: { label: "Kalendarz urlopów", run: () => navigate("/urlopy") },
      });
    const freeNow = people.filter((o) => o.status === "free").length;
    if (freeNow)
      out.push({
        key: "free",
        tone: "info",
        icon: UserX,
        text: (
          <>
            {freeNow} {plural(freeNow, "osoba", "osoby", "osób")} bez przydziału
          </>
        ),
        action: { label: "Pokaż", run: () => showPeople("free") },
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, model, today, deficitWeeks, people, trade]);

  function showPeople(f: PeopleFilter) {
    setFilter(f);
    peopleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          options={[{ value: "all", label: "Wszystkie" }, ...categories().map((c) => ({ value: c, label: c }))]}
        />
        <p className="staff-filters__hint">
          Przeciągnij osobę na tydzień projektu — doda się do końca fazy. Z klawiszem Shift: okno z opcjami.
        </p>
      </div>

      {alerts.length > 0 && (
        <section className="alerts" aria-label="Wymaga uwagi">
          <h2 className="alerts__title">Wymaga uwagi</h2>
          <ul className="alerts__list">
            {alerts.map((a) => (
              <li key={a.key} className={`alert alert--${a.tone}`}>
                <a.icon size={18} aria-hidden />
                <p>{a.text}</p>
                {a.action && (
                  <button type="button" className="btn btn--sm btn--secondary" onClick={a.action.run}>
                    {a.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Siła robocza ---------- */}
      <section className="staff-card" aria-label="Siła robocza w tygodniach">
        <header className="staff-card__head">
          <h2>Siła robocza</h2>
          <TradeLegend />
        </header>
        <div className="staff-scroll">
          <div className="staff-grid staff-grid--force" style={{ gridTemplateColumns: `var(--staff-name) repeat(${WEEKS}, ${COL}px) var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner=" " trailing=" " />
            <div className="staff-row staff-row--chart">
              <div className="staff-name staff-name--force wf-key">
                <span>
                  <i className="wf-key__need" /> potrzeba
                </span>
                <span>
                  <i className="wf-key__fill" /> w planie
                </span>
                <span>
                  <i className="wf-key__free" /> + wolni
                </span>
              </div>
              <WorkforceChart workforce={workforce} trades={trades} />
              <div className="staff-side staff-side--force" />
            </div>
            {(
              [
                ["short", "Brakuje", "Brakujący ludzie w projektach"],
                ["free", "Wolni", "Ludzie bez zadania w tym tygodniu"],
                ["balance", "Bilans", "Wolni minus brakujący. Ujemny: trzeba szukać ludzi spoza obecnej załogi"],
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
            <span className="bars-key">
              <i className="bars-key__bar bars-key__bar--el" />
              <i className="bars-key__bar bars-key__bar--me" />
              obrys = potrzeba, wypełnienie = w planie, kreski = urlop
            </span>
          </p>
        </header>
        <div className="staff-scroll">
          <div className="staff-grid" style={{ gridTemplateColumns: `var(--staff-name) repeat(${WEEKS}, ${COL}px) var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner="Projekt" trailing="Najbliższy brak" />
            {projects.map(({ project, weeks: ws }) => {
              const endWeek = project.endDate ? startOfWeek(project.endDate) : null;
              const share = epcidoShare(model, (model.team(project.id)?.members ?? []).map((m) => m.id));
              const scale = Math.max(1, ...ws.map((w) => Math.max(...trades.map((t) => Math.max(needOfT(w, t), haveOfT(w, t))))));
              const dropProps = (week: ISODate) => ({
                onDragOver: (e: React.DragEvent) => {
                  if (!dragged) return;
                  e.preventDefault();
                  const k = `${project.id}|${week}`;
                  if (dropCell !== k) setDropCell(k);
                },
                onDragLeave: () => setDropCell((c) => (c === `${project.id}|${week}` ? null : c)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  drop(project, week, e.shiftKey);
                },
              });
              const open = () => openProject(project.id, "team", true);
              return (
                <div
                  key={project.id}
                  className={`staff-row staff-row--project ${dropCell?.startsWith(`${project.id}|`) ? "is-drop" : ""} ${project.startDate > today ? "is-future" : ""}`}
                  style={{ ["--project" as string]: project.color }}
                >
                  <div className="staff-name" {...dropProps(weeks[0])}>
                    <button type="button" className="staff-name__btn" onClick={open} data-tip="Otwórz plan zespołu">
                      <ProjectDot color={project.color} />
                      <span>{project.name}</span>
                      <CategoryTag category={project.category} />
                    </button>
                    <span className="staff-name__sub">{projectWhen(project, today)}</span>
                    {share.epcido + share.agency > 0 && (
                      <span
                        className={`staff-name__sub staff-share ${share.ok ? "" : "is-warn"}`}
                        data-tip={`EPCIDO (UoP, B2B): ${share.epcido} · agencja: ${share.agency} · cel: co najmniej ${model.settings.minEpcidoShare}%`}
                      >
                        EPCIDO {share.pct}% · {share.epcido + share.agency} os.
                      </span>
                    )}
                  </div>
                  {ws.map((w, i) => {
                    const isEnd = endWeek === w.week;
                    const isStart = startOfWeek(project.startDate) === w.week;
                    const k = `${project.id}|${w.week}`;
                    return (
                      <div
                        key={w.week}
                        className={`staff-cell staff-cell--bars ${w.active ? "is-active" : ""} ${isEnd ? "is-end" : ""} ${isStart ? "is-start" : ""} ${i === 0 && offset === 0 ? "is-now" : ""} ${dropCell === k ? "is-target" : ""}`}
                        data-tip={dragged ? undefined : w.active ? cellTip(project, w) : undefined}
                        onClick={open}
                        {...dropProps(w.week)}
                      >
                        {w.active && (w.needDefined || w.electrical + w.mechanical > 0) && (
                          <span className="tbars">
                            {trades.map((t) => (
                              <TradeBar key={t} trade={t} need={w.needDefined ? needOfT(w, t) : 0} have={haveOfT(w, t)} away={awayOfT(w, t)} scale={scale} />
                            ))}
                          </span>
                        )}
                        {dropCell === k && <span className="drop-preview">{preview(project, w.week)}</span>}
                        {isEnd && project.endDate && (
                          <span className="staff-cell__end" style={{ left: (parseISO(project.endDate).getDay() || 7) * PX_DAY }} aria-label={`Koniec ${formatDate(project.endDate)}`} />
                        )}
                      </div>
                    );
                  })}
                  <div className="staff-side staff-side--project" {...dropProps(weeks[0])}>
                    <ProjectNeed weeks={ws} trades={trades} />
                    {ws.some((w) => shortOf(w, trades) > 0) && project.demand.some((d) => d.to >= today) && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm staff-propose"
                        onClick={() => setProposing(project)}
                        data-tip="Zaproponuj obsadę braków"
                        aria-label={`Zaproponuj obsadę: ${project.name}`}
                      >
                        <Sparkles size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Ludzie ---------- */}
      <section className="staff-card" aria-label="Ludzie w czasie" ref={peopleRef}>
        <header className="staff-card__head staff-card__head--people">
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
                { value: "experience", label: category === "all" ? "Staż" : `Staż ${category}` },
              ]}
            />
          </div>
          <PeopleFilters value={pf} onChange={setPf} categories={categories()} lockedCategory={category === "all" ? null : category} counts={pfCounts} />
        </header>
        <div className="staff-scroll">
          <div className="staff-grid staff-grid--people" style={{ gridTemplateColumns: `var(--staff-name) ${WEEKS * COL}px var(--staff-side)` }}>
            <WeekHeader weeks={weeks} today={today} corner="Osoba" single trailing="Dostępność" />
            {rows.length === 0 && <p className="staff-empty">Nikt nie pasuje do filtrów.</p>}
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
                  setDropCell(null);
                }}
                onPlan={() => setPlanning({ outlook: o })}
                onBreak={() => setBreaking(o)}
              />
            ))}
          </div>
        </div>
      </section>

      {planning && <PlanNextDialog outlook={planning.outlook} preset={planning.preset} onClose={() => setPlanning(null)} />}
      {breaking && <BreakDialog outlook={breaking} onClose={() => setBreaking(null)} />}
      {proposing && (
        <AutoStaffDialog
          project={proposing}
          team={(model.assignmentsByProject.get(proposing.id) ?? []).map((a) => ({ employeeId: a.employeeId, from: a.from, to: a.to }))}
          onClose={() => setProposing(null)}
          onApply={(items) => data.planMany(items)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- liczby tygodnia

const needOfT = (w: WeekStaffing, t: Trade) => (t === "ELECTRICAL" ? w.needElectrical : w.needMechanical);
const haveOfT = (w: WeekStaffing, t: Trade) => (t === "ELECTRICAL" ? w.electrical : w.mechanical);
const awayOfT = (w: WeekStaffing, t: Trade) => (t === "ELECTRICAL" ? w.leaveElectrical : w.leaveMechanical);
const shortOf = (w: WeekStaffing, trades: Trade[]) => trades.reduce((s, t) => s + (t === "ELECTRICAL" ? w.shortElectrical : w.shortMechanical), 0);
function shortText(w: WeekStaffing, trades: Trade[]) {
  const parts = [];
  if (trades.includes("ELECTRICAL") && w.shortElectrical) parts.push(`${w.shortElectrical} el.`);
  if (trades.includes("MECHANICAL") && w.shortMechanical) parts.push(`${w.shortMechanical} mech.`);
  return parts.join(" i ");
}

function TradeLegend() {
  return (
    <p className="staff-legend">
      <span>
        <i className="trade-dot trade-dot--el" /> elektrycy
      </span>
      <span>
        <i className="trade-dot trade-dot--me" /> mechanicy
      </span>
    </p>
  );
}

/** Słupek branży w komórce projektu: obrys = potrzeba, wypełnienie = w planie, kreski u góry wypełnienia = na urlopie. */
function TradeBar({ trade, need, have, away, scale }: { trade: Trade; need: number; have: number; away: number; scale: number }) {
  const t = trade === "ELECTRICAL" ? "el" : "me";
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  const short = need > 0 && have < need;
  return (
    <span className={`tbar tbar--${t} ${short ? "is-short" : ""} ${need > 0 && have >= need ? "is-full" : ""}`}>
      {need > 0 && <span className="tbar__need" style={{ height: pct(need) }} />}
      <span className="tbar__fill" style={{ height: pct(have) }}>
        {away > 0 && <span className="tbar__away" style={{ height: `${(away / Math.max(have, 1)) * 100}%` }} />}
      </span>
      <span className="tbar__num">{need > 0 ? (short ? `−${need - have}` : have) : have || ""}</span>
    </span>
  );
}

/** Wykres siły roboczej: dla każdej branży obrys = potrzeba, wypełnienie = w planie, kreskowane = wolni ponad plan. */
function WorkforceChart({
  workforce,
  trades,
}: {
  workforce: { week: ISODate; el: { need: number; planned: number; free: number; away: number }; me: { need: number; planned: number; free: number; away: number } }[];
  trades: Trade[];
}) {
  const max = Math.max(1, ...workforce.flatMap((w) => trades.map((t) => (t === "ELECTRICAL" ? w.el : w.me)).map((v) => Math.max(v.need, v.planned + v.free))));
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <>
      {workforce.map((w) => (
        <div key={w.week} className="staff-cell wf-cell">
          {trades.map((t) => {
            const v = t === "ELECTRICAL" ? w.el : w.me;
            const k = t === "ELECTRICAL" ? "el" : "me";
            return (
              <span
                key={t}
                className={`wf-bar wf-bar--${k} ${v.planned < v.need ? "is-short" : ""}`}
                data-tip={`${t === "ELECTRICAL" ? "Elektrycy" : "Mechanicy"}, tydz. ${isoWeek(w.week).week}\nPotrzeba: ${v.need}\nW planie: ${v.planned}${v.away ? ` (na urlopie: ${v.away})` : ""}\nWolni: ${v.free}`}
              >
                <span className="wf-bar__free" style={{ height: pct(v.planned + v.free) }} />
                <span className="wf-bar__fill" style={{ height: pct(v.planned) }} />
                <span className="wf-bar__need" style={{ height: pct(v.need) }} />
              </span>
            );
          })}
        </div>
      ))}
    </>
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
function ProjectNeed({ weeks, trades }: { weeks: WeekStaffing[]; trades: Trade[] }) {
  const defined = weeks.some((w) => w.needDefined);
  const first = weeks.find((w) => shortOf(w, trades) > 0);
  if (!defined) return <span className="muted">Bez zapotrzebowania</span>;
  if (!first) return <span className="staff-ok">Obsadzony</span>;
  return (
    <span className="staff-need">
      Brakuje {shortText(first, trades)} <em>od {formatDate(first.week).replace(/ \d{4}$/, "")}</em>
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
  const leaves = leavesBetween(model, o.employee.id, from, to);

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
            data-tip={categories().map((c) => `${c}: ${formatMonths(exp.byCategory[c] ?? 0)}`).join("\n") + `\nŁącznie: ${formatMonths(exp.totalMonths)}`}
          >
            {category
              ? `${category} ${formatMonthsShort(exp.byCategory[category] ?? 0)}`
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
        {leaves.map((l) => {
          const a = l.from < from ? from : l.from;
          const b = l.to > to ? to : l.to;
          return (
            <span
              key={l.id}
              className={`staff-leave staff-leave--${l.status === "PENDING" ? "pending" : l.type === "SICK" ? "sick" : "leave"}`}
              style={{ left: x(a), width: Math.max(PX_DAY, (daysBetween(a, b) + 1) * PX_DAY) }}
              data-tip={`${formatDate(l.from)} – ${formatDate(l.to)}\n${leaveNote(l)}`}
            />
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

function short(d: ISODate) {
  return formatDate(d).replace(/ \d{4}$/, "");
}

function cellTip(p: Project, w: WeekStaffing) {
  const line = (name: string, have: number, need: number | null, shortN: number, away: number) =>
    `${name}: ${have}${need ? ` z ${need}` : ""}${shortN ? ` — brakuje ${shortN}` : ""}${away ? ` · na urlopie ${away}` : ""}`;
  const days = eachDay(w.week, addDays(w.week, 6));
  return [
    `${p.name}, ${short(days[0])} – ${formatDate(days[6])}`,
    line("Elektrycy", w.electrical, w.needDefined ? w.needElectrical : null, w.shortElectrical, w.leaveElectrical),
    line("Mechanicy", w.mechanical, w.needDefined ? w.needMechanical : null, w.shortMechanical, w.leaveMechanical),
    ...(w.pendingLeave ? [`Wnioski urlopowe czekające: ${w.pendingLeave}`] : []),
    "Kliknij, żeby otworzyć plan zespołu",
  ].join("\n");
}

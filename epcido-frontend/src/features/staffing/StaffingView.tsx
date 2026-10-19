import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Coffee, Sparkles, TriangleAlert, UserX, Users } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { PageHeader } from "../../components/PageHeader";
import { CategoryTag, ProjectDot } from "../../components/PersonBadge";
import { ProjectScopeMark, ScopeFilter, useScope } from "../../components/ScopeFilter";
import { Segmented } from "../../components/Segmented";
import { WeekNav } from "../../components/WeekNav";
import { categories, defaultTask } from "../../domain/labels";
import {
  assignmentEnd,
  epcidoShare,
  FIELD_POSITIONS,
  longStretchWeeks,
  needsBreak,
  outlookOf,
  restartDate,
  weeklyStaffing,
  type PersonOutlook,
  type WeekStaffing,
} from "../../domain/staffing";
import type { Project, ProjectCategory, Trade } from "../../domain/types";
import { addDays, daysBetween, eachDay, formatDate, formatDay, isoWeek, parseISO, startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { plural } from "../../lib/text";
import { AutoStaffDialog } from "./AutoStaffDialog";
import { BreakDialog } from "./BreakDialog";
import { PeopleBoard, type PeopleStatus } from "./PeopleBoard";
import { PlanNextDialog } from "./PlanNextDialog";

const COL = 56; // px na tydzień = 8 px na dzień
const PX_DAY = COL / 7;
const OPEN_END = "9999-12-31";

type TradeFilter = "all" | Trade;
type CategoryFilter = "all" | ProjectCategory;

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
 *  4. ludzie: ta sama oś tygodni, dokładnie pod projektami — widać, kto jest wolny w którym tygodniu.
 *
 * Oś tygodni jest jedna dla całej tablicy i przykleja się do góry ekranu, więc przy najniższym
 * projekcie wciąż widać, od którego tygodnia zaczyna się kolumna.
 */
export function StaffingView() {
  const model = useModel();
  const user = useUser();
  const data = useData();
  const { openProject, confirm } = useUi();
  const navigate = useNavigate();
  const today = todayISO();
  const { ref, weeks: WEEKS } = useWeeksThatFit();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), offset * 7);
  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDays(from, i * 7)), [from, WEEKS]);
  const rangeEnd = addDays(from, WEEKS * 7 - 1);
  const [trade, setTrade] = useState<TradeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const scope = useScope(model, user);
  const [planning, setPlanning] = useState<{ outlook: PersonOutlook; preset?: { projectId: string; from: ISODate } } | null>(null);
  const [breaking, setBreaking] = useState<PersonOutlook | null>(null);
  const [proposing, setProposing] = useState<Project | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropCell, setDropCell] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ filter: PeopleStatus; nonce: number } | null>(null);
  const peopleRef = useRef<HTMLElement>(null);
  const trades: Trade[] = trade === "all" ? ["ELECTRICAL", "MECHANICAL"] : [trade];

  const projects = useMemo(
    () =>
      model.projects
        .filter((p) => p.status !== "CLOSED" && (p.endDate ?? OPEN_END) >= from && p.startDate <= rangeEnd)
        .filter((p) => category === "all" || p.category === category)
        .filter((p) => scope.pass(p))
        .map((p) => ({ project: p, weeks: weeklyStaffing(model, p, weeks) }))
        .sort(
          (a, b) =>
            Number(a.project.startDate > today) - Number(b.project.startDate > today) ||
            (a.project.startDate > today
              ? a.project.startDate.localeCompare(b.project.startDate)
              : (a.project.endDate ?? "9999").localeCompare(b.project.endDate ?? "9999"))
        ),
    [model, weeks, from, rangeEnd, category, today, scope]
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

  const shortProjects = projects.filter((p) => p.weeks.some((w) => shortOf(w, trades) > 0)).length;
  const deficitWeeks = workforce.filter((w) => w.balance < 0);

  /** Upuszczenie osoby na tydzień projektu: od tego tygodnia (albo od kiedy wolna) do końca fazy. */
  const drop = async (project: Project, week: ISODate, withDialog: boolean) => {
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
    // Przeciągnięcie też jest zapisem — planista potwierdza, zanim cokolwiek pójdzie do bazy
    const agreed = await confirm({
      title: "Dopisać do projektu?",
      lines: [
        `${o.employee.name} → ${project.name}`,
        `${defaultTask(o.employee.trade)}: ${formatDate(plan.from)} – ${plan.to ? formatDate(plan.to) : "koniec projektu"}`,
        ...(plan.breakDays ? [`Wcześniej przerwa: ${plan.breakDays} dni`] : []),
      ],
      confirmLabel: "Dopisz do planu",
    });
    if (!agreed) return;
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

  function showPeople(f: PeopleStatus) {
    setFocus({ filter: f, nonce: Date.now() });
    peopleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const gridCols = `var(--staff-name) repeat(${WEEKS}, ${COL}px) var(--staff-side)`;

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
        <ScopeFilter scope={scope} />
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
          <div className="staff-grid staff-grid--force" style={{ gridTemplateColumns: gridCols }}>
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

      {/* ---------- Jedna oś tygodni dla projektów i ludzi ---------- */}
      <div className="staff-board">
        <div className="staff-ruler">
          <div className="staff-grid" style={{ gridTemplateColumns: gridCols }}>
            <div className="staff-corner">Tydzień</div>
            {weeks.map((w) => {
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
            })}
            <div className="staff-corner staff-corner--side">{formatDate(from).replace(/ \d{4}$/, "")} – {formatDate(rangeEnd)}</div>
          </div>
        </div>

        {/* ---------- Projekty ---------- */}
        <section className="staff-card staff-card--flush" aria-label="Projekty w kolejnych tygodniach">
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
            <div className="staff-grid" style={{ gridTemplateColumns: gridCols }}>
              {projects.length === 0 && <p className="staff-empty">Żaden projekt nie pasuje do filtrów.</p>}
              {projects.map(({ project, weeks: ws }) => {
                const endWeek = project.endDate ? startOfWeek(project.endDate) : null;
                const share = epcidoShare(model, (model.team(project.id)?.members ?? []).map((m) => m.id));
                const scale = Math.max(1, ...ws.map((w) => Math.max(...trades.map((t) => Math.max(needOfT(w, t), haveOfT(w, t))))));
                const mine = scope.scopeOf(project) === "mine";
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
                    className={`staff-row staff-row--project ${dropCell?.startsWith(`${project.id}|`) ? "is-drop" : ""} ${project.startDate > today ? "is-future" : ""} ${mine ? "" : "is-other"}`}
                    style={{ ["--project" as string]: project.color }}
                  >
                    <div className="staff-name" {...dropProps(weeks[0])}>
                      <button type="button" className="staff-name__btn" onClick={open} data-tip="Otwórz plan zespołu">
                        <ProjectDot color={project.color} />
                        <span>{project.name}</span>
                        <CategoryTag category={project.category} />
                      </button>
                      <span className="staff-name__sub">
                        {projectWhen(project, today)}
                        <ProjectScopeMark scope={scope} project={project} />
                      </span>
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
        <section className="staff-card staff-card--flush" aria-label="Ludzie w czasie" ref={peopleRef}>
          <header className="staff-card__head staff-card__head--people">
            <h2>Ludzie</h2>
          </header>
          <PeopleBoard
            from={from}
            weeks={weeks}
            col={COL}
            variant="staffing"
            editable
            category={category === "all" ? null : category}
            dragged={dragged}
            onDragPerson={(id) => {
              setDragged(id);
              if (!id) setDropCell(null);
            }}
            onPlan={(o) => setPlanning({ outlook: o })}
            onBreak={(o) => setBreaking(o)}
            focus={focus}
          />
        </section>
      </div>

      {planning && <PlanNextDialog outlook={planning.outlook} preset={planning.preset} onClose={() => setPlanning(null)} />}
      {breaking && <BreakDialog outlook={breaking} onClose={() => setBreaking(null)} />}
      {proposing && (
        <AutoStaffDialog
          project={proposing}
          team={(model.assignmentsByProject.get(proposing.id) ?? []).map((a) => ({ employeeId: a.employeeId, from: a.from, to: a.to }))}
          onClose={() => setProposing(null)}
          onApply={async (items) => {
            const agreed = await confirm({
              title: `Dopisać ${items.length === 1 ? "osobę" : `${items.length} osób`} do ${proposing.name}?`,
              lines: items.map((it) => {
                const e = model.employeeById.get(it.employeeId);
                return `${e?.name ?? it.employeeId}: ${formatDate(it.from)} – ${it.to ? formatDate(it.to) : "koniec projektu"}${it.breakDays ? ` (po przerwie ${it.breakDays} dni)` : ""}`;
              }),
              confirmLabel: "Zapisz obsadę",
            });
            if (!agreed) return false;
            return data.planMany(items);
          }}
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

function projectWhen(p: Project, today: ISODate): string {
  if (p.startDate > today) return `start ${formatDay(p.startDate)} · za ${weeksTo(today, p.startDate)}`;
  if (!p.endDate) return "bez daty końca";
  return `koniec ${formatDay(p.endDate)} · za ${weeksTo(today, p.endDate)}`;
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

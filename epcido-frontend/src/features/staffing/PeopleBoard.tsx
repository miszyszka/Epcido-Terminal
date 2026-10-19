import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Coffee, GripVertical, Search, TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { useUi } from "../../app/UiContext";
import { EMPTY_PEOPLE_FILTER, PeopleFilters, passesPeopleFilter, type PeopleFilterValue } from "../../components/PeopleFilters";
import { EmploymentTag, ProjectDot } from "../../components/PersonBadge";
import { PersonLink } from "../../components/PersonLink";
import { Segmented } from "../../components/Segmented";
import { categories, formatMonths, formatMonthsShort, isEpcido, POSITION_LABEL } from "../../domain/labels";
import {
  availableFrom,
  BOARD_POSITIONS,
  experienceIn,
  leavesBetween,
  needsBreak,
  outlookOf,
  personBars,
  restartDate,
  suggestTargets,
  workChains,
  type PersonOutlook,
} from "../../domain/staffing";
import type { Employee, Position, ProjectCategory } from "../../domain/types";
import { leaveNote } from "../../domain/workflow";
import { addDays, daysBetween, formatDate, formatDay, isoWeek, parseISO, startOfWeek, todayISO, type ISODate } from "../../lib/dates";
import { matches } from "../../lib/search";
import { RangeDialog, type RangeDraft } from "./RangeDialog";

export type PeopleStatus = "releasing" | "free" | "long" | "all";
type PositionFilter = "all" | Extract<Position, "ELECTRICIAN" | "MECHANIC" | "TEAM_LEADER" | "SUPERVISOR">;
type SortKey = "available" | "experience";

const OPEN_END = "9999-12-31";

export interface PeopleBoardProps {
  /** Pierwszy poniedziałek osi — ten sam, co w pasku projektów */
  from: ISODate;
  weeks: ISODate[];
  /** Szerokość tygodnia w px — musi się zgadzać z paskiem projektów, żeby kolumny pokrywały się w pionie */
  col: number;
  /** staffing = pełne narzędzie planisty, project = panel obok planu zespołu */
  variant: "staffing" | "project";
  editable: boolean;
  category?: ProjectCategory | null;
  /** Projekt podpowiadany przy zaznaczaniu zakresu (plan projektu) */
  defaultProjectId?: string | null;
  /** Obsada: osoba przeciągana na kafelek projektu */
  dragged?: string | null;
  onDragPerson?: (employeeId: string | null) => void;
  onPlan?: (outlook: PersonOutlook) => void;
  onBreak?: (outlook: PersonOutlook) => void;
  /** Wymuszony filtr z zewnątrz (kafelki „Wymaga uwagi") — zmiana `nonce` przełącza widok */
  focus?: { filter: PeopleStatus; nonce: number } | null;
  /** Osoby już w planie projektu — pokazujemy je inaczej */
  inPlan?: Set<string>;
}

/**
 * Moduł „Ludzie": kto jest wolny, kto się zwalnia i kto długo pracuje bez przerwy — na tej samej
 * osi tygodni, co pasek projektów nad nim, żeby jednym spojrzeniem dobrać ludzi do tygodnia.
 *
 * Filtry: stanowisko (elektryk, mechanik, TL, SV, wszyscy), forma zatrudnienia i staż.
 * Na pasku osoby można nacisnąć i przeciągnąć: zaznaczony okres otwiera okno, w którym planista
 * przypisuje ją do projektu albo planuje powrót do domu. Nic nie zapisuje się bez potwierdzenia.
 */
export function PeopleBoard({
  from,
  weeks,
  col,
  variant,
  editable,
  category = null,
  defaultProjectId = null,
  dragged = null,
  onDragPerson,
  onPlan,
  onBreak,
  focus = null,
  inPlan,
}: PeopleBoardProps) {
  const model = useModel();
  const today = todayISO();
  const pxDay = col / 7;
  const to = addDays(from, weeks.length * 7 - 1);
  const x = (d: ISODate) => daysBetween(from, d) * pxDay;

  const [position, setPosition] = useState<PositionFilter>("all");
  const [status, setStatus] = useState<PeopleStatus>(variant === "staffing" ? "releasing" : "free");
  const [sort, setSort] = useState<SortKey>("available");
  const [pf, setPf] = useState<PeopleFilterValue>(EMPTY_PEOPLE_FILTER);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeDraft | null>(null);
  const lastFocus = useRef(0);

  if (focus && focus.nonce !== lastFocus.current) {
    lastFocus.current = focus.nonce;
    if (focus.filter !== status) setStatus(focus.filter);
  }

  const pool = useMemo(
    () => model.employees.filter((e) => BOARD_POSITIONS.includes(e.position) && e.active !== false),
    [model]
  );
  // Supervisor nie ma przypisań — jego „zajętość" wynika z projektów, które nadzoruje
  const people = useMemo(
    () =>
      pool.map((e) => {
        const o = outlookOf(model, e, today);
        if (e.position !== "SUPERVISOR") return o;
        const active = personBars(model, e.id).find((b) => b.from <= today && b.to >= today);
        if (!active) return o;
        return {
          ...o,
          currentProject: model.projectById.get(active.projectId) ?? null,
          status: "working" as const,
          releaseDate: active.to.startsWith("9999") ? null : active.to,
        };
      }),
    [model, pool, today]
  );

  const byPosition = (e: Employee) => position === "all" || e.position === position;
  const byFilters = (o: PersonOutlook) =>
    byPosition(o.employee) &&
    passesPeopleFilter(o.employee, { ...pf, category: category ?? pf.category }) &&
    matches(search, o.employee.name, ...model.projectsOf(o.employee.id).map((p) => p.name));

  const groups = {
    releasing: people.filter((o) => o.status === "releasing" && byFilters(o)),
    free: people.filter((o) => (o.status === "free" || o.status === "later") && byFilters(o)),
    long: people.filter((o) => needsBreak(o, today) && byFilters(o)),
    all: people.filter(byFilters),
  };
  const expKey = (o: PersonOutlook) => (category ? experienceIn(o.employee, category) : o.employee.experience?.totalMonths ?? 0);
  const avail = (o: PersonOutlook) => availableFrom(model, o.employee, today);
  const rows = [...groups[status]].sort((a, b) =>
    sort === "experience" ? expKey(b) - expKey(a) : avail(a).localeCompare(avail(b)) || expKey(b) - expKey(a)
  );

  const posCount = (f: PositionFilter) =>
    people.filter((o) => (f === "all" || o.employee.position === f) && passesPeopleFilter(o.employee, { ...pf, category: category ?? pf.category })).length;
  const pfCounts = useMemo(() => {
    const base = people.filter((o) => byPosition(o.employee) && passesPeopleFilter(o.employee, { ...pf, employment: "all", category: category ?? pf.category }));
    return { all: base.length, epcido: base.filter((o) => isEpcido(o.employee)).length, agency: base.filter((o) => !isEpcido(o.employee)).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, pf, position, category]);

  const cols =
    variant === "staffing"
      ? `var(--staff-name) ${weeks.length * col}px var(--staff-side)`
      : `var(--staff-name) ${weeks.length * col}px`;

  return (
    <>
      <div className="pboard__tools">
        <Segmented<PositionFilter>
          label="Stanowisko"
          value={position}
          onChange={setPosition}
          options={[
            { value: "all", label: "Wszyscy", count: posCount("all") },
            { value: "ELECTRICIAN", label: "Elektrycy", count: posCount("ELECTRICIAN") },
            { value: "MECHANIC", label: "Mechanicy", count: posCount("MECHANIC") },
            { value: "TEAM_LEADER", label: "TL", count: posCount("TEAM_LEADER") },
            { value: "SUPERVISOR", label: "SV", count: posCount("SUPERVISOR") },
          ]}
        />
        <Segmented<PeopleStatus>
          label="Kogo pokazać"
          value={status}
          onChange={setStatus}
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
            { value: "experience", label: category ? `Staż ${category}` : "Staż" },
          ]}
        />
        <label className="inline-search inline-search--sm">
          <Search size={15} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj osoby" aria-label="Szukaj osoby" />
        </label>
      </div>
      <PeopleFilters value={pf} onChange={setPf} categories={categories()} lockedCategory={category} counts={pfCounts} />

      {/* W Obsadzie oś tygodni jest wspólna z projektami i przyklejona u góry; w panelu projektu
          moduł ma własną, przyklejoną do swojego pudełka. */}
      {variant === "project" && (
        <div className="pboard-panel__ruler">
          <div className="staff-grid" style={{ gridTemplateColumns: cols }}>
            <div className="staff-corner">Osoba</div>
            <div className="staff-weeks">
              {weeks.map((w) => (
                <div key={w} className={`staff-week ${w === startOfWeek(today) ? "is-now" : ""}`} style={{ width: col }}>
                  <b>tydz. {isoWeek(w).week}</b>
                  <span>
                    {parseISO(w).getDate()}.{String(parseISO(w).getMonth() + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`staff-scroll ${variant === "project" ? "staff-scroll--panel" : ""}`}>
        <div className={`staff-grid staff-grid--people ${variant === "project" ? "staff-grid--panel" : ""}`} style={{ gridTemplateColumns: cols }}>
          {rows.length === 0 && <p className="staff-empty">Nikt nie pasuje do filtrów.</p>}
          {rows.map((o) => (
            <PersonRow
              key={o.employee.id}
              outlook={o}
              from={from}
              to={to}
              pxDay={pxDay}
              x={x}
              today={today}
              category={category}
              variant={variant}
              editable={editable}
              inPlan={inPlan?.has(o.employee.id) ?? false}
              dragging={dragged === o.employee.id}
              onDragStart={() => onDragPerson?.(o.employee.id)}
              onDragEnd={() => onDragPerson?.(null)}
              onRange={(a, b) => setRange({ employee: o.employee, from: a, to: b, projectId: defaultProjectId })}
              onPlan={onPlan ? () => onPlan(o) : undefined}
              onBreak={onBreak ? () => onBreak(o) : undefined}
            />
          ))}
        </div>
      </div>
      {editable && (
        <p className="pboard__hint">
          Naciśnij i przeciągnij po pasku osoby, żeby zaznaczyć okres — otworzy się okno z wyborem: przypisanie do projektu albo powrót do domu.
          {variant === "staffing" && " Nazwisko możesz też przeciągnąć na tydzień projektu powyżej."}
        </p>
      )}
      {range && <RangeDialog draft={range} onClose={() => setRange(null)} />}
    </>
  );
}

function PersonRow({
  outlook: o,
  from,
  to,
  pxDay,
  x,
  today,
  category,
  variant,
  editable,
  inPlan,
  dragging,
  onDragStart,
  onDragEnd,
  onRange,
  onPlan,
  onBreak,
}: {
  outlook: PersonOutlook;
  from: ISODate;
  to: ISODate;
  pxDay: number;
  x: (d: ISODate) => number;
  today: ISODate;
  category: ProjectCategory | null;
  variant: "staffing" | "project";
  editable: boolean;
  inPlan: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRange: (from: ISODate, to: ISODate) => void;
  onPlan?: () => void;
  onBreak?: () => void;
}) {
  const model = useModel();
  const { openProject } = useUi();
  const chains = workChains(model, o.employee.id);
  const bars = personBars(model, o.employee.id).filter((b) => b.from <= to && b.to >= from);
  const long = needsBreak(o, today);
  const free = availableFrom(model, o.employee, today);
  const exp = o.employee.experience;
  const topCategory = exp ? (Object.entries(exp.byCategory) as [ProjectCategory, number][]).sort((a, b) => b[1] - a[1])[0] : null;
  const leaves = leavesBetween(model, o.employee.id, from, to);
  const suggestion = o.status === "releasing" || o.status === "free" ? bestTarget(model, o, today) : null;

  // Zaznaczanie okresu myszą na pasku osoby
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ anchor: ISODate; moved: boolean } | null>(null);
  const [sel, setSel] = useState<{ a: ISODate; b: ISODate } | null>(null);

  const dateAt = (clientX: number): ISODate => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return from;
    const offset = Math.floor((clientX - rect.left) / pxDay);
    const max = daysBetween(from, to);
    return addDays(from, Math.max(0, Math.min(max, offset)));
  };

  const down = (e: React.PointerEvent) => {
    if (!editable || e.button !== 0) return;
    const anchor = dateAt(e.clientX);
    drag.current = { anchor, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const here = dateAt(e.clientX);
    if (!d.moved && here === d.anchor) return;
    d.moved = true;
    setSel(here < d.anchor ? { a: here, b: d.anchor } : { a: d.anchor, b: here });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    const s = sel;
    setSel(null);
    if (d?.moved && s) onRange(s.a, s.b);
  };

  return (
    <>
      <div
        className={`staff-name staff-name--drag ${dragging ? "is-dragging" : ""} ${inPlan ? "is-inplan" : ""}`}
        draggable={variant === "staffing"}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", o.employee.id);
          e.dataTransfer.effectAllowed = "copy";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        data-tip={variant === "staffing" ? "Przeciągnij na tydzień projektu" : undefined}
      >
        <span className="staff-name__person">
          {variant === "staffing" && <GripVertical size={14} className="staff-grip" aria-hidden />}
          <PersonLink employee={o.employee} />
          <EmploymentTag employee={o.employee} />
        </span>
        <span className="staff-name__sub">{personWhen(o, o.employee.position)}</span>
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

      <div
        className={`staff-track ${editable ? "is-selectable" : ""}`}
        ref={track}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {chains.slice(1).map((c, i) => {
          const gapFrom = addDays(chains[i].to, 1);
          const gapTo = addDays(c.from, -1);
          if (gapTo < from || gapFrom > to) return null;
          const a = gapFrom < from ? from : gapFrom;
          const b = gapTo > to ? to : gapTo;
          return (
            <span
              key={`gap-${c.from}`}
              className="staff-gap"
              style={{ left: x(a), width: (daysBetween(a, b) + 1) * pxDay }}
              data-tip={`Przerwa — wyjazd do domu\n${formatDate(gapFrom)} – ${formatDate(gapTo)}`}
            >
              <Coffee size={12} aria-hidden />
            </span>
          );
        })}
        {bars.map((b) => {
          const p = model.projectById.get(b.projectId);
          if (!p) return null;
          const s = b.from < from ? from : b.from;
          const e = b.to > to ? to : b.to;
          const width = (daysBetween(s, e) + 1) * pxDay;
          return (
            <button
              key={b.key}
              type="button"
              className={`staff-bar ${b.supervision ? "staff-bar--sv" : ""}`}
              style={{ left: x(s), width, ["--project" as string]: p.color }}
              data-tip={`${p.name} (${p.category})${b.task ? ` · ${b.task}` : ""}: ${formatDate(b.from)} – ${b.to.startsWith("9999") ? "bez końca" : formatDate(b.to)}\nKliknij, żeby otworzyć projekt`}
              onClick={(ev) => {
                ev.stopPropagation();
                openProject(p.id, "team", true);
              }}
            >
              {width > 44 && <span>{width > 110 ? p.name : p.number}</span>}
            </button>
          );
        })}
        {leaves.map((l) => {
          const a = l.from < from ? from : l.from;
          const b = l.to > to ? to : l.to;
          return (
            <span
              key={l.id}
              className={`staff-leave staff-leave--${l.status === "PENDING" ? "pending" : l.type === "SICK" ? "sick" : "leave"}`}
              style={{ left: x(a), width: Math.max(pxDay, (daysBetween(a, b) + 1) * pxDay) }}
              data-tip={`${formatDate(l.from)} – ${formatDate(l.to)}\n${leaveNote(l)}`}
            />
          );
        })}
        {sel && (
          <span className="staff-sel" style={{ left: x(sel.a), width: (daysBetween(sel.a, sel.b) + 1) * pxDay }}>
            <b>
              {formatDate(sel.a).replace(/ \d{4}$/, "")} – {formatDate(sel.b).replace(/ \d{4}$/, "")}
            </b>
          </span>
        )}
        {today >= from && today <= to && <span className="staff-today" style={{ left: x(today) + pxDay / 2 }} />}
      </div>

      {variant === "staffing" && (
        <div className="staff-side">
          <div className="staff-side__info">
            <span className={`staff-free ${free <= today ? "is-now" : ""}`}>
              {free.startsWith(OPEN_END.slice(0, 4)) ? "zajęty bez końca" : free <= today ? "wolny teraz" : `wolny od ${formatDay(free)}`}
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
            {onPlan && (o.status === "releasing" || o.status === "free" || o.status === "later") && (
              <button type="button" className="btn btn--primary btn--sm" onClick={onPlan} data-tip="Zaplanuj kolejny projekt po obecnym">
                <CalendarPlus size={15} aria-hidden />
                Zaplanuj
              </button>
            )}
            {onBreak && o.chain && (long || o.status === "working") && (
              <button type="button" className={`btn btn--sm ${long ? "btn--secondary" : "btn--quiet"}`} onClick={onBreak} data-tip="Wstaw przerwę na wyjazd do domu">
                <Coffee size={15} aria-hidden />
                Przerwa
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function bestTarget(model: ReturnType<typeof useModel>, o: PersonOutlook, today: ISODate) {
  const start = restartDate(o.releaseDate ?? addDays(today, -1), o.stretchWeeksAtEnd >= 6 ? 7 : 0);
  const best = suggestTargets(model, o.employee, start, o.currentProject?.id)[0];
  return best && best.shortage > 0 ? best : null;
}

function personWhen(o: PersonOutlook, position: Position): string {
  if (position === "SUPERVISOR" && !o.currentProject) return `${POSITION_LABEL.SUPERVISOR} · bez projektu`;
  if (o.status === "free") return o.next ? `od ${formatDate(o.next.from)} w kolejnym projekcie` : "bez przydziału";
  if (o.status === "later") return `startuje ${formatDate(o.next!.from)}`;
  const p = o.currentProject?.name ?? "projekt";
  if (o.releaseDate) return `${p} · kończy ${formatDay(o.releaseDate)}`;
  return `${p} · do końca projektu`;
}

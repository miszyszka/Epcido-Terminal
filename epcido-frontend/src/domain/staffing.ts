// Obsada: kto gdzie pracuje w kolejnych tygodniach, gdzie brakuje ludzi, kto się zwalnia
// i kto długo pracuje bez przerwy na wyjazd do domu. Narzędzie Planningu (ADR 0009).

import type { Model } from "../app/DataContext";
import { addDays, daysBetween, startOfWeek, type ISODate } from "../lib/dates";
import { isOurs } from "./labels";
import type { Assignment, Employee, Project, ProjectCategory, Trade } from "./types";

/** Krótsza luka (np. weekend) nie jest przerwą na wyjazd do domu. */
export const BREAK_MIN_DAYS = 5;
/** Od tylu tygodni ciągłej pracy pokazujemy „długo bez przerwy". */
export const LONG_STRETCH_WEEKS = 8;
/** Ile tygodni naprzód szukamy osób, które się zwalniają. */
export const RELEASE_HORIZON_WEEKS = 8;

const OPEN_END = "9999-12-31";

export const FIELD_POSITIONS: Employee["position"][] = ["TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

/** Faktyczny koniec zadania: data „do" albo koniec projektu (albo bez końca). */
export function assignmentEnd(model: Model, a: Assignment): ISODate {
  return a.to ?? model.projectById.get(a.projectId)?.endDate ?? OPEN_END;
}

export interface Chain {
  from: ISODate;
  /** OPEN_END = bez końca */
  to: ISODate;
  assignments: Assignment[];
}

/** Zadania osoby we wszystkich projektach scalone w ciągi pracy bez przerwy na wyjazd. */
export function workChains(model: Model, employeeId: string): Chain[] {
  const list = [...(model.assignmentsByEmployee.get(employeeId) ?? [])].sort((a, b) => a.from.localeCompare(b.from));
  const chains: Chain[] = [];
  for (const a of list) {
    const end = assignmentEnd(model, a);
    const last = chains[chains.length - 1];
    if (last && daysBetween(last.to, a.from) - 1 < BREAK_MIN_DAYS) {
      if (end > last.to) last.to = end;
      last.assignments.push(a);
    } else {
      chains.push({ from: a.from, to: end, assignments: [a] });
    }
  }
  return chains;
}

export type OutlookStatus = "releasing" | "free" | "working" | "later";

export interface PersonOutlook {
  employee: Employee;
  /** Zadanie na dziś */
  current: Assignment | null;
  currentProject: Project | null;
  /** Ciąg pracy obejmujący dziś */
  chain: Chain | null;
  /** Ile tygodni pracuje bez przerwy (do dziś) */
  stretchWeeks: number;
  /** Ile tygodni bez przerwy wyjdzie do końca obecnego ciągu */
  stretchWeeksAtEnd: number;
  /** Ostatni dzień pracy przed przerwą (gdy w horyzoncie) */
  releaseDate: ISODate | null;
  /** Następne zadanie po obecnym ciągu */
  next: Assignment | null;
  status: OutlookStatus;
}

export function outlookOf(model: Model, employee: Employee, today: ISODate): PersonOutlook {
  const chains = workChains(model, employee.id);
  const chain = chains.find((c) => c.from <= today && c.to >= today) ?? null;
  const current = model.activeAssignment(employee.id, today) ?? null;
  const horizon = addDays(today, RELEASE_HORIZON_WEEKS * 7);
  const after = chains.find((c) => c.from > (chain?.to ?? today));
  const next = after?.assignments[0] ?? null;
  // Przerwa już zaplanowana (następne zadanie w ciągu 3 tygodni) to nie „zwalnia się"
  const plannedAfter = Boolean(chain && after && daysBetween(chain.to, after.from) <= 21);
  const releaseDate = chain && chain.to !== OPEN_END && chain.to <= horizon && !plannedAfter ? chain.to : null;
  const stretchWeeks = chain ? Math.floor((daysBetween(chain.from, today) + 1) / 7) : 0;
  const stretchWeeksAtEnd = chain && chain.to !== OPEN_END ? Math.floor((daysBetween(chain.from, chain.to) + 1) / 7) : stretchWeeks;
  let status: OutlookStatus = "working";
  if (!chain) status = next && next.from <= addDays(today, 14) ? "later" : "free";
  else if (releaseDate) status = "releasing";
  return {
    employee,
    current,
    currentProject: current ? model.projectById.get(current.projectId) ?? null : null,
    chain,
    stretchWeeks,
    stretchWeeksAtEnd,
    releaseDate,
    next,
    status,
  };
}

/** Długo bez przerwy i wyjazd nie jest jeszcze zaplanowany (ciąg pracy nie kończy się w ciągu 3 tygodni). */
export function needsBreak(o: PersonOutlook, today: ISODate): boolean {
  if (o.stretchWeeks < LONG_STRETCH_WEEKS || !o.chain) return false;
  return o.chain.to > addDays(today, 21);
}

/** Zapotrzebowanie projektu w tygodniu: największe z faz, które nachodzą na dni robocze tygodnia. */
export function needAt(project: Project, week: ISODate): { electricians: number; mechanics: number; defined: boolean } {
  const friday = addDays(week, 4);
  const phases = (project.demand ?? []).filter((d) => d.from <= friday && d.to >= week);
  if (phases.length === 0) return { electricians: 0, mechanics: 0, defined: false };
  return {
    electricians: Math.max(...phases.map((d) => d.electricians)),
    mechanics: Math.max(...phases.map((d) => d.mechanics)),
    defined: true,
  };
}

export interface WeekStaffing {
  week: ISODate;
  /** Projekt trwa w tym tygodniu */
  active: boolean;
  electrical: number;
  mechanical: number;
  needElectrical: number;
  needMechanical: number;
  /** Faza zapotrzebowania obejmuje ten tydzień */
  needDefined: boolean;
  /** Ludzie projektu w tym tygodniu (do proporcji nasi / agencja) */
  people: string[];
  /** Brakuje osób względem zapotrzebowania (0 = obsadzony albo brak zapotrzebowania) */
  shortElectrical: number;
  shortMechanical: number;
}

/** Obsada projektu w tygodniach: ilu elektryków i mechaników (razem z TL) pracuje w dni robocze tygodnia. */
export function weeklyStaffing(model: Model, project: Project, weeks: ISODate[]): WeekStaffing[] {
  const list = model.assignmentsByProject.get(project.id) ?? [];
  const projectEnd = project.endDate ?? OPEN_END;
  return weeks.map((week) => {
    const friday = addDays(week, 4);
    const active = project.startDate <= friday && projectEnd >= week;
    const people = new Map<string, Trade | undefined>();
    for (const a of list) {
      if (a.from <= friday && assignmentEnd(model, a) >= week) people.set(a.employeeId, model.employeeById.get(a.employeeId)?.trade);
    }
    const electrical = [...people.values()].filter((t) => t === "ELECTRICAL").length;
    const mechanical = [...people.values()].filter((t) => t === "MECHANICAL").length;
    const need = needAt(project, week);
    return {
      week,
      active: active || need.defined,
      electrical,
      mechanical,
      needElectrical: need.electricians,
      needMechanical: need.mechanics,
      needDefined: need.defined,
      people: [...people.keys()],
      shortElectrical: Math.max(0, need.electricians - electrical),
      shortMechanical: Math.max(0, need.mechanics - mechanical),
    };
  });
}

export interface TargetSuggestion {
  project: Project;
  /** Ilu osób tej branży brakuje w tygodniu startu */
  shortage: number;
  /** Zespół tej branży w tygodniu startu */
  planned: number;
  need: number | null;
}

/** Projekty, do których można przenieść osobę od danego dnia — najpierw te, gdzie brakuje jej branży. */
export function suggestTargets(model: Model, employee: Employee, from: ISODate, excludeProjectId?: string | null): TargetSuggestion[] {
  const week = startOfWeek(from);
  return model.projects
    .filter((p) => p.id !== excludeProjectId && p.status !== "CLOSED" && (p.endDate ?? OPEN_END) >= from)
    .map((project) => {
      const s = weeklyStaffing(model, project, [week])[0];
      const electrical = employee.trade !== "MECHANICAL";
      const need = s.needDefined ? (electrical ? s.needElectrical : s.needMechanical) : null;
      return {
        project,
        planned: electrical ? s.electrical : s.mechanical,
        need,
        shortage: electrical ? s.shortElectrical : s.shortMechanical,
      };
    })
    .sort((a, b) => b.shortage - a.shortage || a.project.startDate.localeCompare(b.project.startDate));
}

/** Pierwszy poniedziałek po końcu pracy i przerwie. */
export function restartDate(lastDay: ISODate, breakDays: number): ISODate {
  const free = addDays(lastDay, 1 + breakDays);
  return startOfWeek(free) === free ? free : addDays(startOfWeek(free), 7);
}

/** Proporcja „naszych" (UoP + B2B) wśród ludzi. Cel: co najmniej połowa. */
export function oursShare(model: Model, employeeIds: string[]): { ours: number; agency: number; ok: boolean } {
  const people = employeeIds.map((id) => model.employeeById.get(id)).filter((e): e is Employee => Boolean(e));
  const ours = people.filter(isOurs).length;
  const agency = people.length - ours;
  return { ours, agency, ok: agency <= ours };
}

/** Pierwszy dzień, od którego osoba jest wolna (dziś, jeśli bez zadania). */
export function availableFrom(model: Model, employee: Employee, today: ISODate): ISODate {
  const o = outlookOf(model, employee, today);
  if (!o.chain) return today;
  if (o.chain.to === OPEN_END) return OPEN_END;
  return addDays(o.chain.to, 1);
}

export function experienceIn(e: Employee, category: ProjectCategory): number {
  return e.experience?.byCategory?.[category] ?? 0;
}

export interface Candidate {
  employee: Employee;
  outlook: PersonOutlook;
  /** Od kiedy może zacząć w fazie (z przerwą, jeśli długo pracuje) */
  start: ISODate;
  /** Proponowana przerwa przed startem (dni) */
  breakDays: number;
  /** Ile dni opóźnienia względem startu fazy (0 = od początku) */
  lateDays: number;
  experience: number;
  ours: boolean;
}

/**
 * Kandydaci do fazy projektu: ta sama branża, wolni przed końcem fazy, bez kolizji.
 * Kolejność: kto może zacząć od początku fazy → doświadczenie w kategorii projektu → nasi przed agencją.
 */
export function candidatesFor(
  model: Model,
  project: Project,
  phase: { from: ISODate; to: ISODate },
  trade: Trade,
  today: ISODate,
  preferOurs: boolean
): Candidate[] {
  const out: Candidate[] = [];
  for (const e of model.employees) {
    if (!FIELD_POSITIONS.includes(e.position) || e.trade !== trade) continue;
    if ((model.assignmentsByProject.get(project.id) ?? []).some((a) => a.employeeId === e.id && a.from <= phase.to && assignmentEnd(model, a) >= phase.from)) continue;
    const o = outlookOf(model, e, today);
    const longRun = o.stretchWeeksAtEnd >= 6;
    let start: ISODate;
    let breakDays = 0;
    if (!o.chain) start = today > phase.from ? today : phase.from;
    else if (o.chain.to === OPEN_END) continue;
    else {
      breakDays = longRun ? 7 : 0;
      start = restartDate(o.chain.to, breakDays);
      if (start < phase.from) start = phase.from;
    }
    if (start > phase.to) continue;
    // Nie może nachodzić na kolejne zadania tej osoby
    const clash = (model.assignmentsByEmployee.get(e.id) ?? []).some((a) => a.from <= phase.to && assignmentEnd(model, a) >= start);
    if (clash) continue;
    out.push({
      employee: e,
      outlook: o,
      start,
      breakDays,
      lateDays: Math.max(0, daysBetween(phase.from, start)),
      experience: experienceIn(e, project.category),
      ours: isOurs(e),
    });
  }
  return out.sort(
    (a, b) =>
      Math.sign(a.lateDays) - Math.sign(b.lateDays) ||
      (preferOurs ? Number(b.ours) - Number(a.ours) : 0) ||
      b.experience - a.experience ||
      a.lateDays - b.lateDays
  );
}

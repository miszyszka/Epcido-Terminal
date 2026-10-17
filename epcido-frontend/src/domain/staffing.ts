// Obsada: kto gdzie pracuje w kolejnych tygodniach, gdzie brakuje ludzi, kto się zwalnia
// i kto długo pracuje bez przerwy na wyjazd do domu. Narzędzie Planningu (ADR 0009).

import type { Model } from "../app/DataContext";
import { addDays, daysBetween, startOfWeek, type ISODate } from "../lib/dates";
import { isEpcido } from "./labels";
import { getSettings } from "./settings";
import type { Assignment, DemandPhase, Employee, LeaveRequest, Project, ProjectCategory, Trade } from "./types";

/** Krótsza luka (np. weekend) nie jest przerwą na wyjazd do domu (ustawienia systemu, domyślnie 5 dni). */
export const breakMinDays = () => getSettings().breakMinDays;
/** Od tylu tygodni ciągłej pracy pokazujemy „długo bez przerwy" (ustawienia, domyślnie 8). */
export const longStretchWeeks = () => getSettings().longStretchWeeks;
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
    if (last && daysBetween(last.to, a.from) - 1 < breakMinDays()) {
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
  if (o.stretchWeeks < longStretchWeeks() || !o.chain) return false;
  return o.chain.to > addDays(today, 21);
}

/** Zapotrzebowanie projektu w tygodniu: największe z faz, które nachodzą na dni robocze tygodnia. */
export function needAt(project: Project, week: ISODate): { electricians: number; mechanics: number; defined: boolean } {
  return needOf(project.demand ?? [], week);
}

/** Zapotrzebowanie z listy faz (np. jeszcze niezapisanych w edytorze projektu). */
export function needOf(demand: DemandPhase[], week: ISODate): { electricians: number; mechanics: number; defined: boolean } {
  const friday = addDays(week, 4);
  const phases = demand.filter((d) => d.from <= friday && d.to >= week);
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
  /** Ludzie projektu w tym tygodniu (do proporcji EPCIDO / agencja) */
  people: string[];
  /** Z przypisanych: na zaakceptowanym urlopie (L4) przez większość tygodnia */
  leaveElectrical: number;
  leaveMechanical: number;
  /** Z przypisanych: wniosek urlopowy czeka na akceptację */
  pendingLeave: number;
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
    let leaveElectrical = 0;
    let leaveMechanical = 0;
    let pendingLeave = 0;
    for (const [id, t] of people) {
      const leave = leaveInWeek(model, id, week);
      if (!leave) continue;
      if (leave.status === "PENDING") pendingLeave++;
      else if (t === "ELECTRICAL") leaveElectrical++;
      else if (t === "MECHANICAL") leaveMechanical++;
    }
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
      leaveElectrical,
      leaveMechanical,
      pendingLeave,
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

/** Wniosek (zaakceptowany albo czekający), który zabiera osobie co najmniej 3 dni robocze tygodnia. */
export function leaveInWeek(model: Model, employeeId: string, week: ISODate): LeaveRequest | undefined {
  const friday = addDays(week, 4);
  return model.leavesOf(employeeId).find((l) => {
    if (l.status !== "APPROVED" && l.status !== "PENDING") return false;
    if (l.from > friday || l.to < week) return false;
    const a = l.from > week ? l.from : week;
    const b = l.to < friday ? l.to : friday;
    return daysBetween(a, b) + 1 >= 3;
  });
}

/** Wnioski osoby (zaakceptowane i czekające) nachodzące na okres. */
export function leavesBetween(model: Model, employeeId: string, from: ISODate, to: ISODate): LeaveRequest[] {
  return model.leavesOf(employeeId).filter((l) => (l.status === "APPROVED" || l.status === "PENDING") && l.from <= to && l.to >= from);
}

export interface Share {
  epcido: number;
  agency: number;
  /** Udział EPCIDO w procentach (100, gdy nikogo nie ma) */
  pct: number;
  /** Co najmniej minimalny udział z ustawień (domyślnie 50%) */
  ok: boolean;
}

/** Udział EPCIDO (UoP + B2B) wśród ludzi. Cel z ustawień: domyślnie co najmniej połowa. */
export function epcidoShare(model: Model, employeeIds: string[]): Share {
  const people = [...new Set(employeeIds)].map((id) => model.employeeById.get(id)).filter((e): e is Employee => Boolean(e));
  const epcido = people.filter(isEpcido).length;
  const agency = people.length - epcido;
  const pct = people.length ? Math.round((epcido / people.length) * 100) : 100;
  return { epcido, agency, pct, ok: pct >= getSettings().minEpcidoShare };
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
  epcido: boolean;
  /** Urlop albo wniosek w czasie fazy */
  leave: LeaveRequest | null;
}

/**
 * Kandydaci do fazy projektu: ta sama branża, wolni przed końcem fazy, bez kolizji.
 * Kolejność: kto może zacząć wcześniej (od startu fazy albo od dziś, gdy faza trwa; w tygodniach) → EPCIDO przed
 * agencją (gdy agencji jest za dużo) → bez urlopu w fazie → doświadczenie w kategorii projektu.
 */
export function candidatesFor(
  model: Model,
  project: Project,
  phase: { from: ISODate; to: ISODate },
  trade: Trade,
  today: ISODate,
  preferEpcido: boolean
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
      // Opóźnienie liczone od startu fazy, a gdy faza już trwa — od dziś
      lateDays: Math.max(0, daysBetween(phase.from < today ? today : phase.from, start)),
      experience: experienceIn(e, project.category),
      epcido: isEpcido(e),
      leave: leavesBetween(model, e.id, start, phase.to)[0] ?? null,
    });
  }
  // Kto wcześniej może zacząć (w tygodniach) → EPCIDO → bez urlopu → staż w kategorii
  return out.sort(
    (a, b) =>
      Math.ceil(a.lateDays / 7) - Math.ceil(b.lateDays / 7) ||
      (preferEpcido ? Number(b.epcido) - Number(a.epcido) : 0) ||
      Number(Boolean(a.leave)) - Number(Boolean(b.leave)) ||
      b.experience - a.experience ||
      a.lateDays - b.lateDays
  );
}

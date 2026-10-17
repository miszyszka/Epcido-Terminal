// Generator danych testowych. Deterministyczny: ten sam dzień „dziś" = te same dane.
//
// Struktura:
//   Administrator, Planista, 3 × Project Manager
//   4 × Installation Manager → 10 projektów w toku + 5 przyszłych (po 1 Supervisorze, gdy jest)
//   Kategorie projektów: KNAPP, KARDEX, FORTNA, OTHER. Każdy projekt ma fazy zapotrzebowania (ilu ludzi kiedy).
//   Zespoły: 20 Team Leaderów + elektrycy i mechanicy, każdy z zadaniem od–do; część z przerwą na wyjazd.
//   Pracownicy: UoP, B2B, agencja (mniej więcej po równo), doświadczenie w miesiącach łącznie i w kategoriach.
//
// Godziny: ostatnie 10 tygodni do dziś. Zamknięte tygodnie są wysłane do Dataverse (cały timesheet),
// poza kilkoma wstrzymanymi timesheetami (brak zatwierdzenia albo brak wpisu) — czekają na administratora.
//
// Biuro: 3 osoby z HR (akceptują urlopy, widzą ludzi) i 1 użytkownik z własnymi uprawnieniami (controlling).
// Urlopy: każda nieobecność w godzinach ma wniosek (zaakceptowany przez supervisora albo HR; L4 potwierdzone),
// do tego zaakceptowane urlopy w kolejnych tygodniach, wnioski czekające na akceptację, jeden odrzucony
// i trwające L4 bez potwierdzonego dokumentu.

import { addDays, daysBetween, eachDay, formatMinutes, parseISO, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { createRandom } from "../lib/random";
import { defaultTask, PROJECT_COLORS } from "../domain/labels";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { exportAt, lockAt } from "../domain/workflow";
import type {
  Assignment,
  Dataset,
  DayEntry,
  DemandPhase,
  Employee,
  Employment,
  Experience,
  LeaveRequest,
  Project,
  ProjectCategory,
  Timesheet,
} from "../domain/types";

export const SEED_VERSION = 6;
const CATEGORIES = DEFAULT_SETTINGS.categories;
export const DEFAULT_USER_ID = "planner-1";

interface SiteSpec {
  customer: string;
  site: string;
  country: string;
  branch: string;
  category: ProjectCategory;
}

const SITES: SiteSpec[] = [
  { customer: "Nordhavn Automated Storage", site: "Ash Road South, Wrexham", country: "Wielka Brytania", branch: "Wielka Brytania", category: "KNAPP" },
  { customer: "Rheinlager Logistik", site: "Industriestraße 12, Kolonia", country: "Niemcy", branch: "Niemcy", category: "KARDEX" },
  { customer: "Vandermolen Distributie", site: "Kraaivenstraat 21, Tilburg", country: "Holandia", branch: "Beneluks", category: "FORTNA" },
  { customer: "Kattegat Cold Chain", site: "Hamnvägen 4, Göteborg", country: "Szwecja", branch: "Skandynawia", category: "KNAPP" },
  { customer: "Warta Fulfilment", site: "ul. Gnieźnieńska 40, Poznań", country: "Polska", branch: "Polska", category: "OTHER" },
  { customer: "Egerland Parts", site: "Průmyslová 7, Cheb", country: "Czechy", branch: "Czechy", category: "KARDEX" },
  { customer: "Rhône Pharma Logistique", site: "Rue de l'Industrie 9, Lyon", country: "Francja", branch: "Francja", category: "KNAPP" },
  { customer: "Aros Retail Hub", site: "Sintrupvej 30, Aarhus", country: "Dania", branch: "Skandynawia", category: "FORTNA" },
  { customer: "Bałtyk Terminal", site: "ul. Kontenerowa 2, Gdańsk", country: "Polska", branch: "Polska", category: "OTHER" },
  { customer: "Midlands Grocery DC", site: "Fenny Lock, Milton Keynes", country: "Wielka Brytania", branch: "Wielka Brytania", category: "KNAPP" },
  // Przyszłe projekty (wrzucone przez PM, czekają na obsadę)
  { customer: "Hanse Pharma Distribution", site: "Am Hafen 3, Hamburg", country: "Niemcy", branch: "Niemcy", category: "KNAPP" },
  { customer: "Scheldt Fashion Hub", site: "Noorderlaan 88, Antwerpia", country: "Belgia", branch: "Beneluks", category: "FORTNA" },
  { customer: "Wisła Spare Parts", site: "ul. Logistyczna 5, Stryków", country: "Polska", branch: "Polska", category: "KARDEX" },
  { customer: "Øresund Grocery", site: "Lagervej 12, Køge", country: "Dania", branch: "Skandynawia", category: "KNAPP" },
  { customer: "Lombardia Retail", site: "Via dell'Industria 4, Piacenza", country: "Włochy", branch: "Polska", category: "OTHER" },
];

/** Start projektu w tygodniach względem początku zakresu danych (ujemne = wcześniej). */
const START_WEEK_OFFSET = [-6, -2, 0, 1, 2, 3, 4, 5, 7, 11, 12, 14, 16, 19, 22];
/** Koniec projektu w tygodniach od bieżącego tygodnia — kilka kończy się wkrótce. */
const END_WEEKS_FROM_NOW = [3, 6, 14, 9, 20, 12, 16, 24, 18, 30, 23, 21, 19, 34, 26];
const WORKS_SATURDAYS = [true, false, false, true, false, false, true, false, true, false];
const PROJECT_IM = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 0, 1, 2, 3, 0];
/** Ilu przyszłych projektów ma już supervisora */
const FUTURE_WITH_SV = 2;
const EXTRA_TASKS_EL = ["Montaż tras kablowych", "Podłączenia", "Prefabrykacja"];

/** Wstrzymane timesheety: projekt (indeks), ile tygodni temu, rodzaje błędów. */
const WITHHELD: { project: number; weeksAgo: number; unapproved: number; missing: number }[] = [
  { project: 2, weeksAgo: 1, unapproved: 2, missing: 1 },
  { project: 6, weeksAgo: 1, unapproved: 0, missing: 1 },
  { project: 1, weeksAgo: 3, unapproved: 1, missing: 0 },
];

export const DATA_WEEKS = 10;

export function generateDataset(today: ISODate, now: Date = new Date()): Dataset {
  const rnd = createRandom(26_044);
  const stamp = now.toISOString();
  const currentWeek = startOfWeek(today);
  const rangeStart = addDays(currentWeek, -(DATA_WEEKS - 1) * 7);

  // ---------- Ludzie ----------
  const experience = (agency: boolean): Experience => {
    const total = agency ? rnd.int(2, 40) : rnd.chance(0.25) ? rnd.int(4, 24) : rnd.int(18, 170);
    const main = rnd.pick(CATEGORIES);
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<ProjectCategory, number>;
    let left = total;
    byCategory[main] = Math.round(total * (0.4 + rnd.next() * 0.4));
    left -= byCategory[main];
    for (const c of rnd.shuffle(CATEGORIES.filter((x) => x !== main))) {
      const part = rnd.chance(0.65) ? Math.round(left * rnd.next() * 0.7) : 0;
      byCategory[c] = part;
      left -= part;
    }
    return { totalMonths: total, byCategory };
  };
  const employment = (leader: boolean): Employment => {
    if (leader) return rnd.chance(0.6) ? "UOP" : "B2B";
    const r = rnd.next();
    return r < 0.34 ? "UOP" : r < 0.67 ? "B2B" : "AGENCY";
  };
  const person = (id: string, name: string, role: Employee["role"], position: Employee["position"], trade?: Employee["trade"]): Employee => {
    const field = position === "TEAM_LEADER" || position === "ELECTRICIAN" || position === "MECHANIC";
    const emp = field ? employment(position === "TEAM_LEADER") : undefined;
    return {
      id,
      name,
      role,
      position,
      ...(trade ? { trade } : {}),
      ...(emp ? { employment: emp, experience: experience(emp === "AGENCY") } : {}),
      active: true,
    };
  };
  const admin = person("admin-1", "Administrator", "ADMIN", "ADMIN");
  const planner = person("planner-1", "Planista 1", "PLANNING", "PLANNER");
  const pms = range(3).map((i) => person(`pm-${i + 1}`, `Project Manager ${i + 1}`, "PROJECT_MANAGER", "PROJECT_MANAGER"));
  const ims = range(4).map((i) => person(`im-${i + 1}`, `Installation Manager ${i + 1}`, "INSTALLATION_MANAGER", "INSTALLATION_MANAGER"));
  const svs = range(12).map((i) => person(`sv-${i + 1}`, `Supervisor ${i + 1}`, "SUPERVISOR", "SUPERVISOR"));
  const tls = range(20).map((i) =>
    person(`tl-${i + 1}`, `Team Leader ${i + 1}`, "WORKER", "TEAM_LEADER", i % 2 === 0 ? "ELECTRICAL" : "MECHANICAL")
  );
  const electricians = range(50).map((i) => person(`el-${i + 1}`, `Elektryk ${i + 1}`, "WORKER", "ELECTRICIAN", "ELECTRICAL"));
  const mechanics = range(50).map((i) => person(`me-${i + 1}`, `Mechanik ${i + 1}`, "WORKER", "MECHANIC", "MECHANICAL"));
  const hrs = range(3).map((i) => ({ ...person(`hr-${i + 1}`, `HR ${i + 1}`, "HR", "HR"), email: `hr${i + 1}@epcido.example` }));
  // Użytkownik z własnym zestawem funkcji (dodany przez administratora): controlling — projekty, mapa, raporty
  const controlling: Employee = {
    ...person("ctrl-1", "Controlling 1", "CUSTOM", "OFFICE"),
    email: "controlling@epcido.example",
    grants: ["projects.all", "map.view", "people.view", "reports.export"],
  };
  const employees = [admin, planner, ...pms, ...ims, ...svs, ...hrs, controlling, ...tls, ...electricians, ...mechanics];

  // ---------- Projekty ----------
  const projects: Project[] = SITES.map((s, i) => {
    const future = i >= 10;
    const startDate = future ? addDays(rangeStart, START_WEEK_OFFSET[i] * 7) : addDays(rangeStart, START_WEEK_OFFSET[i] * 7 + rnd.int(0, 2));
    const endDate = addDays(currentWeek, END_WEEKS_FROM_NOW[i] * 7 + 4);
    const sv = i < 10 ? svs[i] : i - 10 < FUTURE_WITH_SV ? svs[i] : null;
    return {
      id: `p-${i + 1}`,
      number: String(26001 + i),
      name: `Projekt ${i + 1}`,
      customerName: s.customer,
      customerOrderNo: `PO-${rnd.int(400000, 499999)}`,
      siteAddress: s.site,
      country: s.country,
      branch: s.branch,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length].value,
      category: s.category,
      demand: [],
      startDate,
      endDate,
      status: startDate > today ? "PLANNED" : "ACTIVE",
      projectManagerId: pms[i % pms.length].id,
      installationManagerId: ims[PROJECT_IM[i]].id,
      supervisorId: sv?.id ?? null,
      dataverseId: "",
      dataverseNumber: "",
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  const planned = projects[9];
  const future = projects.slice(10);

  // ---------- Zespoły (zadania od–do) ----------
  const assignments: Assignment[] = [];
  const elPool = rnd.shuffle(electricians);
  const mePool = rnd.shuffle(mechanics);
  const leaving: Employee[] = [];
  const taskFor = (e: Employee) =>
    e.position === "ELECTRICIAN" && rnd.chance(0.3) ? rnd.pick(EXTRA_TASKS_EL) : defaultTask(e.trade);
  const assign = (p: Project, e: Employee, from: ISODate, to: ISODate | null, task = taskFor(e)) =>
    assignments.push({ id: `a-${p.id}-${e.id}-${from}`, projectId: p.id, employeeId: e.id, from, to, task });

  /** Zadanie z przerwą na wyjazd do domu: koniec w piątek, powrót po 7–10 dniach. */
  const assignWithBreak = (p: Project, e: Employee, from: ISODate, to: ISODate | null) => {
    const end = to ?? p.endDate!;
    const breakMonday = addDays(currentWeek, rnd.int(-3, 4) * 7);
    if (breakMonday <= addDays(from, 21) || addDays(breakMonday, 21) >= end) return assign(p, e, from, to);
    const task = taskFor(e);
    const back = addDays(breakMonday, rnd.pick([7, 10]));
    assign(p, e, from, addDays(breakMonday, -3), task);
    assign(p, e, back, to, task);
  };

  projects.slice(0, 9).forEach((p, i) => {
    assign(p, tls[i * 2], p.startDate, null);
    assign(p, tls[i * 2 + 1], p.startDate, null);
    const workers = [...elPool.splice(0, rnd.int(3, 6)), ...mePool.splice(0, rnd.int(3, 6))];
    for (const e of workers) {
      const lateStart = rnd.chance(0.25);
      const from = lateStart ? minDate(addDays(p.startDate, rnd.int(3, 20)), addDays(today, -10)) : p.startDate;
      const early = rnd.chance(0.18);
      const to = early ? addDays(currentWeek, rnd.int(9, 30)) : null;
      const start = from > p.startDate ? from : p.startDate;
      if (!early && rnd.chance(0.22)) assignWithBreak(p, e, start, to);
      else assign(p, e, start, to);
      if (early) leaving.push(e);
    }
  });

  // Projekt planowany: własni TL i kilka osób z ławki + część osób kończących inne projekty (bez przerwy!)
  assign(planned, tls[18], planned.startDate, null);
  assign(planned, tls[19], planned.startDate, null);
  for (const e of [...elPool.splice(0, 2), ...mePool.splice(0, 2)]) assign(planned, e, planned.startDate, null);
  for (const e of leaving.slice(0, 4)) {
    const prev = assignments.find((a) => a.employeeId === e.id)!;
    const from = maxDate(planned.startDate, addDays(prev.to!, 3));
    assign(planned, e, from, null);
  }
  // Przyszłe projekty: na razie po jednej, dwie osoby z ławki
  future.slice(0, 2).forEach((p) => {
    for (const e of [...elPool.splice(0, 1), ...mePool.splice(0, 1)]) assign(p, e, p.startDate, null);
  });

  // ---------- Zapotrzebowanie (fazy) ----------
  const tradeCount = (p: Project, trade: Employee["trade"]) =>
    new Set(
      assignments
        .filter((a) => a.projectId === p.id && employees.find((e) => e.id === a.employeeId)?.trade === trade)
        .map((a) => a.employeeId)
    ).size;
  const phase = (p: Project, n: number, from: ISODate, to: ISODate, el: number, me: number): DemandPhase => ({
    id: `d-${p.id}-${n}`,
    from,
    to,
    electricians: Math.max(0, el),
    mechanics: Math.max(0, me),
  });
  projects.forEach((p, i) => {
    const end = p.endDate!;
    if (i < 10) {
      const short = i === 2 || i === 5 || i === 9;
      const el = tradeCount(p, "ELECTRICAL") + (short ? rnd.int(2, 4) : rnd.int(-1, 0));
      const me = tradeCount(p, "MECHANICAL") + (short ? rnd.int(1, 3) : rnd.int(-1, 0));
      const finish = addDays(end, -20);
      p.demand = [phase(p, 1, p.startDate, addDays(finish, -1), el, me), phase(p, 2, finish, end, Math.ceil(el / 2), Math.ceil(me / 2))];
    } else {
      const ramp = addDays(p.startDate, 20);
      const finish = addDays(end, -20);
      const el = rnd.int(6, 11);
      const me = rnd.int(5, 9);
      p.demand = [
        phase(p, 1, p.startDate, addDays(ramp, -1), rnd.int(2, 3), 2),
        phase(p, 2, ramp, addDays(finish, -1), el, me),
        phase(p, 3, finish, end, Math.ceil(el / 3), Math.ceil(me / 3)),
      ];
    }
  });

  // ---------- Godziny ----------
  const timesheets = new Map<string, Timesheet>();
  const absenceLeft = new Map<string, { days: number; type: "SICK" | "LEAVE" }>();
  let approver = { sv: "", im: "" };

  for (const [index, p] of projects.entries()) {
    if (p.startDate > today) continue;
    approver = { sv: p.supervisorId!, im: p.installationManagerId! };
    const periods: { employeeId: string; from: ISODate; to: ISODate | null }[] = [
      { employeeId: p.supervisorId!, from: p.startDate, to: p.endDate },
      ...assignments.filter((a) => a.projectId === p.id),
    ];
    for (const day of eachDay(maxDate(rangeStart, p.startDate), today)) {
      const wd = weekdayIndex(day);
      const week = startOfWeek(day);
      const weeksAgo = Math.round(daysBetween(week, currentWeek) / 7);
      for (const period of periods) {
        if (day < period.from || (period.to && day > period.to)) continue;
        const entry = makeEntry(day, wd, week, weeksAgo, WORKS_SATURDAYS[index], period.employeeId);
        if (!entry) continue;
        const id = `${p.id}_${week}`;
        const sheet = timesheets.get(id) ?? { id, projectId: p.id, weekStart: week, days: {} };
        (sheet.days[period.employeeId] ??= {})[day] = entry;
        timesheets.set(id, sheet);
      }
    }
  }

  // ---------- Urlopy i nieobecności ----------
  const leaves: LeaveRequest[] = [];
  const projectOn = (employeeId: string, date: ISODate): Project | null => {
    const a = assignments.find((x) => x.employeeId === employeeId && x.from <= date && (!x.to || x.to >= date));
    if (a) return projects.find((p) => p.id === a.projectId) ?? null;
    return projects.find((p) => p.supervisorId === employeeId && p.startDate <= date && (p.endDate ?? "9999") >= date) ?? null;
  };
  const sheetOf = (projectId: string, date: ISODate) => {
    const id = `${projectId}_${startOfWeek(date)}`;
    const sheet = timesheets.get(id) ?? { id, projectId, weekStart: startOfWeek(date), days: {} };
    timesheets.set(id, sheet);
    return sheet;
  };
  const before = (iso: ISODate, days: number, hour: number) => at(addDays(iso, -days), hour);
  let leaveNo = 0;
  const newLeave = (l: Omit<LeaveRequest, "id" | "createdById" | "createdByName"> & { createdById?: string }): LeaveRequest => {
    const by = l.createdById ?? l.employeeId;
    const lv: LeaveRequest = { ...l, id: `lv-${++leaveNo}`, createdById: by, createdByName: nameOf(by) };
    leaves.push(lv);
    return lv;
  };
  /** Kto akceptuje: supervisor projektu albo HR (co trzeci wniosek). */
  const deciderFor = (employeeId: string, date: ISODate) => {
    const p = projectOn(employeeId, date);
    return p?.supervisorId && p.supervisorId !== employeeId && rnd.chance(0.65) ? p.supervisorId : rnd.pick(hrs).id;
  };

  // a) Nieobecności już wpisane w godzinach → wnioski (kolejne dni robocze tego samego rodzaju)
  type Run = { employeeId: string; type: "SICK" | "LEAVE" | "OTHER"; days: { sheet: Timesheet; date: ISODate }[] };
  const runs: Run[] = [];
  const absences: { sheet: Timesheet; employeeId: string; date: ISODate; type: "SICK" | "LEAVE" | "OTHER" }[] = [];
  for (const sheet of timesheets.values())
    for (const [employeeId, days] of Object.entries(sheet.days))
      for (const [date, e] of Object.entries(days)) if (e.kind === "ABSENCE") absences.push({ sheet, employeeId, date, type: e.absence ?? "OTHER" });
  absences.sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.date.localeCompare(b.date));
  for (const a of absences) {
    const last = runs[runs.length - 1];
    const prevDay = last?.days[last.days.length - 1].date;
    if (last && last.employeeId === a.employeeId && last.type === a.type && daysBetween(prevDay, a.date) <= 3) last.days.push({ sheet: a.sheet, date: a.date });
    else runs.push({ employeeId: a.employeeId, type: a.type, days: [{ sheet: a.sheet, date: a.date }] });
  }
  for (const r of runs) {
    const from = r.days[0].date;
    const to = r.days[r.days.length - 1].date;
    const sick = r.type === "SICK";
    const decider = sick ? null : deciderFor(r.employeeId, from);
    const decidedAt = sick ? null : before(from, rnd.int(3, 12), rnd.int(8, 16));
    const confirmer = sick && daysBetween(to, today) > 2 ? rnd.pick(hrs).id : null;
    const lv = newLeave({
      employeeId: r.employeeId,
      type: r.type,
      from,
      to,
      note: sick ? null : rnd.chance(0.3) ? "Wyjazd rodzinny" : null,
      status: "APPROVED",
      createdAt: sick ? at(from, rnd.int(6, 9)) : before(from, rnd.int(14, 30), rnd.int(17, 21)),
      decidedAt,
      decidedById: decider,
      decidedByName: decider ? nameOf(decider) : null,
      confirmedAt: confirmer ? at(addDays(to, 2), rnd.int(9, 14)) : null,
      confirmedById: confirmer,
      confirmedByName: confirmer ? nameOf(confirmer) : null,
    });
    for (const d of r.days) {
      const e = d.sheet.days[r.employeeId][d.date];
      const by = decider ?? r.employeeId;
      const when = decidedAt ?? lv.createdAt;
      Object.assign(e, {
        leaveId: lv.id,
        status: "PM_APPROVED",
        svApprovedBy: by,
        svApprovedAt: when,
        finalApprovedBy: by,
        finalApprovedAt: when,
      });
    }
  }

  // b) Zaakceptowane urlopy w kolejnych tygodniach (widać je w planie zespołu i w Obsadzie)
  const working = (id: string, from: ISODate, to: ISODate) => eachDay(from, to).every((d) => weekdayIndex(d) >= 5 || projectOn(id, d));
  const fieldPeople = rnd.shuffle([...tls, ...electricians, ...mechanics]);
  const used = new Set(leaves.filter((l) => l.to >= today).map((l) => l.employeeId));
  const pickPeople = (n: number, from: ISODate, to: ISODate) => {
    const out: Employee[] = [];
    for (const e of fieldPeople) {
      if (out.length >= n) break;
      if (used.has(e.id) || !working(e.id, from, to)) continue;
      used.add(e.id);
      out.push(e);
    }
    return out;
  };
  for (const [weeksAhead, n] of [[1, 2], [2, 2], [3, 2], [5, 2], [7, 1]] as const) {
    const from = addDays(currentWeek, weeksAhead * 7);
    const to = addDays(from, 4);
    for (const e of pickPeople(n, from, to)) {
      const decider = deciderFor(e.id, from);
      const decidedAt = before(today, rnd.int(1, 9), rnd.int(8, 16));
      const lv = newLeave({
        employeeId: e.id,
        type: "LEAVE",
        from,
        to,
        note: rnd.chance(0.4) ? rnd.pick(["Ślub w rodzinie", "Wyjazd z dziećmi", "Sprawy urzędowe w Polsce"]) : null,
        status: "APPROVED",
        createdAt: before(decidedAt.slice(0, 10), rnd.int(1, 6), rnd.int(17, 21)),
        decidedAt,
        decidedById: decider,
        decidedByName: nameOf(decider),
      });
      for (const d of eachDay(from, to)) {
        const p = projectOn(e.id, d);
        if (!p) continue;
        (sheetOf(p.id, d).days[e.id] ??= {})[d] = {
          kind: "ABSENCE",
          status: "PM_APPROVED",
          absence: "LEAVE",
          submittedAt: lv.createdAt,
          svApprovedBy: decider,
          svApprovedAt: decidedAt,
          finalApprovedBy: decider,
          finalApprovedAt: decidedAt,
          leaveId: lv.id,
          history: [{ at: decidedAt, byId: decider, byName: nameOf(decider), text: `Urlop — zaakceptował ${nameOf(decider)}` }],
        };
      }
    }
  }

  // c) Wnioski czekające na akceptację — część w Projekcie 3 (Supervisor 3), reszta w różnych projektach
  const p3 = projects[2];
  const p3People = rnd.shuffle(assignments.filter((a) => a.projectId === p3.id).map((a) => employees.find((e) => e.id === a.employeeId)!));
  const pendingPlan: { employee: Employee | undefined; weeksAhead: number; days: number; type: "LEAVE" | "OTHER" }[] = [
    { employee: p3People.find((e) => !used.has(e.id) && working(e.id, addDays(currentWeek, 14), addDays(currentWeek, 18))), weeksAhead: 2, days: 5, type: "LEAVE" },
    { employee: p3People.find((e) => !used.has(e.id) && e.position !== "TEAM_LEADER" && working(e.id, addDays(currentWeek, 28), addDays(currentWeek, 30))), weeksAhead: 4, days: 3, type: "OTHER" },
  ];
  for (const w of [1, 3, 3, 4, 6]) pendingPlan.push({ employee: pickPeople(1, addDays(currentWeek, w * 7), addDays(currentWeek, w * 7 + 4))[0], weeksAhead: w, days: 5, type: "LEAVE" });
  for (const plan of pendingPlan) {
    if (!plan.employee) continue;
    used.add(plan.employee.id);
    const from = addDays(currentWeek, plan.weeksAhead * 7);
    newLeave({
      employeeId: plan.employee.id,
      type: plan.type,
      from,
      to: addDays(from, plan.days - 1),
      note: plan.type === "OTHER" ? "Badania okresowe i szkolenie SEP w Polsce" : rnd.chance(0.5) ? rnd.pick(["Urlop wypoczynkowy", "Komunia syna", "Przeprowadzka"]) : null,
      status: "PENDING",
      createdAt: before(today, rnd.int(0, 4), rnd.int(7, 20)),
    });
  }

  // d) Odrzucony wniosek
  const rejectedFor = pickPeople(1, addDays(currentWeek, 21), addDays(currentWeek, 25))[0];
  if (rejectedFor) {
    const decider = deciderFor(rejectedFor.id, addDays(currentWeek, 21));
    newLeave({
      employeeId: rejectedFor.id,
      type: "LEAVE",
      from: addDays(currentWeek, 21),
      to: addDays(currentWeek, 25),
      note: null,
      status: "REJECTED",
      createdAt: before(today, 6, 19),
      decidedAt: before(today, 5, 9),
      decidedById: decider,
      decidedByName: nameOf(decider),
      decisionNote: "Odbiór u klienta w tym tygodniu — proszę o termin tydzień później.",
    });
  }

  // e) Trwające L4 bez potwierdzonego dokumentu (od wczoraj do końca tygodnia)
  // Trwa: zaczęło się wczoraj (w weekend — w piątek), kończy za kilka dni
  const sickFrom = weekdayIndex(today) >= 1 && weekdayIndex(today) <= 4 ? addDays(today, -1) : addDays(currentWeek, 4);
  const sickTo = addDays(sickFrom, 5);
  const sickPerson = pickPeople(1, sickFrom, sickTo)[0];
  if (sickPerson) {
    const lv = newLeave({ employeeId: sickPerson.id, type: "SICK", from: sickFrom, to: sickTo, note: null, status: "APPROVED", createdAt: at(sickFrom, 7) });
    for (const d of eachDay(sickFrom, sickTo)) {
      const p = projectOn(sickPerson.id, d);
      if (!p || weekdayIndex(d) >= 5) continue;
      (sheetOf(p.id, d).days[sickPerson.id] ??= {})[d] = {
        kind: "ABSENCE",
        status: "PM_APPROVED",
        absence: "SICK",
        submittedAt: lv.createdAt,
        svApprovedBy: sickPerson.id,
        svApprovedAt: lv.createdAt,
        finalApprovedBy: sickPerson.id,
        finalApprovedAt: lv.createdAt,
        leaveId: lv.id,
        history: [{ at: lv.createdAt, byId: sickPerson.id, byName: sickPerson.name, text: "L4 — obowiązuje od zgłoszenia" }],
      };
    }
  }

  // Wstrzymane timesheety: niezatwierdzone dni i brakujące wpisy, nic z timesheetu nie poszło do Dataverse
  for (const w of WITHHELD) {
    const p = projects[w.project];
    const week = addDays(currentWeek, -7 * w.weeksAgo);
    const sheet = timesheets.get(`${p.id}_${week}`);
    if (!sheet || now < lockAt(week)) continue;
    for (const days of Object.values(sheet.days)) for (const e of Object.values(days)) Object.assign(e, { exported: false, exportedAt: null });
    const workers = Object.keys(sheet.days).filter((id) => id !== p.supervisorId && Object.values(sheet.days[id]).some((e) => e.kind === "WORK"));
    const pickDay = (employeeId: string) =>
      Object.keys(sheet.days[employeeId]).filter((d) => weekdayIndex(d) < 5 && sheet.days[employeeId][d].kind === "WORK");
    for (let k = 0; k < w.unapproved; k++) {
      const emp = rnd.pick(workers);
      const day = rnd.pick(pickDay(emp));
      if (!day) continue;
      const e = sheet.days[emp][day];
      Object.assign(e, k % 2 === 0 ? { status: "SUBMITTED", svApprovedBy: null, svApprovedAt: null } : { status: "SUPERVISOR_APPROVED" }, {
        finalApprovedBy: null,
        finalApprovedAt: null,
      });
    }
    for (let k = 0; k < w.missing; k++) {
      const emp = rnd.pick(workers);
      const day = rnd.pick(pickDay(emp));
      if (day) delete sheet.days[emp][day];
    }
  }

  return { employees, projects, assignments, timesheets: [...timesheets.values()], leaves };

  function makeEntry(day: ISODate, wd: number, week: ISODate, weeksAgo: number, saturdays: boolean, personId: string): DayEntry | null {
    const isToday = day === today;

    if (wd < 5) {
      const running = absenceLeft.get(personId);
      if (running && running.days > 0) {
        running.days -= 1;
        return withStatus(day, { kind: "ABSENCE", absence: running.type, status: "SUBMITTED" }, week, weeksAgo, wd, false);
      }
      if (!isToday && rnd.chance(0.006)) {
        const type = rnd.chance(0.6) ? "SICK" : "LEAVE";
        absenceLeft.set(personId, { days: rnd.int(0, 4), type });
        return withStatus(day, { kind: "ABSENCE", absence: type, status: "SUBMITTED" }, week, weeksAgo, wd, false);
      }
    }

    if (wd === 5 && !rnd.chance(saturdays ? 0.75 : 0.06)) return null;
    if (wd === 6 && !rnd.chance(0.03)) return null;
    if (isToday && !rnd.chance(0.55)) return null;

    const weekend = wd >= 5;
    return withStatus(
      day,
      {
        kind: "WORK",
        status: "SUBMITTED",
        start: 420,
        end: weekend ? 780 : rnd.chance(0.6) ? 1020 : 1080,
        breakMin: weekend ? 30 : rnd.chance(0.5) ? 30 : 60,
      },
      week,
      weeksAgo,
      wd,
      isToday
    );
  }

  /** Moment w danym dniu (godzina i minuty), nie późniejszy niż „teraz". */
  function at(day: ISODate, hour: number): string {
    const d = parseISO(day);
    d.setHours(hour, rnd.int(0, 59), 0, 0);
    const latest = new Date(now.getTime() - 5 * 60_000);
    return (d > latest ? latest : d).toISOString();
  }

  function withStatus(day: ISODate, base: DayEntry, week: ISODate, weeksAgo: number, wd: number, isToday: boolean): DayEntry {
    const entry: DayEntry = { ...base, submittedAt: at(day, rnd.int(16, 19)) };
    const nextWorkday = addDays(day, wd >= 4 ? 7 - wd : 1);
    const approve = (final: boolean): DayEntry => ({
      ...entry,
      status: final ? "PM_APPROVED" : "SUPERVISOR_APPROVED",
      svApprovedBy: approver.sv,
      svApprovedAt: at(nextWorkday, rnd.int(8, 11)),
      finalApprovedBy: final ? approver.im : null,
      finalApprovedAt: final ? at(addDays(week, 7), rnd.int(9, 15)) : null,
    });
    const withEdit = (e: DayEntry): DayEntry => {
      if (e.kind !== "WORK" || e.end !== 1080 || !rnd.chance(0.05)) return e;
      const before = `${formatMinutes(e.start!)}–${formatMinutes(e.end)}, przerwa ${e.breakMin} min`;
      const after = `${formatMinutes(e.start!)}–17:00, przerwa ${e.breakMin} min`;
      return {
        ...e,
        end: 1020,
        history: [{ at: e.svApprovedAt ?? stamp, byId: approver.sv, byName: nameOf(approver.sv), text: `${before} → ${after} — „Wyjazd z projektu o 17:00"` }],
      };
    };
    if (isToday) return entry;
    if (now >= lockAt(week)) {
      // Tydzień zamknięty: timesheet kompletny i (po wtorku 23:00) wysłany; wyjątki ustawia lista WITHHELD
      const final = withEdit(approve(true));
      return now >= exportAt(week) ? { ...final, exported: true, exportedAt: exportAt(week).toISOString() } : final;
    }
    if (weeksAgo >= 1) {
      // poprzedni tydzień, jeszcze przed terminem (poniedziałek)
      const r = rnd.next();
      return r < 0.2 ? entry : withEdit(approve(r > 0.6));
    }
    // bieżący tydzień
    return rnd.chance(wd <= 1 ? 0.65 : 0.25) ? withEdit(approve(false)) : entry;
  }

  function nameOf(id: string) {
    return employees.find((e) => e.id === id)?.name ?? id;
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
function minDate(a: ISODate, b: ISODate) {
  return a < b ? a : b;
}
function maxDate(a: ISODate, b: ISODate) {
  return a > b ? a : b;
}

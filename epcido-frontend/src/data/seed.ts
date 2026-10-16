// Generator danych testowych. Deterministyczny: ten sam dzień „dziś" = te same dane.
//
// Struktura:
//   Administrator, Planista, 3 × Project Manager
//   4 × Installation Manager → 10 projektów (po 1 Supervisorze)
//   Zespoły: 20 Team Leaderów (po 2 na projekt) + losowo elektrycy i mechanicy, każdy na okres od–do.
//   Część osób kończy wcześniej i przechodzi do planowanego Projektu 10; reszta czeka bez projektu.
//
// Godziny: ostatnie 10 tygodni do dziś. Tygodnie po wtorkowej wysyłce są w Dataverse (ptaszek),
// bieżący czeka na zatwierdzenie, pojedyncze nieobecności (L4, urlop) i odrzucenia.

import { addDays, daysBetween, eachDay, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { createRandom } from "../lib/random";
import { PROJECT_COLORS } from "../domain/labels";
import { exportAt } from "../domain/workflow";
import type { Assignment, Dataset, DayEntry, Employee, Project, Timesheet } from "../domain/types";

export const SEED_VERSION = 3;
export const DEFAULT_USER_ID = "planner-1";

const SITES = [
  { customer: "Nordhavn Automated Storage", site: "Ash Road South, Wrexham", country: "Wielka Brytania", branch: "Wielka Brytania" },
  { customer: "Rheinlager Logistik", site: "Industriestraße 12, Kolonia", country: "Niemcy", branch: "Niemcy" },
  { customer: "Vandermolen Distributie", site: "Kraaivenstraat 21, Tilburg", country: "Holandia", branch: "Beneluks" },
  { customer: "Kattegat Cold Chain", site: "Hamnvägen 4, Göteborg", country: "Szwecja", branch: "Skandynawia" },
  { customer: "Warta Fulfilment", site: "ul. Gnieźnieńska 40, Poznań", country: "Polska", branch: "Polska" },
  { customer: "Egerland Parts", site: "Průmyslová 7, Cheb", country: "Czechy", branch: "Czechy" },
  { customer: "Rhône Pharma Logistique", site: "Rue de l'Industrie 9, Lyon", country: "Francja", branch: "Francja" },
  { customer: "Aros Retail Hub", site: "Sintrupvej 30, Aarhus", country: "Dania", branch: "Skandynawia" },
  { customer: "Bałtyk Terminal", site: "ul. Kontenerowa 2, Gdańsk", country: "Polska", branch: "Polska" },
  { customer: "Midlands Grocery DC", site: "Fenny Lock, Milton Keynes", country: "Wielka Brytania", branch: "Wielka Brytania" },
];

/** Start projektu w tygodniach względem początku zakresu danych (ujemne = wcześniej). */
const START_WEEK_OFFSET = [-6, -2, 0, 1, 2, 3, 4, 5, 7, 11];
const WORKS_SATURDAYS = [true, false, false, true, false, false, true, false, true, false];
const PROJECT_IM = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3];
const REJECT_REASONS = ["Sprawdź godzinę zakończenia", "Brak przerwy w raporcie", "Tego dnia nie było Cię na budowie"];

export const DATA_WEEKS = 10;

export function generateDataset(today: ISODate, now: Date = new Date()): Dataset {
  const rnd = createRandom(26_042);
  const stamp = now.toISOString();
  const currentWeek = startOfWeek(today);
  const rangeStart = addDays(currentWeek, -(DATA_WEEKS - 1) * 7);

  // ---------- Ludzie ----------
  const person = (id: string, name: string, role: Employee["role"], position: Employee["position"], trade?: Employee["trade"]): Employee => ({
    id,
    name,
    role,
    position,
    ...(trade ? { trade } : {}),
    active: true,
  });
  const admin = person("admin-1", "Administrator", "ADMIN", "ADMIN");
  const planner = person("planner-1", "Planista 1", "PLANNING", "PLANNER");
  const pms = range(3).map((i) => person(`pm-${i + 1}`, `Project Manager ${i + 1}`, "PROJECT_MANAGER", "PROJECT_MANAGER"));
  const ims = range(4).map((i) => person(`im-${i + 1}`, `Installation Manager ${i + 1}`, "INSTALLATION_MANAGER", "INSTALLATION_MANAGER"));
  const svs = range(10).map((i) => person(`sv-${i + 1}`, `Supervisor ${i + 1}`, "SUPERVISOR", "SUPERVISOR"));
  const tls = range(20).map((i) =>
    person(`tl-${i + 1}`, `Team Leader ${i + 1}`, "WORKER", "TEAM_LEADER", i % 2 === 0 ? "ELECTRICAL" : "MECHANICAL")
  );
  const electricians = range(50).map((i) => person(`el-${i + 1}`, `Elektryk ${i + 1}`, "WORKER", "ELECTRICIAN", "ELECTRICAL"));
  const mechanics = range(50).map((i) => person(`me-${i + 1}`, `Mechanik ${i + 1}`, "WORKER", "MECHANIC", "MECHANICAL"));
  const employees = [admin, planner, ...pms, ...ims, ...svs, ...tls, ...electricians, ...mechanics];

  // ---------- Projekty ----------
  const projects: Project[] = SITES.map((s, i) => {
    const startDate = addDays(rangeStart, START_WEEK_OFFSET[i] * 7 + rnd.int(0, 2));
    const endDate = addDays(startDate, rnd.int(18, 34) * 7);
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
      startDate,
      endDate,
      status: startDate > today ? "PLANNED" : "ACTIVE",
      projectManagerId: pms[i % pms.length].id,
      installationManagerId: ims[PROJECT_IM[i]].id,
      supervisorId: svs[i].id,
      dataverseId: "",
      dataverseNumber: "",
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  const planned = projects.find((p) => p.status === "PLANNED")!;

  // ---------- Zespoły (okresy od–do) ----------
  const assignments: Assignment[] = [];
  const elPool = rnd.shuffle(electricians);
  const mePool = rnd.shuffle(mechanics);
  const leaving: Employee[] = [];
  const assign = (p: Project, e: Employee, from: ISODate, to: ISODate | null) =>
    assignments.push({ id: `a-${p.id}-${e.id}-${from}`, projectId: p.id, employeeId: e.id, from, to });

  projects.forEach((p, i) => {
    if (p === planned) return;
    assign(p, tls[i * 2], p.startDate, p.endDate);
    assign(p, tls[i * 2 + 1], p.startDate, p.endDate);
    const workers = [...elPool.splice(0, rnd.int(2, 6)), ...mePool.splice(0, rnd.int(2, 6))];
    for (const e of workers) {
      const lateStart = rnd.chance(0.25);
      const from = lateStart ? minDate(addDays(p.startDate, rnd.int(3, 20)), addDays(today, -10)) : p.startDate;
      const early = rnd.chance(0.18);
      const to = early ? addDays(currentWeek, rnd.int(9, 30)) : p.endDate;
      assign(p, e, from > p.startDate ? from : p.startDate, to);
      if (early) leaving.push(e);
    }
  });

  // Projekt planowany: własni TL i kilka osób z ławki + część osób kończących inne projekty
  const plannedIndex = projects.indexOf(planned);
  assign(planned, tls[plannedIndex * 2], planned.startDate, planned.endDate);
  assign(planned, tls[plannedIndex * 2 + 1], planned.startDate, planned.endDate);
  for (const e of [...elPool.splice(0, 2), ...mePool.splice(0, 2)]) assign(planned, e, planned.startDate, planned.endDate);
  for (const e of leaving.slice(0, 5)) {
    const prev = assignments.find((a) => a.employeeId === e.id)!;
    const from = maxDate(planned.startDate, addDays(prev.to!, 3));
    assign(planned, e, from, planned.endDate);
  }

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

  return { employees, projects, assignments, timesheets: [...timesheets.values()] };

  function makeEntry(day: ISODate, wd: number, week: ISODate, weeksAgo: number, saturdays: boolean, personId: string): DayEntry | null {
    const isToday = day === today;

    if (wd < 5) {
      const running = absenceLeft.get(personId);
      if (running && running.days > 0) {
        running.days -= 1;
        return withStatus({ kind: "ABSENCE", absence: running.type, status: "SUBMITTED" }, week, weeksAgo, wd, false);
      }
      if (!isToday && rnd.chance(0.006)) {
        const type = rnd.chance(0.6) ? "SICK" : "LEAVE";
        absenceLeft.set(personId, { days: rnd.int(0, 4), type });
        return withStatus({ kind: "ABSENCE", absence: type, status: "SUBMITTED" }, week, weeksAgo, wd, false);
      }
    }

    if (wd === 5 && !rnd.chance(saturdays ? 0.75 : 0.06)) return null;
    if (wd === 6 && !rnd.chance(0.03)) return null;
    if (isToday && !rnd.chance(0.55)) return null;

    const weekend = wd >= 5;
    return withStatus(
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

  function withStatus(entry: DayEntry, week: ISODate, weeksAgo: number, wd: number, isToday: boolean): DayEntry {
    const sent = now >= exportAt(week);
    const approve = (final: boolean): DayEntry => ({
      ...entry,
      status: final ? "PM_APPROVED" : "SUPERVISOR_APPROVED",
      svApprovedBy: approver.sv,
      finalApprovedBy: final ? approver.im : null,
    });
    if (isToday) return entry;
    if (sent) {
      const r = rnd.next();
      const late = weeksAgo >= 2 ? 0.002 : 0.03;
      if (r < late / 2) return entry; // spóźniony wpis, czeka na supervisora
      if (r < late) return approve(false); // czeka na Installation Managera
      return { ...approve(true), exported: true, exportedAt: exportAt(week).toISOString() };
    }
    if (weeksAgo >= 1) {
      // poprzedni tydzień przed wysyłką
      const r = rnd.next();
      return r < 0.2 ? entry : approve(r > 0.6);
    }
    // bieżący tydzień
    if (entry.kind === "WORK" && rnd.chance(0.02)) {
      return { ...entry, status: "REJECTED", rejectionReason: rnd.pick(REJECT_REASONS) };
    }
    return rnd.chance(wd <= 1 ? 0.65 : 0.25) ? approve(false) : entry;
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

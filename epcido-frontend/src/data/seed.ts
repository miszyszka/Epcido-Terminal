// Generator danych testowych. Deterministyczny: ten sam dzień „dziś" = te same dane.
//
// Struktura (zgodnie z ustaleniami):
//   4 × Installation Manager
//   └─ 10 projektów (po 1 Supervisorze na projekt)
//      └─ Team Leaderzy (20 łącznie, po 2 na projekt) — na równi z elektrykami i mechanikami
//         + losowa liczba elektryków (z 50) i mechaników (z 50); reszta czeka bez projektu
//
// Godziny: ostatnie 10 tygodni do dziś. Starsze tygodnie zatwierdzone, bieżący czeka,
// pojedyncze nieobecności (L4, urlop), soboty na części projektów.

import { addDays, daysBetween, eachDay, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { createRandom } from "../lib/random";
import { PROJECT_COLORS } from "../domain/labels";
import type { Assignment, Dataset, DayEntry, Employee, Project, Timesheet } from "../domain/types";

export const SEED_VERSION = 1;
export const PLANNER_ID = "planner-1";
export const PLANNER_NAME = "Planista 1";

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
/** Projekty → Installation Manager (indeks 0–3) */
const PROJECT_IM = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3];

export const DATA_WEEKS = 10;

export function generateDataset(today: ISODate): Dataset {
  const rnd = createRandom(26_042);
  const now = new Date().toISOString();
  const currentWeek = startOfWeek(today);
  const rangeStart = addDays(currentWeek, -(DATA_WEEKS - 1) * 7);

  // ---------- Ludzie ----------
  const employees: Employee[] = [
    { id: PLANNER_ID, name: PLANNER_NAME, role: "PLANNING", position: "PLANNER", active: true },
  ];
  const ims: Employee[] = range(4).map((i) => ({
    id: `im-${i + 1}`,
    name: `Installation Manager ${i + 1}`,
    role: "INSTALLATION_MANAGER",
    position: "INSTALLATION_MANAGER",
    active: true,
  }));
  const svs: Employee[] = range(10).map((i) => ({
    id: `sv-${i + 1}`,
    name: `Supervisor ${i + 1}`,
    role: "SUPERVISOR",
    position: "SUPERVISOR",
    active: true,
  }));
  const tls: Employee[] = range(20).map((i) => ({
    id: `tl-${i + 1}`,
    name: `Team Leader ${i + 1}`,
    role: "WORKER",
    position: "TEAM_LEADER",
    trade: i % 2 === 0 ? "ELECTRICAL" : "MECHANICAL",
    active: true,
  }));
  const electricians: Employee[] = range(50).map((i) => ({
    id: `el-${i + 1}`,
    name: `Elektryk ${i + 1}`,
    role: "WORKER",
    position: "ELECTRICIAN",
    trade: "ELECTRICAL",
    active: true,
  }));
  const mechanics: Employee[] = range(50).map((i) => ({
    id: `me-${i + 1}`,
    name: `Mechanik ${i + 1}`,
    role: "WORKER",
    position: "MECHANIC",
    trade: "MECHANICAL",
    active: true,
  }));
  employees.push(...ims, ...svs, ...tls, ...electricians, ...mechanics);

  // ---------- Projekty ----------
  const projects: Project[] = SITES.map((s, i) => {
    const startDate = addDays(rangeStart, START_WEEK_OFFSET[i] * 7 + rnd.int(0, 2));
    const endDate = addDays(startDate, rnd.int(18, 34) * 7);
    const number = String(26001 + i);
    return {
      id: `p-${i + 1}`,
      number,
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
      installationManagerId: ims[PROJECT_IM[i]].id,
      supervisorId: svs[i].id,
      dataverseId: "",
      dataverseNumber: "",
      createdAt: now,
      updatedAt: now,
    };
  });

  // ---------- Zespoły ----------
  const assignments: Assignment[] = [];
  const elPool = rnd.shuffle(electricians);
  const mePool = rnd.shuffle(mechanics);
  projects.forEach((p, i) => {
    const planned = p.status === "PLANNED";
    const team: Employee[] = [tls[i * 2], tls[i * 2 + 1]];
    team.push(...elPool.splice(0, planned ? rnd.int(1, 2) : rnd.int(2, 6)));
    team.push(...mePool.splice(0, planned ? rnd.int(1, 2) : rnd.int(2, 6)));
    for (const e of team) {
      assignments.push({ id: `a-${p.id}-${e.id}`, projectId: p.id, employeeId: e.id, since: p.startDate });
    }
  });

  // ---------- Godziny ----------
  const timesheets: Timesheet[] = [];
  for (const [index, p] of projects.entries()) {
    if (p.startDate > today) continue;
    const people = [
      p.supervisorId!,
      ...assignments.filter((a) => a.projectId === p.id).map((a) => a.employeeId),
    ];
    const absenceLeft = new Map<string, { days: number; type: "SICK" | "LEAVE" }>();
    const firstWeek = p.startDate > rangeStart ? startOfWeek(p.startDate) : rangeStart;

    for (let week = firstWeek; week <= currentWeek; week = addDays(week, 7)) {
      const sheet: Timesheet = { id: `${p.id}_${week}`, projectId: p.id, weekStart: week, days: {} };
      const weeksAgo = Math.round(daysBetween(week, currentWeek) / 7);

      for (const day of eachDay(week, addDays(week, 6))) {
        if (day < p.startDate || day > today) continue;
        const wd = weekdayIndex(day);

        for (const personId of people) {
          const entry = makeEntry({ day, wd, weeksAgo, today, saturdays: WORKS_SATURDAYS[index], personId, absenceLeft });
          if (!entry) continue;
          (sheet.days[personId] ??= {})[day] = entry;
        }
      }
      if (Object.keys(sheet.days).length > 0) timesheets.push(sheet);
    }
  }

  return { employees, projects, assignments, timesheets };

  function makeEntry(args: {
    day: ISODate;
    wd: number;
    weeksAgo: number;
    today: ISODate;
    saturdays: boolean;
    personId: string;
    absenceLeft: Map<string, { days: number; type: "SICK" | "LEAVE" }>;
  }): DayEntry | null {
    const { day, wd, weeksAgo, saturdays, personId, absenceLeft } = args;
    const isToday = day === args.today;

    // Nieobecności tylko w dni robocze, w ciągach 1–5 dni
    if (wd < 5) {
      const running = absenceLeft.get(personId);
      if (running && running.days > 0) {
        running.days -= 1;
        return { kind: "ABSENCE", absence: running.type, status: statusFor(weeksAgo, wd, false) };
      }
      if (!isToday && rnd.chance(0.006)) {
        const type = rnd.chance(0.6) ? "SICK" : "LEAVE";
        absenceLeft.set(personId, { days: rnd.int(0, 4), type });
        return { kind: "ABSENCE", absence: type, status: statusFor(weeksAgo, wd, false) };
      }
    }

    // Weekendy: soboty na części projektów, niedziele wyjątkowo
    if (wd === 5 && !rnd.chance(saturdays ? 0.75 : 0.06)) return null;
    if (wd === 6 && !rnd.chance(0.03)) return null;

    // Dziś część osób jeszcze nie wpisała godzin
    if (isToday && !rnd.chance(0.55)) return null;

    const weekend = wd >= 5;
    return {
      kind: "WORK",
      status: statusFor(weeksAgo, wd, isToday),
      start: 420,
      end: weekend ? 780 : rnd.chance(0.6) ? 1020 : 1080,
      breakMin: weekend ? 30 : rnd.chance(0.5) ? 30 : 60,
    };
  }

  function statusFor(weeksAgo: number, wd: number, isToday: boolean): DayEntry["status"] {
    if (isToday) return "SUBMITTED";
    if (weeksAgo >= 2) return rnd.chance(0.0015) ? "SUBMITTED" : "PM_APPROVED";
    if (weeksAgo === 1) return rnd.chance(0.015) ? "SUBMITTED" : "SUPERVISOR_APPROVED";
    // bieżący tydzień: supervisor zatwierdza na bieżąco, ale nie wszystko
    return rnd.chance(wd <= 1 ? 0.7 : 0.25) ? "SUPERVISOR_APPROVED" : "SUBMITTED";
  }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

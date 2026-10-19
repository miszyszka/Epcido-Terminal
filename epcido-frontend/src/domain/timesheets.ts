// Timesheet = wszystkie godziny wszystkich osób w jednym projekcie w jednym tygodniu (ADR 0010).
// W każdym tygodniu jest tyle timesheetów, ile projektów.
//
// Cykl (terminy w ustawieniach systemu, domyślnie pn 23:59 i wt 23:00):
//   otwarty   — do poniedziałku 23:59 po tygodniu: wpisy, poprawki, zatwierdzanie,
//   zamknięty — od wtorku 00:00; gdy kompletny (każdy dzień roboczy ma wpis, wszystko zatwierdzone do końca),
//               jest nienaruszalny i idzie do Dataverse we wtorek o 23:00 → „wysłany",
//   wstrzymany — zamknięty z błędami (brak zatwierdzenia albo brak wpisu): cały timesheet nie idzie do Dataverse.
//               Poprawia i zatwierdza go tylko administrator; po poprawie idzie w najbliższy wtorek.

import type { Model } from "../app/DataContext";
import { addDays, eachDay, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import type { DayEntry, DayState, Project } from "./types";
import { exportAt, isComplete, lockAt, nextExportAfter } from "./workflow";

export type SheetStatus = "open" | "closed" | "sent" | "withheld";

export interface SheetProblem {
  employeeId: string;
  date: ISODate;
  kind: "unapproved" | "missing";
}

export interface SheetInfo {
  projectId: string;
  week: ISODate;
  status: SheetStatus;
  problems: SheetProblem[];
  /** Kiedy kompletny timesheet idzie (albo poszedł) do Dataverse */
  sentAt: Date | null;
}

export const sheetKey = (projectId: string, week: ISODate) => `${projectId}|${week}`;

/** Okresy, w których osoba ma pracować w projekcie: supervisor — cały projekt, reszta — zadania. */
function periodsOf(model: Model, project: Project, employeeId: string) {
  if (employeeId === project.supervisorId) return [{ from: project.startDate, to: project.endDate }];
  return (model.assignmentsByProject.get(project.id) ?? []).filter((a) => a.employeeId === employeeId).map((a) => ({ from: a.from, to: a.to }));
}

/** Dni robocze tygodnia, w które osoba powinna mieć wpis (godziny albo nieobecność). */
export function expectedDays(model: Model, project: Project, employeeId: string, week: ISODate): ISODate[] {
  const periods = periodsOf(model, project, employeeId);
  return eachDay(week, addDays(week, 4)).filter(
    (d) =>
      d >= project.startDate &&
      (!project.endDate || d <= project.endDate) &&
      periods.some((p) => p.from <= d && (!p.to || p.to >= d))
  );
}

function computeSheet(model: Model, project: Project, week: ISODate, now: Date): SheetInfo | null {
  const weekEnd = addDays(week, 6);
  if (project.startDate > weekEnd || (project.endDate && project.endDate < week)) return null;
  if (now < lockAt(week)) return { projectId: project.id, week, status: "open", problems: [], sentAt: null };

  const people = new Set<string>();
  if (project.supervisorId) people.add(project.supervisorId);
  for (const a of model.assignmentsByProject.get(project.id) ?? []) if (a.from <= weekEnd && (!a.to || a.to >= week)) people.add(a.employeeId);
  const perPerson = model.entries.get(project.id);
  for (const [employeeId, days] of perPerson ?? []) for (const d of days.keys()) if (d >= week && d <= weekEnd) people.add(employeeId);

  const problems: SheetProblem[] = [];
  const entries: DayEntry[] = [];
  for (const employeeId of people) {
    const days = perPerson?.get(employeeId);
    for (const d of eachDay(week, weekEnd)) {
      const e = days?.get(d);
      if (e) {
        entries.push(e);
        if (!isComplete(project, employeeId, e)) problems.push({ employeeId, date: d, kind: "unapproved" });
      }
    }
    for (const d of expectedDays(model, project, employeeId, week)) if (!days?.get(d)) problems.push({ employeeId, date: d, kind: "missing" });
  }
  if (entries.length === 0 && problems.length === 0) return null;
  if (problems.length) return { projectId: project.id, week, status: "withheld", problems, sentAt: null };

  const exported = entries.find((e) => e.exported);
  let sentAt: Date;
  if (exported) sentAt = exported.exportedAt ? new Date(exported.exportedAt) : exportAt(week);
  else {
    const last = entries.reduce<string | null>((m, e) => (e.finalApprovedAt && (!m || e.finalApprovedAt > m) ? e.finalApprovedAt : m), null);
    const regular = exportAt(week);
    const late = last ? nextExportAfter(new Date(last)) : regular;
    sentAt = late > regular ? late : regular;
  }
  return { projectId: project.id, week, status: now >= sentAt ? "sent" : "closed", problems: [], sentAt };
}

/** Indeks timesheetów dla danej chwili — liczony leniwie i zapamiętywany. */
export class SheetIndex {
  private cache = new Map<string, SheetInfo | null>();
  private problemCache = new Map<string, Map<string, SheetProblem>>();
  private model: Model;
  readonly now: Date;
  /** Pierwszy tydzień, z którego są dane — wcześniejszych tygodni nie oceniamy (np. sprzed migracji z Gantbee) */
  private dataStart: ISODate;
  constructor(model: Model, now: Date) {
    this.model = model;
    this.now = now;
    this.dataStart = model.snapshot.timesheets.reduce((m, t) => (t.weekStart < m ? t.weekStart : m), "9999-12-31");
  }

  get(projectId: string, week: ISODate): SheetInfo | null {
    const key = sheetKey(projectId, week);
    if (!this.cache.has(key)) {
      const project = this.model.projectById.get(projectId);
      this.cache.set(key, project && week >= this.dataStart ? computeSheet(this.model, project, week, this.now) : null);
    }
    return this.cache.get(key)!;
  }

  of(projectId: string, date: ISODate) {
    return this.get(projectId, startOfWeek(date));
  }

  problemAt(projectId: string, employeeId: string, date: ISODate): SheetProblem | undefined {
    const sheet = this.of(projectId, date);
    if (!sheet || sheet.status !== "withheld") return undefined;
    const key = sheetKey(projectId, sheet.week);
    let map = this.problemCache.get(key);
    if (!map) {
      map = new Map(sheet.problems.map((p) => [`${p.employeeId}|${p.date}`, p]));
      this.problemCache.set(key, map);
    }
    return map.get(`${employeeId}|${date}`);
  }

  /** Wstrzymane timesheety projektów (najnowsze najpierw). */
  withheld(projectIds: string[], weeksBack = 12): SheetInfo[] {
    const out: SheetInfo[] = [];
    const lastClosed = addDays(startOfWeek(toISODate(this.now)), -7);
    for (const id of projectIds) {
      for (let i = 0; i < weeksBack; i++) {
        const s = this.get(id, addDays(lastClosed, -7 * i));
        if (s?.status === "withheld") out.push(s);
      }
    }
    return out.sort((a, b) => b.week.localeCompare(a.week) || a.projectId.localeCompare(b.projectId));
  }
}

function toISODate(d: Date): ISODate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let cached: { model: Model; minute: number; index: SheetIndex } | null = null;

/** Indeks na teraz (zapamiętany na minutę dla tego samego modelu). */
export function sheetsFor(model: Model, now: Date): SheetIndex {
  const minute = Math.floor(now.getTime() / 60_000);
  if (!cached || cached.model !== model || cached.minute !== minute) cached = { model, minute, index: new SheetIndex(model, now) };
  return cached.index;
}

export interface CellView {
  state: DayState;
  /** Timesheet wysłany do Dataverse */
  sent: boolean;
  /** Tydzień zamknięty (od wtorku) — nienaruszalny */
  closed: boolean;
  /** Brakujący wpis w wstrzymanym timesheecie */
  missing: boolean;
}

function baseState(entry: DayEntry | undefined): DayState {
  if (!entry) return "off";
  if (entry.kind === "ABSENCE") return "absent";
  if (entry.status === "SUPERVISOR_APPROVED" || entry.status === "PM_APPROVED") return "approved";
  return "pending";
}

/**
 * Jak wygląda dzień jednej osoby w projekcie: stan, wysłanie, zamknięcie, błąd.
 * `hideDispatch` — dla pracownika i TL: zamknięty tydzień bez informacji o wysyłce i wstrzymaniu.
 */
export function cellView(
  sheets: SheetIndex,
  projectId: string,
  employeeId: string,
  date: ISODate,
  entry: DayEntry | undefined,
  hideDispatch = false
): CellView {
  const sheet = sheets.of(projectId, date);
  if (!sheet || sheet.status === "open") return { state: baseState(entry), sent: false, closed: false, missing: false };
  if (hideDispatch) return { state: baseState(entry), sent: false, closed: true, missing: false };
  if (sheet.status === "withheld") {
    const problem = sheets.problemAt(projectId, employeeId, date);
    if (problem) return { state: "missed", sent: false, closed: true, missing: problem.kind === "missing" };
  }
  // Znacznik „wysłane" tylko na dniach z wpisem — pusty weekend nie był nigdzie wysyłany
  return { state: baseState(entry), sent: sheet.status === "sent" && !!entry, closed: true, missing: false };
}

/** Słowne podsumowanie błędów timesheetu: „2 dni bez zatwierdzenia, 1 dzień bez wpisu". */
export function problemSummary(sheet: SheetInfo): string {
  const unapproved = sheet.problems.filter((p) => p.kind === "unapproved").length;
  const missing = sheet.problems.filter((p) => p.kind === "missing").length;
  const days = (n: number) => `${n} ${n === 1 ? "dzień" : "dni"}`;
  return [unapproved ? `${days(unapproved)} bez zatwierdzenia` : "", missing ? `${days(missing)} bez wpisu` : ""].filter(Boolean).join(", ");
}

export const WITHHELD_MESSAGE =
  "Czas minął. Skontaktuj się z administratorem — Twój timesheet nie został wysłany z powodu błędnie wypełnionego timesheetu.";

export function isWeekday(d: ISODate) {
  return weekdayIndex(d) < 5;
}

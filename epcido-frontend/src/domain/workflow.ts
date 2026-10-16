// Zasady cyklu tygodnia (PLAN_I_ARCHITEKTURA.md, sekcja 5):
//  - tydzień = poniedziałek–niedziela,
//  - do poniedziałku włącznie można poprawiać i zatwierdzać godziny poprzedniego tygodnia,
//  - we wtorek o 23:00 zatwierdzone godziny tygodnia idą do Dataverse.
// Ścieżka zatwierdzania: pracownik/TL → Supervisor → Installation Manager.

import type { Model } from "../app/DataContext";
import { addDays, parseISO, startOfWeek, toISO, weekdayIndex, type ISODate } from "../lib/dates";
import { workedMinutes } from "./labels";
import type { DayEntry, Employee, EntryStatus } from "./types";

export const EXPORT_HOUR = 23;

/** Ostatni dzień poprawek i zatwierdzeń dla tygodnia: poniedziałek następnego tygodnia. */
export function editDeadline(weekStart: ISODate): ISODate {
  return addDays(weekStart, 7);
}

/** Moment wysyłki tygodnia do Dataverse: wtorek następnego tygodnia, 23:00. */
export function exportAt(weekStart: ISODate): Date {
  const d = parseISO(addDays(weekStart, 8));
  d.setHours(EXPORT_HOUR, 0, 0, 0);
  return d;
}

export function isPastDeadline(date: ISODate, today: ISODate): boolean {
  return today > editDeadline(startOfWeek(date));
}

export function isFinal(entry: DayEntry | undefined): boolean {
  return Boolean(entry && (entry.exported || entry.status === "PM_APPROVED"));
}

/** Pracownik może poprawić dzień, dopóki nikt go nie zatwierdził i nie minął termin. */
export function workerCanEdit(date: ISODate, entry: DayEntry | undefined, today: ISODate): boolean {
  if (date > today) return false;
  if (entry && entry.status !== "SUBMITTED" && entry.status !== "REJECTED") return false;
  if (entry?.exported) return false;
  return !isPastDeadline(date, today);
}

/** Najbliższe terminy: którego tygodnia dotyczą, do kiedy zatwierdzić, kiedy wysyłka. */
export function closingWeek(now: Date = new Date()) {
  const today = toISO(now);
  const wd = weekdayIndex(today);
  const thisWeek = startOfWeek(today);
  const previous = addDays(thisWeek, -7);
  const previousStillOpen = wd === 0 || (wd === 1 && now < exportAt(previous));
  const week = previousStillOpen ? previous : thisWeek;
  return { week, approveBy: editDeadline(week), exportAt: exportAt(week) };
}

export type QueueLevel = "team" | "final";

export interface QueueItem {
  key: string;
  projectId: string;
  employeeId: string;
  date: ISODate;
  entry: DayEntry;
  minutes: number;
  overdue: boolean;
  level: QueueLevel;
}

/** Status po zatwierdzeniu na danym poziomie. */
export function approvedStatus(level: QueueLevel): EntryStatus {
  return level === "team" ? "SUPERVISOR_APPROVED" : "PM_APPROVED";
}

/** Co dana osoba ma do zatwierdzenia. */
export function queueFor(model: Model, user: Employee, today: ISODate): QueueItem[] {
  const items: QueueItem[] = [];
  for (const project of model.projects) {
    const isSv = project.supervisorId === user.id;
    const isIm = project.installationManagerId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isSv && !isIm && !isAdmin) continue;
    const perPerson = model.entries.get(project.id);
    if (!perPerson) continue;
    for (const [employeeId, days] of perPerson) {
      const isProjectSv = employeeId === project.supervisorId;
      for (const [date, entry] of days) {
        if (entry.exported) continue;
        let level: QueueLevel | null = null;
        if (entry.status === "SUBMITTED") {
          if (isProjectSv && (isIm || isAdmin)) level = "final";
          else if (!isProjectSv && (isSv || isAdmin)) level = "team";
        } else if (entry.status === "SUPERVISOR_APPROVED" && (isIm || isAdmin)) {
          level = "final";
        }
        if (!level) continue;
        items.push({
          key: `${project.id}|${employeeId}|${date}`,
          projectId: project.id,
          employeeId,
          date,
          entry,
          minutes: workedMinutes(entry),
          overdue: isPastDeadline(date, today),
          level,
        });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export interface SupervisorStats {
  supervisor: Employee;
  projectIds: string[];
  /** Pozycje zespołu czekające na supervisora */
  pending: number;
  pendingMinutes: number;
  overdue: number;
  /** Zatwierdzone przez supervisora, czekają na Installation Managera */
  awaitingFinal: number;
  awaitingFinalMinutes: number;
  /** Bieżący tydzień: wpisy zespołu i ile z nich zatwierdzono */
  weekTotal: number;
  weekApproved: number;
}

export function supervisorStats(model: Model, supervisor: Employee, today: ISODate): SupervisorStats {
  const projects = model.projects.filter((p) => p.supervisorId === supervisor.id);
  const weekStart = startOfWeek(today);
  const stats: SupervisorStats = {
    supervisor,
    projectIds: projects.map((p) => p.id),
    pending: 0,
    pendingMinutes: 0,
    overdue: 0,
    awaitingFinal: 0,
    awaitingFinalMinutes: 0,
    weekTotal: 0,
    weekApproved: 0,
  };
  for (const p of projects) {
    for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
      const own = employeeId === supervisor.id;
      for (const [date, entry] of days) {
        if (entry.exported) continue;
        const min = workedMinutes(entry);
        if (!own && entry.status === "SUBMITTED") {
          stats.pending++;
          stats.pendingMinutes += min;
          if (isPastDeadline(date, today)) stats.overdue++;
        }
        if (entry.status === "SUPERVISOR_APPROVED" || (own && entry.status === "SUBMITTED")) {
          stats.awaitingFinal++;
          stats.awaitingFinalMinutes += min;
        }
        if (!own && date >= weekStart && date <= today) {
          stats.weekTotal++;
          if (entry.status === "SUPERVISOR_APPROVED" || entry.status === "PM_APPROVED") stats.weekApproved++;
        }
      }
    }
  }
  return stats;
}

export function sumMinutes(items: { minutes: number }[]): number {
  return items.reduce((s, i) => s + i.minutes, 0);
}

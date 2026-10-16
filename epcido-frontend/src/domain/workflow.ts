// Zasady cyklu tygodnia (PLAN_I_ARCHITEKTURA.md, sekcja 5; ADR 0009):
//  - tydzień = poniedziałek–niedziela,
//  - godziny tygodnia trzeba zatwierdzić do poniedziałku następnego tygodnia, 23:59,
//  - od wtorku 00:00 wszystko, czego nie zatwierdzono do końca (supervisor i Installation Manager),
//    jest „nie wysłane do Dataverse": szare, zakreskowane, zatwierdza i zmienia je już tylko administrator,
//  - we wtorek o 23:00 zatwierdzone godziny idą do Dataverse; to, co administrator zatwierdzi później,
//    idzie w najbliższy wtorek.
// Ścieżka zatwierdzania: pracownik/TL → Supervisor → Installation Manager.
// Pracownik zmienia swój dzień, dopóki nikt go nie zatwierdził. Osoby zatwierdzające zmieniają także
// zatwierdzone dni — każda zmiana zostaje w notatce wpisu (kto, kiedy, co).

import type { Model } from "../app/DataContext";
import { addDays, formatDay, formatMinutes, formatTimestamp, parseISO, startOfWeek, toISO, weekdayIndex, type ISODate } from "../lib/dates";
import { plural } from "../lib/text";
import { ABSENCE_LABEL } from "./labels";
import { can } from "./permissions";
import type { DayEntry, DayState, Employee, EntryStatus, Project } from "./types";

export const EXPORT_HOUR = 23;

/** Ostatni dzień zatwierdzania tygodnia: poniedziałek następnego tygodnia (do 23:59). */
export function approveByDay(weekStart: ISODate): ISODate {
  return addDays(weekStart, 7);
}

/** Moment blokady tygodnia: wtorek 00:00 po terminie. */
export function lockAt(weekStart: ISODate): Date {
  return parseISO(addDays(weekStart, 8));
}

/** Moment wysyłki tygodnia do Dataverse: wtorek następnego tygodnia, 23:00. */
export function exportAt(weekStart: ISODate): Date {
  const d = parseISO(addDays(weekStart, 8));
  d.setHours(EXPORT_HOUR, 0, 0, 0);
  return d;
}

/** Najbliższa wtorkowa wysyłka nie wcześniej niż `t`. */
export function nextExportAfter(t: Date): Date {
  const day = toISO(t);
  const daysToTuesday = (1 - weekdayIndex(day) + 7) % 7;
  const d = parseISO(addDays(day, daysToTuesday));
  d.setHours(EXPORT_HOUR, 0, 0, 0);
  return d < t ? new Date(d.getTime() + 7 * 86_400_000) : d;
}

export function isFinal(entry: DayEntry | undefined): boolean {
  return Boolean(entry && (entry.exported || entry.status === "PM_APPROVED"));
}

/** Nie zatwierdzone do końca przed wtorkiem 00:00 — nie trafi do Dataverse, decyduje administrator. */
export function isLocked(date: ISODate, entry: DayEntry | undefined, now: Date): boolean {
  return Boolean(entry) && !isFinal(entry) && now >= lockAt(startOfWeek(date));
}

/** Kiedy wpis idzie (albo poszedł) do Dataverse. null = jeszcze nie zatwierdzony do końca. */
export function sentAt(date: ISODate, entry: DayEntry | undefined): Date | null {
  if (!entry) return null;
  const week = startOfWeek(date);
  if (entry.exported) return entry.exportedAt ? new Date(entry.exportedAt) : exportAt(week);
  if (entry.status !== "PM_APPROVED") return null;
  const regular = exportAt(week);
  if (!entry.finalApprovedAt) return regular;
  const late = nextExportAfter(new Date(entry.finalApprovedAt));
  return late > regular ? late : regular;
}

export function isSent(date: ISODate, entry: DayEntry | undefined, now: Date): boolean {
  if (!entry) return false;
  if (entry.exported) return true;
  const at = sentAt(date, entry);
  return Boolean(at && now >= at);
}

/** Jak dzień wygląda na siatkach: kolor stanu i ptaszek wysyłki. */
export function dayView(entry: DayEntry | undefined, date: ISODate, now: Date): { state: DayState; sent: boolean } {
  if (!entry) return { state: "off", sent: false };
  if (isSent(date, entry, now)) return { state: entry.kind === "ABSENCE" ? "absent" : "approved", sent: true };
  if (isLocked(date, entry, now)) return { state: "missed", sent: false };
  if (entry.kind === "ABSENCE") return { state: "absent", sent: false };
  if (entry.status === "SUPERVISOR_APPROVED" || entry.status === "PM_APPROVED") return { state: "approved", sent: false };
  return { state: "pending", sent: false };
}

/** Krótki stan słowami: do listy dni pracownika i nagłówka dnia. */
export function statusText(entry: DayEntry | undefined, date: ISODate, now: Date): string {
  if (!entry) return "Brak wpisu";
  if (isSent(date, entry, now)) return "Wysłane do Dataverse";
  if (isLocked(date, entry, now)) return "Nie wysłane do Dataverse";
  if (entry.status === "PM_APPROVED") return "Zatwierdzone";
  if (entry.status === "SUPERVISOR_APPROVED") return "Zatwierdzone przez supervisora";
  return "Do zatwierdzenia";
}

/** Godziny słowami: „7:00–17:00, przerwa 30 min" albo „Nieobecny: urlop". */
export function describeHours(entry: DayEntry | undefined): string {
  if (!entry) return "Brak wpisu";
  if (entry.kind === "ABSENCE") return `Nieobecny: ${ABSENCE_LABEL[entry.absence ?? "OTHER"].toLowerCase()}`;
  if (entry.start == null || entry.end == null) return "Brak godzin";
  return `${formatMinutes(entry.start)}–${formatMinutes(entry.end)}, przerwa ${entry.breakMin ?? 0} min`;
}

/**
 * Dymek dnia: kto i kiedy zatwierdził (i zmienił). Bez powtarzania tego, co widać na kafelku.
 */
export function approvalNote(model: Model, employeeId: string, date: ISODate, entry: DayEntry | undefined, now: Date): string {
  if (!entry) return "Brak wpisu";
  const name = (id: string | null | undefined) => (id ? model.employeeById.get(id)?.name ?? id : "—");
  const lines: string[] = [];
  if (entry.svApprovedBy) lines.push(`Zatwierdzone przez ${name(entry.svApprovedBy)}${entry.svApprovedAt ? ` · ${formatTimestamp(entry.svApprovedAt)}` : ""}`);
  if (entry.finalApprovedBy && entry.finalApprovedBy !== entry.svApprovedBy)
    lines.push(`Zatwierdzone przez ${name(entry.finalApprovedBy)}${entry.finalApprovedAt ? ` · ${formatTimestamp(entry.finalApprovedAt)}` : ""}`);
  const changedByOthers = (entry.history ?? []).filter((h) => h.byId !== employeeId);
  const last = changedByOthers[changedByOthers.length - 1];
  if (last) lines.push(`Zmienione przez ${last.byName} · ${formatTimestamp(last.at)}`);
  if (isSent(date, entry, now)) {
    const at = sentAt(date, entry);
    lines.push(`Wysłane do Dataverse${at ? ` · ${formatTimestamp(at.toISOString())}` : ""}`);
  } else if (isLocked(date, entry, now)) {
    lines.unshift(`Nie wysłane do Dataverse — nie zatwierdzone do ${formatDay(approveByDay(startOfWeek(date)))}, 23:59`);
  }
  if (lines.length === 0) lines.push(`Do zatwierdzenia${entry.submittedAt ? ` · wpisane ${formatTimestamp(entry.submittedAt)}` : ""}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- zatwierdzanie

export type QueueLevel = "team" | "final";

/** Status po zatwierdzeniu na danym poziomie. */
export function approvedStatus(level: QueueLevel): EntryStatus {
  return level === "team" ? "SUPERVISOR_APPROVED" : "PM_APPROVED";
}

/** Na jakim poziomie ta osoba zatwierdza ten wpis (null = nie zatwierdza). */
export function approvalLevel(project: Project, user: Employee, employeeId: string, entry: DayEntry | undefined): QueueLevel | null {
  if (!entry || isFinal(entry)) return null;
  const isAdmin = user.role === "ADMIN";
  const isSv = project.supervisorId === user.id;
  const isIm = project.installationManagerId === user.id;
  const ofSupervisor = employeeId === project.supervisorId;
  if (entry.status === "SUBMITTED") {
    if (ofSupervisor) return isIm || isAdmin ? "final" : null;
    if (isSv) return "team";
    return isAdmin ? "final" : null;
  }
  if (entry.status === "SUPERVISOR_APPROVED") return isIm || isAdmin ? "final" : null;
  return null;
}

export interface QueueItem {
  key: string;
  projectId: string;
  employeeId: string;
  date: ISODate;
  week: ISODate;
  entry: DayEntry;
  level: QueueLevel;
  /** Po terminie — widzi i zatwierdza tylko administrator */
  locked: boolean;
}

/** Co dana osoba ma do zatwierdzenia. Po terminie: tylko administrator. */
export function queueFor(model: Model, user: Employee, now: Date): QueueItem[] {
  const items: QueueItem[] = [];
  const isAdmin = user.role === "ADMIN";
  for (const project of model.projects) {
    if (!isAdmin && project.supervisorId !== user.id && project.installationManagerId !== user.id) continue;
    for (const [employeeId, days] of model.entries.get(project.id) ?? []) {
      for (const [date, entry] of days) {
        const level = approvalLevel(project, user, employeeId, entry);
        if (!level) continue;
        const locked = isLocked(date, entry, now);
        if (locked && !isAdmin) continue;
        items.push({
          key: `${project.id}|${employeeId}|${date}`,
          projectId: project.id,
          employeeId,
          date,
          week: startOfWeek(date),
          entry,
          level,
          locked,
        });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** Timesheety w projektach osoby (SV, IM), których nikt nie zatwierdził na czas — nie poszły do Dataverse. */
export function missedInScope(model: Model, user: Employee, now: Date): number {
  const refs: { projectId: string; employeeId: string; date: ISODate }[] = [];
  for (const project of model.projects) {
    if (project.supervisorId !== user.id && project.installationManagerId !== user.id) continue;
    for (const [employeeId, days] of model.entries.get(project.id) ?? []) {
      if (employeeId === user.id) continue;
      for (const [date, entry] of days) if (isLocked(date, entry, now)) refs.push({ projectId: project.id, employeeId, date });
    }
  }
  return countTimesheets(refs);
}

/** Timesheet = tydzień jednej osoby w jednym projekcie. */
export function timesheetKey(projectId: string, employeeId: string, week: ISODate) {
  return `${projectId}|${employeeId}|${week}`;
}

export function countTimesheets(items: { projectId: string; employeeId: string; date: ISODate }[]): number {
  return new Set(items.map((i) => timesheetKey(i.projectId, i.employeeId, startOfWeek(i.date)))).size;
}

/** Tydzień, którego termin jest teraz najbliższy: poprzedni do poniedziałku 23:59, potem bieżący. */
export function closingWeek(now: Date = new Date()) {
  const thisWeek = startOfWeek(toISO(now));
  const previous = addDays(thisWeek, -7);
  const week = now < lockAt(previous) ? previous : thisWeek;
  return { week, approveBy: approveByDay(week), lockAt: lockAt(week), exportAt: exportAt(week) };
}

export interface DeadlineSummary {
  /** Tydzień z najbliższym terminem */
  week: ISODate;
  approveBy: ISODate;
  lockAt: Date;
  exportAt: Date;
  /** Timesheety do zatwierdzenia w tym terminie */
  timesheets: number;
  /** Timesheety z późniejszym terminem (bieżący tydzień, gdy zamykamy poprzedni) */
  later: number;
  laterApproveBy: ISODate | null;
  /** Po terminie — tylko administrator */
  missed: number;
  remainingMs: number;
  /** Zostały już tylko godziny (mniej niż doba) */
  urgent: boolean;
}

export function deadlineSummary(items: QueueItem[], now: Date): DeadlineSummary {
  const open = items.filter((i) => !i.locked);
  const weeks = [...new Set(open.map((i) => i.week))].sort();
  const week = weeks[0] ?? closingWeek(now).week;
  const due = open.filter((i) => i.week === week);
  const later = open.filter((i) => i.week !== week);
  const lock = lockAt(week);
  const remainingMs = Math.max(0, lock.getTime() - now.getTime());
  return {
    week,
    approveBy: approveByDay(week),
    lockAt: lock,
    exportAt: exportAt(week),
    timesheets: countTimesheets(due),
    later: countTimesheets(later),
    laterApproveBy: weeks[1] ? approveByDay(weeks[1]) : null,
    missed: countTimesheets(items.filter((i) => i.locked)),
    remainingMs,
    urgent: remainingMs < 86_400_000,
  };
}

/** „3 dni i 1 godzinę", „5 godzin", „40 minut" — ile zostało do terminu. */
export function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  const d = `${days} ${plural(days, "dzień", "dni", "dni")}`;
  const h = `${hours} ${plural(hours, "godzinę", "godziny", "godzin")}`;
  if (days > 0) return hours > 0 ? `${d} i ${h}` : d;
  if (hours > 0) return h;
  return `${minutes} ${plural(minutes, "minutę", "minuty", "minut")}`;
}

export const timesheetsGen = (n: number) => `${n} ${plural(n, "timesheetu", "timesheetów", "timesheetów")}`;
export const timesheetsNom = (n: number) => `${n} ${plural(n, "timesheet", "timesheety", "timesheetów")}`;

// ---------------------------------------------------------------- pulpit IM

export interface SupervisorStats {
  supervisor: Employee;
  projectIds: string[];
  /** Timesheety zespołu czekające na supervisora (przed terminem) */
  pending: number;
  /** Timesheety zespołu nie zatwierdzone na czas — nie wysłane do Dataverse */
  missed: number;
  /** Zatwierdzone przez supervisora i godziny samego supervisora — czekają na Installation Managera */
  awaitingFinal: number;
  /** Bieżący tydzień: wpisy zespołu i ile z nich zatwierdzono */
  weekTotal: number;
  weekApproved: number;
}

export function supervisorStats(model: Model, supervisor: Employee, now: Date): SupervisorStats {
  const projects = model.projects.filter((p) => p.supervisorId === supervisor.id);
  const today = toISO(now);
  const weekStart = startOfWeek(today);
  const pending: { projectId: string; employeeId: string; date: ISODate }[] = [];
  const missed: typeof pending = [];
  const awaiting: typeof pending = [];
  let weekTotal = 0;
  let weekApproved = 0;
  for (const p of projects) {
    for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
      const own = employeeId === supervisor.id;
      for (const [date, entry] of days) {
        if (isFinal(entry)) {
          if (!own && date >= weekStart && date <= today) {
            weekTotal++;
            weekApproved++;
          }
          continue;
        }
        const ref = { projectId: p.id, employeeId, date };
        if (isLocked(date, entry, now)) {
          if (!own) missed.push(ref);
          continue;
        }
        if (!own && entry.status === "SUBMITTED") pending.push(ref);
        if (entry.status === "SUPERVISOR_APPROVED" || (own && entry.status === "SUBMITTED")) awaiting.push(ref);
        if (!own && date >= weekStart && date <= today) {
          weekTotal++;
          if (entry.status === "SUPERVISOR_APPROVED") weekApproved++;
        }
      }
    }
  }
  return {
    supervisor,
    projectIds: projects.map((p) => p.id),
    pending: countTimesheets(pending),
    missed: countTimesheets(missed),
    awaitingFinal: countTimesheets(awaiting),
    weekTotal,
    weekApproved,
  };
}

// ---------------------------------------------------------------- edycja wpisu

export interface EditRight {
  can: boolean;
  /** Dlaczego nie można (do pokazania przy dniu) */
  reason: string | null;
  /** Zmienia jako osoba zatwierdzająca — zmiana trafia do notatki wpisu */
  asApprover: boolean;
  /** Czy przy okazji może zatwierdzić (i na jakim poziomie) */
  level: QueueLevel | null;
}

const NO = (reason: string | null): EditRight => ({ can: false, reason, asApprover: false, level: null });

/** Kto może zmienić dzień: pracownik do zatwierdzenia; SV, IM i administrator także po zatwierdzeniu. */
export function editRight(
  model: Model,
  user: Employee,
  projectId: string,
  employeeId: string,
  date: ISODate,
  entry: DayEntry | undefined,
  now: Date
): EditRight {
  const project = model.projectById.get(projectId);
  if (!project) return NO(null);
  if (date > toISO(now)) return NO("Ten dzień jeszcze nie minął.");
  if (isSent(date, entry, now)) return NO("Wysłane do Dataverse — tego dnia nie można już zmienić.");
  const isAdmin = user.role === "ADMIN";
  const level = approvalLevel(project, user, employeeId, entry);
  if (isLocked(date, entry, now)) {
    return isAdmin
      ? { can: true, reason: null, asApprover: true, level: level ?? "final" }
      : NO("Nie zatwierdzone do poniedziałku 23:59 — nie wysłane do Dataverse. Zmienić i zatwierdzić może tylko administrator.");
  }
  const isSv = project.supervisorId === user.id && employeeId !== user.id;
  const isIm = project.installationManagerId === user.id;
  if (isAdmin || isSv || isIm) return { can: true, reason: null, asApprover: true, level };
  if (employeeId === user.id && can(user, "hours.own")) {
    if (entry && entry.status !== "SUBMITTED") return NO("Zatwierdzone — zmiany wprowadza supervisor.");
    const assigned =
      project.supervisorId === user.id ||
      (model.assignmentsByEmployee.get(user.id) ?? []).some((a) => a.projectId === projectId && a.from <= date && (!a.to || a.to >= date));
    if (!assigned) return NO("Przerwa — w tym dniu nie masz zadania w projekcie.");
    return { can: true, reason: null, asApprover: false, level: null };
  }
  return NO(null);
}

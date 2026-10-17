// Zasady cyklu tygodnia (PLAN_I_ARCHITEKTURA.md, sekcja 5; ADR 0009, 0010, 0011):
//  - tydzień = poniedziałek–niedziela; timesheet = projekt × tydzień (wszyscy ludzie projektu),
//  - godziny tygodnia trzeba wpisać i zatwierdzić do terminu (domyślnie poniedziałek następnego tygodnia, 23:59),
//  - minutę po terminie tydzień jest zamknięty: kompletny timesheet jest nienaruszalny i idzie do Dataverse
//    w dniu wysyłki (domyślnie wtorek 23:00); timesheet z błędami (brak zatwierdzenia, brak wpisu) jest
//    wstrzymany w całości i poprawia go już tylko osoba z uprawnieniem „poprawia wstrzymane" (administrator).
//  Terminy są w ustawieniach systemu (domain/settings.ts).
// Ścieżka zatwierdzania: pracownik/TL → Supervisor → Installation Manager. Zatwierdza się osoby (wiersze) albo dni.
// Pracownik zmienia swój dzień, dopóki nikt go nie zatwierdził. Osoby zatwierdzające zmieniają także
// zatwierdzone dni — każda zmiana zostaje w notatce wpisu (kto, kiedy, co).

import type { Model } from "../app/DataContext";
import { addDays, formatDay, formatMinutes, formatTimestamp, parseISO, startOfWeek, toISO, weekdayIndex, type ISODate } from "../lib/dates";
import { plural } from "../lib/text";
import { ABSENCE_LABEL } from "./labels";
import { can, seesDispatch } from "./permissions";
import { getSettings, parseTime } from "./settings";
import { sheetKey, sheetsFor, WITHHELD_MESSAGE, type SheetInfo } from "./timesheets";
import type { DayEntry, Employee, EntryStatus, LeaveRequest, Project } from "./types";

function at(day: ISODate, time: string): Date {
  const d = parseISO(day);
  const [h, m] = parseTime(time);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Ostatni dzień zatwierdzania tygodnia (domyślnie poniedziałek następnego tygodnia). */
export function approveByDay(weekStart: ISODate): ISODate {
  return addDays(weekStart, getSettings().approveDayOffset);
}

/** Godzina terminu zatwierdzania, np. „23:59". */
export function approveTime(): string {
  return getSettings().approveTime;
}

/** Godzina wysyłki do Dataverse, np. „23:00". */
export function exportTime(): string {
  return getSettings().exportTime;
}

/** Moment zamknięcia tygodnia: minuta po terminie zatwierdzania (domyślnie wtorek 00:00). */
export function lockAt(weekStart: ISODate): Date {
  return new Date(at(approveByDay(weekStart), approveTime()).getTime() + 60_000);
}

/** Moment wysyłki tygodnia do Dataverse (domyślnie wtorek następnego tygodnia, 23:00). */
export function exportAt(weekStart: ISODate): Date {
  return at(addDays(weekStart, getSettings().exportDayOffset), exportTime());
}

/** Najbliższa wysyłka (w dniu tygodnia wysyłki) nie wcześniej niż `t`. */
export function nextExportAfter(t: Date): Date {
  const day = toISO(t);
  const exportWeekday = getSettings().exportDayOffset % 7;
  const daysTo = (exportWeekday - weekdayIndex(day) + 7) % 7;
  const d = at(addDays(day, daysTo), exportTime());
  return d < t ? new Date(d.getTime() + 7 * 86_400_000) : d;
}

export function isFinal(entry: DayEntry | undefined): boolean {
  return Boolean(entry && (entry.exported || entry.status === "PM_APPROVED"));
}

/** Tydzień zamknięty (od wtorku 00:00 po terminie). */
export function isWeekClosed(date: ISODate, now: Date): boolean {
  return now >= lockAt(startOfWeek(date));
}

/** Godziny słowami: „7:00–17:00, przerwa 30 min" albo „Nieobecny: urlop". */
export function describeHours(entry: DayEntry | undefined): string {
  if (!entry) return "Brak wpisu";
  if (entry.kind === "ABSENCE") return `Nieobecny: ${ABSENCE_LABEL[entry.absence ?? "OTHER"].toLowerCase()}`;
  if (entry.start == null || entry.end == null) return "Brak godzin";
  return `${formatMinutes(entry.start)}–${formatMinutes(entry.end)}, przerwa ${entry.breakMin ?? 0} min`;
}

/**
 * Krótki stan słowami: do listy dni pracownika i nagłówka dnia.
 * `viewer` bez prawa zatwierdzania (pracownik, TL) nie widzi wysyłki ani wstrzymania — tylko „zamknięte".
 */
export function statusText(
  model: Model,
  projectId: string | null,
  employeeId: string,
  date: ISODate,
  entry: DayEntry | undefined,
  now: Date,
  viewer?: Employee | null
): string {
  const sheet = projectId ? sheetsFor(model, now).of(projectId, date) : null;
  if (viewer && !seesDispatch(viewer) && sheet && sheet.status !== "open") {
    if (!entry) return "Brak wpisu — tydzień zamknięty";
    return entry.kind === "ABSENCE" ? "Nieobecność — tydzień zamknięty" : "Tydzień zamknięty";
  }
  if (sheet?.status === "sent") return entry ? "Wysłane do Dataverse" : "Tydzień wysłany";
  if (sheet?.status === "closed") return "Zamknięte, wysyłka we wtorek";
  if (sheet?.status === "withheld") {
    const problem = sheetsFor(model, now).problemAt(projectId!, employeeId, date);
    if (problem) return problem.kind === "missing" ? "Brak wpisu — timesheet nie wysłany" : "Nie zatwierdzone — timesheet nie wysłany";
    return "Timesheet nie wysłany";
  }
  if (!entry) return "Brak wpisu";
  if (entry.kind === "ABSENCE" && entry.leaveId) return entry.absence === "SICK" ? "L4" : "Urlop zaakceptowany";
  if (entry.status === "PM_APPROVED") return "Zatwierdzone";
  if (entry.status === "SUPERVISOR_APPROVED") return "Zatwierdzone przez supervisora";
  return "Do zatwierdzenia";
}

/**
 * Dymek dnia: kto i kiedy zatwierdził (i zmienił), czy timesheet poszedł do Dataverse.
 * Bez powtarzania tego, co widać na kafelku.
 */
export function approvalNote(model: Model, projectId: string, employeeId: string, date: ISODate, entry: DayEntry | undefined, now: Date): string {
  const sheets = sheetsFor(model, now);
  const sheet = sheets.of(projectId, date);
  const lines: string[] = [];
  if (sheet?.status === "withheld") {
    const problem = sheets.problemAt(projectId, employeeId, date);
    lines.push(problem ? (problem.kind === "missing" ? "Brak wpisu — timesheet nie został wysłany" : "Nie zatwierdzone na czas — timesheet nie został wysłany") : "Timesheet nie został wysłany (błędy u innych osób)");
  }
  if (!entry) return lines.join("\n") || "Brak wpisu";
  const name = (id: string | null | undefined) => (id ? model.employeeById.get(id)?.name ?? id : "—");
  const leave = entry.leaveId ? model.leaveById.get(entry.leaveId) : undefined;
  if (leave) {
    lines.push(leaveNote(leave));
    if (sheet?.status === "sent" && sheet.sentAt) lines.push(`Wysłane do Dataverse · ${formatTimestamp(sheet.sentAt.toISOString())}`);
    return lines.join("\n");
  }
  if (entry.svApprovedBy) lines.push(`Zatwierdzone przez ${name(entry.svApprovedBy)}${entry.svApprovedAt ? ` · ${formatTimestamp(entry.svApprovedAt)}` : ""}`);
  if (entry.finalApprovedBy && entry.finalApprovedBy !== entry.svApprovedBy)
    lines.push(`Zatwierdzone przez ${name(entry.finalApprovedBy)}${entry.finalApprovedAt ? ` · ${formatTimestamp(entry.finalApprovedAt)}` : ""}`);
  const changedByOthers = (entry.history ?? []).filter((h) => h.byId !== employeeId);
  const last = changedByOthers[changedByOthers.length - 1];
  if (last) lines.push(`Zmienione przez ${last.byName} · ${formatTimestamp(last.at)}`);
  if (sheet?.status === "sent" && sheet.sentAt) lines.push(`Wysłane do Dataverse · ${formatTimestamp(sheet.sentAt.toISOString())}`);
  if (sheet?.status === "closed" && sheet.sentAt) lines.push(`Zamknięte · wysyłka ${formatTimestamp(sheet.sentAt.toISOString())}`);
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
  const isAdmin = can(user, "hours.approveAll");
  const isSv = project.supervisorId === user.id && can(user, "hours.approveTeam");
  const isIm = project.installationManagerId === user.id && can(user, "hours.approveFinal");
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
  /** Tydzień zamknięty — wstrzymany timesheet, zatwierdza tylko administrator */
  locked: boolean;
}

/** Co dana osoba ma do zatwierdzenia. W zamkniętych tygodniach: tylko administrator. */
export function queueFor(model: Model, user: Employee, now: Date): QueueItem[] {
  const items: QueueItem[] = [];
  const isAdmin = can(user, "hours.approveAll");
  const fixer = can(user, "hours.fixWithheld");
  for (const project of model.projects) {
    if (!isAdmin && project.supervisorId !== user.id && project.installationManagerId !== user.id) continue;
    for (const [employeeId, days] of model.entries.get(project.id) ?? []) {
      for (const [date, entry] of days) {
        const level = approvalLevel(project, user, employeeId, entry);
        if (!level) continue;
        const locked = isWeekClosed(date, now);
        if (locked && !fixer) continue;
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

/** Liczba timesheetów (projekt × tydzień) wśród pozycji. */
export function countTimesheets(items: { projectId: string; date: ISODate }[]): number {
  return new Set(items.map((i) => sheetKey(i.projectId, startOfWeek(i.date)))).size;
}

/** Wstrzymane timesheety w projektach osoby (SV, IM; administrator — wszystkie). */
export function withheldInScope(model: Model, user: Employee, now: Date): SheetInfo[] {
  const ids = model.projects
    .filter((p) => can(user, "hours.approveAll") || p.supervisorId === user.id || p.installationManagerId === user.id)
    .map((p) => p.id);
  return sheetsFor(model, now).withheld(ids);
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
  /** Timesheety (projekt × tydzień) do zatwierdzenia w tym terminie */
  timesheets: number;
  /** Timesheety z późniejszym terminem */
  later: number;
  laterApproveBy: ISODate | null;
  /** Wstrzymane timesheety (nie wysłane) */
  missed: number;
  remainingMs: number;
  /** Zostały już tylko godziny (mniej niż doba) */
  urgent: boolean;
}

export function deadlineSummary(items: QueueItem[], now: Date, withheld = 0): DeadlineSummary {
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
    missed: withheld,
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
  /** Timesheety, w których supervisor ma coś do zatwierdzenia (przed terminem) */
  pending: number;
  /** Wstrzymane timesheety w projektach supervisora — nie wysłane do Dataverse */
  missed: number;
  /** Timesheety z dniami zatwierdzonymi przez supervisora (i jego własnymi), które czekają na IM */
  awaitingFinal: number;
  /** Bieżący tydzień: wpisy zespołu i ile z nich zatwierdzono */
  weekTotal: number;
  weekApproved: number;
}

export function supervisorStats(model: Model, supervisor: Employee, now: Date): SupervisorStats {
  const projects = model.projects.filter((p) => p.supervisorId === supervisor.id);
  const today = toISO(now);
  const weekStart = startOfWeek(today);
  const pending: { projectId: string; date: ISODate }[] = [];
  const awaiting: typeof pending = [];
  let weekTotal = 0;
  let weekApproved = 0;
  for (const p of projects) {
    for (const [employeeId, days] of model.entries.get(p.id) ?? []) {
      const own = employeeId === supervisor.id;
      for (const [date, entry] of days) {
        const inWeek = !own && date >= weekStart && date <= today;
        if (isFinal(entry)) {
          if (inWeek) {
            weekTotal++;
            weekApproved++;
          }
          continue;
        }
        if (isWeekClosed(date, now)) continue;
        const ref = { projectId: p.id, date };
        if (!own && entry.status === "SUBMITTED") pending.push(ref);
        if (entry.status === "SUPERVISOR_APPROVED" || (own && entry.status === "SUBMITTED")) awaiting.push(ref);
        if (inWeek) {
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
    missed: sheetsFor(model, now).withheld(projects.map((p) => p.id)).length,
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

/**
 * Kto może zmienić dzień:
 *  - tydzień otwarty: pracownik do zatwierdzenia; SV, IM i administrator także po zatwierdzeniu,
 *  - tydzień zamknięty: kompletny timesheet jest nienaruszalny; wstrzymany poprawia tylko administrator.
 */
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
  const isAdmin = can(user, "hours.approveAll");
  const level = approvalLevel(project, user, employeeId, entry);
  if (entry?.leaveId && entry.kind === "ABSENCE") {
    const leave = model.leaveById.get(entry.leaveId);
    if (leave && leave.status === "APPROVED") return NO(`${leaveNote(leave)}. Zmiana — w ekranie Urlopy (cofnięcie wniosku).`);
  }

  if (isWeekClosed(date, now)) {
    const sheet = sheetsFor(model, now).of(projectId, date);
    if (!seesDispatch(user)) return NO("Tydzień zamknięty.");
    if (sheet?.status === "sent") return NO("Timesheet wysłany do Dataverse — nienaruszalny.");
    if (sheet?.status === "closed") return NO(`Timesheet zamknięty i kompletny — wysyłka ${formatDay(toISO(sheet.sentAt!))}, ${exportTime()}.`);
    if (can(user, "hours.fixWithheld")) return { can: true, reason: null, asApprover: true, level: level ?? "final" };
    return NO(WITHHELD_MESSAGE);
  }

  const isSv = project.supervisorId === user.id && employeeId !== user.id && can(user, "hours.approveTeam");
  const isIm = project.installationManagerId === user.id && can(user, "hours.approveFinal");
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

/** Kto i kiedy przyjął nieobecność: „Urlop 12–16 paź · zaakceptował Supervisor 3 · 10 paź 2026, 14:32". */
export function leaveNote(leave: LeaveRequest): string {
  const kind = leave.type === "SICK" ? "L4" : leave.type === "LEAVE" ? "Urlop" : "Nieobecność";
  if (leave.type === "SICK") {
    const confirmed = leave.confirmedByName ? ` · dokument potwierdził ${leave.confirmedByName}, ${formatTimestamp(leave.confirmedAt!)}` : " · dokument czeka na potwierdzenie HR";
    return `${kind} · zgłoszone ${formatTimestamp(leave.createdAt)}${confirmed}`;
  }
  if (leave.status === "APPROVED") return `${kind} · zaakceptował ${leave.decidedByName ?? "—"}${leave.decidedAt ? `, ${formatTimestamp(leave.decidedAt)}` : ""}`;
  if (leave.status === "PENDING") return `${kind} · czeka na akceptację (wniosek z ${formatTimestamp(leave.createdAt)})`;
  if (leave.status === "REJECTED") return `${kind} · odrzucony przez ${leave.decidedByName ?? "—"}${leave.decisionNote ? `: ${leave.decisionNote}` : ""}`;
  return `${kind} · anulowany`;
}

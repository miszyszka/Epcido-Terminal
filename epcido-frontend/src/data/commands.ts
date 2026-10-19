// Polecenia zmieniające dane. Każde zwraca ChangeSet: zapisy + wpis do dziennika zmian.
// Walidacja biznesowa jest tutaj, a nie w ekranach.

import { newId } from "../lib/random";
import { addDays, eachDay, formatDate, formatDay, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { ABSENCE_LABEL, defaultTask, POSITION_LABEL, PROJECT_STATUS_LABEL, ROLE_LABEL } from "../domain/labels";
import { approvedStatus, countTimesheets, describeHours, isWeekClosed, type QueueItem, type QueueLevel } from "../domain/workflow";
import { can, canDecideLeave, leaveProjects, PERMISSION_LABEL, permissionsOf, type Permission } from "../domain/permissions";
import { DEFAULT_SETTINGS, normalizeSettings, validateSettings, WEEKDAY_AFTER } from "../domain/settings";
import type {
  AbsenceType,
  AccessRole,
  Assignment,
  AuditAction,
  AuditEvent,
  DayEntry,
  Employee,
  Employment,
  EntryChange,
  EntryKind,
  LeaveRequest,
  Position,
  Project,
  ProjectInput,
  SystemSettings,
  Trade,
} from "../domain/types";
import type { ChangeSet, Snapshot, Write } from "./repository";
import { generateDataset, SEED_VERSION } from "./seed";
import { daysCount, plural } from "../lib/text";

export interface Actor {
  id: string;
  name: string;
}

export class CommandError extends Error {}

/** Przypisanie w edytorze, zanim zostanie zapisane. */
export interface DraftAssignment {
  key: string;
  id?: string;
  employeeId: string;
  from: ISODate;
  to: ISODate | null;
  task?: string | null;
}

function audit(
  actor: Actor,
  action: AuditAction,
  projectId: string | null,
  summary: string,
  changes?: AuditEvent["changes"]
): AuditEvent {
  return {
    id: newId("ev"),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    projectId,
    summary,
    ...(changes && changes.length > 0 ? { changes } : {}),
  };
}

const FIELD_LABELS: Partial<Record<keyof ProjectInput, string>> = {
  number: "Numer projektu",
  name: "Nazwa",
  customerName: "Klient",
  customerOrderNo: "Nr zamówienia klienta",
  siteAddress: "Adres projektu",
  country: "Kraj",
  branch: "Oddział",
  color: "Kolor",
  startDate: "Start",
  endDate: "Koniec",
  status: "Status",
  projectManagerId: "Project Manager",
  installationManagerId: "Installation Manager",
  supervisorId: "Supervisor",
  category: "Kategoria",
  demand: "Zapotrzebowanie",
  dataverseId: "Dataverse Id",
  dataverseNumber: "Dataverse Number",
};

// ---------------------------------------------------------------- projekty i zespoły

export function validateProject(input: ProjectInput, snapshot: Snapshot, editingId?: string | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.number.trim()) errors.number = "Podaj numer projektu.";
  else if (snapshot.projects.some((p) => p.number === input.number.trim() && p.id !== editingId))
    errors.number = "Projekt o tym numerze już istnieje.";
  if (!input.name.trim()) errors.name = "Podaj nazwę projektu.";
  if (!input.customerName.trim()) errors.customerName = "Podaj nazwę klienta.";
  if (!input.startDate) errors.startDate = "Wybierz datę startu.";
  if (input.endDate && input.startDate && input.endDate < input.startDate) errors.endDate = "Koniec nie może być przed startem.";
  if (!input.installationManagerId) errors.installationManagerId = "Wybierz Installation Managera.";
  if (!input.branch) errors.branch = "Wybierz oddział.";
  if (!input.category) errors.category = "Wybierz kategorię projektu.";
  for (const d of input.demand ?? []) {
    if (!d.from || !d.to || d.to < d.from) errors.demand = "Każda faza zapotrzebowania musi mieć daty od–do.";
    else if ([d.electricians, d.mechanics].some((n) => !Number.isInteger(n) || n < 0 || n > 500))
      errors.demand = "Podaj liczbę osób od 0 do 500.";
  }
  return errors;
}

function clean(input: ProjectInput): ProjectInput {
  const t = (s: string) => s.trim();
  return {
    ...input,
    number: t(input.number),
    name: t(input.name),
    customerName: t(input.customerName),
    customerOrderNo: t(input.customerOrderNo),
    siteAddress: t(input.siteAddress),
    country: t(input.country),
    dataverseId: t(input.dataverseId),
    dataverseNumber: t(input.dataverseNumber),
  };
}

/** Tworzy lub zapisuje projekt razem z planem zespołu — jedna operacja, jeden zestaw wpisów w dzienniku. */
export function saveProject(
  snapshot: Snapshot,
  actor: Actor,
  args: { id: string | null; input: ProjectInput; team: DraftAssignment[] }
): { id: string; changes: ChangeSet } {
  const errors = validateProject(args.input, snapshot, args.id);
  if (Object.keys(errors).length) throw new CommandError(Object.values(errors)[0]);
  for (const d of args.team) {
    if (d.to && d.to < d.from) throw new CommandError("Zadanie kończy się przed startem.");
  }
  // Zadania jednej osoby w projekcie nie mogą na siebie nachodzić
  const byPerson = new Map<string, DraftAssignment[]>();
  args.team.forEach((d) => byPerson.set(d.employeeId, [...(byPerson.get(d.employeeId) ?? []), d]));
  for (const [employeeId, list] of byPerson) {
    const sorted = [...list].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].to ?? "9999-12-31";
      if (sorted[i].from <= prevEnd) {
        const who = snapshot.employees.find((e) => e.id === employeeId)?.name ?? "Osoba";
        throw new CommandError(`${who}: zadania nachodzą na siebie (${formatDate(sorted[i].from)}). Przesuń jedno z nich.`);
      }
    }
  }
  // …ani na zadania tej samej osoby w innych projektach. Nikt nie pracuje w dwóch miejscach naraz,
  // a plan zespołu pokazuje te kolizje na szaro — zapis nie może ich przepuścić po cichu.
  const projectEndOf = (projectId: string) => snapshot.projects.find((p) => p.id === projectId)?.endDate ?? "9999-12-31";
  // Zadanie bez daty końca trwa do końca projektu — liczymy po nowej dacie, nie po zapisanej
  const draftEnd = (d: DraftAssignment) => d.to ?? args.input.endDate ?? "9999-12-31";
  for (const d of args.team) {
    const clash = snapshot.assignments.find(
      (a) => a.employeeId === d.employeeId && a.projectId !== args.id && a.from <= draftEnd(d) && (a.to ?? projectEndOf(a.projectId)) >= d.from
    );
    if (clash) {
      const who = snapshot.employees.find((e) => e.id === d.employeeId)?.name ?? "Osoba";
      const where = snapshot.projects.find((p) => p.id === clash.projectId)?.name ?? "innym projekcie";
      throw new CommandError(
        `${who} ma w tym czasie zadanie w ${where} (${formatDate(clash.from)} – ${clash.to ? formatDate(clash.to) : "koniec projektu"}). Skróć jedno z zadań.`
      );
    }
  }

  const now = new Date().toISOString();
  const writes: Write[] = [];
  const events: AuditEvent[] = [];
  const current = args.id ? snapshot.projects.find((p) => p.id === args.id) : undefined;
  if (args.id && !current) throw new CommandError("Nie znaleziono projektu.");
  const id = current?.id ?? newId("p");
  const next: Project = current
    ? { ...current, ...clean(args.input), updatedAt: now }
    : { ...clean(args.input), id, createdAt: now, updatedAt: now };

  if (!current) {
    writes.push({ collection: "projects", id, data: strip(next) });
    events.push(audit(actor, "PROJECT_CREATED", id, `Utworzono projekt ${next.name} (${next.number})`));
  } else {
    const changes = (Object.keys(FIELD_LABELS) as (keyof ProjectInput)[])
      .filter((key) => JSON.stringify(current[key] ?? "") !== JSON.stringify(next[key] ?? ""))
      .map((key) => ({
        field: FIELD_LABELS[key]!,
        before: describeValue(snapshot, key, current[key]),
        after: describeValue(snapshot, key, next[key]),
      }));
    if (changes.length) {
      writes.push({ collection: "projects", id, data: strip(next) });
      events.push(audit(actor, "PROJECT_UPDATED", id, `Zmieniono dane projektu ${next.name}`, changes));
    }
  }

  // Plan zespołu: porównanie z tym, co jest zapisane
  const name = (employeeId: string) => snapshot.employees.find((e) => e.id === employeeId)?.name ?? "osoba";
  const range = (from: ISODate, to: ISODate | null, task?: string | null) =>
    `${task ? `${task}: ` : ""}${formatDate(from)} – ${to ? formatDate(to) : "koniec projektu"}`;
  const existing = snapshot.assignments.filter((a) => a.projectId === id);
  const teamChanges: { field: string; before: string; after: string }[] = [];
  for (const old of existing) {
    const draft = args.team.find((d) => d.id === old.id);
    if (!draft) {
      writes.push({ collection: "assignments", id: old.id, data: null });
      teamChanges.push({ field: name(old.employeeId), before: range(old.from, old.to, old.task), after: "zadanie usunięte" });
    } else if (draft.from !== old.from || (draft.to ?? null) !== (old.to ?? null) || (draft.task ?? null) !== (old.task ?? null)) {
      writes.push({ collection: "assignments", id: old.id, data: strip({ ...old, from: draft.from, to: draft.to, task: draft.task ?? null }) });
      teamChanges.push({
        field: name(old.employeeId),
        before: range(old.from, old.to, old.task),
        after: range(draft.from, draft.to, draft.task),
      });
    }
  }
  for (const draft of args.team.filter((d) => !d.id)) {
    const a: Assignment = {
      id: newId("a"),
      projectId: id,
      employeeId: draft.employeeId,
      from: draft.from,
      to: draft.to,
      task: draft.task ?? null,
    };
    writes.push({ collection: "assignments", id: a.id, data: strip(a) });
    teamChanges.push({ field: name(draft.employeeId), before: "—", after: range(draft.from, draft.to, draft.task) });
  }
  if (teamChanges.length) {
    events.push(audit(actor, "TEAM_PLANNED", id, `Zmieniono plan zespołu ${next.name}: ${teamChanges.length} ${plural(teamChanges.length, "zmiana", "zmiany", "zmian")}`, teamChanges));
  }
  return { id, changes: { writes, audit: events } };
}

/** Szybkie przypisanie z listy ludzi: od dziś do końca projektu; poprzednie przypisanie kończy się wczoraj. */
export function assignToProject(snapshot: Snapshot, actor: Actor, employeeId: string, projectId: string, today: ISODate): ChangeSet {
  const project = snapshot.projects.find((p) => p.id === projectId);
  const employee = snapshot.employees.find((e) => e.id === employeeId);
  if (!project || !employee) throw new CommandError("Nie znaleziono projektu lub osoby.");
  const from = project.startDate > today ? project.startDate : today;
  const writes: Write[] = [];
  const mine = snapshot.assignments.filter((a) => a.employeeId === employeeId);
  // Trwające zadania kończymy dniem przed przeprowadzką
  for (const a of mine.filter((a) => a.from <= from && (!a.to || a.to >= from))) {
    if (a.projectId === projectId) throw new CommandError(`${employee.name} jest już w tym zespole.`);
    const end = addDays(from, -1);
    writes.push(end < a.from ? { collection: "assignments", id: a.id, data: null } : { collection: "assignments", id: a.id, data: strip({ ...a, to: end }) });
  }
  // …a nowe zadanie nie może wjechać w zadanie, które osoba ma już zaplanowane dalej
  const nextStart = mine.filter((a) => a.from > from).sort((x, y) => x.from.localeCompare(y.from))[0]?.from ?? null;
  let to = project.endDate;
  if (nextStart) {
    const limit = addDays(nextStart, -1);
    if (limit < from) {
      const where = snapshot.projects.find((p) => p.id === mine.find((a) => a.from === nextStart)!.projectId)?.name ?? "innym projekcie";
      throw new CommandError(`${employee.name} zaczyna ${formatDate(nextStart)} w ${where}. Najpierw przesuń tamto zadanie.`);
    }
    if (!to || limit < to) to = limit;
  }
  const a: Assignment = { id: newId("a"), projectId, employeeId, from, to, task: defaultTask(employee.trade) };
  writes.push({ collection: "assignments", id: a.id, data: strip(a) });
  return {
    writes,
    audit: [
      audit(
        actor,
        "MEMBER_ASSIGNED",
        projectId,
        `Przypisano ${employee.name} do ${project.name}: ${formatDate(from)} – ${to ? formatDate(to) : "koniec projektu"}`
      ),
    ],
  };
}

/**
 * Obsada: nowe zadanie osoby w projekcie od–do (zwykle po przerwie na wyjazd do domu).
 * Nie może nachodzić na inne zadania tej osoby.
 */
export function planAssignment(
  snapshot: Snapshot,
  actor: Actor,
  args: { id?: string; employeeId: string; projectId: string; from: ISODate; to: ISODate | null; task: string; breakDays?: number }
): ChangeSet {
  const project = snapshot.projects.find((p) => p.id === args.projectId);
  const employee = snapshot.employees.find((e) => e.id === args.employeeId);
  if (!project || !employee) throw new CommandError("Nie znaleziono projektu lub osoby.");
  if (args.to && args.to < args.from) throw new CommandError("Zadanie kończy się przed startem.");
  if (project.endDate && args.from > project.endDate) throw new CommandError(`${project.name} kończy się ${formatDate(project.endDate)}.`);
  const to = args.to ?? project.endDate;
  const clash = snapshot.assignments.find((a) => {
    if (a.employeeId !== args.employeeId) return false;
    const end = a.to ?? snapshot.projects.find((p) => p.id === a.projectId)?.endDate ?? "9999-12-31";
    return a.from <= (to ?? "9999-12-31") && end >= args.from;
  });
  if (clash) {
    const p = snapshot.projects.find((x) => x.id === clash.projectId);
    throw new CommandError(`${employee.name} ma już zadanie w ${p?.name ?? "innym projekcie"} w tym czasie.`);
  }
  const a: Assignment = {
    id: args.id ?? newId("a"),
    projectId: project.id,
    employeeId: employee.id,
    from: args.from,
    to,
    task: args.task.trim() || defaultTask(employee.trade),
  };
  const pause = args.breakDays ? `, wcześniej przerwa ${daysCount(args.breakDays)}` : "";
  return {
    writes: [{ collection: "assignments", id: a.id, data: strip(a) }],
    audit: [
      audit(
        actor,
        "MEMBER_ASSIGNED",
        project.id,
        `Zaplanowano ${employee.name} w ${project.name}: ${a.task}, ${formatDate(a.from)} – ${to ? formatDate(to) : "koniec projektu"}${pause}`
      ),
    ],
  };
}

/** Obsada: cofnięcie zaplanowanego zadania (albo usunięcie osoby z przyszłej fazy projektu). */
export function removeAssignment(snapshot: Snapshot, actor: Actor, args: { assignmentId: string; reason?: string }): ChangeSet {
  const a = snapshot.assignments.find((x) => x.id === args.assignmentId);
  if (!a) throw new CommandError("Tego zadania już nie ma.");
  const project = snapshot.projects.find((p) => p.id === a.projectId);
  const employee = snapshot.employees.find((e) => e.id === a.employeeId);
  const hasHours = snapshot.timesheets.some(
    (t) => t.projectId === a.projectId && Object.entries(t.days?.[a.employeeId] ?? {}).some(([d, e]) => e && d >= a.from && (!a.to || d <= a.to))
  );
  if (hasHours) throw new CommandError(`${employee?.name ?? "Ta osoba"} ma już wpisane godziny w tym zadaniu — skróć zadanie w planie zespołu.`);
  return {
    writes: [{ collection: "assignments", id: a.id, data: null }],
    audit: [
      audit(
        actor,
        "MEMBER_REMOVED",
        a.projectId,
        `${args.reason ?? "Usunięto z planu"}: ${employee?.name ?? a.employeeId} w ${project?.name ?? a.projectId}, ${formatDate(a.from)} – ${a.to ? formatDate(a.to) : "koniec projektu"}`
      ),
    ],
  };
}

type PlanItem = { id?: string; employeeId: string; projectId: string; from: ISODate; to: ISODate | null; task: string; breakDays?: number };

/** Propozycja obsady: kilka zadań naraz — jedna operacja, jeden wpis w dzienniku na projekt. */
export function planMany(snapshot: Snapshot, actor: Actor, items: PlanItem[]): ChangeSet {
  if (items.length === 0) throw new CommandError("Nie wybrano nikogo.");
  const writes: Write[] = [];
  const planned: Assignment[] = [];
  const byProject = new Map<string, string[]>();
  for (const it of items) {
    // Każde zadanie sprawdzane jak pojedyncze, także względem już dodanych w tej samej propozycji
    const view: Snapshot = { ...snapshot, assignments: [...snapshot.assignments, ...planned] };
    const one = planAssignment(view, actor, it);
    const a = one.writes[0].data as unknown as Assignment;
    planned.push({ ...a, id: one.writes[0].id });
    writes.push(...one.writes);
    const name = snapshot.employees.find((e) => e.id === it.employeeId)?.name ?? it.employeeId;
    byProject.set(it.projectId, [...(byProject.get(it.projectId) ?? []), `${name} od ${formatDate(it.from)}`]);
  }
  return {
    writes,
    audit: [...byProject.entries()].map(([projectId, names]) => {
      const p = snapshot.projects.find((x) => x.id === projectId);
      return audit(actor, "MEMBER_ASSIGNED", projectId, `Propozycja obsady ${p?.name ?? projectId}: ${names.length} ${plural(names.length, "osoba", "osoby", "osób")} — ${names.join(", ")}`);
    }),
  };
}

export function removeMany(snapshot: Snapshot, actor: Actor, args: { assignmentIds: string[]; reason?: string }): ChangeSet {
  const writes: Write[] = [];
  const events: AuditEvent[] = [];
  for (const id of args.assignmentIds) {
    if (!snapshot.assignments.some((a) => a.id === id)) continue;
    const one = removeAssignment(snapshot, actor, { assignmentId: id, reason: args.reason });
    writes.push(...one.writes);
    events.push(...one.audit);
  }
  return { writes, audit: events };
}

/** Obsada: przerwa w trakcie zadania (np. wyjazd do domu) — zadanie dzieli się na dwa, w przerwie nie ma wpisu godzin. */
export function insertBreak(
  snapshot: Snapshot,
  actor: Actor,
  args: { assignmentId: string; from: ISODate; days: number }
): ChangeSet {
  const a = snapshot.assignments.find((x) => x.id === args.assignmentId);
  if (!a) throw new CommandError("Nie znaleziono zadania.");
  const project = snapshot.projects.find((p) => p.id === a.projectId);
  const employee = snapshot.employees.find((e) => e.id === a.employeeId);
  const end = a.to ?? project?.endDate ?? null;
  if (args.days < 1) throw new CommandError("Przerwa musi trwać co najmniej dzień.");
  if (args.from <= a.from) throw new CommandError("Przerwa musi zaczynać się po starcie zadania.");
  if (end && args.from > end) throw new CommandError("Przerwa musi zaczynać się przed końcem zadania.");
  const back = addDays(args.from, args.days);
  const writes: Write[] = [{ collection: "assignments", id: a.id, data: strip({ ...a, to: addDays(args.from, -1) }) }];
  if (!end || back <= end) {
    const rest: Assignment = { id: newId("a"), projectId: a.projectId, employeeId: a.employeeId, from: back, to: a.to, task: a.task ?? null };
    writes.push({ collection: "assignments", id: rest.id, data: strip(rest) });
  }
  return {
    writes,
    audit: [
      audit(
        actor,
        "TEAM_PLANNED",
        a.projectId,
        `Przerwa: ${employee?.name ?? a.employeeId} w ${project?.name ?? a.projectId}, ${formatDate(args.from)} – ${formatDate(addDays(back, -1))} (${daysCount(args.days)})`
      ),
    ],
  };
}

// ---------------------------------------------------------------- godziny

function sheetId(projectId: string, date: ISODate) {
  return `${projectId}_${startOfWeek(date)}`;
}

/** Zapisy kart tygodnia scalane po dokumencie — zmieniają tylko wskazane dni. */
function entryWrites(items: { projectId: string; employeeId: string; date: ISODate; entry: DayEntry }[]): Write[] {
  const docs = new Map<string, Write>();
  for (const it of items) {
    const id = sheetId(it.projectId, it.date);
    const w = docs.get(id) ?? {
      collection: "timesheets" as const,
      id,
      merge: true,
      data: { projectId: it.projectId, weekStart: startOfWeek(it.date), days: {} as Record<string, Record<string, DayEntry>> },
    };
    const days = (w.data as { days: Record<string, Record<string, DayEntry>> }).days;
    (days[it.employeeId] ??= {})[it.date] = normalizeEntry(it.entry);
    docs.set(id, w);
  }
  return [...docs.values()];
}

/** Pełny wpis z jawnymi null — scalanie nie zostawia starych pól. */
function normalizeEntry(e: DayEntry): DayEntry {
  return {
    kind: e.kind,
    status: e.status,
    start: e.start ?? null,
    end: e.end ?? null,
    breakMin: e.breakMin ?? null,
    absence: e.absence ?? null,
    note: e.note ?? null,
    submittedAt: e.submittedAt ?? null,
    svApprovedBy: e.svApprovedBy ?? null,
    svApprovedAt: e.svApprovedAt ?? null,
    finalApprovedBy: e.finalApprovedBy ?? null,
    finalApprovedAt: e.finalApprovedAt ?? null,
    exported: e.exported ?? false,
    exportedAt: e.exportedAt ?? null,
    history: e.history ?? [],
    leaveId: e.leaveId ?? null,
  };
}

/** Usunięcie dni z kart tygodnia (null w scalanym dokumencie = brak wpisu). */
function entryRemovals(items: { projectId: string; employeeId: string; date: ISODate }[]): Write[] {
  const docs = new Map<string, Write>();
  for (const it of items) {
    const id = sheetId(it.projectId, it.date);
    const w = docs.get(id) ?? { collection: "timesheets" as const, id, merge: true, data: { days: {} as Record<string, Record<string, null>> } };
    const days = (w.data as { days: Record<string, Record<string, null>> }).days;
    (days[it.employeeId] ??= {})[it.date] = null;
    docs.set(id, w);
  }
  return [...docs.values()];
}

function actorOf(snapshot: Snapshot, actor: Actor): Employee | undefined {
  return snapshot.employees.find((e) => e.id === actor.id);
}

function change(actor: Actor, text: string): EntryChange {
  return { at: new Date().toISOString(), byId: actor.id, byName: actor.name, text };
}

/**
 * Zamknięty tydzień: wysłany timesheet jest nienaruszalny dla wszystkich, wstrzymany poprawia tylko administrator.
 * (W wersji produkcyjnej to samo sprawdza backend — tu ostatnia linia obrony w prototypie.)
 */
function closedCheck(snapshot: Snapshot, actor: Actor, projectId: string, date: ISODate) {
  if (!isWeekClosed(date, new Date())) return;
  const sheet = snapshot.timesheets.find((t) => t.id === sheetId(projectId, date));
  const sent = Object.values(sheet?.days ?? {}).some((days) => Object.values(days ?? {}).some((e) => e?.exported));
  if (sent) throw new CommandError("Timesheet jest już w Dataverse — nienaruszalny.");
  if (!can(actorOf(snapshot, actor), "hours.fixWithheld")) throw new CommandError("Czas minął — timesheet poprawia już tylko administrator.");
}

function currentEntry(snapshot: Snapshot, projectId: string, employeeId: string, date: ISODate): DayEntry | undefined {
  return snapshot.timesheets.find((t) => t.id === sheetId(projectId, date))?.days?.[employeeId]?.[date];
}

export function submitHours(
  snapshot: Snapshot,
  actor: Actor,
  args: { projectId: string; employeeId: string; date: ISODate; start: number; end: number; breakMin: number }
): ChangeSet {
  if (args.end <= args.start) throw new CommandError("Koniec pracy musi być po starcie.");
  if (args.breakMin >= args.end - args.start) throw new CommandError("Przerwa jest dłuższa niż czas pracy.");
  const prev = currentEntry(snapshot, args.projectId, args.employeeId, args.date);
  if (prev && (prev.status !== "SUBMITTED" || prev.exported))
    throw new CommandError("Ten dzień jest już zatwierdzony. Zmiany wprowadza supervisor.");
  closedCheck(snapshot, actor, args.projectId, args.date);
  const next: DayEntry = {
    ...(prev ?? {}),
    kind: "WORK",
    status: "SUBMITTED",
    start: args.start,
    end: args.end,
    breakMin: args.breakMin,
    absence: null,
    submittedAt: new Date().toISOString(),
  };
  const before = prev ? describeHours(prev) : null;
  const after = describeHours(next);
  if (before === after) throw new CommandError("Nic się nie zmieniło.");
  next.history = [...(prev?.history ?? []), ...(before ? [change(actor, `Poprawione: ${before} → ${after}`)] : [])];
  return {
    writes: entryWrites([{ ...args, entry: next }]),
    audit: [audit(actor, "HOURS_SUBMITTED", args.projectId, `${prev ? "Poprawiono" : "Wpisano"} godziny: ${formatDay(args.date)}, ${after}`)],
  };
}

// ---------------------------------------------------------------- urlopy i nieobecności

const LEAVE_KIND: Record<AbsenceType, string> = { LEAVE: "urlop", SICK: "L4", OTHER: "inna nieobecność" };

function leaveRange(l: Pick<LeaveRequest, "from" | "to">) {
  return l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} – ${formatDate(l.to)}`;
}

/** Projekt, w którym osoba pracuje danego dnia (zadanie albo nadzór). */
function projectOn(snapshot: Snapshot, employeeId: string, date: ISODate): string | null {
  const a = snapshot.assignments.find((x) => x.employeeId === employeeId && x.from <= date && (!x.to || x.to >= date));
  if (a) return a.projectId;
  return snapshot.projects.find((p) => p.supervisorId === employeeId && p.startDate <= date && (!p.endDate || p.endDate >= date))?.id ?? null;
}

/**
 * Dni nieobecności z zaakceptowanego wniosku: dni robocze, w których osoba ma zadanie, w otwartych tygodniach
 * (w zamkniętych tylko osoba z uprawnieniem do poprawy wstrzymanych). Dni z zatwierdzonymi godzinami zostają.
 */
function leaveEntries(snapshot: Snapshot, actor: Actor, leave: LeaveRequest, text: string) {
  const now = new Date();
  const fixer = can(actorOf(snapshot, actor), "hours.fixWithheld");
  const items: { projectId: string; employeeId: string; date: ISODate; entry: DayEntry }[] = [];
  let skipped = 0;
  const at = now.toISOString();
  for (const date of eachDay(leave.from, leave.to)) {
    if (weekdayIndex(date) >= 5) continue;
    const projectId = projectOn(snapshot, leave.employeeId, date);
    if (!projectId) continue;
    if (isWeekClosed(date, now) && !fixer) {
      skipped++;
      continue;
    }
    const prev = currentEntry(snapshot, projectId, leave.employeeId, date);
    if (prev && (prev.exported || (prev.kind === "WORK" && prev.status !== "SUBMITTED"))) {
      skipped++;
      continue;
    }
    items.push({
      projectId,
      employeeId: leave.employeeId,
      date,
      entry: {
        kind: "ABSENCE",
        status: "PM_APPROVED",
        start: null,
        end: null,
        breakMin: null,
        absence: leave.type,
        note: leave.note ?? null,
        submittedAt: leave.createdAt,
        svApprovedBy: actor.id,
        svApprovedAt: at,
        finalApprovedBy: actor.id,
        finalApprovedAt: at,
        leaveId: leave.id,
        history: [...(prev?.history ?? []), change(actor, prev ? `${describeHours(prev)} → ${text}` : text)],
      },
    });
  }
  return { items, skipped };
}

/** Dni z kart tygodnia, które pochodzą z wniosku (od daty `from`), w tygodniach, które można jeszcze zmienić. */
function leaveEntryRefs(snapshot: Snapshot, actor: Actor, leave: LeaveRequest, from: ISODate) {
  const now = new Date();
  const fixer = can(actorOf(snapshot, actor), "hours.fixWithheld");
  const refs: { projectId: string; employeeId: string; date: ISODate }[] = [];
  for (const t of snapshot.timesheets) {
    for (const [date, e] of Object.entries(t.days?.[leave.employeeId] ?? {})) {
      if (!e || e.leaveId !== leave.id || date < from || e.exported) continue;
      if (isWeekClosed(date, now) && !fixer) continue;
      refs.push({ projectId: t.projectId, employeeId: leave.employeeId, date });
    }
  }
  return refs;
}

export function requestLeave(
  snapshot: Snapshot,
  actor: Actor,
  args: { employeeId: string; from: ISODate; to: ISODate; type: AbsenceType; note?: string }
): ChangeSet {
  const employee = snapshot.employees.find((e) => e.id === args.employeeId);
  const me = actorOf(snapshot, actor);
  if (!employee || !me) throw new CommandError("Nie znaleziono osoby.");
  if (!args.from || !args.to) throw new CommandError("Wybierz daty od–do.");
  if (args.to < args.from) throw new CommandError("Koniec nieobecności nie może być przed startem.");
  if (eachDay(args.from, args.to).length > 120) throw new CommandError("Wniosek może obejmować najwyżej 120 dni.");
  if ((args.note ?? "").length > 500) throw new CommandError("Uwagi: najwyżej 500 znaków.");
  const own = args.employeeId === actor.id;
  if (own && !can(me, "leave.own")) throw new CommandError("Nie masz uprawnienia do składania wniosków.");
  const draft: LeaveRequest = {
    id: newId("lv"),
    employeeId: employee.id,
    type: args.type,
    from: args.from,
    to: args.to,
    note: args.note?.trim() || null,
    status: args.type === "SICK" ? "APPROVED" : "PENDING",
    createdAt: new Date().toISOString(),
    createdById: actor.id,
    createdByName: actor.name,
  };
  if (!own && !canDecideLeave(snapshot, me, draft)) throw new CommandError("Możesz zgłaszać nieobecność tylko za ludzi ze swoich projektów.");
  const clash = (snapshot.leaves ?? []).find(
    (l) => l.employeeId === employee.id && (l.status === "PENDING" || l.status === "APPROVED") && l.from <= args.to && l.to >= args.from
  );
  if (clash) throw new CommandError(`${own ? "Masz" : `${employee.name} ma`} już wniosek na te dni (${LEAVE_KIND[clash.type]}, ${leaveRange(clash)}).`);
  if (args.type !== "SICK" && isWeekClosed(args.from, new Date()) && !can(me, "hours.fixWithheld"))
    throw new CommandError("Ten tydzień jest już zamknięty. Nieobecność wstecz wpisuje administrator.");

  const writes: Write[] = [{ collection: "leaves", id: draft.id, data: strip(draft) }];
  let extra = "";
  if (draft.type === "SICK") {
    const { items, skipped } = leaveEntries(snapshot, actor, draft, "L4 — obowiązuje od zgłoszenia");
    writes.push(...entryWrites(items));
    extra = `, dni w timesheetach: ${items.length}${skipped ? ` (pominięto ${skipped} — zamknięte albo zatwierdzone godziny)` : ""}`;
  }
  const project = leaveProjects(snapshot, draft)[0];
  return {
    writes,
    audit: [
      audit(
        actor,
        "LEAVE_REQUESTED",
        project?.id ?? null,
        `${own ? "Wniosek" : `Wniosek za ${employee.name}`}: ${LEAVE_KIND[draft.type]} ${leaveRange(draft)}${draft.type === "SICK" ? " — L4 obowiązuje od razu" : ""}${extra}`
      ),
    ],
  };
}

function findLeave(snapshot: Snapshot, leaveId: string): LeaveRequest {
  const leave = (snapshot.leaves ?? []).find((l) => l.id === leaveId);
  if (!leave) throw new CommandError("Nie znaleziono wniosku.");
  return leave;
}

export function decideLeave(snapshot: Snapshot, actor: Actor, args: { leaveId: string; approve: boolean; note?: string }): ChangeSet {
  const leave = findLeave(snapshot, args.leaveId);
  const me = actorOf(snapshot, actor);
  if (!me || !canDecideLeave(snapshot, me, leave)) throw new CommandError("Nie możesz rozpatrzyć tego wniosku.");
  if (leave.status !== "PENDING") throw new CommandError("Ten wniosek jest już rozpatrzony.");
  const note = args.note?.trim() || null;
  if (!args.approve && !note) throw new CommandError("Podaj powód odrzucenia — zobaczy go pracownik.");
  const employee = snapshot.employees.find((e) => e.id === leave.employeeId);
  const now = new Date().toISOString();
  const next: LeaveRequest = {
    ...leave,
    status: args.approve ? "APPROVED" : "REJECTED",
    decidedAt: now,
    decidedById: actor.id,
    decidedByName: actor.name,
    decisionNote: note,
  };
  const writes: Write[] = [{ collection: "leaves", id: leave.id, data: strip(next) }];
  let extra = "";
  if (args.approve) {
    const { items, skipped } = leaveEntries(snapshot, actor, next, `${ABSENCE_LABEL[leave.type]} — zaakceptował ${actor.name}`);
    writes.push(...entryWrites(items));
    extra = `, dni w timesheetach: ${items.length}${skipped ? ` (pominięto ${skipped})` : ""}`;
  }
  const project = leaveProjects(snapshot, leave)[0];
  return {
    writes,
    audit: [
      audit(
        actor,
        args.approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        project?.id ?? null,
        `${args.approve ? "Zaakceptowano" : "Odrzucono"}: ${employee?.name ?? leave.employeeId}, ${LEAVE_KIND[leave.type]} ${leaveRange(leave)}${note ? ` — „${note}"` : ""}${extra}`
      ),
    ],
  };
}

/**
 * Anulowanie wniosku. Czekający anuluje wnioskujący albo osoba akceptująca. Zaakceptowany (i L4) — osoba
 * akceptująca: jeśli nieobecność już trwa, wniosek kończy się wczoraj, a dni od dziś znikają z timesheetów.
 */
export function cancelLeave(snapshot: Snapshot, actor: Actor, args: { leaveId: string; note?: string }): ChangeSet {
  const leave = findLeave(snapshot, args.leaveId);
  const me = actorOf(snapshot, actor);
  if (!me) throw new CommandError("Nie znaleziono osoby.");
  const own = leave.employeeId === actor.id;
  const decider = canDecideLeave(snapshot, me, leave);
  if (leave.status === "PENDING" ? !own && !decider : !decider)
    throw new CommandError(own ? "Zaakceptowany wniosek cofa osoba akceptująca — napisz do supervisora albo HR." : "Nie możesz anulować tego wniosku.");
  if (leave.status !== "PENDING" && leave.status !== "APPROVED") throw new CommandError("Ten wniosek jest już zamknięty.");
  const today = new Date().toISOString().slice(0, 10);
  const employee = snapshot.employees.find((e) => e.id === leave.employeeId);
  const now = new Date().toISOString();
  const started = leave.status === "APPROVED" && leave.from < today;
  const next: LeaveRequest = started
    ? { ...leave, to: addDays(today, -1), decisionNote: args.note?.trim() || `Skrócono do ${formatDate(addDays(today, -1))}` }
    : { ...leave, status: "CANCELLED", decidedAt: now, decidedById: actor.id, decidedByName: actor.name, decisionNote: args.note?.trim() || null };
  const removals = leave.status === "APPROVED" ? leaveEntryRefs(snapshot, actor, leave, started ? today : leave.from) : [];
  const project = leaveProjects(snapshot, leave)[0];
  return {
    writes: [{ collection: "leaves", id: leave.id, data: strip(next) }, ...entryRemovals(removals)],
    audit: [
      audit(
        actor,
        "LEAVE_CANCELLED",
        project?.id ?? null,
        `${started ? "Skrócono" : "Anulowano"}: ${employee?.name ?? leave.employeeId}, ${LEAVE_KIND[leave.type]} ${leaveRange(leave)}${started ? ` → do ${formatDate(next.to)}` : ""}${removals.length ? `, usunięte dni: ${removals.length}` : ""}`
      ),
    ],
  };
}

/** HR potwierdza dokument L4. */
export function confirmSickNote(snapshot: Snapshot, actor: Actor, args: { leaveId: string }): ChangeSet {
  const leave = findLeave(snapshot, args.leaveId);
  const me = actorOf(snapshot, actor);
  if (!me || !canDecideLeave(snapshot, me, leave)) throw new CommandError("Nie możesz potwierdzić tego L4.");
  if (leave.type !== "SICK" || leave.status !== "APPROVED") throw new CommandError("To nie jest aktywne L4.");
  if (leave.confirmedAt) throw new CommandError("L4 jest już potwierdzone.");
  const employee = snapshot.employees.find((e) => e.id === leave.employeeId);
  const next: LeaveRequest = { ...leave, confirmedAt: new Date().toISOString(), confirmedById: actor.id, confirmedByName: actor.name };
  return {
    writes: [{ collection: "leaves", id: leave.id, data: strip(next) }],
    audit: [audit(actor, "LEAVE_CONFIRMED", leaveProjects(snapshot, leave)[0]?.id ?? null, `Potwierdzono L4: ${employee?.name ?? leave.employeeId}, ${leaveRange(leave)}`)],
  };
}

// ---------------------------------------------------------------- użytkownicy i uprawnienia

export interface UserInput {
  name: string;
  email: string;
  position: Position;
  role: AccessRole;
  trade?: Trade | null;
  employment?: Employment | null;
  grants: Permission[];
  revokes: Permission[];
  active: boolean;
}

export function saveUser(snapshot: Snapshot, actor: Actor, args: UserInput & { id: string | null }): { id: string; changes: ChangeSet } {
  const me = actorOf(snapshot, actor);
  if (!can(me, "users.manage")) throw new CommandError("Nie masz uprawnienia do zarządzania użytkownikami.");
  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw new CommandError("Podaj imię i nazwisko (2–80 znaków).");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommandError("Adres e-mail wygląda na niepoprawny.");
  if (email && snapshot.employees.some((e) => e.email?.toLowerCase() === email && e.id !== args.id))
    throw new CommandError("Ten adres e-mail ma już inny użytkownik.");
  if (!(args.role in ROLE_LABEL)) throw new CommandError("Wybierz rolę.");
  const field = args.position === "TEAM_LEADER" || args.position === "ELECTRICIAN" || args.position === "MECHANIC";
  const current = args.id ? snapshot.employees.find((e) => e.id === args.id) : undefined;
  if (args.id && !current) throw new CommandError("Nie znaleziono użytkownika.");

  const base: Employee = current ?? { id: newId("u"), name, role: args.role, position: args.position, active: true, createdAt: new Date().toISOString() };
  const next: Employee = {
    ...base,
    name,
    email: email || null,
    role: args.role,
    position: args.position,
    active: args.active,
    grants: [...new Set(args.grants)],
    revokes: [...new Set(args.revokes)],
  };
  if (field) {
    next.trade = args.position === "ELECTRICIAN" ? "ELECTRICAL" : args.position === "MECHANIC" ? "MECHANICAL" : args.trade ?? base.trade ?? "ELECTRICAL";
    next.employment = args.employment ?? base.employment ?? "UOP";
  } else {
    delete next.trade;
    delete next.employment;
    delete next.experience;
  }
  if (actor.id === next.id && (!next.active || !permissionsOf(next).has("users.manage")))
    throw new CommandError("Nie możesz odebrać sobie dostępu do zarządzania użytkownikami.");

  const writes: Write[] = [{ collection: "employees", id: next.id, data: strip(next) }];
  if (!current) {
    const perms = [...permissionsOf(next)].map((p) => PERMISSION_LABEL[p]).join(", ") || "brak";
    return {
      id: next.id,
      changes: {
        writes,
        audit: [audit(actor, "USER_CREATED", null, `Dodano użytkownika ${name} (${POSITION_LABEL[next.position]}, rola: ${ROLE_LABEL[next.role]}). Uprawnienia: ${perms}`)],
      },
    };
  }
  const changes: { field: string; before: string; after: string }[] = [];
  const diff = (label: string, a: unknown, b: unknown) => {
    if (String(a ?? "—") !== String(b ?? "—")) changes.push({ field: label, before: String(a ?? "—"), after: String(b ?? "—") });
  };
  diff("Imię i nazwisko", current.name, next.name);
  diff("E-mail", current.email, next.email);
  diff("Stanowisko", POSITION_LABEL[current.position], POSITION_LABEL[next.position]);
  diff("Rola", ROLE_LABEL[current.role], ROLE_LABEL[next.role]);
  diff("Konto", current.active === false ? "wyłączone" : "aktywne", next.active ? "aktywne" : "wyłączone");
  const before = permissionsOf(current);
  const after = permissionsOf(next);
  const added = [...after].filter((p) => !before.has(p));
  const removed = [...before].filter((p) => !after.has(p));
  if (added.length) changes.push({ field: "Dodane uprawnienia", before: "—", after: added.map((p) => PERMISSION_LABEL[p]).join(", ") });
  if (removed.length) changes.push({ field: "Odebrane uprawnienia", before: removed.map((p) => PERMISSION_LABEL[p]).join(", "), after: "—" });
  if (!changes.length) return { id: next.id, changes: { writes: [], audit: [] } };
  return { id: next.id, changes: { writes, audit: [audit(actor, "USER_UPDATED", null, `Zmieniono użytkownika ${name}`, changes)] } };
}

// ---------------------------------------------------------------- ustawienia systemu

export function saveSettings(snapshot: Snapshot, actor: Actor, input: SystemSettings): ChangeSet {
  if (!can(actorOf(snapshot, actor), "settings.manage")) throw new CommandError("Nie masz uprawnienia do ustawień systemu.");
  const next = normalizeSettings({
    ...input,
    categories: input.categories.map((c) => c.trim().toUpperCase()).filter(Boolean),
    branches: input.branches.map((b) => b.trim()).filter(Boolean),
  });
  const error = validateSettings(next);
  if (error) throw new CommandError(error);
  for (const c of normalizeSettings(snapshot.settings).categories.filter((c) => !next.categories.includes(c))) {
    const used = snapshot.projects.filter((p) => p.category === c).length;
    if (used) throw new CommandError(`Kategoria ${c} jest w ${used} ${plural(used, "projekcie", "projektach", "projektach")} — najpierw zmień im kategorię.`);
  }
  for (const b of normalizeSettings(snapshot.settings).branches.filter((b) => !next.branches.includes(b))) {
    const used = snapshot.projects.filter((p) => p.branch === b).length;
    if (used) throw new CommandError(`Oddział ${b} ma ${used} ${plural(used, "projekt", "projekty", "projektów")} — najpierw zmień im oddział.`);
  }
  const prev = normalizeSettings(snapshot.settings);
  const day = (offset: number) => WEEKDAY_AFTER.find((w) => w.offset === offset)?.label ?? `${offset} dni`;
  const rows: [string, string, string][] = [
    ["Termin zatwierdzania", `${day(prev.approveDayOffset)} ${prev.approveTime}`, `${day(next.approveDayOffset)} ${next.approveTime}`],
    ["Wysyłka do Dataverse", `${day(prev.exportDayOffset)} ${prev.exportTime}`, `${day(next.exportDayOffset)} ${next.exportTime}`],
    ["Kategorie projektów", prev.categories.join(", "), next.categories.join(", ")],
    ["Oddziały", prev.branches.join(", "), next.branches.join(", ")],
    ["Minimalny udział EPCIDO", `${prev.minEpcidoShare}%`, `${next.minEpcidoShare}%`],
    ["Przerwa na wyjazd od", daysCount(prev.breakMinDays), daysCount(next.breakMinDays)],
    ["„Długo bez przerwy” od", `${prev.longStretchWeeks} tyg.`, `${next.longStretchWeeks} tyg.`],
  ];
  const changes = rows.filter(([, a, b]) => a !== b).map(([field, before, after]) => ({ field, before, after }));
  if (!changes.length) return { writes: [], audit: [] };
  return {
    writes: [{ collection: "meta", id: "settings", data: strip(next) }],
    audit: [audit(actor, "SETTINGS_UPDATED", null, `Zmieniono ustawienia systemu: ${changes.map((c) => c.field).join(", ")}`, changes)],
  };
}

// ---------------------------------------------------------------- raporty

/** Pobranie raportu zostaje w dzienniku (kto, kiedy, jakie dane) — bez zmian w danych. */
export function logReport(actor: Actor, summary: string): ChangeSet {
  return { writes: [], audit: [audit(actor, "REPORT_EXPORTED", null, summary)] };
}

function approvalFields(entry: DayEntry, level: QueueLevel, actor: Actor, at: string): DayEntry {
  return level === "team"
    ? { ...entry, status: approvedStatus(level), svApprovedBy: actor.id, svApprovedAt: at }
    : { ...entry, status: approvedStatus(level), finalApprovedBy: actor.id, finalApprovedAt: at };
}

export function approve(snapshot: Snapshot, actor: Actor, items: QueueItem[]): ChangeSet {
  if (items.length === 0) throw new CommandError("Nie ma nic do zatwierdzenia.");
  const now = new Date().toISOString();
  const updated = items.map((it) => {
    let entry = approvalFields(it.entry, it.level, actor, now);
    if (it.locked) entry = { ...entry, history: [...(entry.history ?? []), change(actor, "Zatwierdzone po terminie — pójdzie w najbliższej wtorkowej wysyłce")] };
    return { ...it, entry };
  });
  return { writes: entryWrites(updated), audit: summarize(snapshot, actor, "HOURS_APPROVED", "Zatwierdzono", items) };
}

export interface EntryInput {
  kind: EntryKind;
  start?: number | null;
  end?: number | null;
  breakMin?: number | null;
  absence?: AbsenceType | null;
}

/**
 * Zmiana dnia przez osobę z uprawnieniami (supervisor, IM, administrator) — także zatwierdzonego.
 * Zmiana zostaje w notatce wpisu (kto, kiedy, co było, co jest) i w dzienniku zmian.
 * Opcjonalnie od razu zatwierdza dzień na poziomie tej osoby.
 */
export function editEntry(
  snapshot: Snapshot,
  actor: Actor,
  args: {
    projectId: string;
    employeeId: string;
    date: ISODate;
    input: EntryInput;
    comment?: string;
    approveLevel?: QueueLevel | null;
  }
): ChangeSet {
  const { input } = args;
  if (input.kind === "WORK") {
    if (input.start == null || input.end == null) throw new CommandError("Podaj godziny pracy.");
    if (input.end <= input.start) throw new CommandError("Koniec pracy musi być po starcie.");
    if ((input.breakMin ?? 0) >= input.end - input.start) throw new CommandError("Przerwa jest dłuższa niż czas pracy.");
  } else if (!input.absence) throw new CommandError("Wybierz rodzaj nieobecności.");

  const prev = currentEntry(snapshot, args.projectId, args.employeeId, args.date);
  closedCheck(snapshot, actor, args.projectId, args.date);

  const at = new Date().toISOString();
  let next: DayEntry = {
    ...(prev ?? { status: "SUBMITTED", submittedAt: at }),
    kind: input.kind,
    start: input.kind === "WORK" ? input.start ?? null : null,
    end: input.kind === "WORK" ? input.end ?? null : null,
    breakMin: input.kind === "WORK" ? input.breakMin ?? 0 : null,
    absence: input.kind === "ABSENCE" ? input.absence ?? "OTHER" : null,
  } as DayEntry;
  const before = prev ? describeHours(prev) : null;
  const after = describeHours(next);
  const changed = before !== after;
  const comment = args.comment?.trim();
  if (!changed && !comment && !args.approveLevel) throw new CommandError("Nic się nie zmieniło.");

  const parts: string[] = [];
  if (changed) parts.push(before ? `${before} → ${after}` : `Wpisane: ${after}`);
  if (comment) parts.push(`„${comment}"`);
  if (parts.length) next.history = [...(prev?.history ?? []), change(actor, parts.join(" — "))];
  if (args.approveLevel) next = approvalFields(next, args.approveLevel, actor, at);

  const who = snapshot.employees.find((e) => e.id === args.employeeId)?.name ?? args.employeeId;
  const summary = `${who}, ${formatDay(args.date)}: ${parts.join(" — ") || "bez zmian"}${args.approveLevel ? " (zatwierdzono)" : ""}`;
  return {
    writes: entryWrites([{ projectId: args.projectId, employeeId: args.employeeId, date: args.date, entry: next }]),
    audit: [audit(actor, changed || comment ? "HOURS_EDITED" : "HOURS_APPROVED", args.projectId, summary)],
  };
}

function summarize(snapshot: Snapshot, actor: Actor, action: AuditAction, verb: string, items: QueueItem[]): AuditEvent[] {
  const byProject = new Map<string, QueueItem[]>();
  items.forEach((it) => byProject.set(it.projectId, [...(byProject.get(it.projectId) ?? []), it]));
  return [...byProject.entries()].map(([projectId, list]) => {
    const people = [...new Set(list.map((i) => snapshot.employees.find((e) => e.id === i.employeeId)?.name ?? i.employeeId))];
    const sheets = countTimesheets(list);
    const who = people.length > 3 ? `${people.slice(0, 3).join(", ")} i ${people.length - 3} innych` : people.join(", ");
    return audit(
      actor,
      action,
      projectId,
      `${verb} ${sheets} ${plural(sheets, "timesheet", "timesheety", "timesheetów")} (${daysCount(list.length)}): ${who}`
    );
  });
}

// ---------------------------------------------------------------- dane testowe

export function loadTestData(actor: Actor, today: ISODate): ChangeSet {
  const data = generateDataset(today);
  const writes: Write[] = [
    ...data.employees.map((e) => ({ collection: "employees" as const, id: e.id, data: strip(e) })),
    ...data.projects.map((p) => ({ collection: "projects" as const, id: p.id, data: strip(p) })),
    ...data.assignments.map((a) => ({ collection: "assignments" as const, id: a.id, data: strip(a) })),
    ...data.timesheets.map((t) => ({ collection: "timesheets" as const, id: t.id, data: strip(t) })),
    ...data.leaves.map((l) => ({ collection: "leaves" as const, id: l.id, data: strip(l) })),
    { collection: "meta", id: "settings", data: strip(DEFAULT_SETTINGS) },
    { collection: "meta", id: "seed", data: { version: SEED_VERSION, loadedAt: new Date().toISOString() } },
  ];
  const summary = `Wgrano dane testowe v${SEED_VERSION}: ${data.employees.length} osób, ${data.projects.length} projektów, ${data.timesheets.length} kart tygodniowych, ${data.leaves.length} wniosków o nieobecność`;
  return { writes, audit: [audit(actor, "TEST_DATA_LOADED", null, summary)] };
}

/** Usuwa wszystkie dane oprócz dziennika zmian (dziennik jest tylko do dopisywania). */
export function clearData(snapshot: Snapshot, actor: Actor): ChangeSet {
  const writes: Write[] = [
    ...snapshot.timesheets.map((t) => ({ collection: "timesheets" as const, id: t.id, data: null })),
    ...(snapshot.leaves ?? []).map((l) => ({ collection: "leaves" as const, id: l.id, data: null })),
    ...snapshot.assignments.map((a) => ({ collection: "assignments" as const, id: a.id, data: null })),
    ...snapshot.projects.map((p) => ({ collection: "projects" as const, id: p.id, data: null })),
    ...snapshot.employees.map((e) => ({ collection: "employees" as const, id: e.id, data: null })),
    { collection: "meta", id: "seed", data: null },
  ];
  return { writes, audit: [audit(actor, "TEST_DATA_CLEARED", null, "Usunięto dane testowe")] };
}

function describeValue(snapshot: Snapshot, key: keyof ProjectInput, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "installationManagerId" || key === "supervisorId" || key === "projectManagerId")
    return snapshot.employees.find((e) => e.id === value)?.name ?? String(value);
  if (key === "startDate" || key === "endDate") return formatDate(String(value));
  if (key === "status") return PROJECT_STATUS_LABEL[value as Project["status"]];
  if (key === "demand") {
    const phases = value as Project["demand"];
    if (!phases.length) return "—";
    return phases.map((d) => `${formatDate(d.from)} – ${formatDate(d.to)}: E ${d.electricians}, M ${d.mechanics}`).join("; ");
  }
  return String(value);
}

/** Usuwa pola undefined (Firestore ich nie przyjmuje) i zwraca zwykły obiekt. */
function strip(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

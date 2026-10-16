// Polecenia zmieniające dane. Każde zwraca ChangeSet: zapisy + wpis do dziennika zmian.
// Walidacja biznesowa jest tutaj, a nie w ekranach.

import { newId } from "../lib/random";
import { addDays, eachDay, formatDate, formatDay, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { ABSENCE_LABEL, defaultTask, PROJECT_STATUS_LABEL } from "../domain/labels";
import { approvedStatus, countTimesheets, describeHours, isLocked, type QueueItem, type QueueLevel } from "../domain/workflow";
import type {
  AbsenceType,
  Assignment,
  AuditAction,
  AuditEvent,
  DayEntry,
  EntryChange,
  EntryKind,
  Project,
  ProjectInput,
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
  needElectricians: "Zapotrzebowanie: elektrycy",
  needMechanics: "Zapotrzebowanie: mechanicy",
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
  for (const key of ["needElectricians", "needMechanics"] as const) {
    const v = input[key];
    if (v != null && (!Number.isInteger(v) || v < 0 || v > 500)) errors[key] = "Podaj liczbę osób od 0 do 500.";
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
      .filter((key) => (current[key] ?? "") !== (next[key] ?? ""))
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
  const active = snapshot.assignments.filter((a) => a.employeeId === employeeId && (!a.to || a.to >= from) && a.from <= from);
  for (const a of active) {
    if (a.projectId === projectId) throw new CommandError(`${employee.name} jest już w tym zespole.`);
    const end = addDays(from, -1);
    writes.push(end < a.from ? { collection: "assignments", id: a.id, data: null } : { collection: "assignments", id: a.id, data: strip({ ...a, to: end }) });
  }
  const a: Assignment = { id: newId("a"), projectId, employeeId, from, to: project.endDate, task: defaultTask(employee.trade) };
  writes.push({ collection: "assignments", id: a.id, data: strip(a) });
  return {
    writes,
    audit: [audit(actor, "MEMBER_ASSIGNED", projectId, `Przypisano ${employee.name} do ${project.name} od ${formatDate(from)}`)],
  };
}

/**
 * Obsada: nowe zadanie osoby w projekcie od–do (zwykle po przerwie na wyjazd do domu).
 * Nie może nachodzić na inne zadania tej osoby.
 */
export function planAssignment(
  snapshot: Snapshot,
  actor: Actor,
  args: { employeeId: string; projectId: string; from: ISODate; to: ISODate | null; task: string; breakDays?: number }
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
  const a: Assignment = { id: newId("a"), projectId: project.id, employeeId: employee.id, from: args.from, to, task: args.task.trim() || defaultTask(employee.trade) };
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
  };
}

function change(actor: Actor, text: string): EntryChange {
  return { at: new Date().toISOString(), byId: actor.id, byName: actor.name, text };
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
  if (isLocked(args.date, prev, new Date())) throw new CommandError("Termin minął — ten dzień zmieni już tylko administrator.");
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

export function reportAbsence(
  snapshot: Snapshot,
  actor: Actor,
  args: { employeeId: string; from: ISODate; to: ISODate; type: AbsenceType; note?: string }
): ChangeSet {
  if (args.to < args.from) throw new CommandError("Koniec nieobecności nie może być przed startem.");
  const now = new Date();
  const items: { projectId: string; employeeId: string; date: ISODate; entry: DayEntry }[] = [];
  for (const date of eachDay(args.from, args.to)) {
    if (weekdayIndex(date) >= 5) continue;
    const a = snapshot.assignments.find(
      (x) => x.employeeId === args.employeeId && x.from <= date && (!x.to || x.to >= date)
    );
    const projectId = a?.projectId ?? snapshot.projects.find((p) => p.supervisorId === args.employeeId && p.startDate <= date)?.id;
    if (!projectId) continue;
    const prev = currentEntry(snapshot, projectId, args.employeeId, date);
    if (prev && (prev.status !== "SUBMITTED" || prev.exported)) continue;
    if (isLocked(date, prev, now)) continue;
    items.push({
      projectId,
      employeeId: args.employeeId,
      date,
      entry: {
        ...(prev ?? {}),
        kind: "ABSENCE",
        status: "SUBMITTED",
        start: null,
        end: null,
        breakMin: null,
        absence: args.type,
        note: args.note ?? null,
        submittedAt: now.toISOString(),
        history: [...(prev?.history ?? []), ...(prev ? [change(actor, `Poprawione: ${describeHours(prev)} → nieobecność (${ABSENCE_LABEL[args.type].toLowerCase()})`)] : [])],
      },
    });
  }
  if (items.length === 0)
    throw new CommandError("W wybranym okresie nie ma dni roboczych z zadaniem, które można jeszcze zmienić.");
  return {
    writes: entryWrites(items),
    audit: [
      audit(
        actor,
        "ABSENCE_REPORTED",
        items[0].projectId,
        `Zgłoszono nieobecność (${ABSENCE_LABEL[args.type].toLowerCase()}): ${formatDate(args.from)} – ${formatDate(args.to)}, dni robocze: ${items.length}`
      ),
    ],
  };
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
  if (prev?.exported) throw new CommandError("Ten dzień jest już w Dataverse — nie można go zmienić.");
  const actorRole = snapshot.employees.find((e) => e.id === actor.id)?.role;
  if (isLocked(args.date, prev, new Date()) && actorRole !== "ADMIN")
    throw new CommandError("Termin minął — ten dzień zmieni i zatwierdzi tylko administrator.");

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
    { collection: "meta", id: "seed", data: { version: SEED_VERSION, loadedAt: new Date().toISOString() } },
  ];
  const summary = `Wgrano dane testowe v${SEED_VERSION}: ${data.employees.length} osób, ${data.projects.length} projektów, ${data.timesheets.length} kart tygodniowych`;
  return { writes, audit: [audit(actor, "TEST_DATA_LOADED", null, summary)] };
}

/** Usuwa wszystkie dane oprócz dziennika zmian (dziennik jest tylko do dopisywania). */
export function clearData(snapshot: Snapshot, actor: Actor): ChangeSet {
  const writes: Write[] = [
    ...snapshot.timesheets.map((t) => ({ collection: "timesheets" as const, id: t.id, data: null })),
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
  return String(value);
}

/** Usuwa pola undefined (Firestore ich nie przyjmuje) i zwraca zwykły obiekt. */
function strip(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

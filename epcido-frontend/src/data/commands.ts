// Polecenia zmieniające dane. Każde zwraca ChangeSet: zapisy + wpis do dziennika zmian.
// Walidacja biznesowa jest tutaj, a nie w ekranach.

import { newId } from "../lib/random";
import { addDays, eachDay, formatDate, formatDay, formatMinutes, startOfWeek, weekdayIndex, type ISODate } from "../lib/dates";
import { ABSENCE_LABEL, PROJECT_STATUS_LABEL, formatHoursTotal, workedMinutes } from "../domain/labels";
import { approvedStatus, type QueueItem } from "../domain/workflow";
import type { AbsenceType, Assignment, AuditAction, AuditEvent, DayEntry, Project, ProjectInput } from "../domain/types";
import type { ChangeSet, Snapshot, Write } from "./repository";
import { generateDataset, SEED_VERSION } from "./seed";
import { plural } from "../lib/text";

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
  siteAddress: "Adres budowy",
  country: "Kraj",
  branch: "Oddział",
  color: "Kolor",
  startDate: "Start",
  endDate: "Koniec",
  status: "Status",
  projectManagerId: "Project Manager",
  installationManagerId: "Installation Manager",
  supervisorId: "Supervisor",
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
    if (d.to && d.to < d.from) throw new CommandError("Okres pracy kończy się przed startem.");
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
  const range = (from: ISODate, to: ISODate | null) => `${formatDate(from)} – ${to ? formatDate(to) : "koniec projektu"}`;
  const existing = snapshot.assignments.filter((a) => a.projectId === id);
  const teamChanges: { field: string; before: string; after: string }[] = [];
  for (const old of existing) {
    const draft = args.team.find((d) => d.id === old.id);
    if (!draft) {
      writes.push({ collection: "assignments", id: old.id, data: null });
      teamChanges.push({ field: name(old.employeeId), before: range(old.from, old.to), after: "usunięty z planu" });
    } else if (draft.from !== old.from || (draft.to ?? null) !== (old.to ?? null)) {
      writes.push({ collection: "assignments", id: old.id, data: strip({ ...old, from: draft.from, to: draft.to }) });
      teamChanges.push({ field: name(old.employeeId), before: range(old.from, old.to), after: range(draft.from, draft.to) });
    }
  }
  for (const draft of args.team.filter((d) => !d.id)) {
    const a: Assignment = { id: newId("a"), projectId: id, employeeId: draft.employeeId, from: draft.from, to: draft.to };
    writes.push({ collection: "assignments", id: a.id, data: strip(a) });
    teamChanges.push({ field: name(draft.employeeId), before: "—", after: range(draft.from, draft.to) });
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
  const a: Assignment = { id: newId("a"), projectId, employeeId, from, to: project.endDate };
  writes.push({ collection: "assignments", id: a.id, data: strip(a) });
  return {
    writes,
    audit: [audit(actor, "MEMBER_ASSIGNED", projectId, `Przypisano ${employee.name} do ${project.name} od ${formatDate(from)}`)],
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

/** Pełny wpis z jawnymi null — scalanie nie zostawia starych pól (np. powodu odrzucenia). */
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
    rejectionReason: e.rejectionReason ?? null,
    svApprovedBy: e.svApprovedBy ?? null,
    svApprovedAt: e.svApprovedAt ?? null,
    finalApprovedBy: e.finalApprovedBy ?? null,
    finalApprovedAt: e.finalApprovedAt ?? null,
    exported: e.exported ?? false,
    exportedAt: e.exportedAt ?? null,
  };
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
  if (prev && (prev.status === "SUPERVISOR_APPROVED" || prev.status === "PM_APPROVED" || prev.exported))
    throw new CommandError("Ten dzień jest już zatwierdzony i nie można go zmienić.");
  const entry: DayEntry = {
    kind: "WORK",
    status: "SUBMITTED",
    start: args.start,
    end: args.end,
    breakMin: args.breakMin,
    submittedAt: new Date().toISOString(),
  };
  return {
    writes: entryWrites([{ ...args, entry }]),
    audit: [
      audit(
        actor,
        "HOURS_SUBMITTED",
        args.projectId,
        `${prev ? "Poprawiono" : "Wpisano"} godziny: ${formatDay(args.date)}, ${formatMinutes(args.start)}–${formatMinutes(args.end)}, przerwa ${args.breakMin} min`
      ),
    ],
  };
}

export function reportAbsence(
  snapshot: Snapshot,
  actor: Actor,
  args: { employeeId: string; from: ISODate; to: ISODate; type: AbsenceType; note?: string }
): ChangeSet {
  if (args.to < args.from) throw new CommandError("Koniec nieobecności nie może być przed startem.");
  const items: { projectId: string; employeeId: string; date: ISODate; entry: DayEntry }[] = [];
  for (const date of eachDay(args.from, args.to)) {
    if (weekdayIndex(date) >= 5) continue;
    const a = snapshot.assignments.find(
      (x) => x.employeeId === args.employeeId && x.from <= date && (!x.to || x.to >= date)
    );
    const projectId = a?.projectId ?? snapshot.projects.find((p) => p.supervisorId === args.employeeId)?.id;
    if (!projectId) continue;
    const prev = currentEntry(snapshot, projectId, args.employeeId, date);
    if (prev && (prev.status === "SUPERVISOR_APPROVED" || prev.status === "PM_APPROVED" || prev.exported)) continue;
    items.push({
      projectId,
      employeeId: args.employeeId,
      date,
      entry: { kind: "ABSENCE", status: "SUBMITTED", absence: args.type, note: args.note ?? null, submittedAt: new Date().toISOString() },
    });
  }
  if (items.length === 0) throw new CommandError("W wybranym okresie nie ma dni roboczych w Twoich projektach do zgłoszenia.");
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

export function approve(snapshot: Snapshot, actor: Actor, items: QueueItem[]): ChangeSet {
  if (items.length === 0) throw new CommandError("Nic nie jest zaznaczone.");
  const now = new Date().toISOString();
  const updated = items.map((it) => {
    const status = approvedStatus(it.level);
    const entry: DayEntry =
      it.level === "team"
        ? { ...it.entry, status, svApprovedBy: actor.id, svApprovedAt: now, rejectionReason: null }
        : { ...it.entry, status, finalApprovedBy: actor.id, finalApprovedAt: now, rejectionReason: null };
    return { ...it, entry };
  });
  return { writes: entryWrites(updated), audit: summarize(snapshot, actor, "HOURS_APPROVED", "Zatwierdzono", items) };
}

export function reject(snapshot: Snapshot, actor: Actor, items: QueueItem[], reason: string): ChangeSet {
  if (items.length === 0) throw new CommandError("Nic nie jest zaznaczone.");
  if (!reason.trim()) throw new CommandError("Napisz powód odrzucenia — pracownik zobaczy go przy dniu.");
  const updated = items.map((it) => ({
    ...it,
    entry: { ...it.entry, status: "REJECTED" as const, rejectionReason: reason.trim(), svApprovedBy: null, svApprovedAt: null },
  }));
  return { writes: entryWrites(updated), audit: summarize(snapshot, actor, "HOURS_REJECTED", `Odrzucono (${reason.trim()})`, items) };
}

function summarize(snapshot: Snapshot, actor: Actor, action: AuditAction, verb: string, items: QueueItem[]): AuditEvent[] {
  const byProject = new Map<string, QueueItem[]>();
  items.forEach((it) => byProject.set(it.projectId, [...(byProject.get(it.projectId) ?? []), it]));
  return [...byProject.entries()].map(([projectId, list]) => {
    const people = [...new Set(list.map((i) => snapshot.employees.find((e) => e.id === i.employeeId)?.name ?? i.employeeId))];
    const minutes = list.reduce((s, i) => s + workedMinutes(i.entry), 0);
    const who = people.length > 3 ? `${people.slice(0, 3).join(", ")} i ${people.length - 3} innych` : people.join(", ");
    return audit(actor, action, projectId, `${verb} ${list.length} poz. (${formatHoursTotal(minutes)}): ${who}`);
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

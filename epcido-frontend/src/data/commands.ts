// Polecenia zmieniające dane. Każde zwraca ChangeSet: zapisy + wpis do dziennika zmian.
// Walidacja biznesowa jest tutaj, a nie w ekranach.

import { newId } from "../lib/random";
import { formatDate, todayISO } from "../lib/dates";
import { PROJECT_STATUS_LABEL } from "../domain/labels";
import type { Assignment, AuditAction, AuditEvent, Project, ProjectInput } from "../domain/types";
import type { ChangeSet, Snapshot, Write } from "./repository";
import { generateDataset, SEED_VERSION } from "./seed";

export interface Actor {
  id: string;
  name: string;
}

export class CommandError extends Error {}

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
  installationManagerId: "Installation Manager",
  supervisorId: "Supervisor",
  dataverseId: "Dataverse Id",
  dataverseNumber: "Dataverse Number",
};

export function validateProject(input: ProjectInput, snapshot: Snapshot, editingId?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.number.trim()) errors.number = "Podaj numer projektu.";
  else if (snapshot.projects.some((p) => p.number === input.number.trim() && p.id !== editingId))
    errors.number = "Projekt o tym numerze już istnieje.";
  if (!input.name.trim()) errors.name = "Podaj nazwę projektu.";
  if (!input.customerName.trim()) errors.customerName = "Podaj nazwę klienta.";
  if (!input.startDate) errors.startDate = "Wybierz datę startu.";
  if (input.endDate && input.startDate && input.endDate < input.startDate)
    errors.endDate = "Koniec nie może być przed startem.";
  if (!input.installationManagerId) errors.installationManagerId = "Wybierz Installation Managera.";
  if (!input.branch) errors.branch = "Wybierz oddział.";
  return errors;
}

function clean(input: ProjectInput): ProjectInput {
  return {
    ...input,
    number: input.number.trim(),
    name: input.name.trim(),
    customerName: input.customerName.trim(),
    customerOrderNo: input.customerOrderNo.trim(),
    siteAddress: input.siteAddress.trim(),
    country: input.country.trim(),
    dataverseId: input.dataverseId.trim(),
    dataverseNumber: input.dataverseNumber.trim(),
  };
}

export function createProject(snapshot: Snapshot, actor: Actor, input: ProjectInput): { id: string; changes: ChangeSet } {
  const errors = validateProject(input, snapshot);
  if (Object.keys(errors).length) throw new CommandError(Object.values(errors)[0]);
  const now = new Date().toISOString();
  const id = newId("p");
  const project: Project = { ...clean(input), id, createdAt: now, updatedAt: now };
  return {
    id,
    changes: {
      writes: [{ collection: "projects", id, data: strip(project) }],
      audit: [audit(actor, "PROJECT_CREATED", id, `Utworzono projekt ${project.name} (${project.number})`)],
    },
  };
}

export function updateProject(snapshot: Snapshot, actor: Actor, id: string, input: ProjectInput): ChangeSet {
  const current = snapshot.projects.find((p) => p.id === id);
  if (!current) throw new CommandError("Nie znaleziono projektu.");
  const errors = validateProject(input, snapshot, id);
  if (Object.keys(errors).length) throw new CommandError(Object.values(errors)[0]);

  const next: Project = { ...current, ...clean(input), updatedAt: new Date().toISOString() };
  const changes = (Object.keys(FIELD_LABELS) as (keyof ProjectInput)[])
    .filter((key) => (current[key] ?? "") !== (next[key] ?? ""))
    .map((key) => ({
      field: FIELD_LABELS[key]!,
      before: describeValue(snapshot, key, current[key]),
      after: describeValue(snapshot, key, next[key]),
    }));
  if (changes.length === 0) return { writes: [], audit: [] };

  return {
    writes: [{ collection: "projects", id, data: strip(next) }],
    audit: [audit(actor, "PROJECT_UPDATED", id, `Zmieniono dane projektu ${next.name}`, changes)],
  };
}

export function addMember(snapshot: Snapshot, actor: Actor, projectId: string, employeeId: string): ChangeSet {
  const project = snapshot.projects.find((p) => p.id === projectId);
  const employee = snapshot.employees.find((e) => e.id === employeeId);
  if (!project || !employee) throw new CommandError("Nie znaleziono projektu lub osoby.");
  if (snapshot.assignments.some((a) => a.employeeId === employeeId))
    throw new CommandError(`${employee.name} jest już w innym zespole. Użyj przeniesienia.`);
  const assignment: Assignment = { id: newId("a"), projectId, employeeId, since: todayISO() };
  return {
    writes: [{ collection: "assignments", id: assignment.id, data: strip(assignment) }],
    audit: [audit(actor, "MEMBER_ADDED", projectId, `Dodano ${employee.name} do zespołu ${project.name}`)],
  };
}

export function removeMember(snapshot: Snapshot, actor: Actor, assignmentId: string): ChangeSet {
  const a = snapshot.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new CommandError("To przypisanie już nie istnieje.");
  const employee = snapshot.employees.find((e) => e.id === a.employeeId);
  const project = snapshot.projects.find((p) => p.id === a.projectId);
  return {
    writes: [{ collection: "assignments", id: a.id, data: null }],
    audit: [
      audit(actor, "MEMBER_REMOVED", a.projectId, `Usunięto ${employee?.name ?? "osobę"} z zespołu ${project?.name ?? ""}`),
    ],
  };
}

export function moveMember(snapshot: Snapshot, actor: Actor, employeeId: string, toProjectId: string): ChangeSet {
  const from = snapshot.assignments.find((a) => a.employeeId === employeeId);
  const employee = snapshot.employees.find((e) => e.id === employeeId);
  const to = snapshot.projects.find((p) => p.id === toProjectId);
  if (!from || !employee || !to) throw new CommandError("Nie można przenieść tej osoby.");
  const fromProject = snapshot.projects.find((p) => p.id === from.projectId);
  const assignment: Assignment = { id: newId("a"), projectId: toProjectId, employeeId, since: todayISO() };
  const summary = `Przeniesiono ${employee.name} z ${fromProject?.name ?? "projektu"} do ${to.name}`;
  return {
    writes: [
      { collection: "assignments", id: from.id, data: null },
      { collection: "assignments", id: assignment.id, data: strip(assignment) },
    ],
    audit: [audit(actor, "MEMBER_MOVED", toProjectId, summary), audit(actor, "MEMBER_MOVED", from.projectId, summary)],
  };
}

export function loadTestData(actor: Actor): ChangeSet {
  const data = generateDataset(todayISO());
  const writes: Write[] = [
    ...data.employees.map((e) => ({ collection: "employees" as const, id: e.id, data: strip(e) })),
    ...data.projects.map((p) => ({ collection: "projects" as const, id: p.id, data: strip(p) })),
    ...data.assignments.map((a) => ({ collection: "assignments" as const, id: a.id, data: strip(a) })),
    ...data.timesheets.map((t) => ({ collection: "timesheets" as const, id: t.id, data: strip(t) })),
    { collection: "meta", id: "seed", data: { version: SEED_VERSION, loadedAt: new Date().toISOString() } },
  ];
  const summary = `Wgrano dane testowe: ${data.employees.length} osób, ${data.projects.length} projektów, ${data.timesheets.length} kart tygodniowych`;
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
  if (key === "installationManagerId" || key === "supervisorId")
    return snapshot.employees.find((e) => e.id === value)?.name ?? String(value);
  if (key === "startDate" || key === "endDate") return formatDate(String(value));
  if (key === "status") return PROJECT_STATUS_LABEL[value as Project["status"]];
  return String(value);
}

/** Usuwa pola undefined (Firestore ich nie przyjmuje) i zwraca zwykły obiekt. */
function strip(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

// Warstwa dostępu do danych — na razie localStorage (czysty prototyp frontendowy).
//
// WAŻNE: cały reszta aplikacji woła TYLKO funkcje z tego pliku, nigdy nie dotyka
// localStorage bezpośrednio. Dzięki temu, kiedy przejdziemy na Firebase (Firestore),
// zmieniamy WYŁĄCZNIE implementację poniższych funkcji — reszta kodu (ekrany, komponenty)
// zostaje bez zmian. To jest nasza przyszła granica integracji z backendem.

import type { Employee, Project, Assignment, TimeEntry, TimeEntryStatus, Trade } from "../types";
import { seedEmployees, seedProjects, seedAssignments, seedTimeEntries } from "../mock/seed";

const KEYS = {
  employees: "epcido_employees",
  projects: "epcido_projects",
  assignments: "epcido_assignments",
  timeEntries: "epcido_time_entries",
  currentUserId: "epcido_current_user_id",
} as const;

function load<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Jednorazowy zasiew danych testowych przy pierwszym uruchomieniu
export function ensureSeeded() {
  if (!localStorage.getItem(KEYS.employees)) save(KEYS.employees, seedEmployees);
  if (!localStorage.getItem(KEYS.projects)) save(KEYS.projects, seedProjects);
  if (!localStorage.getItem(KEYS.assignments)) save(KEYS.assignments, seedAssignments);
  if (!localStorage.getItem(KEYS.timeEntries)) save(KEYS.timeEntries, seedTimeEntries);
}

export function resetToSeed() {
  save(KEYS.employees, seedEmployees);
  save(KEYS.projects, seedProjects);
  save(KEYS.assignments, seedAssignments);
  save(KEYS.timeEntries, seedTimeEntries);
}

// ---------- Auth (symulowane logowanie — wybór roli) ----------

export function getCurrentUserId(): string | null {
  return localStorage.getItem(KEYS.currentUserId);
}

export function setCurrentUserId(id: string) {
  localStorage.setItem(KEYS.currentUserId, id);
}

export function logout() {
  localStorage.removeItem(KEYS.currentUserId);
}

export function getCurrentEmployee(): Employee | null {
  const id = getCurrentUserId();
  if (!id) return null;
  return getEmployees().find((e) => e.id === id) ?? null;
}

// ---------- Employees ----------

export function getEmployees(): Employee[] {
  return load(KEYS.employees, []);
}

export function getEmployee(id: string): Employee | undefined {
  return getEmployees().find((e) => e.id === id);
}

// ---------- Projects ----------

export function getProjects(): Project[] {
  return load(KEYS.projects, []);
}

export function getProject(id: string): Project | undefined {
  return getProjects().find((p) => p.id === id);
}

export function createProject(input: {
  name: string;
  customerName: string;
  siteAddress: string;
  pmId: string;
  supervisorIds: string[];
}): Project {
  const projects = getProjects();
  const project: Project = {
    id: `proj-${Date.now()}`,
    status: "ACTIVE",
    ...input,
  };
  save(KEYS.projects, [...projects, project]);
  return project;
}

// Projekty widoczne dla danego PM
export function getProjectsForPM(pmId: string): Project[] {
  return getProjects().filter((p) => p.pmId === pmId);
}

// Projekty, do których przypisany jest dany supervisor
export function getProjectsForSupervisor(svId: string): Project[] {
  return getProjects().filter((p) => p.supervisorIds.includes(svId));
}

// ---------- Assignments ----------

export function getAssignments(): Assignment[] {
  return load(KEYS.assignments, []);
}

export function getAssignmentsForProject(projectId: string): Assignment[] {
  return getAssignments().filter((a) => a.projectId === projectId);
}

export function getProjectsForEmployee(employeeId: string): Project[] {
  const projectIds = new Set(
    getAssignments()
      .filter((a) => a.employeeId === employeeId)
      .map((a) => a.projectId)
  );
  return getProjects().filter((p) => projectIds.has(p.id));
}

export function assignEmployee(projectId: string, employeeId: string, trade: Trade): Assignment {
  const assignments = getAssignments();
  // nie dubluj przypisania
  const existing = assignments.find((a) => a.projectId === projectId && a.employeeId === employeeId);
  if (existing) return existing;
  const assignment: Assignment = { id: `a-${Date.now()}`, projectId, employeeId, trade };
  save(KEYS.assignments, [...assignments, assignment]);
  return assignment;
}

export function removeAssignment(assignmentId: string) {
  save(
    KEYS.assignments,
    getAssignments().filter((a) => a.id !== assignmentId)
  );
}

// ---------- Time entries ----------

export function getTimeEntries(): TimeEntry[] {
  return load(KEYS.timeEntries, []);
}

export function getTimeEntriesForEmployee(employeeId: string): TimeEntry[] {
  return getTimeEntries()
    .filter((t) => t.employeeId === employeeId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function saveTimeEntries(entries: TimeEntry[]) {
  save(KEYS.timeEntries, entries);
}

export function submitTimeEntry(input: {
  employeeId: string;
  projectId: string;
  date: string;
  workStart: string;
  workEnd: string;
  breakMinutes: number;
  note?: string;
}): TimeEntry {
  const entries = getTimeEntries();
  const entry: TimeEntry = {
    id: `te-${Date.now()}`,
    status: "SUBMITTED",
    ...input,
  };
  saveTimeEntries([...entries, entry]);
  return entry;
}

// Wpisy czekające na akceptację danego supervisora (projekty, do których jest przypisany)
export function getPendingForSupervisor(svId: string): TimeEntry[] {
  const svProjectIds = new Set(getProjectsForSupervisor(svId).map((p) => p.id));
  return getTimeEntries().filter((t) => t.status === "SUBMITTED" && svProjectIds.has(t.projectId));
}

// Wpisy czekające na akceptację danego PM (zaakceptowane przez SV, w projektach PM)
export function getPendingForPM(pmId: string): TimeEntry[] {
  const pmProjectIds = new Set(getProjectsForPM(pmId).map((p) => p.id));
  return getTimeEntries().filter(
    (t) => t.status === "SUPERVISOR_APPROVED" && pmProjectIds.has(t.projectId)
  );
}

function updateEntryStatus(
  id: string,
  status: TimeEntryStatus,
  patch: Partial<TimeEntry> = {}
) {
  const entries = getTimeEntries().map((t) => (t.id === id ? { ...t, status, ...patch } : t));
  saveTimeEntries(entries);
}

export function supervisorApprove(entryId: string, approvedBy: string) {
  updateEntryStatus(entryId, "SUPERVISOR_APPROVED", {
    supervisorApprovedBy: approvedBy,
    supervisorApprovedAt: new Date().toISOString(),
  });
}

export function supervisorReject(entryId: string, reason: string) {
  updateEntryStatus(entryId, "REJECTED", { rejectionReason: reason });
}

export function pmApprove(entryId: string, approvedBy: string) {
  updateEntryStatus(entryId, "PM_APPROVED", {
    pmApprovedBy: approvedBy,
    pmApprovedAt: new Date().toISOString(),
  });
}

export function pmReject(entryId: string, reason: string) {
  updateEntryStatus(entryId, "REJECTED", { rejectionReason: reason });
}

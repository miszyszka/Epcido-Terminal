// Model domenowy — zgodny z PLAN_I_ARCHITEKTURA.md (sekcje 3 i 9).
// Rola dostępu (co ktoś może w systemie) jest rozdzielona od stanowiska (kim jest na budowie).

import type { ISODate } from "../lib/dates";

export type AccessRole = "ADMIN" | "PLANNING" | "INSTALLATION_MANAGER" | "SUPERVISOR" | "WORKER";

export type Position =
  | "PLANNER"
  | "INSTALLATION_MANAGER"
  | "SUPERVISOR"
  | "TEAM_LEADER"
  | "ELECTRICIAN"
  | "MECHANIC";

export type Trade = "ELECTRICAL" | "MECHANICAL";

export interface Employee {
  id: string;
  name: string;
  role: AccessRole;
  position: Position;
  /** Branża — dla Team Leaderów, elektryków i mechaników */
  trade?: Trade;
  /** Numer pracownika z Enovy (przez Dataverse) — wypełni integracja */
  enovaNumber?: string;
  active: boolean;
}

export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "CLOSED";

export interface Project {
  id: string;
  number: string;
  name: string;
  customerName: string;
  customerOrderNo: string;
  siteAddress: string;
  country: string;
  branch: string;
  /** Kolor identyfikacyjny z palety projektów (brandbook 2.4) */
  color: string;
  startDate: ISODate;
  endDate: ISODate | null;
  status: ProjectStatus;
  installationManagerId: string | null;
  supervisorId: string | null;
  /** Pola integracyjne — zmiana wpływa na połączenie z Business Central */
  dataverseId: string;
  dataverseNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;

/** Przypisanie osoby (TL, elektryk, mechanik) do projektu. Supervisor i IM są w samym projekcie. */
export interface Assignment {
  id: string;
  projectId: string;
  employeeId: string;
  since: ISODate;
}

export type EntryStatus = "SUBMITTED" | "SUPERVISOR_APPROVED" | "PM_APPROVED" | "REJECTED";
export type EntryKind = "WORK" | "ABSENCE";
export type AbsenceType = "SICK" | "LEAVE";

/** Jeden dzień jednej osoby. Godziny w minutach od północy — jak w API Gantbee. */
export interface DayEntry {
  kind: EntryKind;
  status: EntryStatus;
  start?: number;
  end?: number;
  breakMin?: number;
  absence?: AbsenceType;
}

/** Karta tygodnia projektu: id = `${projectId}_${weekStart}` */
export interface Timesheet {
  id: string;
  projectId: string;
  weekStart: ISODate;
  /** employeeId → data → wpis */
  days: Record<string, Record<ISODate, DayEntry>>;
}

export type AuditAction =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "MEMBER_MOVED"
  | "TEST_DATA_LOADED"
  | "TEST_DATA_CLEARED";

/** Wpis dziennika zmian — tylko dopisywanie, nigdy edycja ani usuwanie. */
export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  projectId: string | null;
  summary: string;
  changes?: { field: string; before: string; after: string }[];
}

export interface Dataset {
  employees: Employee[];
  projects: Project[];
  assignments: Assignment[];
  timesheets: Timesheet[];
}

export type DayState = "approved" | "pending" | "absent" | "off";

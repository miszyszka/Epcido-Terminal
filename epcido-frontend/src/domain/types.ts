// Model domenowy — zgodny z PLAN_I_ARCHITEKTURA.md (sekcje 3 i 9).
// Rola dostępu (co ktoś może w systemie) jest rozdzielona od stanowiska (kim jest na budowie).

import type { ISODate } from "../lib/dates";

export type AccessRole =
  | "ADMIN"
  | "PLANNING"
  | "PROJECT_MANAGER"
  | "INSTALLATION_MANAGER"
  | "SUPERVISOR"
  | "WORKER";

export type Position =
  | "ADMIN"
  | "PLANNER"
  | "PROJECT_MANAGER"
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
  projectManagerId: string | null;
  installationManagerId: string | null;
  supervisorId: string | null;
  /** Pola integracyjne — zmiana wpływa na połączenie z Business Central */
  dataverseId: string;
  dataverseNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;

/**
 * Przypisanie osoby (TL, elektryk, mechanik) do projektu na okres od–do.
 * Ta sama osoba może mieć kolejne przypisania w różnych projektach.
 * Supervisor, IM i PM są wskazani w samym projekcie.
 */
export interface Assignment {
  id: string;
  projectId: string;
  employeeId: string;
  from: ISODate;
  /** null = do końca projektu */
  to: ISODate | null;
}

export type EntryStatus = "SUBMITTED" | "SUPERVISOR_APPROVED" | "PM_APPROVED" | "REJECTED";
export type EntryKind = "WORK" | "ABSENCE";
export type AbsenceType = "SICK" | "LEAVE" | "OTHER";

/** Jeden dzień jednej osoby. Godziny w minutach od północy — jak w API Gantbee. */
export interface DayEntry {
  kind: EntryKind;
  status: EntryStatus;
  start?: number | null;
  end?: number | null;
  breakMin?: number | null;
  absence?: AbsenceType | null;
  note?: string | null;
  submittedAt?: string | null;
  rejectionReason?: string | null;
  svApprovedBy?: string | null;
  svApprovedAt?: string | null;
  finalApprovedBy?: string | null;
  finalApprovedAt?: string | null;
  /** Wysłane do Dataverse (wtorek 23:00) */
  exported?: boolean;
  exportedAt?: string | null;
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
  | "TEAM_PLANNED"
  | "MEMBER_ASSIGNED"
  | "HOURS_SUBMITTED"
  | "ABSENCE_REPORTED"
  | "HOURS_APPROVED"
  | "HOURS_REJECTED"
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

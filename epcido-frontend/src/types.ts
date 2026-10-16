// Domproperties modelu — zgodne z PLAN_I_ARCHITEKTURA.md (sekcja 3 i 9)
// Role: Admin > Planning, PM > Supervisor > Pracownik/TeamLeader (ten sam poziom dostępu)

export type Role = "ADMIN" | "PLANNING" | "PM" | "SUPERVISOR" | "WORKER";

export type Trade = "ELECTRICIAN" | "MECHANIC";

export interface Employee {
  id: string;
  name: string;
  role: Role;
  trade?: Trade; // tylko dla WORKER/SUPERVISOR na budowie
  // Dla PM: lista ID supervisorów, którzy mu podlegają (do akceptacji zbiorczej)
  // Dla Supervisora: lista ID projektów, do których jest przypisany
}

export interface Project {
  id: string;
  name: string;
  customerName: string;
  siteAddress: string;
  pmId: string; // Project Manager odpowiedzialny za projekt
  supervisorIds: string[]; // 1+ supervisorów przypisanych do projektu
  status: "ACTIVE" | "CLOSED";
}

export interface Assignment {
  id: string;
  projectId: string;
  employeeId: string;
  trade: Trade; // podział mechanik/elektryk wymagany przez Planning
}

export type TimeEntryStatus =
  | "DRAFT" // pracownik jeszcze edytuje
  | "SUBMITTED" // wysłane, czeka na supervisora
  | "SUPERVISOR_APPROVED" // zaakceptowane przez SV, czeka na PM
  | "PM_APPROVED" // zaakceptowane przez PM — gotowe do eksportu
  | "REJECTED"; // odrzucone, pracownik musi poprawić

export interface TimeEntry {
  id: string;
  employeeId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  workStart: string; // "07:00"
  workEnd: string; // "18:00"
  breakMinutes: number;
  note?: string;
  status: TimeEntryStatus;
  rejectionReason?: string;
  supervisorApprovedBy?: string;
  supervisorApprovedAt?: string;
  pmApprovedBy?: string;
  pmApprovedAt?: string;
}

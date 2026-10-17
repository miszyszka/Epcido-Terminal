// Model domenowy — zgodny z PLAN_I_ARCHITEKTURA.md (sekcje 3 i 9).
// Rola dostępu (co ktoś może w systemie) jest rozdzielona od stanowiska (kim jest w projekcie).

import type { ISODate } from "../lib/dates";

export type AccessRole =
  | "ADMIN"
  | "PLANNING"
  | "PROJECT_MANAGER"
  | "INSTALLATION_MANAGER"
  | "SUPERVISOR"
  | "HR"
  | "WORKER"
  /** Własny zestaw funkcji — administrator zaznacza uprawnienia ręcznie */
  | "CUSTOM";

export type Position =
  | "ADMIN"
  | "PLANNER"
  | "PROJECT_MANAGER"
  | "INSTALLATION_MANAGER"
  | "SUPERVISOR"
  | "TEAM_LEADER"
  | "ELECTRICIAN"
  | "MECHANIC"
  | "HR"
  /** Biuro: controlling, kadry, księgowość — użytkownicy dodani przez administratora */
  | "OFFICE";

export type Trade = "ELECTRICAL" | "MECHANICAL";

/**
 * Kategoria projektu = system, który montujemy. Lista jest w ustawieniach systemu
 * (domyślnie KNAPP, KARDEX, FORTNA, OTHER) — administrator może dodać kolejne.
 */
export type ProjectCategory = string;

/** Forma zatrudnienia. UoP i B2B to „EPCIDO" (nasi), agencja — pracownicy z agencji. */
export type Employment = "UOP" | "B2B" | "AGENCY";

/** Doświadczenie w miesiącach: łącznie i w projektach danej kategorii. */
export interface Experience {
  totalMonths: number;
  byCategory: Record<ProjectCategory, number>;
}

export interface Employee {
  id: string;
  name: string;
  role: AccessRole;
  position: Position;
  /** Branża — dla Team Leaderów, elektryków i mechaników */
  trade?: Trade;
  /** Numer pracownika z Enovy (przez Dataverse) — wypełni integracja */
  enovaNumber?: string;
  /** Forma zatrudnienia — pracownicy w projektach */
  employment?: Employment;
  experience?: Experience;
  active: boolean;
  /** Konto w systemie */
  email?: string | null;
  /** Uprawnienia dodane ponad rolę (administrator, ekran Użytkownicy) */
  grants?: string[];
  /** Uprawnienia roli odebrane tej osobie */
  revokes?: string[];
  createdAt?: string;
}

export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "CLOSED";

/** Faza zapotrzebowania: ilu ludzi potrzeba w danym okresie (razem z Team Leaderami danej branży). Wpisuje PM. */
export interface DemandPhase {
  id: string;
  from: ISODate;
  to: ISODate;
  electricians: number;
  mechanics: number;
}

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
  category: ProjectCategory;
  /** Zapotrzebowanie w czasie (fazy). Wpisuje PM, korzysta Planning w Obsadzie. */
  demand: DemandPhase[];
  /** Pola integracyjne — zmiana wpływa na połączenie z Business Central */
  dataverseId: string;
  dataverseNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;

/**
 * Zadanie osoby (TL, elektryk, mechanik) w projekcie na okres od–do — kafelek na planie zespołu.
 * Osoba może mieć kilka zadań w jednym projekcie; przerwa między nimi = brak zadania = brak wpisu godzin.
 * Ta sama osoba może mieć kolejne zadania w różnych projektach.
 * Supervisor, IM i PM są wskazani w samym projekcie.
 */
export interface Assignment {
  id: string;
  projectId: string;
  employeeId: string;
  from: ISODate;
  /** null = do końca projektu */
  to: ISODate | null;
  /** Nazwa zadania, np. „Prace elektryczne" (w Gantbee: taskname) */
  task?: string | null;
}

export type EntryStatus = "SUBMITTED" | "SUPERVISOR_APPROVED" | "PM_APPROVED";
export type EntryKind = "WORK" | "ABSENCE";
export type AbsenceType = "SICK" | "LEAVE" | "OTHER";

/** Ślad zmiany wpisu: kto, kiedy, co zmienił. Tylko dopisywanie. */
export interface EntryChange {
  at: string;
  byId: string;
  byName: string;
  text: string;
}

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
  svApprovedBy?: string | null;
  svApprovedAt?: string | null;
  finalApprovedBy?: string | null;
  finalApprovedAt?: string | null;
  /** Wysłane do Dataverse (wtorek 23:00) */
  exported?: boolean;
  exportedAt?: string | null;
  /** Notatka zmian: poprawki pracownika i zmiany osób zatwierdzających */
  history?: EntryChange[] | null;
  /** Dzień nieobecności z wniosku urlopowego (urlop, L4, inna) — zatwierdzony razem z wnioskiem */
  leaveId?: string | null;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/**
 * Wniosek o nieobecność: urlop, L4 albo inna. Urlop i inną akceptuje supervisor albo Installation Manager
 * projektu, w którym osoba wtedy pracuje, albo HR (kto dokładnie — uprawnienia u administratora).
 * L4 obowiązuje od zgłoszenia; HR potwierdza dokument.
 * Zaakceptowany wniosek wpisuje dni nieobecności do timesheetów (zatwierdzone).
 */
export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: AbsenceType;
  from: ISODate;
  to: ISODate;
  note?: string | null;
  status: LeaveStatus;
  createdAt: string;
  createdById: string;
  createdByName: string;
  decidedAt?: string | null;
  decidedById?: string | null;
  decidedByName?: string | null;
  /** Powód odrzucenia albo cofnięcia */
  decisionNote?: string | null;
  /** L4: HR potwierdził dokument */
  confirmedAt?: string | null;
  confirmedById?: string | null;
  confirmedByName?: string | null;
}

/** Ustawienia systemu (administrator). Zapisane w meta/settings. */
export interface SystemSettings {
  /** Termin zatwierdzania: dzień po początku tygodnia (7 = poniedziałek następnego tygodnia) */
  approveDayOffset: number;
  /** Godzina terminu, np. „23:59" */
  approveTime: string;
  /** Wysyłka do Dataverse: dzień po początku tygodnia (8 = wtorek następnego tygodnia) */
  exportDayOffset: number;
  exportTime: string;
  categories: string[];
  branches: string[];
  /** Minimalny udział EPCIDO (UoP + B2B) na projekcie, w procentach */
  minEpcidoShare: number;
  /** Krótsza luka nie jest przerwą na wyjazd do domu (dni) */
  breakMinDays: number;
  /** Od tylu tygodni ciągłej pracy pokazujemy „długo bez przerwy" */
  longStretchWeeks: number;
}

/**
 * Timesheet = wszystkie godziny wszystkich osób w jednym projekcie w jednym tygodniu.
 * W każdym tygodniu jest tyle timesheetów, ile projektów. id = `${projectId}_${weekStart}`
 */
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
  | "HOURS_EDITED"
  | "MEMBER_REMOVED"
  | "LEAVE_REQUESTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED"
  | "LEAVE_CONFIRMED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "SETTINGS_UPDATED"
  | "REPORT_EXPORTED"
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
  leaves: LeaveRequest[];
}

/**
 * Stan dnia na siatkach:
 *  approved — zatwierdzone przez supervisora (lub dalej),
 *  pending  — do zatwierdzenia,
 *  absent   — nieobecny,
 *  off      — wolne / brak wpisu,
 *  missed   — błąd w zamkniętym timesheecie (brak zatwierdzenia albo brak wpisu): timesheet nie został wysłany,
 *             poprawia tylko administrator.
 */
export type DayState = "approved" | "pending" | "absent" | "off" | "missed";

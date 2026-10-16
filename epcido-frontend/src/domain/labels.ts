import type { AbsenceType, AccessRole, DayEntry, DayState, Position, ProjectStatus, Trade } from "./types";

export const POSITION_LABEL: Record<Position, string> = {
  ADMIN: "Administrator",
  PLANNER: "Planista",
  PROJECT_MANAGER: "Project Manager",
  INSTALLATION_MANAGER: "Installation Manager",
  SUPERVISOR: "Supervisor",
  TEAM_LEADER: "Team Leader",
  ELECTRICIAN: "Elektryk",
  MECHANIC: "Mechanik",
};

export const POSITION_SHORT: Record<Position, string> = {
  ADMIN: "AD",
  PLANNER: "PL",
  PROJECT_MANAGER: "PM",
  INSTALLATION_MANAGER: "IM",
  SUPERVISOR: "SV",
  TEAM_LEADER: "TL",
  ELECTRICIAN: "E",
  MECHANIC: "M",
};

export const ROLE_LABEL: Record<AccessRole, string> = {
  ADMIN: "Administrator",
  PLANNING: "Planning",
  PROJECT_MANAGER: "Project Manager",
  INSTALLATION_MANAGER: "Installation Manager",
  SUPERVISOR: "Supervisor",
  WORKER: "Pracownik",
};

export const TRADE_LABEL: Record<Trade, string> = {
  ELECTRICAL: "elektryka",
  MECHANICAL: "mechanika",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planowany",
  ACTIVE: "W realizacji",
  ON_HOLD: "Wstrzymany",
  CLOSED: "Zakończony",
};

export const DAY_STATE_LABEL: Record<DayState, string> = {
  approved: "Zatwierdzone",
  pending: "Do zatwierdzenia",
  absent: "Nieobecny",
  off: "Wolne lub brak wpisu",
  missed: "Nie wysłane do Dataverse",
};

export const ABSENCE_LABEL: Record<AbsenceType, string> = {
  SICK: "Zwolnienie lekarskie",
  LEAVE: "Urlop",
  OTHER: "Inna nieobecność",
};

export const ABSENCE_SHORT: Record<AbsenceType, string> = {
  SICK: "L4",
  LEAVE: "Urlop",
  OTHER: "Inna",
};

export const BRANCHES = ["Polska", "Wielka Brytania", "Niemcy", "Beneluks", "Skandynawia", "Francja", "Czechy"];

/**
 * Kolory identyfikacyjne projektów — brandbook 2.4. Rozstawione po całym kole barw, o podobnej jasności,
 * żeby projekty dało się odróżnić na pierwszy rzut oka. Celowo bez żółci i czerwieni stanów dnia.
 */
export const PROJECT_COLORS = [
  { value: "#2F6FA3", name: "Kobalt" },
  { value: "#1E9A8A", name: "Morski" },
  { value: "#6A9A2E", name: "Oliwka" },
  { value: "#7B4FB8", name: "Fiolet" },
  { value: "#C24C8C", name: "Malina" },
  { value: "#D9822B", name: "Pomarańcz" },
  { value: "#3B4FC4", name: "Indygo" },
  { value: "#2C8FC9", name: "Lazur" },
  { value: "#8C5A3C", name: "Orzech" },
  { value: "#A33D5E", name: "Wino" },
  { value: "#4F6B7A", name: "Grafit" },
  { value: "#9A8A1F", name: "Musztarda" },
];

/** Domyślna nazwa zadania według branży (w Gantbee: taskname). */
export function defaultTask(trade: Trade | undefined): string {
  return trade === "MECHANICAL" ? "Prace mechaniczne" : "Prace elektryczne";
}

export const TASK_SUGGESTIONS = [
  "Prace elektryczne",
  "Prace mechaniczne",
  "Prefabrykacja",
  "Montaż tras kablowych",
  "Podłączenia",
  "Uruchomienie",
  "Testy i odbiory",
  "Serwis",
  "Szkolenie",
];

/** Przepracowane minuty w dniu (bez przerwy). */
export function workedMinutes(entry: DayEntry | undefined): number {
  if (!entry || entry.kind !== "WORK" || entry.start == null || entry.end == null) return 0;
  return Math.max(0, entry.end - entry.start - (entry.breakMin ?? 0));
}

/** 570 → „9 h 30 min", 600 → „10 h" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Suma godzin do wyświetlenia w liczbach: 18 720 min → „312 h" */
export function formatHoursTotal(min: number): string {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
}

import { formatMinutes } from "../lib/dates";
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

/** Kolory identyfikacyjne projektów — brandbook 2.4. Nie mylić z kolorami stanów. */
export const PROJECT_COLORS = [
  { value: "#5B7A99", name: "Łupek" },
  { value: "#7FA7C9", name: "Niebo" },
  { value: "#8C6A8D", name: "Śliwka" },
  { value: "#A9A1C7", name: "Lawenda" },
  { value: "#A39B8B", name: "Kamień" },
  { value: "#3E5368", name: "Granat" },
  { value: "#9DB3B0", name: "Mgła" },
  { value: "#6F7F96", name: "Stal" },
];

export function dayStateOf(entry: DayEntry | undefined): DayState {
  if (!entry) return "off";
  if (entry.kind === "ABSENCE") return "absent";
  if (entry.status === "SUPERVISOR_APPROVED" || entry.status === "PM_APPROVED") return "approved";
  return "pending";
}

export function statusLabel(entry: DayEntry | undefined): string {
  if (!entry) return DAY_STATE_LABEL.off;
  if (entry.exported) return "Wysłane do Dataverse";
  switch (entry.status) {
    case "PM_APPROVED":
      return "Zatwierdzone przez supervisora i IM";
    case "SUPERVISOR_APPROVED":
      return "Zatwierdzone przez supervisora";
    case "REJECTED":
      return "Odrzucone, do poprawy";
    default:
      return "Do zatwierdzenia";
  }
}

/** Opis dnia do dymka: godziny, przerwa, powód nieobecności, stan. */
export function describeEntry(entry: DayEntry | undefined): string {
  if (!entry) return DAY_STATE_LABEL.off;
  const lines: string[] = [];
  if (entry.kind === "ABSENCE") {
    lines.push(`Nieobecny: ${ABSENCE_LABEL[entry.absence ?? "OTHER"].toLowerCase()}`);
  } else if (entry.start != null && entry.end != null) {
    lines.push(`${formatMinutes(entry.start)}–${formatMinutes(entry.end)}, przerwa ${entry.breakMin ?? 0} min`);
  }
  lines.push(statusLabel(entry));
  if (entry.status === "REJECTED" && entry.rejectionReason) lines.push(`Powód: ${entry.rejectionReason}`);
  return lines.join("\n");
}

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

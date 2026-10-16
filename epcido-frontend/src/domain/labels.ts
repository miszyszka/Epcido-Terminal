import type { DayEntry, DayState, Position, ProjectStatus, Trade } from "./types";

export const POSITION_LABEL: Record<Position, string> = {
  PLANNER: "Planista",
  INSTALLATION_MANAGER: "Installation Manager",
  SUPERVISOR: "Supervisor",
  TEAM_LEADER: "Team Leader",
  ELECTRICIAN: "Elektryk",
  MECHANIC: "Mechanik",
};

export const POSITION_SHORT: Record<Position, string> = {
  PLANNER: "PL",
  INSTALLATION_MANAGER: "IM",
  SUPERVISOR: "SV",
  TEAM_LEADER: "TL",
  ELECTRICIAN: "E",
  MECHANIC: "M",
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
  pending: "Czeka na zatwierdzenie",
  absent: "Nieobecny",
  off: "Wolne lub brak wpisu",
};

export const BRANCHES = [
  "Polska",
  "Wielka Brytania",
  "Niemcy",
  "Beneluks",
  "Skandynawia",
  "Francja",
  "Czechy",
];

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

export function describeEntry(entry: DayEntry | undefined): string {
  if (!entry) return DAY_STATE_LABEL.off;
  if (entry.kind === "ABSENCE") {
    return entry.absence === "LEAVE" ? "Nieobecny: urlop" : "Nieobecny: zwolnienie lekarskie";
  }
  const hours =
    entry.start !== undefined && entry.end !== undefined
      ? `${fmt(entry.start)}–${fmt(entry.end)}, przerwa ${entry.breakMin ?? 0} min`
      : "";
  const who =
    entry.status === "PM_APPROVED"
      ? "Zatwierdzone przez supervisora i IM"
      : entry.status === "SUPERVISOR_APPROVED"
        ? "Zatwierdzone przez supervisora"
        : entry.status === "REJECTED"
          ? "Odrzucone, do poprawy"
          : "Czeka na zatwierdzenie";
  return hours ? `${who}\n${hours}` : who;
}

function fmt(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/** Przepracowane minuty w dniu (bez przerwy). */
export function workedMinutes(entry: DayEntry | undefined): number {
  if (!entry || entry.kind !== "WORK" || entry.start === undefined || entry.end === undefined) return 0;
  return Math.max(0, entry.end - entry.start - (entry.breakMin ?? 0));
}

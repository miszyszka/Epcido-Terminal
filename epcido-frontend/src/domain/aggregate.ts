// Liczby zbiorcze projektu do nagłówków kart.

import type { Model } from "../app/DataContext";
import type { ISODate } from "../lib/dates";
import { countTimesheets, isFinal, isLocked, isSent } from "./workflow";

export interface ProjectStats {
  /** Timesheety czekające na zatwierdzenie (na dowolnym poziomie, przed terminem) */
  pending: number;
  /** Timesheety nie zatwierdzone na czas — nie wysłane do Dataverse */
  missed: number;
  absences: number;
  /** Ostatni dzień wysłany do Dataverse */
  lastSent: ISODate | null;
}

export function projectStats(model: Model, projectId: string, now: Date, from?: ISODate, to?: ISODate): ProjectStats {
  const pending: { projectId: string; employeeId: string; date: ISODate }[] = [];
  const missed: typeof pending = [];
  let absences = 0;
  let lastSent: ISODate | null = null;
  for (const [employeeId, days] of model.entries.get(projectId) ?? []) {
    for (const [date, entry] of days) {
      if (entry.kind === "ABSENCE" && (!from || date >= from) && (!to || date <= to)) absences++;
      if (isSent(date, entry, now)) {
        if (!lastSent || date > lastSent) lastSent = date;
        continue;
      }
      if (isFinal(entry)) continue;
      if (isLocked(date, entry, now)) missed.push({ projectId, employeeId, date });
      else pending.push({ projectId, employeeId, date });
    }
  }
  return { pending: countTimesheets(pending), missed: countTimesheets(missed), absences, lastSent };
}

// Liczby zbiorcze projektu do nagłówków kart.

import type { Model } from "../app/DataContext";
import { workedMinutes } from "./labels";
import type { ISODate } from "../lib/dates";

export interface ProjectStats {
  /** Wpisy czekające na zatwierdzenie (na dowolnym poziomie) */
  pending: number;
  pendingMinutes: number;
  rejected: number;
  absences: number;
  /** Ostatni dzień wysłany do Dataverse */
  lastSent: ISODate | null;
}

export function projectStats(model: Model, projectId: string, from?: ISODate, to?: ISODate): ProjectStats {
  const s: ProjectStats = { pending: 0, pendingMinutes: 0, rejected: 0, absences: 0, lastSent: null };
  for (const [, days] of model.entries.get(projectId) ?? []) {
    for (const [date, entry] of days) {
      if (entry.exported) {
        if (!s.lastSent || date > s.lastSent) s.lastSent = date;
        continue;
      }
      if (entry.status === "REJECTED") s.rejected++;
      else if (entry.status === "SUBMITTED" || entry.status === "SUPERVISOR_APPROVED") {
        s.pending++;
        s.pendingMinutes += workedMinutes(entry);
      }
      if (entry.kind === "ABSENCE" && (!from || date >= from) && (!to || date <= to)) s.absences++;
    }
  }
  return s;
}

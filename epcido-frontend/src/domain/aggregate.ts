// Liczby zbiorcze projektu do nagłówków kart.

import type { Model } from "../app/DataContext";
import { addDays, startOfWeek, toISO, type ISODate } from "../lib/dates";
import { oursShare } from "./staffing";
import { sheetsFor } from "./timesheets";
import { countTimesheets, isFinal, isWeekClosed } from "./workflow";

export interface ProjectStats {
  /** Otwarte timesheety (projekt × tydzień) z czymś do zatwierdzenia */
  pending: number;
  /** Tygodnie, których timesheet został wstrzymany (nie wysłany) */
  withheldWeeks: ISODate[];
  absences: number;
  /** Ostatni dzień tygodnia wysłanego do Dataverse */
  lastSent: ISODate | null;
  /** Ludzie dziś: nasi (UoP, B2B) i agencja */
  ours: number;
  agency: number;
}

export function projectStats(model: Model, projectId: string, now: Date, from?: ISODate, to?: ISODate): ProjectStats {
  const pending: { projectId: string; date: ISODate }[] = [];
  let absences = 0;
  for (const [, days] of model.entries.get(projectId) ?? []) {
    for (const [date, entry] of days) {
      if (entry.kind === "ABSENCE" && (!from || date >= from) && (!to || date <= to)) absences++;
      if (!isFinal(entry) && !isWeekClosed(date, now)) pending.push({ projectId, date });
    }
  }
  const sheets = sheetsFor(model, now);
  const withheldWeeks = sheets.withheld([projectId]).map((s) => s.week);
  let lastSent: ISODate | null = null;
  for (let i = 1; i <= 12 && !lastSent; i++) {
    const week = addDays(startOfWeek(toISO(now)), -7 * i);
    if (sheets.get(projectId, week)?.status === "sent") lastSent = addDays(week, 6);
  }
  const team = model.team(projectId);
  const share = oursShare(model, (team?.members ?? []).map((m) => m.id));
  return { pending: countTimesheets(pending), withheldWeeks, absences, lastSent, ours: share.ours, agency: share.agency };
}

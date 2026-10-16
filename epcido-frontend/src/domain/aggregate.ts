// Zbiorczy stan dnia projektu — reguła z brandbooka (2.3):
// czeka, jeśli choć jeden wpis czeka → zatwierdzony, jeśli ktoś pracował →
// nieobecny, jeśli wszyscy z wpisem byli nieobecni → inaczej wolne.

import type { Model, Team } from "../app/DataContext";
import { dayStateOf } from "./labels";
import type { DayState } from "./types";

export interface ProjectDay {
  state: DayState;
  approved: number;
  pending: number;
  absent: number;
  /** Ktoś był nieobecny w dniu, który poza tym jest zatwierdzony lub czeka */
  hasAbsence: boolean;
}

export function teamPeopleIds(team: Team): string[] {
  return [...(team.supervisor ? [team.supervisor.id] : []), ...team.members.map((m) => m.id)];
}

export function projectDay(model: Model, projectId: string, peopleIds: string[], date: string): ProjectDay {
  let approved = 0;
  let pending = 0;
  let absent = 0;
  for (const id of peopleIds) {
    const s = dayStateOf(model.entry(projectId, id, date));
    if (s === "approved") approved++;
    else if (s === "pending") pending++;
    else if (s === "absent") absent++;
  }
  const state: DayState = pending > 0 ? "pending" : approved > 0 ? "approved" : absent > 0 ? "absent" : "off";
  return { state, approved, pending, absent, hasAbsence: absent > 0 && state !== "absent" };
}

export function describeProjectDay(d: ProjectDay): string {
  if (d.approved + d.pending + d.absent === 0) return "Brak wpisów";
  const parts: string[] = [];
  if (d.approved) parts.push(`zatwierdzone: ${d.approved}`);
  if (d.pending) parts.push(`czeka: ${d.pending}`);
  if (d.absent) parts.push(`nieobecni: ${d.absent}`);
  return parts.join(", ");
}

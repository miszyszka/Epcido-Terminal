// Urlopy i nieobecności (ADR 0011): co zmienia zaakceptowanie wniosku w obsadzie projektów.

import type { Model } from "../app/DataContext";
import { addDays, startOfWeek, type ISODate } from "../lib/dates";
import { leaveProjects } from "./permissions";
import { leaveInWeek, weeklyStaffing } from "./staffing";
import type { Employee, LeaveRequest, Project, Trade } from "./types";

export interface LeaveImpact {
  project: Project;
  trade: Trade | null;
  /** Najsłabszy tydzień wniosku */
  week: ISODate;
  need: number | null;
  /** Obecni tej branży (bez innych urlopów) przed i po akceptacji */
  before: number;
  after: number;
  /** Inni z projektu z urlopem albo wnioskiem w tym czasie */
  others: { employee: Employee; leave: LeaveRequest }[];
}

/** Wpływ wniosku na projekty, w których osoba wtedy pracuje: ilu zostaje w najsłabszym tygodniu i kto jeszcze ma wolne. */
export function leaveImpact(model: Model, leave: LeaveRequest): LeaveImpact[] {
  const employee = model.employeeById.get(leave.employeeId);
  const trade = employee?.trade ?? null;
  const weeks: ISODate[] = [];
  for (let w = startOfWeek(leave.from); w <= leave.to; w = addDays(w, 7)) weeks.push(w);
  return leaveProjects(model, leave).map((project) => {
    const staffing = weeklyStaffing(model, project, weeks);
    let worst: { week: ISODate; need: number | null; before: number; after: number } | null = null;
    for (const s of staffing) {
      const assigned = trade === "MECHANICAL" ? s.mechanical : s.electrical;
      const away = trade === "MECHANICAL" ? s.leaveMechanical : s.leaveElectrical;
      const need = s.needDefined ? (trade === "MECHANICAL" ? s.needMechanical : s.needElectrical) : null;
      const counted = leave.status === "APPROVED" && leaveInWeek(model, leave.employeeId, s.week)?.id === leave.id;
      const before = assigned - away + (counted ? 1 : 0);
      const takesWeek = Boolean(leaveInWeek(model, leave.employeeId, s.week)) || counted;
      const after = before - (takesWeek ? 1 : 0);
      if (!worst || after - (need ?? 0) < worst.after - (worst.need ?? 0)) worst = { week: s.week, need, before, after };
    }
    const teamIds = new Set((model.assignmentsByProject.get(project.id) ?? []).map((a) => a.employeeId));
    const others = model.leaves
      .filter(
        (l) =>
          l.id !== leave.id &&
          l.employeeId !== leave.employeeId &&
          teamIds.has(l.employeeId) &&
          (l.status === "APPROVED" || l.status === "PENDING") &&
          l.from <= leave.to &&
          l.to >= leave.from
      )
      .map((l) => ({ employee: model.employeeById.get(l.employeeId)!, leave: l }))
      .filter((o) => o.employee);
    return { project, trade: project.supervisorId === leave.employeeId ? null : trade, ...(worst ?? { week: weeks[0], need: null, before: 0, after: 0 }), others };
  });
}

/** Wnioski w zakresie osoby: HR i „kalendarz wszystkich" — wszystkie; supervisor, IM, PM — ludzie z ich projektów. */
export function leavesInScope(model: Model, user: Employee, all: boolean): LeaveRequest[] {
  if (all) return model.leaves;
  const mine = new Set(
    model.projects.filter((p) => p.supervisorId === user.id || p.installationManagerId === user.id || p.projectManagerId === user.id).map((p) => p.id)
  );
  return model.leaves.filter((l) => leaveProjects(model, l).some((p) => mine.has(p.id)));
}

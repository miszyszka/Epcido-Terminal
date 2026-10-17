// Uprawnienia jako dane, nie warunki rozsiane po ekranach (PLAN, sekcja 3.1).
// Rola daje zestaw domyślny; administrator może osobie dodać albo odebrać pojedyncze uprawnienia
// (ekran Użytkownicy) — wtedy liczy się rola + dodane − odebrane.

import type { Model } from "../app/DataContext";
import type { AccessRole, Assignment, Employee, LeaveRequest, Project } from "./types";

export type Permission =
  | "projects.all"
  | "projects.own"
  | "project.create"
  | "project.edit"
  | "map.view"
  | "team.plan"
  | "staffing.plan"
  | "hours.own"
  | "hours.approveTeam"
  | "hours.approveFinal"
  | "hours.approveAll"
  | "hours.fixWithheld"
  | "leave.own"
  | "leave.approveProject"
  | "leave.approveAll"
  | "leave.view"
  | "dashboard.supervisors"
  | "people.view"
  | "structure.view"
  | "reports.export"
  | "users.manage"
  | "settings.manage"
  | "data.admin";

export const PERMISSION_LABEL: Record<Permission, string> = {
  "projects.all": "Widzi wszystkie projekty",
  "projects.own": "Widzi swoje projekty",
  "project.create": "Tworzy projekty",
  "project.edit": "Edytuje dane projektu",
  "map.view": "Mapa i oś czasu",
  "team.plan": "Planuje zespoły (zadania od–do)",
  "staffing.plan": "Obsada: przesuwa ludzi między projektami",
  "hours.own": "Wpisuje swoje godziny",
  "hours.approveTeam": "Zatwierdza godziny zespołu (supervisor projektu)",
  "hours.approveFinal": "Zatwierdza godziny po supervisorach (IM projektu)",
  "hours.approveAll": "Zatwierdza i zmienia godziny we wszystkich projektach",
  "hours.fixWithheld": "Poprawia wstrzymane timesheety po terminie",
  "leave.own": "Składa wnioski o urlop i zgłasza L4",
  "leave.approveProject": "Akceptuje urlopy ludzi ze swoich projektów",
  "leave.approveAll": "Akceptuje urlopy wszystkich i potwierdza L4",
  "leave.view": "Kalendarz urlopów wszystkich",
  "dashboard.supervisors": "Pulpit supervisorów",
  "people.view": "Lista ludzi",
  "structure.view": "Struktura zespołów",
  "reports.export": "Raporty do Excela",
  "users.manage": "Użytkownicy i uprawnienia",
  "settings.manage": "Ustawienia systemu",
  "data.admin": "Zarządza danymi testowymi",
};

/** Grupy uprawnień na ekranie Użytkownicy. */
export const PERMISSION_GROUPS: { label: string; items: Permission[] }[] = [
  { label: "Projekty", items: ["projects.all", "projects.own", "project.create", "project.edit", "map.view", "structure.view"] },
  { label: "Planowanie", items: ["team.plan", "staffing.plan", "people.view"] },
  { label: "Godziny", items: ["hours.own", "hours.approveTeam", "hours.approveFinal", "hours.approveAll", "hours.fixWithheld", "dashboard.supervisors"] },
  { label: "Urlopy i nieobecności", items: ["leave.own", "leave.approveProject", "leave.approveAll", "leave.view"] },
  { label: "Administracja", items: ["reports.export", "users.manage", "settings.manage", "data.admin"] },
];

export const PERMISSION_ORDER = PERMISSION_GROUPS.flatMap((g) => g.items);

export const ROLE_PERMISSIONS: Record<AccessRole, Permission[]> = {
  ADMIN: PERMISSION_ORDER.filter((p) => !["projects.own", "hours.own", "leave.own", "leave.approveProject"].includes(p)),
  PLANNING: ["projects.all", "project.create", "project.edit", "map.view", "team.plan", "staffing.plan", "people.view", "structure.view", "leave.view"],
  PROJECT_MANAGER: ["projects.own", "project.create", "project.edit", "map.view", "structure.view"],
  INSTALLATION_MANAGER: ["projects.own", "map.view", "hours.approveFinal", "leave.approveProject", "dashboard.supervisors", "people.view", "structure.view"],
  SUPERVISOR: ["projects.own", "map.view", "hours.own", "hours.approveTeam", "leave.own", "leave.approveProject"],
  HR: ["people.view", "leave.approveAll", "leave.view"],
  WORKER: ["hours.own", "leave.own"],
  CUSTOM: [],
};

/** Uprawnienia osoby: rola + dodane − odebrane. */
export function permissionsOf(user: Employee): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[user.role] ?? []);
  for (const p of user.grants ?? []) if (p in PERMISSION_LABEL) set.add(p as Permission);
  for (const p of user.revokes ?? []) set.delete(p as Permission);
  return set;
}

const cache = new WeakMap<Employee, Set<Permission>>();

export function can(user: Employee | null | undefined, permission: Permission): boolean {
  if (!user || user.active === false) return false;
  let set = cache.get(user);
  if (!set) cache.set(user, (set = permissionsOf(user)));
  return set.has(permission);
}

export function canApprove(user: Employee | null): boolean {
  return can(user, "hours.approveTeam") || can(user, "hours.approveFinal") || can(user, "hours.approveAll");
}

/**
 * Czy osoba widzi, co poszło do Dataverse, a co zostało wstrzymane. Pracownicy i Team Leaderzy
 * tego nie widzą — to nie ich zadanie; dla nich zamknięty tydzień jest po prostu zamknięty.
 */
export function seesDispatch(user: Employee | null): boolean {
  return canApprove(user) || can(user, "hours.fixWithheld");
}

/** Projekty widoczne dla osoby. */
export function visibleProjects(model: Model, user: Employee): Project[] {
  if (can(user, "projects.all")) return model.projects;
  const assigned = new Set((model.assignmentsByEmployee.get(user.id) ?? []).map((a) => a.projectId));
  return model.projects.filter(
    (p) =>
      p.projectManagerId === user.id ||
      p.installationManagerId === user.id ||
      p.supervisorId === user.id ||
      (can(user, "hours.approveAll") ? true : assigned.has(p.id))
  );
}

export function canEditProject(user: Employee | null, project: Project): boolean {
  if (!user || !can(user, "project.edit")) return false;
  if (can(user, "projects.all")) return true;
  return project.projectManagerId === user.id;
}

/** Dane potrzebne do ustalenia projektów wniosku — pasuje i model, i snapshot. */
interface PlanData {
  assignments: Assignment[];
  projects: Project[];
}

/** Projekty, w których osoba pracuje w czasie wniosku (zadanie albo nadzór). */
export function leaveProjects(data: PlanData, leave: Pick<LeaveRequest, "employeeId" | "from" | "to">): Project[] {
  const ids = new Set(
    data.assignments
      .filter((a) => a.employeeId === leave.employeeId && a.from <= leave.to && (!a.to || a.to >= leave.from))
      .map((a) => a.projectId)
  );
  for (const p of data.projects) {
    if (p.supervisorId === leave.employeeId && p.startDate <= leave.to && (!p.endDate || p.endDate >= leave.from)) ids.add(p.id);
  }
  return data.projects.filter((p) => ids.has(p.id));
}

/**
 * Czy osoba może zaakceptować (odrzucić, cofnąć) wniosek: HR (wszystkich) albo supervisor / IM / PM
 * projektu, w którym wnioskujący wtedy pracuje — jeśli ma uprawnienie „urlopy ze swoich projektów".
 * Nikt nie akceptuje własnego wniosku.
 */
export function canDecideLeave(data: PlanData, user: Employee, leave: LeaveRequest): boolean {
  if (leave.employeeId === user.id) return false;
  if (can(user, "leave.approveAll")) return true;
  if (!can(user, "leave.approveProject")) return false;
  return leaveProjects(data, leave).some(
    (p) => p.supervisorId === user.id || p.installationManagerId === user.id || p.projectManagerId === user.id
  );
}

export type Route =
  | "/pulpit"
  | "/zatwierdzanie"
  | "/mapa"
  | "/os-czasu"
  | "/struktura"
  | "/ludzie"
  | "/urlopy"
  | "/obsada"
  | "/moje-godziny"
  | "/raporty"
  | "/uzytkownicy"
  | "/ustawienia";

const ROUTE_PERMISSION: Record<Route, (u: Employee) => boolean> = {
  "/pulpit": (u) => can(u, "dashboard.supervisors"),
  "/zatwierdzanie": (u) => canApprove(u),
  "/mapa": (u) => can(u, "map.view"),
  "/os-czasu": (u) => can(u, "map.view"),
  "/struktura": (u) => can(u, "structure.view"),
  "/ludzie": (u) => can(u, "people.view"),
  "/urlopy": (u) => can(u, "leave.approveProject") || can(u, "leave.approveAll") || can(u, "leave.view"),
  "/obsada": (u) => can(u, "staffing.plan"),
  "/moje-godziny": (u) => can(u, "hours.own") || can(u, "leave.own"),
  "/raporty": (u) => can(u, "reports.export"),
  "/uzytkownicy": (u) => can(u, "users.manage"),
  "/ustawienia": (u) => can(u, "settings.manage"),
};

/** Kolejność pozycji w docku. */
const NAV_ORDER: Route[] = [
  "/pulpit",
  "/zatwierdzanie",
  "/moje-godziny",
  "/mapa",
  "/os-czasu",
  "/struktura",
  "/ludzie",
  "/urlopy",
  "/obsada",
  "/raporty",
  "/uzytkownicy",
  "/ustawienia",
];

/** Narzędzia Planningu — w docku osobno, za kreską. */
export const PLANNING_TOOLS: Route[] = ["/obsada"];
/** Narzędzia administratora — w docku osobno, same ikony. */
export const ADMIN_TOOLS: Route[] = ["/raporty", "/uzytkownicy", "/ustawienia"];

export function routesFor(user: Employee): Route[] {
  const routes = NAV_ORDER.filter((r) => ROUTE_PERMISSION[r](user));
  // Supervisor zaczyna od zatwierdzania, a swoje godziny ma na końcu
  if (user.role === "SUPERVISOR" && routes.includes("/moje-godziny")) return [...routes.filter((r) => r !== "/moje-godziny"), "/moje-godziny"];
  return routes;
}

export function canOpen(user: Employee, path: string): boolean {
  const route = NAV_ORDER.find((r) => path.startsWith(r));
  return route ? ROUTE_PERMISSION[route](user) : true;
}

export function homeFor(user: Employee): Route {
  const routes = routesFor(user);
  const prefer: Route[] = canApprove(user) && user.role === "SUPERVISOR"
    ? ["/zatwierdzanie"]
    : ["/pulpit", "/mapa", "/zatwierdzanie", "/urlopy", "/ludzie", "/moje-godziny"];
  return prefer.find((r) => routes.includes(r)) ?? routes[0] ?? "/moje-godziny";
}

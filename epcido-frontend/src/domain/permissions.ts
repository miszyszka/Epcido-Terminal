// Uprawnienia jako dane, nie warunki rozsiane po ekranach (PLAN, sekcja 3.1).
// Zmiana tego, co widzi rola = zmiana w tej tabeli.

import type { Model } from "../app/DataContext";
import type { AccessRole, Employee, Project } from "./types";

export type Permission =
  | "projects.all"
  | "projects.own"
  | "project.create"
  | "project.edit"
  | "team.plan"
  | "staffing.plan"
  | "hours.own"
  | "hours.approveTeam"
  | "hours.approveFinal"
  | "dashboard.supervisors"
  | "people.view"
  | "structure.view"
  | "data.admin";

export const PERMISSION_LABEL: Record<Permission, string> = {
  "projects.all": "Widzi wszystkie projekty",
  "projects.own": "Widzi swoje projekty",
  "project.create": "Tworzy projekty",
  "project.edit": "Edytuje dane projektu",
  "team.plan": "Planuje zespoły (zadania od–do)",
  "staffing.plan": "Obsada: przesuwa ludzi między projektami",
  "hours.own": "Wpisuje swoje godziny",
  "hours.approveTeam": "Zatwierdza i zmienia godziny zespołu",
  "hours.approveFinal": "Zatwierdza i zmienia godziny po supervisorach",
  "dashboard.supervisors": "Pulpit supervisorów",
  "people.view": "Lista ludzi",
  "structure.view": "Struktura zespołów",
  "data.admin": "Zarządza danymi testowymi",
};

export const PERMISSION_ORDER = Object.keys(PERMISSION_LABEL) as Permission[];

export const ROLE_PERMISSIONS: Record<AccessRole, Permission[]> = {
  ADMIN: PERMISSION_ORDER.filter((p) => p !== "projects.own" && p !== "hours.own"),
  PLANNING: ["projects.all", "project.create", "project.edit", "team.plan", "staffing.plan", "people.view", "structure.view"],
  PROJECT_MANAGER: ["projects.own", "project.create", "project.edit", "structure.view"],
  INSTALLATION_MANAGER: ["projects.own", "hours.approveFinal", "dashboard.supervisors", "people.view", "structure.view"],
  SUPERVISOR: ["projects.own", "hours.own", "hours.approveTeam"],
  WORKER: ["hours.own"],
};

export function can(user: Employee | null, permission: Permission): boolean {
  return Boolean(user && ROLE_PERMISSIONS[user.role].includes(permission));
}

export function canApprove(user: Employee | null): boolean {
  return can(user, "hours.approveTeam") || can(user, "hours.approveFinal");
}

/** Projekty widoczne dla osoby. */
export function visibleProjects(model: Model, user: Employee): Project[] {
  if (can(user, "projects.all")) return model.projects;
  switch (user.role) {
    case "PROJECT_MANAGER":
      return model.projects.filter((p) => p.projectManagerId === user.id);
    case "INSTALLATION_MANAGER":
      return model.projects.filter((p) => p.installationManagerId === user.id);
    case "SUPERVISOR":
      return model.projects.filter((p) => p.supervisorId === user.id);
    default: {
      const ids = new Set((model.assignmentsByEmployee.get(user.id) ?? []).map((a) => a.projectId));
      return model.projects.filter((p) => ids.has(p.id));
    }
  }
}

export function canEditProject(user: Employee | null, project: Project): boolean {
  if (!user || !can(user, "project.edit")) return false;
  if (can(user, "projects.all")) return true;
  return project.projectManagerId === user.id;
}

export type Route =
  | "/pulpit"
  | "/zatwierdzanie"
  | "/mapa"
  | "/os-czasu"
  | "/struktura"
  | "/ludzie"
  | "/obsada"
  | "/moje-godziny";

const ROUTE_PERMISSION: Record<Route, (u: Employee) => boolean> = {
  "/pulpit": (u) => can(u, "dashboard.supervisors"),
  "/zatwierdzanie": (u) => canApprove(u),
  "/mapa": (u) => u.role !== "WORKER",
  "/os-czasu": (u) => u.role !== "WORKER",
  "/struktura": (u) => can(u, "structure.view"),
  "/ludzie": (u) => can(u, "people.view"),
  "/obsada": (u) => can(u, "staffing.plan"),
  "/moje-godziny": (u) => can(u, "hours.own"),
};

/** Kolejność pozycji w docku dla danej roli. */
const NAV_ORDER: Route[] = ["/pulpit", "/zatwierdzanie", "/moje-godziny", "/mapa", "/os-czasu", "/struktura", "/ludzie", "/obsada"];

/** Narzędzia tylko dla Planningu — w docku osobno, za kreską. */
export const PLANNING_TOOLS: Route[] = ["/obsada"];

export function routesFor(user: Employee): Route[] {
  const routes = NAV_ORDER.filter((r) => ROUTE_PERMISSION[r](user));
  // Supervisor zaczyna od zatwierdzania, a swoje godziny ma na końcu
  if (user.role === "SUPERVISOR") return ["/zatwierdzanie", "/mapa", "/os-czasu", "/moje-godziny"];
  return routes;
}

export function canOpen(user: Employee, path: string): boolean {
  const route = NAV_ORDER.find((r) => path.startsWith(r));
  return route ? ROUTE_PERMISSION[route](user) : true;
}

export function homeFor(user: Employee): Route {
  if (user.role === "WORKER") return "/moje-godziny";
  if (user.role === "SUPERVISOR") return "/zatwierdzanie";
  if (can(user, "dashboard.supervisors")) return "/pulpit";
  return "/mapa";
}

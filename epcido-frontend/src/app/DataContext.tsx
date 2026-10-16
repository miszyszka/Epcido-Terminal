import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AbsenceType, Assignment, DayEntry, Employee, Project, ProjectInput } from "../domain/types";
import type { QueueItem } from "../domain/workflow";
import type { ChangeSet, RepoError, Repository, Snapshot } from "../data/repository";
import * as commands from "../data/commands";
import { CommandError, type Actor, type DraftAssignment } from "../data/commands";
import { createMemoryRepository, resetDemoStorage } from "../data/memoryRepo";
import { todayISO, type ISODate } from "../lib/dates";
import { useSession } from "./SessionContext";
import { useUi } from "./UiContext";

export type DataMode = "firebase" | "demo";
export type DataStatus =
  | { state: "loading"; slow: boolean }
  | { state: "ready" }
  | { state: "error"; error: RepoError };

const MODE_KEY = "epcido-data-mode";

export interface Team {
  project: Project;
  projectManager: Employee | null;
  installationManager: Employee | null;
  supervisor: Employee | null;
  teamLeaders: Employee[];
  electricians: Employee[];
  mechanics: Employee[];
  /** Członkowie aktywni w danym dniu (TL + elektrycy + mechanicy) */
  members: Employee[];
}

export interface Row {
  employee: Employee;
  /** Okresy pracy w projekcie (supervisor: cały projekt) */
  periods: { from: ISODate; to: ISODate | null }[];
}

export interface Model {
  snapshot: Snapshot;
  employees: Employee[];
  projects: Project[];
  assignments: Assignment[];
  employeeById: Map<string, Employee>;
  projectById: Map<string, Project>;
  assignmentsByProject: Map<string, Assignment[]>;
  assignmentsByEmployee: Map<string, Assignment[]>;
  /** projectId → employeeId → data → wpis */
  entries: Map<string, Map<string, Map<string, DayEntry>>>;
  entry: (projectId: string, employeeId: string, date: string) => DayEntry | undefined;
  /** Wszystkie dni osoby we wszystkich projektach */
  entriesOf: (employeeId: string) => Map<ISODate, { projectId: string; entry: DayEntry }>;
  activeAssignment: (employeeId: string, date: ISODate) => Assignment | undefined;
  team: (projectId: string, date?: ISODate) => Team | null;
  /** Wiersze projektu w zakresie dat: supervisor + osoby z przypisaniem nakładającym się na zakres */
  rows: (projectId: string, from: ISODate, to: ISODate) => Row[];
  /** Projekty osoby na dziś (zespół, nadzór lub zarządzanie) */
  projectsOf: (employeeId: string, date?: ISODate) => Project[];
}

interface DataValue {
  mode: DataMode;
  status: DataStatus;
  model: Model | null;
  user: Employee | null;
  switchMode: (mode: DataMode) => void;
  saveProject: (id: string | null, input: ProjectInput, team: DraftAssignment[]) => Promise<string | null>;
  assignToProject: (employeeId: string, projectId: string) => Promise<boolean>;
  submitHours: (args: { projectId: string; employeeId: string; date: ISODate; start: number; end: number; breakMin: number }) => Promise<boolean>;
  reportAbsence: (args: { employeeId: string; from: ISODate; to: ISODate; type: AbsenceType; note?: string }) => Promise<boolean>;
  approve: (items: QueueItem[]) => Promise<boolean>;
  reject: (items: QueueItem[], reason: string) => Promise<boolean>;
  loadTestData: () => Promise<boolean>;
  clearData: () => Promise<boolean>;
}

const DataContext = createContext<DataValue | null>(null);

function detectMode(): DataMode {
  const params = new URLSearchParams(window.location.search);
  if (params.has("demo")) return "demo";
  if (import.meta.env.VITE_DATA_SOURCE === "demo") return "demo";
  try {
    if (localStorage.getItem(MODE_KEY) === "demo") return "demo";
  } catch {
    /* brak dostępu do localStorage */
  }
  return "firebase";
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { toast } = useUi();
  const { userId } = useSession();
  const [mode] = useState<DataMode>(detectMode);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<DataStatus>({ state: "loading", slow: false });
  const snapshotRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = mode === "demo" ? createMemoryRepository() : (await import("../data/firestoreRepo")).createFirestoreRepository();
      if (!cancelled) setRepo(r);
    })().catch((e: unknown) =>
      setStatus({ state: "error", error: { code: "init", message: e instanceof Error ? e.message : String(e) } })
    );
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!repo) return;
    const slowTimer = window.setTimeout(
      () => setStatus((s) => (s.state === "loading" ? { state: "loading", slow: true } : s)),
      9000
    );
    const unsubscribe = repo.subscribe(
      (s) => {
        snapshotRef.current = s;
        setSnapshot(s);
        setStatus({ state: "ready" });
      },
      (error) => setStatus({ state: "error", error })
    );
    return () => {
      window.clearTimeout(slowTimer);
      unsubscribe();
    };
  }, [repo]);

  const model = useMemo(() => (snapshot ? buildModel(snapshot) : null), [snapshot]);
  const user = useMemo(() => {
    if (!model) return null;
    return model.employeeById.get(userId) ?? model.employees.find((e) => e.role === "PLANNING") ?? model.employees[0] ?? null;
  }, [model, userId]);
  const actorRef = useRef<Actor>({ id: "anon", name: "Nieznany" });
  useEffect(() => {
    if (user) actorRef.current = { id: user.id, name: user.name };
  }, [user]);

  const commit = useCallback(
    async (build: (s: Snapshot, actor: Actor) => ChangeSet, success?: string): Promise<boolean> => {
      const current = snapshotRef.current;
      if (!repo || !current) return false;
      try {
        const changes = build(current, actorRef.current);
        if (changes.writes.length === 0 && changes.audit.length === 0) {
          toast("Nic się nie zmieniło");
          return true;
        }
        await repo.apply(changes);
        if (success) toast(success);
        return true;
      } catch (e) {
        if (e instanceof CommandError) toast(e.message, "error");
        else toast(`Nie udało się zapisać zmian. ${e instanceof Error ? e.message : ""}`, "error");
        return false;
      }
    },
    [repo, toast]
  );

  const value = useMemo<DataValue>(
    () => ({
      mode,
      status,
      model,
      user,
      switchMode(next) {
        try {
          if (next === "demo") localStorage.setItem(MODE_KEY, "demo");
          else localStorage.removeItem(MODE_KEY);
        } catch {
          /* nic */
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("demo");
        window.location.assign(url.toString());
      },
      async saveProject(id, input, team) {
        let savedId: string | null = null;
        const ok = await commit((s, actor) => {
          const result = commands.saveProject(s, actor, { id, input, team });
          savedId = result.id;
          return result.changes;
        }, id ? "Zmiany zapisane" : "Projekt utworzony");
        return ok ? savedId : null;
      },
      assignToProject: (employeeId, projectId) =>
        commit((s, a) => commands.assignToProject(s, a, employeeId, projectId, todayISO()), "Przypisano do projektu"),
      submitHours: (args) => commit((s, a) => commands.submitHours(s, a, args), "Godziny wysłane do zatwierdzenia"),
      reportAbsence: (args) => commit((s, a) => commands.reportAbsence(s, a, args), "Nieobecność zgłoszona"),
      approve: (items) =>
        commit((s, a) => commands.approve(s, a, items), items.length === 1 ? "Zatwierdzono" : `Zatwierdzono: ${items.length} poz.`),
      reject: (items, reason) => commit((s, a) => commands.reject(s, a, items, reason), "Odrzucono, pracownik zobaczy powód"),
      loadTestData: () => commit((_s, a) => commands.loadTestData(a, todayISO()), "Dane testowe wgrane"),
      async clearData() {
        const ok = await commit((s, a) => commands.clearData(s, a), "Dane testowe usunięte");
        if (ok && mode === "demo") resetDemoStorage();
        return ok;
      },
    }),
    [mode, status, model, user, commit]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData musi być użyty wewnątrz DataProvider");
  return ctx;
}

/** Model gotowy do użycia przez ekrany. Dostępny tylko, gdy dane są wczytane. */
export function useModel(): Model {
  const { model } = useData();
  if (!model) throw new Error("Dane nie są jeszcze wczytane");
  return model;
}

/** Zalogowana osoba. Dostępna tylko, gdy dane są wczytane. */
export function useUser(): Employee {
  const { user } = useData();
  if (!user) throw new Error("Brak użytkownika");
  return user;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pl", { numeric: true, sensitivity: "base" });

const POSITION_ORDER: Employee["position"][] = ["SUPERVISOR", "TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

export function buildModel(snapshot: Snapshot): Model {
  const employees = [...snapshot.employees].sort(byName);
  const projects = [...snapshot.projects]
    .map((p) => ({ ...p, projectManagerId: p.projectManagerId ?? null }))
    .sort((a, b) => a.number.localeCompare(b.number, "pl", { numeric: true }));
  // Zgodność wstecz: przypisania z wersji 0.2 miały pole `since` zamiast `from`.
  const assignments = snapshot.assignments.map((a) => {
    const legacy = a as Assignment & { since?: string };
    return { ...a, from: a.from ?? legacy.since ?? "1970-01-01", to: a.to ?? null };
  });
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const assignmentsByProject = new Map<string, Assignment[]>();
  const assignmentsByEmployee = new Map<string, Assignment[]>();
  for (const a of assignments) {
    assignmentsByProject.set(a.projectId, [...(assignmentsByProject.get(a.projectId) ?? []), a]);
    assignmentsByEmployee.set(a.employeeId, [...(assignmentsByEmployee.get(a.employeeId) ?? []), a]);
  }
  for (const list of assignmentsByEmployee.values()) list.sort((a, b) => a.from.localeCompare(b.from));

  const entries = new Map<string, Map<string, Map<string, DayEntry>>>();
  const byEmployee = new Map<string, Map<ISODate, { projectId: string; entry: DayEntry }>>();
  for (const sheet of snapshot.timesheets) {
    let perProject = entries.get(sheet.projectId);
    if (!perProject) entries.set(sheet.projectId, (perProject = new Map()));
    for (const [employeeId, days] of Object.entries(sheet.days ?? {})) {
      let perPerson = perProject.get(employeeId);
      if (!perPerson) perProject.set(employeeId, (perPerson = new Map()));
      let mine = byEmployee.get(employeeId);
      if (!mine) byEmployee.set(employeeId, (mine = new Map()));
      for (const [date, entry] of Object.entries(days ?? {})) {
        if (!entry) continue;
        perPerson.set(date, entry);
        mine.set(date, { projectId: sheet.projectId, entry });
      }
    }
  }

  const activeAssignment = (employeeId: string, date: ISODate) =>
    (assignmentsByEmployee.get(employeeId) ?? []).find((a) => a.from <= date && (!a.to || a.to >= date));

  const today = todayISO();
  const team = (projectId: string, date: ISODate = today): Team | null => {
    const project = projectById.get(projectId);
    if (!project) return null;
    const reference = project.startDate > date ? project.startDate : date;
    const members = (assignmentsByProject.get(projectId) ?? [])
      .filter((a) => a.from <= reference && (!a.to || a.to >= reference))
      .map((a) => employeeById.get(a.employeeId))
      .filter((e): e is Employee => Boolean(e))
      .sort(byName);
    const pick = (id: string | null) => (id ? employeeById.get(id) ?? null : null);
    return {
      project,
      projectManager: pick(project.projectManagerId),
      installationManager: pick(project.installationManagerId),
      supervisor: pick(project.supervisorId),
      teamLeaders: members.filter((e) => e.position === "TEAM_LEADER"),
      electricians: members.filter((e) => e.position === "ELECTRICIAN"),
      mechanics: members.filter((e) => e.position === "MECHANIC"),
      members,
    };
  };

  const rows = (projectId: string, from: ISODate, to: ISODate): Row[] => {
    const project = projectById.get(projectId);
    if (!project) return [];
    const map = new Map<string, Row>();
    const sv = project.supervisorId ? employeeById.get(project.supervisorId) : undefined;
    if (sv) map.set(sv.id, { employee: sv, periods: [{ from: project.startDate, to: project.endDate }] });
    for (const a of assignmentsByProject.get(projectId) ?? []) {
      if (a.from > to || (a.to && a.to < from)) continue;
      const e = employeeById.get(a.employeeId);
      if (!e) continue;
      const row = map.get(e.id) ?? { employee: e, periods: [] };
      row.periods.push({ from: a.from, to: a.to });
      map.set(e.id, row);
    }
    return [...map.values()].sort(
      (a, b) =>
        POSITION_ORDER.indexOf(a.employee.position) - POSITION_ORDER.indexOf(b.employee.position) || byName(a.employee, b.employee)
    );
  };

  return {
    snapshot,
    employees,
    projects,
    assignments,
    employeeById,
    projectById,
    assignmentsByProject,
    assignmentsByEmployee,
    entries,
    entry: (projectId, employeeId, date) => entries.get(projectId)?.get(employeeId)?.get(date),
    entriesOf: (employeeId) => byEmployee.get(employeeId) ?? new Map(),
    activeAssignment,
    team,
    rows,
    projectsOf(employeeId, date = today) {
      const a = activeAssignment(employeeId, date);
      if (a) return [projectById.get(a.projectId)].filter((p): p is Project => Boolean(p));
      return projects.filter(
        (p) => p.supervisorId === employeeId || p.installationManagerId === employeeId || p.projectManagerId === employeeId
      );
    },
  };
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Assignment, DayEntry, Employee, Project, ProjectInput } from "../domain/types";
import type { ChangeSet, RepoError, Repository, Snapshot } from "../data/repository";
import * as commands from "../data/commands";
import { CommandError, type Actor } from "../data/commands";
import { createMemoryRepository, resetDemoStorage } from "../data/memoryRepo";
import { PLANNER_ID, PLANNER_NAME } from "../data/seed";
import { useUi } from "./UiContext";

export type DataMode = "firebase" | "demo";
export type DataStatus =
  | { state: "loading"; slow: boolean }
  | { state: "ready" }
  | { state: "error"; error: RepoError };

/** Do czasu wprowadzenia logowania wszystkie zmiany zapisują się jako Planista 1. */
const ACTOR: Actor = { id: PLANNER_ID, name: PLANNER_NAME };
const MODE_KEY = "epcido-data-mode";

export interface Team {
  project: Project;
  installationManager: Employee | null;
  supervisor: Employee | null;
  teamLeaders: Employee[];
  electricians: Employee[];
  mechanics: Employee[];
  /** Wszyscy członkowie z przypisania (TL + elektrycy + mechanicy) */
  members: Employee[];
}

export interface Model {
  snapshot: Snapshot;
  employees: Employee[];
  projects: Project[];
  employeeById: Map<string, Employee>;
  projectById: Map<string, Project>;
  assignmentByEmployee: Map<string, Assignment>;
  membersByProject: Map<string, Assignment[]>;
  /** projectId → employeeId → data → wpis */
  entries: Map<string, Map<string, Map<string, DayEntry>>>;
  team: (projectId: string) => Team | null;
  entry: (projectId: string, employeeId: string, date: string) => DayEntry | undefined;
  /** Projekt, w którego zespole jest osoba (lub który nadzoruje / prowadzi) */
  projectsOf: (employeeId: string) => Project[];
}

interface DataValue {
  mode: DataMode;
  status: DataStatus;
  model: Model | null;
  switchMode: (mode: DataMode) => void;
  createProject: (input: ProjectInput) => Promise<string | null>;
  updateProject: (id: string, input: ProjectInput) => Promise<boolean>;
  addMember: (projectId: string, employeeId: string) => Promise<boolean>;
  removeMember: (assignmentId: string) => Promise<boolean>;
  moveMember: (employeeId: string, toProjectId: string) => Promise<boolean>;
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
  const [mode] = useState<DataMode>(detectMode);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<DataStatus>({ state: "loading", slow: false });
  const snapshotRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r =
        mode === "demo"
          ? createMemoryRepository()
          : (await import("../data/firestoreRepo")).createFirestoreRepository();
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

  const commit = useCallback(
    async (build: (s: Snapshot) => ChangeSet, success?: string): Promise<boolean> => {
      const current = snapshotRef.current;
      if (!repo || !current) return false;
      try {
        const changes = build(current);
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
      async createProject(input) {
        let id: string | null = null;
        const ok = await commit((s) => {
          const result = commands.createProject(s, ACTOR, input);
          id = result.id;
          return result.changes;
        }, "Projekt utworzony");
        return ok ? id : null;
      },
      updateProject: (id, input) => commit((s) => commands.updateProject(s, ACTOR, id, input), "Zmiany zapisane"),
      addMember: (projectId, employeeId) =>
        commit((s) => commands.addMember(s, ACTOR, projectId, employeeId), "Dodano do zespołu"),
      removeMember: (assignmentId) =>
        commit((s) => commands.removeMember(s, ACTOR, assignmentId), "Usunięto z zespołu"),
      moveMember: (employeeId, toProjectId) =>
        commit((s) => commands.moveMember(s, ACTOR, employeeId, toProjectId), "Przeniesiono do zespołu"),
      loadTestData: () => commit(() => commands.loadTestData(ACTOR), "Dane testowe wgrane"),
      async clearData() {
        const ok = await commit((s) => commands.clearData(s, ACTOR), "Dane testowe usunięte");
        if (ok && mode === "demo") resetDemoStorage();
        return ok;
      },
    }),
    [mode, status, model, commit]
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

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pl", { numeric: true, sensitivity: "base" });

export function buildModel(snapshot: Snapshot): Model {
  const employees = [...snapshot.employees].sort(byName);
  const projects = [...snapshot.projects].sort((a, b) =>
    a.number.localeCompare(b.number, "pl", { numeric: true })
  );
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const assignmentByEmployee = new Map<string, Assignment>();
  const membersByProject = new Map<string, Assignment[]>();
  for (const a of snapshot.assignments) {
    assignmentByEmployee.set(a.employeeId, a);
    const list = membersByProject.get(a.projectId) ?? [];
    list.push(a);
    membersByProject.set(a.projectId, list);
  }

  const entries = new Map<string, Map<string, Map<string, DayEntry>>>();
  for (const sheet of snapshot.timesheets) {
    let perProject = entries.get(sheet.projectId);
    if (!perProject) entries.set(sheet.projectId, (perProject = new Map()));
    for (const [employeeId, days] of Object.entries(sheet.days ?? {})) {
      let perPerson = perProject.get(employeeId);
      if (!perPerson) perProject.set(employeeId, (perPerson = new Map()));
      for (const [date, entry] of Object.entries(days)) perPerson.set(date, entry);
    }
  }

  const teamCache = new Map<string, Team | null>();
  const team = (projectId: string): Team | null => {
    if (teamCache.has(projectId)) return teamCache.get(projectId)!;
    const project = projectById.get(projectId);
    if (!project) return null;
    const members = (membersByProject.get(projectId) ?? [])
      .map((a) => employeeById.get(a.employeeId))
      .filter((e): e is Employee => Boolean(e))
      .sort(byName);
    const result: Team = {
      project,
      installationManager: project.installationManagerId ? employeeById.get(project.installationManagerId) ?? null : null,
      supervisor: project.supervisorId ? employeeById.get(project.supervisorId) ?? null : null,
      teamLeaders: members.filter((e) => e.position === "TEAM_LEADER"),
      electricians: members.filter((e) => e.position === "ELECTRICIAN"),
      mechanics: members.filter((e) => e.position === "MECHANIC"),
      members,
    };
    teamCache.set(projectId, result);
    return result;
  };

  return {
    snapshot,
    employees,
    projects,
    employeeById,
    projectById,
    assignmentByEmployee,
    membersByProject,
    entries,
    team,
    entry: (projectId, employeeId, date) => entries.get(projectId)?.get(employeeId)?.get(date),
    projectsOf(employeeId) {
      const assigned = assignmentByEmployee.get(employeeId);
      if (assigned) return [projectById.get(assigned.projectId)].filter((p): p is Project => Boolean(p));
      return projects.filter((p) => p.supervisorId === employeeId || p.installationManagerId === employeeId);
    },
  };
}

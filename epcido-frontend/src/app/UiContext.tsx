import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type DrawerState =
  | { kind: "new" }
  | { kind: "project"; projectId: string; tab: ProjectTab }
  | null;

export type ProjectTab = "team" | "details" | "history";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface UiValue {
  search: string;
  setSearch: (value: string) => void;
  drawer: DrawerState;
  openNewProject: () => void;
  openProject: (projectId: string, tab?: ProjectTab) => void;
  closeDrawer: () => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3200);
  }, []);

  const openNewProject = useCallback(() => setDrawer({ kind: "new" }), []);
  const openProject = useCallback(
    (projectId: string, tab: ProjectTab = "team") => setDrawer({ kind: "project", projectId, tab }),
    []
  );
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const value = useMemo<UiValue>(
    () => ({ search, setSearch, drawer, openNewProject, openProject, closeDrawer, toasts, toast }),
    [search, drawer, openNewProject, openProject, closeDrawer, toasts, toast]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi musi być użyty wewnątrz UiProvider");
  return ctx;
}

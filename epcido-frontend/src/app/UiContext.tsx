import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/** Edytor projektu na pełnym ekranie: null = zamknięty, projectId null = nowy projekt. */
export type EditorState = { projectId: string | null; tab: EditorTab; rev: number } | null;
export type EditorTab = "team" | "history";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface UiValue {
  search: string;
  setSearch: (value: string) => void;
  editor: EditorState;
  openNewProject: () => void;
  openProject: (projectId: string, tab?: EditorTab) => void;
  closeEditor: () => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3200);
  }, []);

  const openNewProject = useCallback(() => setEditor({ projectId: null, tab: "team", rev: Date.now() }), []);
  const openProject = useCallback(
    (projectId: string, tab: EditorTab = "team") => setEditor({ projectId, tab, rev: Date.now() }),
    []
  );
  const closeEditor = useCallback(() => setEditor(null), []);

  const value = useMemo<UiValue>(
    () => ({ search, setSearch, editor, openNewProject, openProject, closeEditor, toasts, toast }),
    [search, editor, openNewProject, openProject, closeEditor, toasts, toast]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi musi być użyty wewnątrz UiProvider");
  return ctx;
}

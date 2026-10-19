import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/** Edytor projektu na pełnym ekranie: null = zamknięty, projectId null = nowy projekt. */
export type EditorState = { projectId: string | null; tab: EditorTab; rev: number; focus?: boolean } | null;
export type EditorTab = "team" | "history";

/** Dzień otwarty do podglądu lub zmiany (oś czasu, zatwierdzanie). */
export type EntryRef = { projectId: string; employeeId: string; date: string } | null;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: ToastAction;
}

/** Pytanie przed zapisem — nic nie trafia do bazy, zanim ktoś nie potwierdzi. */
export interface ConfirmRequest {
  title: string;
  /** Co dokładnie się zapisze — lista zmian po ludzku */
  lines?: string[];
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface UiValue {
  search: string;
  setSearch: (value: string) => void;
  editor: EditorState;
  openNewProject: () => void;
  /** focus: plan zespołu na całą szerokość (dane projektu zwinięte) — np. z Obsady */
  openProject: (projectId: string, tab?: EditorTab, focus?: boolean) => void;
  closeEditor: () => void;
  entryEditor: EntryRef;
  openEntry: (ref: NonNullable<EntryRef>) => void;
  closeEntry: () => void;
  /** Podgląd osoby — otwiera się kliknięciem w imię w dowolnym widoku */
  personId: string | null;
  openPerson: (employeeId: string) => void;
  closePerson: () => void;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  confirmState: (ConfirmRequest & { id: number }) | null;
  resolveConfirm: (ok: boolean) => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"], action?: ToastAction) => void;
  dismissToast: (id: number) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [entryEditor, setEntryEditor] = useState<EntryRef>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<(ConfirmRequest & { id: number }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info", action?: ToastAction) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" || action ? 7000 : 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const openNewProject = useCallback(() => setEditor({ projectId: null, tab: "team", rev: Date.now() }), []);
  const openProject = useCallback(
    (projectId: string, tab: EditorTab = "team", focus = false) => setEditor({ projectId, tab, rev: Date.now(), focus }),
    []
  );
  const closeEditor = useCallback(() => setEditor(null), []);
  const openEntry = useCallback((ref: NonNullable<EntryRef>) => setEntryEditor(ref), []);
  const closeEntry = useCallback(() => setEntryEditor(null), []);
  const openPerson = useCallback((employeeId: string) => setPersonId(employeeId), []);
  const closePerson = useCallback(() => setPersonId(null), []);

  const confirm = useCallback((request: ConfirmRequest) => {
    pending.current?.(false);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setConfirmState({ ...request, id: nextId.current++ });
    });
  }, []);
  const resolveConfirm = useCallback((ok: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setConfirmState(null);
    resolve?.(ok);
  }, []);

  const value = useMemo<UiValue>(
    () => ({
      search,
      setSearch,
      editor,
      openNewProject,
      openProject,
      closeEditor,
      entryEditor,
      openEntry,
      closeEntry,
      personId,
      openPerson,
      closePerson,
      confirm,
      confirmState,
      resolveConfirm,
      toasts,
      toast,
      dismissToast,
    }),
    [
      search,
      editor,
      openNewProject,
      openProject,
      closeEditor,
      entryEditor,
      openEntry,
      closeEntry,
      personId,
      openPerson,
      closePerson,
      confirm,
      confirmState,
      resolveConfirm,
      toasts,
      toast,
      dismissToast,
    ]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi musi być użyty wewnątrz UiProvider");
  return ctx;
}

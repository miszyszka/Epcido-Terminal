import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_USER_ID } from "../data/seed";

/**
 * Sesja prototypu: kto jest „zalogowany" (przełączany w panelu roboczym) i podgląd mobilny.
 * Docelowo użytkownik przyjdzie z logowania (Firebase Authentication / Entra ID).
 */
export type Preview = "desktop" | "mobile";

interface SessionValue {
  userId: string;
  setUserId: (id: string) => void;
  preview: Preview;
  setPreview: (p: Preview) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const SessionContext = createContext<SessionValue | null>(null);
const KEY = "epcido-session-v3";

function read(): Partial<{ userId: string; preview: Preview; panelOpen: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function write(v: { userId: string; preview: Preview; panelOpen: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* tryb prywatny — sesja tylko w pamięci */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const initial = read();
  const [userId, setUserIdState] = useState(initial.userId ?? DEFAULT_USER_ID);
  const [preview, setPreviewState] = useState<Preview>(initial.preview ?? "desktop");
  const [panelOpen, setPanelOpenState] = useState(initial.panelOpen ?? true);

  const persist = useCallback(
    (patch: Partial<{ userId: string; preview: Preview; panelOpen: boolean }>) =>
      write({ userId, preview, panelOpen, ...patch }),
    [userId, preview, panelOpen]
  );

  const value = useMemo<SessionValue>(
    () => ({
      userId,
      preview,
      panelOpen,
      setUserId(id) {
        setUserIdState(id);
        persist({ userId: id });
      },
      setPreview(p) {
        setPreviewState(p);
        persist({ preview: p });
      },
      setPanelOpen(open) {
        setPanelOpenState(open);
        persist({ panelOpen: open });
      },
    }),
    [userId, preview, panelOpen, persist]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession musi być użyty wewnątrz SessionProvider");
  return ctx;
}

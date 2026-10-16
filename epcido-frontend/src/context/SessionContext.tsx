import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Employee } from "../types";
import { ensureSeeded, getCurrentEmployee, setCurrentUserId, logout as storeLogout } from "../data/store";

interface SessionContextValue {
  user: Employee | null;
  login: (employeeId: string) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);

  useEffect(() => {
    ensureSeeded();
    setUser(getCurrentEmployee());
  }, []);

  function login(employeeId: string) {
    setCurrentUserId(employeeId);
    setUser(getCurrentEmployee());
  }

  function logout() {
    storeLogout();
    setUser(null);
  }

  return <SessionContext.Provider value={{ user, login, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession musi być użyty wewnątrz SessionProvider");
  return ctx;
}

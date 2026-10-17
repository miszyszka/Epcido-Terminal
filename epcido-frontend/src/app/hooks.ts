import { useMemo, useSyncExternalStore } from "react";
import { canApprove, canDecideLeave } from "../domain/permissions";
import type { LeaveRequest } from "../domain/types";
import { deadlineSummary, queueFor, withheldInScope, type DeadlineSummary, type QueueItem } from "../domain/workflow";
import { useData } from "./DataContext";

// Zegar aplikacji: odświeża się co 30 s (odliczanie do terminu, blokada we wtorek o północy).
let nowValue = new Date();
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.setInterval(() => {
    nowValue = new Date();
    listeners.forEach((l) => l());
  }, 30_000);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => nowValue);
}

/** Kolejka zalogowanej osoby: co ma do zatwierdzenia i ile zostało czasu. */
export function useQueue(): { items: QueueItem[]; summary: DeadlineSummary | null } {
  const { model, user } = useData();
  const now = useNow();
  return useMemo(() => {
    if (!model || !user || !canApprove(user)) return { items: [], summary: null };
    const items = queueFor(model, user, now);
    return { items, summary: deadlineSummary(items, now, withheldInScope(model, user, now).length) };
  }, [model, user, now]);
}

/** Wnioski, które zalogowana osoba może teraz rozpatrzyć (czekające na akceptację). */
export function usePendingLeaves(): LeaveRequest[] {
  const { model, user } = useData();
  return useMemo(() => {
    if (!model || !user) return [];
    return model.leaves.filter((l) => l.status === "PENDING" && canDecideLeave(model, user, l));
  }, [model, user]);
}

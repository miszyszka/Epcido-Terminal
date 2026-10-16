import { useMemo } from "react";
import { canApprove } from "../domain/permissions";
import { queueFor, sumMinutes, type QueueItem } from "../domain/workflow";
import { todayISO } from "../lib/dates";
import { useData } from "./DataContext";

/** Kolejka zalogowanej osoby: co ma do zatwierdzenia i ile to godzin. */
export function useQueue(): { items: QueueItem[]; minutes: number; overdue: number } {
  const { model, user } = useData();
  return useMemo(() => {
    if (!model || !user || !canApprove(user)) return { items: [], minutes: 0, overdue: 0 };
    const items = queueFor(model, user, todayISO());
    return { items, minutes: sumMinutes(items), overdue: items.filter((i) => i.overdue).length };
  }, [model, user]);
}

/** Dni zalogowanej osoby odrzucone do poprawy. */
export function useRejectedOwn(): number {
  const { model, user } = useData();
  return useMemo(() => {
    if (!model || !user) return 0;
    let n = 0;
    for (const { entry } of model.entriesOf(user.id).values()) if (entry.status === "REJECTED") n++;
    return n;
  }, [model, user]);
}

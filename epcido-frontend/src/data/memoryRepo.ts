// Tryb demo: dane w pamięci przeglądarki (zapisywane w localStorage tej przeglądarki).
// Służy do oglądania widoków bez bazy i do testów automatycznych.

import { todayISO } from "../lib/dates";
import type { AuditEvent } from "../domain/types";
import type { ChangeSet, Repository, Snapshot } from "./repository";
import { generateDataset, SEED_VERSION } from "./seed";

const STORAGE_KEY = "epcido-demo-v4";

type Store = {
  employees: Map<string, Record<string, unknown>>;
  projects: Map<string, Record<string, unknown>>;
  assignments: Map<string, Record<string, unknown>>;
  timesheets: Map<string, Record<string, unknown>>;
  meta: Map<string, Record<string, unknown>>;
  audit: AuditEvent[];
};

export function createMemoryRepository(): Repository {
  const store = load() ?? fresh();
  const listeners = new Set<(s: Snapshot) => void>();

  const snapshot = (): Snapshot => ({
    employees: values(store.employees),
    projects: values(store.projects),
    assignments: values(store.assignments),
    timesheets: values(store.timesheets),
    audit: [...store.audit].sort((a, b) => b.at.localeCompare(a.at)),
    seeded: store.meta.has("seed"),
    seedVersion: store.meta.has("seed") ? Number(store.meta.get("seed")?.version ?? 1) : null,
  });

  const emit = () => {
    const s = snapshot();
    listeners.forEach((l) => l(s));
    persist(store);
  };

  return {
    kind: "demo",
    subscribe(onData) {
      listeners.add(onData);
      queueMicrotask(() => onData(snapshot()));
      return () => listeners.delete(onData);
    },
    async apply(changes: ChangeSet) {
      for (const w of changes.writes) {
        const target = store[w.collection];
        if (w.data === null) target.delete(w.id);
        else if (w.merge && target.has(w.id)) target.set(w.id, deepMerge(target.get(w.id)!, w.data));
        else target.set(w.id, { ...w.data, id: w.id });
      }
      store.audit.push(...changes.audit);
      emit();
    },
  };
}

function fresh(): Store {
  const data = generateDataset(todayISO());
  const toMap = (items: { id: string }[]) => new Map(items.map((i) => [i.id, i as unknown as Record<string, unknown>]));
  return {
    employees: toMap(data.employees),
    projects: toMap(data.projects),
    assignments: toMap(data.assignments),
    timesheets: toMap(data.timesheets),
    meta: new Map([["seed", { version: SEED_VERSION }]]),
    audit: [],
  };
}

/** Scalanie jak w Firestore set(…, { merge: true }): zagnieżdżone obiekty są łączone, reszta nadpisywana. */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(source)) {
    const current = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && current && typeof current === "object" && !Array.isArray(current)
        ? deepMerge(current as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

function values<T>(map: Map<string, Record<string, unknown>>): T[] {
  return [...map.values()] as T[];
}

function persist(store: Store) {
  try {
    const plain = Object.fromEntries(
      Object.entries(store).map(([k, v]) => [k, v instanceof Map ? [...v.entries()] : v])
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
  } catch {
    // Brak miejsca lub tryb prywatny — demo działa dalej, tylko bez zapamiętania zmian.
  }
}

function load(): Store | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const plain = JSON.parse(raw);
    return {
      employees: new Map(plain.employees),
      projects: new Map(plain.projects),
      assignments: new Map(plain.assignments),
      timesheets: new Map(plain.timesheets),
      meta: new Map(plain.meta),
      audit: plain.audit ?? [],
    };
  } catch {
    return null;
  }
}

export function resetDemoStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nic */
  }
}

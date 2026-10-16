// Granica między aplikacją a bazą danych.
//
// Ekrany nigdy nie rozmawiają z bazą bezpośrednio. Logika zmian (co zmienić + wpis do dziennika)
// powstaje w commands.ts jako „zestaw zmian", a repozytorium tylko go zapisuje — w Firestore
// jednym atomowym batchem, w trybie demo w pamięci. Przy przejściu na docelowy backend
// (PostgreSQL + API) wymieniamy tylko implementację tego interfejsu.

import type { AuditEvent, Dataset } from "../domain/types";

export type CollectionName = "employees" | "projects" | "assignments" | "timesheets";

export interface Write {
  collection: CollectionName | "meta";
  id: string;
  /** null = usunięcie dokumentu */
  data: Record<string, unknown> | null;
}

export interface ChangeSet {
  writes: Write[];
  /** Wpisy dziennika zapisywane razem ze zmianą (ta sama transakcja) */
  audit: AuditEvent[];
}

export interface Snapshot extends Dataset {
  audit: AuditEvent[];
  seeded: boolean;
}

export interface RepoError {
  code: string;
  message: string;
}

export interface Repository {
  readonly kind: "firebase" | "demo";
  subscribe(onData: (snapshot: Snapshot) => void, onError: (error: RepoError) => void): () => void;
  apply(changes: ChangeSet): Promise<void>;
}

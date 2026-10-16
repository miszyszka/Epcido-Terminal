// Firestore: dane na żywo. Każda zmiana w bazie pojawia się u wszystkich otwartych przeglądarek.
//
// Kolekcje:
//   employees/{id}        — ludzie (docelowo z Dataverse/Enova)
//   projects/{id}         — projekty
//   assignments/{id}      — kto jest w którym zespole
//   timesheets/{projectId}_{poniedziałek} — karta tygodnia projektu, dni wszystkich osób
//   auditLog/{id}         — dziennik zmian, tylko dopisywanie
//   meta/seed             — znacznik wgranych danych testowych

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";
import { getDb } from "../lib/firebase";
import type { AuditEvent } from "../domain/types";
import type { ChangeSet, CollectionName, RepoError, Repository, Snapshot } from "./repository";

const COLLECTIONS: CollectionName[] = ["employees", "projects", "assignments", "timesheets"];
const BATCH_LIMIT = 450; // Firestore przyjmuje maks. 500 operacji w jednym batchu

export function createFirestoreRepository(): Repository {
  const db = getDb();

  return {
    kind: "firebase",

    subscribe(onData, onError) {
      const parts: Partial<Record<CollectionName, unknown[]>> = {};
      let audit: AuditEvent[] | null = null;
      let seeded: boolean | null = null;
      let seedVersion: number | null = null;

      const emit = () => {
        if (COLLECTIONS.some((c) => !parts[c]) || audit === null || seeded === null) return;
        onData({
          employees: parts.employees,
          projects: parts.projects,
          assignments: parts.assignments,
          timesheets: parts.timesheets,
          audit,
          seeded,
          seedVersion,
        } as Snapshot);
      };
      const fail = (e: FirestoreError) => onError(toRepoError(e));

      const unsubs = COLLECTIONS.map((name) =>
        onSnapshot(
          collection(db, name),
          (snap) => {
            parts[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
            emit();
          },
          fail
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, "auditLog"), orderBy("at", "desc"), limit(400)),
          (snap) => {
            audit = snap.docs.map((d) => ({ ...(d.data() as AuditEvent), id: d.id }));
            emit();
          },
          fail
        ),
        onSnapshot(
          doc(db, "meta", "seed"),
          (snap) => {
            seeded = snap.exists();
            seedVersion = snap.exists() ? Number(snap.data()?.version ?? 1) : null;
            emit();
          },
          fail
        )
      );
      return () => unsubs.forEach((u) => u());
    },

    async apply(changes: ChangeSet) {
      // Zmiana + jej wpis w dzienniku idą w tym samym batchu (atomowo).
      // Tylko duże operacje (wgranie danych testowych) są dzielone na kilka batchy.
      const ops = [
        ...changes.writes.map((w) => ({ ref: doc(db, w.collection, w.id), data: w.data, merge: w.merge })),
        ...changes.audit.map((a) => ({
          ref: doc(db, "auditLog", a.id),
          data: a as unknown as Record<string, unknown>,
          merge: false,
        })),
      ];
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          if (op.data === null) batch.delete(op.ref);
          else if (op.merge) batch.set(op.ref, op.data, { merge: true });
          else batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
    },
  };
}

function toRepoError(e: FirestoreError): RepoError {
  if (e.code === "permission-denied")
    return {
      code: e.code,
      message:
        "Baza odrzuciła dostęp. W konsoli Firebase otwórz Firestore → Reguły i opublikuj zawartość pliku firestore.rules.",
    };
  if (e.code === "not-found" || /database .* does not exist/i.test(e.message))
    return {
      code: "not-found",
      message: "Baza Firestore jeszcze nie istnieje. W konsoli Firebase wybierz Firestore Database → Utwórz bazę.",
    };
  if (e.code === "unavailable")
    return { code: e.code, message: "Brak połączenia z Firebase. Sprawdź internet — dane z pamięci podręcznej są nadal widoczne." };
  return { code: e.code, message: e.message };
}

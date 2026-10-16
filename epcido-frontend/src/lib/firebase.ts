// Połączenie z Firebase.
//
// Konfiguracja aplikacji webowej Firebase nie jest tajna — identyfikuje projekt, a nie daje
// uprawnień. O tym, kto co może czytać i zapisywać, decydują reguły w pliku firestore.rules.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtCOonMzjroQWD2RiH-ELd7_ddxDRD8h8",
  authDomain: "epcido-terminal.firebaseapp.com",
  projectId: "epcido-terminal",
  storageBucket: "epcido-terminal.firebasestorage.app",
  messagingSenderId: "16000481623",
  appId: "1:16000481623:web:e23fff50edccd0be0a6612",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getDb(): Firestore {
  if (!db) {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      // Kopia danych w przeglądarce: szybszy start, mniej odczytów, działa przy słabym zasięgu.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}

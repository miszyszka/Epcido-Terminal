# Epcido Terminal — prototyp frontendowy

Prototyp frontendu (React + TypeScript + Vite) do zastąpienia Gantbee.
Dane na razie żyją w localStorage przeglądarki (plik `src/data/store.ts`) —
to świadomy skrót, żeby szybko testować UX bez backendu. Gdy przejdziemy
na Firebase, wymienimy WYŁĄCZNIE implementację funkcji w tym jednym pliku.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz http://localhost:5173 — zobaczysz ekran logowania z listą
użytkowników testowych (różne role). Wybierz dowolnego, żeby zobaczyć
widok danej roli.

## Role i przepływ

- **Planning** — tworzy projekty, przypisuje pracowników (mechanik/elektryk)
- **Pracownik / Team Leader** — wpisuje godziny dzień po dniu
- **Supervisor** — akceptuje godziny swojego zespołu (projekty, do których jest przypisany)
- **Project Manager** — akceptuje zbiorczo godziny już zaakceptowane przez swoich Supervisorów
- **Administrator** — widzi wszystko (na razie jak PM+Planning razem)

## Reset danych testowych

W konsoli przeglądarki: `localStorage.clear()` i odśwież stronę —
dane wrócą do stanu początkowego (`src/mock/seed.ts`).

## Struktura

```
src/
  types.ts              # model domenowy (Employee, Project, TimeEntry...)
  mock/seed.ts           # dane testowe
  data/store.ts           # warstwa danych — tu podmienimy localStorage na Firebase
  context/SessionContext.tsx  # symulowane logowanie (docelowo Firebase Auth)
  components/            # Layout, StatusBadge
  pages/                 # ekrany per rola
```

Pełny plan i architektura docelowa: patrz `PLAN_I_ARCHITEKTURA.md` w projekcie.

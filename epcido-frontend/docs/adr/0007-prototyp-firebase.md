# 0007. Prototyp widoku planisty na Firebase (Firestore)

- Status: Przyjęta
- Data: 2026-10-16
- Decydujący: zespół Epcido Terminal

## Kontekst

Przed prezentacją dla zarządu potrzebujemy działającego prototypu z prawdziwą synchronizacją danych między przeglądarkami — szybko i bez kosztów. Docelowa architektura (PostgreSQL + API, sekcje 6–7 planu) wymaga więcej czasu na infrastrukturę.

## Decyzja

- Prototyp korzysta z **Cloud Firestore** (projekt `epcido-terminal`) z nasłuchiwaniem zmian na żywo i kopią danych w przeglądarce.
- Kod ekranów jest oddzielony od bazy interfejsem `Repository` (`src/data/repository.ts`). Logika zmian i dziennik zmian są w `commands.ts`, niezależnie od bazy.
- Karta czasu pracy to jeden dokument na **projekt i tydzień** (`timesheets/{projectId}_{poniedziałek}`) — mniej odczytów niż dokument na dzień i układ zbliżony do odpowiedzi API Gantbee (godziny w minutach od północy).
- Dziennik zmian (`auditLog`) jest zapisywany w tym samym batchu co zmiana; reguły bazy zabraniają jego edycji i usuwania.
- Tryb demo (`?demo`) trzyma te same dane w pamięci przeglądarki — do pokazów i testów bez bazy.

## Rozważane alternatywy

- **Od razu PostgreSQL + API** — docelowe, ale wolniejszy start.
- **localStorage** (poprzedni prototyp) — brak współdzielenia danych między osobami.
- **Dokument na każdy dzień pracy** — prostsze zapisy pracownika, ale ok. 6 000 odczytów przy każdym otwarciu mapy (limit darmowy: 50 000 dziennie).

## Konsekwencje

- Reguły prototypu nie wymagają logowania i wygasają 31.12.2026 → tylko dane testowe.
- Przy module wpisywania godzin przez pracowników trzeba dodać Firebase Authentication i reguły per rola, albo przejść na docelowy backend.
- Migracja na PostgreSQL: nowa implementacja `Repository`; model danych (`src/domain/types.ts`) jest już zgodny z planem.

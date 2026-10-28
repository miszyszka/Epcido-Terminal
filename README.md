# Epcido Terminal (repozytorium)

System planowania projektów, obsady i czasu pracy dla Epcido. Aplikacja jest w `epcido-frontend/`.

## Gdzie co jest

| Co | Gdzie |
|---|---|
| Kod aplikacji (React + Firebase), uruchamianie | `epcido-frontend/README.md` |
| Stan prac i kontynuacja (zacznij tutaj) | `epcido-frontend/docs/KONTYNUACJA.md` |
| Cel, zakres, architektura, otwarte kwestie | `epcido-frontend/docs/PLAN_I_ARCHITEKTURA.md` |
| Decyzje architektoniczne (ADR) | `epcido-frontend/docs/adr/` |
| Historia wersji | `epcido-frontend/CHANGELOG.md` |
| Brandbook interfejsu | `epcido-frontend/docs/BRANDBOOK.md` |

## Zasady pracy

- Każda wersja to osobna gałąź `vX.Y-opis` i pull request do `main`. Merge robi właściciel.
- Każda zmiana ma wpis w `CHANGELOG.md`, a każda decyzja architektoniczna nowy ADR.
- Przed PR: `npm run build` i `npm run lint` bez błędów.
- Nie commitujemy tokenów, haseł ani danych osobowych (także przykładowych eksportów z Dataverse lub Gantbee).

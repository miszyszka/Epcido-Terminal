# 0004. Timesheet = projekt × tydzień, wstrzymanie całego timesheetu, kategorie, zapotrzebowanie w fazach, Obsada 2.0

- Status: Przyjęta
- Data: 2026-10-17
- Decydujący: zespół Epcido Terminal
- Zastępuje część ADR 0003: definicję timesheetu i stan „nie wysłane" liczony po dniu; pola `needElectricians` / `needMechanics`

## Kontekst

Po przeglądzie wersji 0.4:

1. Definicja timesheetu była błędna („tydzień jednej osoby w jednym projekcie"). Poprawna: **wszystkie godziny wszystkich pracowników jednego projektu w jednym tygodniu**. W tygodniu jest dokładnie tyle timesheetów, ile projektów. Godziny to godziny, zadania to zadania.
2. We wtorek wychodzi wysyłka do Dataverse. Co poszło — ma wyglądać na nienaruszalne. Co nie poszło z powodu braków — wszyscy poza administratorem muszą widzieć, że było do zrobienia, ale już nie mogą tego zmienić.
3. Planning potrzebuje narzędzia pracy: przyszłe projekty, ile ludzi i kiedy potrzeba, kto jest dostępny od kiedy i z jakim doświadczeniem, z zachowaniem zasady, że co najmniej połowa ludzi na projekcie to „nasi", a nie agencja.

Ustalenia z użytkownikiem (2026-10-17): wstrzymywany jest **cały** timesheet; zatwierdza się **tylko po osobie**; kategorie: KNAPP, KARDEX, FORTNA, OTHER.

## Decyzja

**Timesheet** (`src/domain/timesheets.ts`):
- Klucz: `projectId + poniedziałek tygodnia`. Statusy:
  - `open` — przed wtorkiem 00:00 po tygodniu; godziny zmienia się wg ADR 0003;
  - `closed` — tydzień zamknięty, wszystko w porządku, czeka na wtorek 23:00;
  - `sent` — wysłany do Dataverse; nikt nic nie zmienia;
  - `withheld` — zamknięty z błędami, nic z niego nie poszło.
- Błąd = dzień z wpisem bez zatwierdzenia Installation Managera (`unapproved`) **albo** brak wpisu w dzień roboczy (pn–pt), w którym osoba ma zadanie w projekcie (`missing`; `expectedDays`). Ludzie timesheetu: supervisor, osoby z zadaniem w tygodniu, każdy z wpisem.
- Jeden błąd wstrzymuje cały timesheet projektu.
- Wstrzymany timesheet poprawia i zatwierdza tylko administrator (`editRight`, `closedCheck` w poleceniach). Gdy jest kompletny, idzie w najbliższy wtorek 23:00 (`sentAt` = późniejsze z: wysyłka tygodnia, najbliższy wtorek po ostatnim zatwierdzeniu).
- Pozostali widzą komunikat `WITHHELD_MESSAGE`: „Czas minął. Skontaktuj się z administratorem — Twój timesheet nie został wysłany z powodu błędnie wypełnionego timesheetu." — w zatwierdzaniu (SV, IM), na ekranie pracownika i w oknie dnia.
- `SheetIndex` liczy timesheety raz na model i minutę (`sheetsFor`); tygodnie sprzed pierwszych danych są pomijane.
- Liczniki („Masz X dni i Y godzin na zatwierdzenie Z timesheetów", karty projektów, pulpit IM) liczą pary projekt–tydzień.

**Wygląd** (BRANDBOOK 1.3): tydzień zamknięty — dni lekko wyszarzone, w ukośne paski; wysłany — dodatkowo ptaszek, tylko na dniach z wpisem; błąd — szary, wykrzyknik, „Brak wpisu / nie wysłany".

**Zatwierdzanie**: tylko po osobie („Zatwierdź" w wierszu osoby). Brak przycisku dla całego timesheetu. Administrator ma sekcję „Wstrzymane timesheety" z osobami, które mają błędy.

**Kategorie i zapotrzebowanie** (`types.ts`):
- `Project.category: "KNAPP" | "KARDEX" | "FORTNA" | "OTHER"` — wymagane w formularzu.
- `Project.demand: DemandPhase[]` — fazy `{from, to, electricians, mechanics}` (z Team Leaderami tej branży). Potrzeba w tygodniu = maksimum faz, które go obejmują (`needAt`). Starsze dane z `needElectricians` / `needMechanics` są w kliencie zamieniane na jedną fazę na cały projekt.

**Pracownik** (`types.ts`):
- `Employee.employment: "UOP" | "B2B" | "AGENCY"`; „nasi" = UoP + B2B (`isOurs`).
- `Employee.experience: { totalMonths, byCategory }` — miesiące łącznie i w każdej kategorii.
- Zasada „co najmniej połowa naszych" (`oursShare`): ostrzeżenie, gdy agencji jest więcej niż naszych — na karcie projektu, w Obsadzie i w panelu projektu.

**Obsada 2.0** (`/obsada`, `staffing.plan`):
- Filtry branży i kategorii. Trzy siatki w tych samych tygodniach (od bieżącego, 6–18 tygodni wg szerokości):
  - Siła robocza: potrzeba / obsadzone / brakuje / wolni / bilans = wolni − brakujący;
  - Projekty: bieżące (wg końca), potem przyszłe (wg startu);
  - Ludzie: kto, do kiedy, od kiedy wolny, doświadczenie, forma zatrudnienia.
- Panel projektu (`StaffPanel`): fazy z najsłabszym tygodniem, kandydaci (`candidatesFor`) w kolejności:
  1. ci, którzy mogą zacząć od startu fazy (z tygodniem przerwy, jeśli długo pracują);
  2. nasi przed agencją, gdy agencji jest co najmniej tyle co naszych;
  3. doświadczenie w kategorii projektu.
- Dodanie jednym kliknięciem (`planAssignment` z nadanym id). Komunikat ma „Cofnij" (`removeAssignment`). Zadanie można usunąć tylko wtedy, gdy nie ma do niego godzin; usunięcie zapisuje się w dzienniku (`MEMBER_REMOVED`).
- Przeciągnięcie osoby na tydzień projektu otwiera „Zaplanuj dalej" z tym projektem i datą.

## Konsekwencje

- Dane testowe v5 nie są zgodne z v4 (kategorie, fazy, zatrudnienie, doświadczenie). Aplikacja proponuje wymianę jednym przyciskiem; klucz trybu demo: `epcido-demo-v5`.
- Wysyłka do Dataverse jest nadal symulowana: status `sent` wynika z czasu, a nie z odpowiedzi integracji. Docelowo `sentAt` i wynik wysyłki zapisuje backend przy eksporcie (wtorek 23:00), a „wstrzymany" liczy ten sam kod co w kliencie.
- Reguły (kto zmienia zamknięty tydzień) są w kliencie i w poleceniach. Backend albo reguły bazy muszą je powtórzyć po wprowadzeniu logowania.
- Doświadczenie jest dziś liczbą w danych pracownika. Docelowo można je liczyć z historii zadań (miesiące w projektach danej kategorii) plus doświadczenie sprzed Epcido wpisywane ręcznie.

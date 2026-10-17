# 0011. Urlopy z akceptacją, uprawnienia per osoba, ustawienia systemu, raporty Excel, Obsada 3.0

- Status: Przyjęta
- Data: 2026-10-17
- Decydujący: zespół Epcido Terminal
- Zmienia: ADR 0008 (role), ADR 0009 (nieobecność zatwierdzana z godzinami), ADR 0010 (terminy na sztywno, „nasi")

## Kontekst

Po przeglądzie 0.5:

1. Urlopy muszą być widoczne w planie zespołu z informacją, kto je zaakceptował. Akceptuje **ktokolwiek przypisany do projektu: supervisor, Installation Manager — albo HR**. Kto co może, ustawia administrator. **L4 obowiązuje od razu.**
2. Potrzebny dział HR (widok pracowników, akceptacja urlopów) i możliwość dodawania przez administratora użytkowników z wybranymi funkcjami oraz zmiany uprawnień pojedynczym osobom.
3. Administrator potrzebuje raportów do Excela i ustawień systemu (terminy, wysyłka, kategorie, oddziały).
4. Planning potrzebuje czytelnego obrazu wypełnienia projektów: dwa słupki (potrzeba / przypisani), elektrycy czerwień, mechanicy błękit w całym systemie, szybsze przeciąganie i podpowiedzi.
5. „Nasi" → „EPCIDO". Pracownicy i TL nie muszą wiedzieć o wstrzymanych timesheetach.

## Decyzja

**Uprawnienia** (`src/domain/permissions.ts`):
- Uprawnienia osoby = domyślne dla roli + `Employee.grants` − `Employee.revokes`. Funkcja `permissionsOf`; `can()` z pamięcią podręczną na obiekt osoby.
- Nowe role: `HR` (ludzie, akceptacja urlopów wszystkich, kalendarz) i `CUSTOM` (bez uprawnień z roli — administrator zaznacza je ręcznie). Nowe stanowiska: `HR`, `OFFICE` (biuro).
- Nowe uprawnienia: `map.view`, `hours.approveAll`, `hours.fixWithheld`, `leave.own`, `leave.approveProject`, `leave.approveAll`, `leave.view`, `reports.export`, `users.manage`, `settings.manage`.
- Sprawdzenia `role === "ADMIN"` zastąpione uprawnieniami (zatwierdzanie wszędzie, poprawa wstrzymanych, zamknięty tydzień w poleceniach).
- `seesDispatch(user)`: wysyłkę i wstrzymanie widzi tylko ktoś, kto zatwierdza godziny. Pracownik i TL widzą zamknięty tydzień bez szczegółów.
- Zmiany użytkowników: polecenie `saveUser` — walidacja (nazwa, e-mail, unikalny e-mail), nie można odebrać sobie `users.manage`, w dzienniku `USER_CREATED` / `USER_UPDATED` z dodanymi i odebranymi uprawnieniami.

**Urlopy** (`LeaveRequest`, kolekcja `leaves`, `src/domain/leaves.ts`, polecenia `requestLeave`, `decideLeave`, `cancelLeave`, `confirmSickNote`):
- Rodzaje: urlop, L4, inna nieobecność. Urlop i inna → `PENDING`; L4 → od razu `APPROVED` (HR potwierdza dokument: `confirmedAt/By`).
- Kto akceptuje: `canDecideLeave` — `leave.approveAll` (HR, administrator) albo `leave.approveProject` i bycie SV / IM / PM projektu, w którym wnioskujący pracuje w czasie wniosku (`leaveProjects`). Nikt nie akceptuje własnego wniosku.
- Akceptacja wpisuje dni nieobecności do timesheetów: dni robocze z zadaniem, w otwartych tygodniach (w zamkniętych tylko z `hours.fixWithheld`), od razu zatwierdzone do końca, z `leaveId`. Dni z zatwierdzonymi godzinami pracy zostają (liczone jako pominięte).
- Odrzucenie wymaga powodu (widzi go pracownik). Cofnięcie zaakceptowanego: jeśli trwa — wniosek kończy się wczoraj, dni od dziś znikają z timesheetów; jeśli nie — `CANCELLED` i wszystkie dni znikają. Czekający może anulować sam wnioskujący.
- Dzień z wniosku nie jest edytowalny w oknie dnia — zmienia się go cofnięciem wniosku. Zgłoszenie nieobecności przez pracownika (dawne `reportAbsence`) zastąpione wnioskiem.
- Widoczność: plan zespołu (blok na wierszu osoby z osobą akceptującą), Obsada (wiersze ludzi, słupki — urlop jako kreski w wypełnieniu), mapa i oś czasu (dymek dnia), ekran Urlopy (wnioski z wpływem na obsadę, L4, kalendarz, decyzje), ekran pracownika (Moje wnioski).
- Obsada liczy osobę jako nieobecną w tygodniu, gdy wniosek zabiera jej co najmniej 3 dni robocze (`leaveInWeek`).

**Ustawienia systemu** (`meta/settings`, `src/domain/settings.ts`, polecenie `saveSettings`):
- Termin zatwierdzania (dzień po tygodniu + godzina), wysyłka do Dataverse (dzień + godzina), kategorie projektów, oddziały, minimalny udział EPCIDO, minimalna przerwa, „długo bez przerwy".
- Funkcje domeny czytają bieżące ustawienia (`getSettings`); model danych podmienia je przy każdej zmianie w bazie. `lockAt` = minuta po terminie, `exportAt`, `nextExportAfter` — z ustawień.
- `ProjectCategory` jest teraz napisem; nie można usunąć kategorii ani oddziału używanego w projektach.

**Raporty** (`src/domain/reports.ts`, ekran `/raporty`):
- Siedem raportów: godziny szczegółowo, timesheety projekt × tydzień, godziny na osobę, urlopy, obsada i zapotrzebowanie, pracownicy, wstrzymane timesheety. Filtry: daty, projekty (kategoria / wybór), branża, umowa, stan godzin.
- Plik .xlsx: biblioteka `write-excel-file` 4.1.1 (MIT, jedna zależność `fflate`), ładowana dopiero przy pobraniu. Daty zapisywane jako czas ścienny (UTC), żeby Excel nie przesuwał ich o strefę.
- Pobranie raportu zapisuje `REPORT_EXPORTED` w dzienniku (kto, jaki raport, zakres) — raporty zawierają dane osobowe.

**Obsada 3.0** (`StaffingView`, `AutoStaffDialog`):
- Komórka projektu: dwa pionowe słupki (E, M) — obrys = potrzeba, wypełnienie = w planie, kreski = urlop. Wykres siły roboczej: potrzeba, w planie, wolni.
- „Wymaga uwagi": braki przed startem (≤ 4 tyg.), tygodnie bez rezerwy, udział EPCIDO poniżej celu, długo bez przerwy, urlopy, ludzie bez przydziału — każde z akcją.
- Upuszczenie osoby na tydzień projektu = zadanie od tego tygodnia (albo od dnia, w którym osoba jest wolna, z tygodniem przerwy po długim ciągu) do końca fazy, z „Cofnij". Shift = okno z opcjami.
- Propozycja obsady: dla każdej przyszłej fazy i branży kandydaci (`candidatesFor`), dobór z pilnowaniem udziału EPCIDO, bez urlopu w fazie, z doświadczeniem w kategorii. W Obsadzie zapis od razu (`planMany`, jedno „Cofnij" — `removeMany`); w planie zespołu — do niezapisanego planu.
- Kliknięcie projektu otwiera plan zespołu (dane projektu zwinięte). Panel boczny z 0.5 usunięty — jego rolę przejęła propozycja obsady.
- Filtry ludzi (Obsada i Ludzie): EPCIDO / agencja, suwaki stażu łącznie i w kategorii.

**Wygląd** (BRANDBOOK 1.4): kolory branż `--el` / `--me`, baner terminu bez gradientu, licznik w docku w jednej linii z nazwą, narzędzia administratora jako ikony, mapa bez „W Dataverse do" i liczby osób.

## Konsekwencje

- Dane testowe v6 (HR, controlling z własnymi uprawnieniami, wnioski urlopowe, ustawienia). Klucz demo: `epcido-demo-v6`; aplikacja proponuje wymianę starszych danych.
- Uprawnienia nadal sprawdza tylko klient i polecenia. Logowanie i reguły bazy oparte o `permissionsOf` to warunek wejścia na prawdziwe dane — szczególnie dla urlopów i raportów (dane osobowe).
- `npm audit` zgłasza znane podatności w `@grpc/grpc-js` (zależność serwerowa Firebase, nieużywana w przeglądarce) — do zamknięcia przy aktualizacji Firebase; `write-excel-file` nie dokłada nowych.
- Kategorie z ustawień nie mają osobnych kolorów etykiet (neutralna); doświadczenie w nowej kategorii zaczyna się od zera.

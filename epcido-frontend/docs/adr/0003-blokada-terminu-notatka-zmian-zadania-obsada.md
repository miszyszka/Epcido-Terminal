# 0003. Blokada po terminie, zmiany z notatką, zadania z przerwami, Obsada

- Status: Przyjęta
- Data: 2026-10-16
- Decydujący: zespół Epcido Terminal
- Zastępuje część ADR 0002: odrzucanie godzin („do poprawy") i termin edycji

## Kontekst

Po przeglądzie wersji 0.3:

1. Godziny tygodnia trzeba zatwierdzić do poniedziałku. To, czego nikt nie zatwierdził, nie może „wisieć" — musi być jasne, że nie poszło do Dataverse.
2. Odrzucanie dni do poprawy przez pracownika jest zbędne. Pracownik poprawia dzień, dopóki nikt go nie zatwierdził; później zmienia go osoba zatwierdzająca — także dzień już zatwierdzony — i musi zostać ślad, kto i co zmienił.
3. Suma godzin do zatwierdzenia nic nie mówi. Liczy się, ile czasu zostało i ile timesheetów.
4. Pracownik ma przerwy (wyjazd do domu). Planning potrzebuje kilku zadań na osobę w projekcie i narzędzia, które pokaże, kto się zwalnia, gdzie brakuje ludzi i kto długo pracuje bez przerwy.

## Decyzja

**Terminy** (`src/domain/workflow.ts`):
- Tydzień W trzeba zatwierdzić do końca (supervisor i Installation Manager) do poniedziałku W+1, 23:59.
- Od wtorku 00:00 każdy dzień tygodnia W, który nie jest zatwierdzony do końca, ma stan **„nie wysłane do Dataverse"** (`isLocked`): szary, zakreskowany, z wykrzyknikiem. Zmienia i zatwierdza go tylko **administrator**. Supervisor i IM widzą informację, ile takich timesheetów jest w ich projektach.
- Wysyłka: wtorek 23:00. Dzień zatwierdzony przez administratora po terminie idzie w najbliższą wtorkową wysyłkę (`sentAt` = późniejsze z: wysyłka tygodnia, najbliższy wtorek 23:00 po zatwierdzeniu). W prototypie wysyłka jest symulowana — ptaszek pojawia się, gdy minie `sentAt`.
- Licznik u góry i baner: „Masz X dni i Y godzin na zatwierdzenie Z timesheetów" do najbliższego terminu; poniżej doby — na czerwono. **Timesheet = tydzień jednej osoby w jednym projekcie.**

**Zmiany godzin** (`editRight`, `editEntry`):
- Pracownik: swój dzień, dopóki ma status „do zatwierdzenia", nie minął termin i w tym dniu ma zadanie.
- Supervisor projektu, Installation Manager projektu, administrator: każdy dzień zespołu, także zatwierdzony — do terminu; po terminie tylko administrator. Dni wysłanych do Dataverse nie zmienia nikt.
- Każda zmiana dopisuje wpis do **notatki dnia** (`DayEntry.history`: kto, kiedy, „przed → po", komentarz) i do dziennika zmian (`HOURS_EDITED`). Notatki nie da się edytować ani usunąć.
- Zmiana nie cofa zatwierdzenia. W oknie dnia osoba zatwierdzająca może od razu „Zapisz i zatwierdź".
- Usunięto status `REJECTED`, powód odrzucenia i ekran „do poprawy".

**Zatwierdzanie**: bez „Zatwierdź wszystko" i bez sum godzin. Zatwierdza się timesheet (wiersz) albo dzień (w oknie dnia). Dymek na dniu mówi tylko, kto i kiedy zatwierdził.

**Zadania i przerwy**:
- `Assignment` ma pole `task` (nazwa zadania, jak `taskname` w Gantbee). Osoba może mieć kilka zadań w projekcie; zadania jednej osoby nie mogą na siebie nachodzić (walidacja w `saveProject`).
- Luka między zadaniami = przerwa: brak zadania → brak wpisu godzin (ekran pracownika pokazuje „Przerwa").
- Oś planu zespołu sięga zawsze 3 miesiące za najdalsze zadanie i rośnie podczas przeciągania.

**Obsada** (`src/domain/staffing.ts`, ekran `/obsada`, uprawnienie `staffing.plan` — Planning i administrator):
- Projekt ma zapotrzebowanie: `needElectricians`, `needMechanics` (razem z Team Leaderami tej branży). Wpisuje PM przy tworzeniu projektu.
- Obsada tygodnia = osoby z zadaniem w dni robocze tygodnia; brak = zapotrzebowanie − obsada.
- Ciąg pracy = zadania osoby ze wszystkich projektów scalone, jeśli luka < 5 dni. „Długo bez przerwy" = ciąg ≥ 8 tygodni i brak zaplanowanej przerwy w ciągu 3 tygodni. „Zwalnia się" = ciąg kończy się w ciągu 8 tygodni i nic nie jest zaplanowane w ciągu 3 tygodni po nim.
- Akcje: „Zaplanuj dalej" (przerwa 0–3 tyg. → start od poniedziałku → projekt z brakami jego branży → nowe zadanie, `planAssignment`) i „Przerwa" (podział bieżącego zadania, `insertBreak`). Obie zapisują się w dzienniku zmian projektu.

**Wyszukiwarka** w górnej linii zamiast filtra w docku: podpowiada projekty, ludzi, zatwierdzanie u supervisora, ekrany i akcje — tylko w zakresie uprawnień osoby. Ekrany nie są już filtrowane wspólnym polem wyszukiwania.

## Konsekwencje

- Dane testowe v4 nie są zgodne z v3 (zadania, zapotrzebowanie, notatki, brak odrzuceń) — aplikacja proponuje wymianę jednym przyciskiem.
- Reguły uprawnień do zmian są na razie w kliencie (`editRight`) i w poleceniach. W wersji produkcyjnej to samo musi sprawdzać backend albo reguły bazy oparte o logowanie — dziś reguły Firestore wpuszczają każdego (dane testowe, do 31.12.2026).
- Prawdziwa wysyłka do Dataverse (wtorek 23:00) wymaga zadania po stronie serwera, które oznaczy `exported` i zapisze `exportedAt` (PLAN, sekcja 8).

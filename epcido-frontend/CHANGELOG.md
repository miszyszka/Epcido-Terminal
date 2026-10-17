# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje: SemVer.

## [0.5.0] - 2026-10-17

### Nowe funkcje
- **Timesheet = projekt × tydzień.** Jeden timesheet to wszystkie godziny wszystkich osób jednego projektu w jednym tygodniu; w tygodniu jest tyle timesheetów, ile projektów. Liczniki, baner terminu, karty projektów i pulpit liczą timesheety w tym znaczeniu. Godziny to godziny, zadania to zadania.
- **Tydzień zamknięty we wtorek.** Od wtorku 00:00 poprzedni tydzień jest nienaruszalny: dni są lekko wyszarzone, w ukośne paski. Kompletny timesheet idzie do Dataverse we wtorek 23:00 i dostaje ptaszek.
- **Timesheet wstrzymany.** Jeśli w zamkniętym tygodniu choć jeden dzień nie jest zatwierdzony do końca albo brakuje wpisu w dzień roboczy z zadaniem, cały timesheet projektu nie idzie do Dataverse. Dni z błędem mają wykrzyknik („Brak wpisu", „nie wysłany"); wszyscy poza administratorem widzą: „Czas minął. Skontaktuj się z administratorem — Twój timesheet nie został wysłany z powodu błędnie wypełnionego timesheetu." Poprawia i zatwierdza tylko administrator — w sekcji „Wstrzymane timesheety" — a kompletny timesheet idzie w najbliższy wtorek.
- **Kategorie projektów:** KNAPP, KARDEX, FORTNA, OTHER — wybór w danych projektu, etykieta przy nazwie projektu na mapie, osi czasu, w obsadzie i wyszukiwarce.
- **Zapotrzebowanie w fazach:** PM wpisuje fazy od–do z liczbą elektryków i mechaników (np. rozruch, główna, wykończenie). Obsada liczy braki tydzień po tygodniu.
- **Forma zatrudnienia i doświadczenie pracowników:** UoP, B2B (razem „nasi") i agencja; miesiące doświadczenia łącznie i w każdej kategorii. Widoczne w Ludziach, Obsadzie, planie zespołu i przy dodawaniu osób.
- **Zasada „co najmniej połowa naszych":** karta projektu i Obsada pokazują „nasi X · agencja Y" i ostrzegają, gdy agencji jest więcej.
- **Obsada 2.0** (Planning, administrator):
  - filtry branży (obie / elektrycy / mechanicy) i kategorii;
  - **Siła robocza** w tygodniach: potrzeba, obsadzone, brakuje, wolni i bilans (ujemny = trzeba szukać ludzi spoza obecnej załogi);
  - **Projekty** w tygodniach z „E 4/7 · M 3/4", bieżące i przyszłe (kursywą, z datą startu); kliknięcie otwiera panel projektu;
  - **panel projektu**: fazy z brakami, pasek nasi / agencja z kreską 50%, kandydaci dopasowani do fazy (najpierw ci, którzy mogą zacząć od startu fazy, potem nasi przed agencją, potem doświadczenie w kategorii projektu), „Dodaj" jednym kliknięciem z „Cofnij" w komunikacie, zespół fazy z usuwaniem przyszłych zadań;
  - **Ludzie** w tygodniach: filtry zwalniają się / wolni / bez przerwy / wszyscy, sortowanie „od kiedy wolni" albo „doświadczenie", przeciąganie osoby na tydzień projektu (otwiera „Zaplanuj dalej" z tym projektem i datą).
- Pięć przyszłych projektów w danych testowych (start za 3–13 tygodni) z zapotrzebowaniem w fazach.

### Zmiany
- Panel roboczy: wybór roli bez nachodzących na siebie ramek (osoba i „Zmień" w jednym wierszu).
- Zatwierdzanie tylko po osobie — bez przycisku dla całego timesheetu. W tygodniu widać „Brak wpisu: …" dla dni bez wpisu.
- Ekran pracownika: baner wstrzymanego timesheetu (kliknięcie przenosi do tego tygodnia), status dnia „zamknięte" albo „brak wpisu — nie wysłany".
- Legenda: „Wysłane (zamknięte)" i „Błąd — nie wysłany".
- Dane testowe v5 (kategorie, fazy, zatrudnienie, doświadczenie, 3 wstrzymane timesheety). Aplikacja zaproponuje wymianę starszych danych.

## [0.4.0] - 2026-10-16

### Nowe funkcje
- **Obsada** — narzędzie tylko dla Planningu (osobny przycisk w docku): projekty w kolejnych tygodniach z obsadą „E 6/8 · M 4/4" i datą końca, ludzie w czasie (paski w kolorach projektów, przerwy), filtry „zwalnia się", „bez przydziału", „długo bez przerwy", „projekty z brakami". Okno „Zaplanuj dalej": przerwa na wyjazd → start → projekt, w którym brakuje tej branży. Okno „Przerwa" dzieli bieżące zadanie.
- **Zapotrzebowanie projektu** (elektrycy, mechanicy) w danych projektu — z tego Obsada liczy braki.
- **Zadania w planie zespołu**: kilka zadań na osobę, nazwa zadania, przerwa między zadaniami (w przerwie nie ma wpisu godzin), panel zadania z „Wstaw przerwę" i „Usuń zadanie", nowe zadanie kliknięciem w pusty wiersz. Oś sięga 3 miesiące za najdalsze zadanie i rośnie przy przeciąganiu.
- **Okno dnia z notatką zmian**: supervisor, Installation Manager i administrator zmieniają godziny, przerwę albo wpisują nieobecność — także w dniach już zatwierdzonych. Każda zmiana zostaje w notatce dnia (kto, kiedy, przed → po, komentarz). „Zapisz i zatwierdź" w jednym kroku.
- **Stan „nie wysłane do Dataverse"**: od wtorku 00:00 dni poprzedniego tygodnia bez pełnego zatwierdzenia są szare, zakreskowane, z wykrzyknikiem; zatwierdza je już tylko administrator, a idą w najbliższej wysyłce.
- **Wyszukiwarka u góry** z podpowiedziami na żywo: projekty, ludzie, zatwierdzanie u supervisora, ekrany, „Dodaj nowy projekt".

### Zmiany
- Zatwierdzanie: zamiast panelu z dużymi liczbami i „Zatwierdź wszystko" — baner „Masz X dni i Y godzin na zatwierdzenie Z timesheetów" (czerwony, gdy została mniej niż doba). Nigdzie nie ma sumy godzin do zatwierdzenia. Zatwierdza się timesheet (wiersz) albo dzień.
- Dymek na dniu w zatwierdzaniu i na osi czasu pokazuje tylko, kto i kiedy zatwierdził (i zmienił).
- Usunięto odrzucanie godzin i „do poprawy". Pracownik poprawia dzień, dopóki nikt go nie zatwierdził.
- Mapa: legenda i nawigacja tygodni oraz nagłówek dni przyklejone u góry przy przewijaniu; z legendy zniknął „Koniec edycji"; doszło „Nie wysłane"; przerwy w zadaniach kreskowane.
- Dock na wysokość ikon, bez wyszukiwarki.
- Struktura: wszyscy jedna osoba pod drugą, grupy jedna pod drugą.
- Tytuły ekranów bez podpisów pod spodem.
- Nowy krój: Plus Jakarta Sans (kontrast grubości 800 / 300, liczby tabelaryczne) zamiast Archivo.
- Bardziej zróżnicowane kolory projektów (12 barw z całego koła).
- Słowo „budowa" zastąpione „projektem".
- Pulpit IM: timesheety zamiast godzin, kolumna „Nie wysłane", postęp tygodnia w %.
- Dane testowe v4: zadania z przerwami, zapotrzebowanie i braki, godziny i osoby zatwierdzeń, notatki zmian, dni nie wysłane.

## [0.3.0] - 2026-10-16

### Nowe funkcje
- **Zatwierdzanie godzin** (Supervisor, Installation Manager, Administrator): duże liczby pozycji i godzin, termin i godzina wysyłki, zaznaczanie dni, zatwierdzanie tygodnia osoby, projektu albo wszystkiego, odrzucanie z powodem.
- **Pulpit Installation Managera**: supervisorzy, ich zaległości, „po terminie", postęp tygodnia i to, co czeka na IM.
- **Ekran pracownika** (telefon): duże godziny start/koniec z krokami 15 min, przerwa przyciskami, wysyłka, tydzień w kolorach, zgłoszenie nieobecności (urlop, L4, inna), dni do poprawy.
- **Edytor projektu na pełnym ekranie** z planem zespołu: paski od–do przeciągane i rozciągane, „Przypisz pracowników" z informacją, kto jest wolny, kolizje z innymi projektami, historia zmian.
- **Role i uprawnienia**: Administrator, Planning, Project Manager, Installation Manager, Supervisor, Team Leader, pracownik. Nawigacja i widoczne projekty zależą od roli.
- **Panel roboczy** (prototyp): przełączanie użytkowników i macierz „kto co może".
- „Cześć, *imię*" i „Masz X pozycji do zatwierdzenia" u góry; przycisk „Dodaj nowy projekt" dla Admina, Planning i PM.
- Przełącznik wersja mobilna / desktopowa (podgląd telefonu).
- Okresy pracy od–do i przechodzenie osób między projektami; wysyłka do Dataverse oznaczana zielonym ptaszkiem.

### Zmiany
- Mapa: wiersze = ludzie, kolumny = dni, nad kropkami numery dni i miesiąc, weekendy inaczej, kreska końca edycji między poniedziałkiem a wtorkiem. Liczba tygodni dopasowuje się do szerokości ekranu.
- Oś czasu: duże komórki z godzinami od–do, przerwą i powodem nieobecności; bez podświetlania wierszy i dymków na znacznikach.
- Status „Czeka" → „Do zatwierdzenia".
- Własne listy wyboru zamiast systemowych; poprawione marginesy w tabelach.
- Usunięto „+" z docku.
- Dane testowe v3 (Project Managerowie, okresy pracy, wysłane tygodnie, odrzucenia).

## [0.2.0] - 2026-10-16

### Nowe funkcje
- Widok planisty: mapa projektów (siatki dni), oś czasu, struktura zespołów, lista ludzi.
- Tworzenie i edycja projektu (numer, klient, termin, oddział, Installation Manager, Supervisor, kolor, pola Dataverse).
- Zespół projektu: dodawanie, usuwanie i przenoszenie Team Leaderów, elektryków i mechaników.
- Historia zmian projektu (kto, kiedy, co zmienił — przed i po).
- Synchronizacja na żywo przez Firebase Firestore; tryb demo bez bazy (`?demo`).
- Dane testowe jednym przyciskiem: 134 osoby, 10 projektów, godziny z 10 tygodni.
- Brandbook (`docs/BRANDBOOK.md`) i jego żywy podgląd (`/brandbook`).

### Zmiany
- Nowy design: paleta Deep Forest / Golden Hour / Terracotta Clay / Warm Sand, krój Archivo, pływająca nawigacja zamiast górnego paska.
- Usunięto ekrany prototypu 0.1 (wpis godzin, akceptacje SV i PM) — wrócą w nowym designie w kolejnym etapie.

## [0.1.0] - 2026-10-16

### Nowe funkcje
- Pierwszy prototyp: wpis godzin, akceptacja przez Supervisora i PM, planowanie (dane w localStorage).

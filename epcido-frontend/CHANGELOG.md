# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje: SemVer.

## [0.7.0] - 2026-10-19

### Nowe funkcje
- **Podgląd osoby.** Kliknięcie w nazwisko w dowolnym widoku (tabele, plany, kolejka zatwierdzania, struktura, urlopy) otwiera lekkie okno: gdzie osoba jest teraz, kiedy kończy, kiedy ma przerwę i dokąd leci dalej — na osi 12 tygodni; jej godziny z 4 tygodni (suma, zatwierdzone, czekające, nieobecności, dni tygodnia, lista dni bez podpisu) oraz dane, umowa i doświadczenie w kategoriach.
- **Moduł „Ludzie" w planowaniu projektu.** Ten sam moduł co w Obsadzie, pod planem zespołu: kto jest wolny w kolejnych tygodniach, z filtrem stanowisk i zaznaczaniem okresu.
- **Zaznaczanie okresu myszą.** Naciśnięcie i przeciągnięcie po pasku osoby otwiera okno z wyborem: przypisanie do projektu (z zadaniem i datami) albo powrót do domu — przerwa w trwającym zadaniu.
- **Filtr stanowisk w module „Ludzie"**: elektrycy, mechanicy, TL, SV albo wszyscy; supervisorzy wchodzą na tablicę ze swoimi projektami (nadzór zamiast zadania).
- **Podgląd kolejki supervisorów** dla Installation Managera: sekcja „Czeka na Twoich supervisorów" na ekranie Zatwierdzanie — kto, w którym tygodniu i ile dni czeka na podpis. Bez przycisku zatwierdzania: to nie jest jego podpis.
- **Potwierdzenie przed zapisem.** Zapis projektu i planu zespołu, porzucenie niezapisanych zmian, przeciągnięcie osoby na tydzień projektu, propozycja obsady, „Zaplanuj", „Przerwa" i zaznaczenie okresu pokazują listę zmian i pytają, zanim cokolwiek trafi do bazy.

### Zmiany
- **Godziny zatwierdza się raz.** Supervisor zatwierdza dni zespołu (TL, elektrycy, mechanicy) i to jest zatwierdzenie ostateczne — timesheet domyka się bez udziału Installation Managera. IM zatwierdza wyłącznie godziny swoich supervisorów. Project Manager nie zatwierdza godzin w ogóle. Szczegóły i ryzyka: ADR 0012.
- **Installation Manager widzi wszystkie projekty firmy** — z filtrem „Moje / Innych IM / Wszystkie" i znacznikiem przy każdym projekcie, w Pulpicie, na Mapie, Osi czasu, w Strukturze i Obsadzie.
- **Obsada ma jedną oś tygodni**, przyklejoną do góry ekranu: przy najniższym projekcie wciąż widać, od którego tygodnia zaczyna się kolumna, a moduł „Ludzie" stoi dokładnie pod projektami — tygodnie pokrywają się w pionie.
- **Szary pasek w planie zespołu** („ta sama osoba w innym projekcie") jest teraz przyciskiem — kliknięcie otwiera tamten projekt.
- **Panel roboczy prototypu** wygląda jak terminal (czarne tło, monospace) i chowa się sam po wybraniu osoby. Ma się odcinać od aplikacji — to rusztowanie, nie produkt.
- **Ruch w całym interfejsie** zebrany w `src/styles/motion.css`: wejścia ekranu i kart, reakcje przycisków, kafelków dni i pasków, przejścia słupków. Ustawienie systemowe „ogranicz ruch" wyłącza wszystko.

### Poprawki
- **Okna dialogowe ucinały się na dole ekranu** i nie dało się ich przewinąć (np. „Zaproponuj obsadę" po zjechaniu na dół Obsady). Okna żyją teraz w warstwie poza przewijaną stroną i są środkowane flexem, a nie gridem — `max-height` faktycznie przycina je do ekranu.
- **Zapis planu zespołu przepuszczał kolizje między projektami.** Plan pokazywał je na szaro, ale `saveProject` sprawdzał nachodzenie tylko wewnątrz jednego projektu. Teraz odrzuca też zadanie nachodzące na zadanie tej samej osoby w innym projekcie, z nazwą projektu i datami.
- **„Przypisz do…" na liście ludzi** skracał tylko zadanie trwające w dniu przeprowadzki, a zadanie zaplanowane później zostawało i nachodziło na nowe. Teraz nowe zadanie kończy się dzień przed kolejnym, a gdy to niemożliwe — polecenie odmawia i mówi dlaczego.
- Komunikaty i panele pływające (dock, podgląd osoby, potwierdzenia) nie uciekają już razem z przewijaniem strony.

## [0.6.0] - 2026-10-17

### Nowe funkcje
- **Urlopy z akceptacją.** Pracownik składa wniosek (urlop, inna nieobecność) albo zgłasza L4 — L4 obowiązuje od razu, HR potwierdza dokument. Akceptuje supervisor albo Installation Manager projektu, w którym osoba wtedy pracuje, albo HR; odrzucenie wymaga powodu. Zaakceptowane dni trafiają do timesheetu jako nieobecność (zatwierdzona).
- **Ekran Urlopy** (SV, IM, HR, administrator): wnioski do akceptacji z wpływem na obsadę projektu („elektrycy w tygodniu 19.10: 6 → 5 z 8") i listą osób, które w tym czasie też mają wolne; L4 do potwierdzenia; kalendarz nieobecności na 8 tygodni; ostatnie decyzje z „Cofnij"; wpisanie nieobecności za pracownika.
- **Urlopy w planie zespołu**: blok na wierszu osoby — kto zaakceptował i kiedy; wnioski czekające kreskowane. Urlopy także w Obsadzie, na mapie i osi czasu (dymek dnia).
- **Moje wnioski** na ekranie pracownika: stan, kto zaakceptował, powód odrzucenia, anulowanie czekającego.
- **HR i użytkownicy z własnymi uprawnieniami.** Rola HR (ludzie, urlopy wszystkich, L4). Administrator dodaje użytkowników (np. HR, controlling) z rolą albo z ręcznie zaznaczonymi funkcjami.
- **Użytkownicy** (administrator): wszyscy użytkownicy, rola, liczba uprawnień, dodane i odebrane; zmiana roli i pojedynczych uprawnień, wyłączanie kont.
- **Raporty** (administrator): 7 raportów do Excela (.xlsx) — godziny szczegółowo, timesheety, godziny na osobę, urlopy, obsada, pracownicy, wstrzymane timesheety; filtry dat, projektów, branży, umowy i stanu godzin; podgląd przed pobraniem. Pobranie zapisuje się w dzienniku.
- **Ustawienia systemu** (administrator): termin zatwierdzania i godzina wysyłki do Dataverse, kategorie projektów, oddziały, minimalny udział EPCIDO, przerwa na wyjazd, „długo bez przerwy".
- **Obsada 3.0**:
  - w komórkach projektów dwa słupki — elektrycy (czerwień) i mechanicy (błękit): obrys = potrzeba, wypełnienie = w planie, kreski = urlop; pod słupkiem brak „−2";
  - wykres siły roboczej (potrzeba, w planie, wolni) zamiast tabeli liczb;
  - „Wymaga uwagi": braki przed startem projektów, tygodnie bez rezerwy, za mało EPCIDO, długo bez przerwy, urlopy, ludzie bez przydziału — z akcjami;
  - przeciągnięcie osoby na tydzień projektu od razu dodaje ją do końca fazy (z „Cofnij"), podgląd nad komórką; z Shift — okno z opcjami;
  - **propozycja obsady**: brakujący ludzie dobrani automatycznie (dostępność, EPCIDO przed agencją, bez urlopu, staż w kategorii), zaznacz i dodaj jednym kliknięciem;
  - kliknięcie projektu otwiera od razu plan zespołu;
  - filtry ludzi: EPCIDO / agencja, suwaki stażu łącznie i w kategorii (także w Ludziach).
- **Plan zespołu**: wiersz „Zapotrzebowanie" ze słupkami E/M tydzień po tygodniu, „Zaproponuj obsadę", pełne imiona i nazwiska (kolumna 300 px, dwie linie), dane projektu można zwinąć.

### Zmiany
- Kolory branż w całym systemie: E — czerwień, M — błękit (znaczniki, słupki, wykresy); TL z kreską w kolorze branży.
- „Nasi" → **EPCIDO** wszędzie.
- Mapa: po prawej nad projektem tylko „Do zatwierdzenia" i czerwone „! Nie wysłany: tydz. N" — bez liczby osób, EPCIDO/agencji i „W Dataverse do".
- Pracownicy i Team Leaderzy nie widzą informacji o wysyłce i wstrzymanych timesheetach — dla nich tydzień jest „zamknięty".
- Baner terminu: płaska karta bez gradientu, termin i wysyłka po prawej.
- Dock: licznik jako pigułka w jednej linii z nazwą; narzędzia administratora (Raporty, Użytkownicy, Ustawienia) jako ikony.
- Uprawnienia: rola + dodane − odebrane; sprawdzenia „czy administrator" zastąpione uprawnieniami.
- Dane testowe v6.

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

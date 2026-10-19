# Epcido Terminal — brandbook interfejsu

> Wersja 1.4 · obowiązuje dla wszystkich modułów (planowanie, czas pracy, zatwierdzanie, obsada, komunikacja, aplikacja mobilna).
> Źródło prawdy w kodzie: `src/styles/tokens.css`. Żywy podgląd: ekran **Brandbook** w aplikacji (`/brandbook`).
> Zmiana tokenu = zmiana w tym pliku + w `tokens.css` w tym samym commicie.

---

## 1. Charakter

Epcido montuje instalacje w kilkudziesięciu projektach naraz. Terminal ma działać jak dobrze prowadzona tablica w biurze projektu: wszystko widać od razu, nic nie krzyczy, a kolor oznacza zawsze to samo. W całym interfejsie mówimy **„projekt"** — nigdy „budowa".

Cztery zasady, które rozstrzygają spory projektowe:

1. **Kolor to stan.** Zielony, żółty, czerwony i szary-kreskowany opisują wyłącznie stan dnia pracy. Nigdy nie służą do dekoracji, wyróżnień ani marketingu.
2. **Dzień to kropka.** Jeden dzień jednej osoby to zawsze ten sam obiekt: zaokrąglony kwadrat. Wygląda tak samo na mapie projektów, na osi czasu, w kalendarzu i w aplikacji mobilnej.
3. **Pływa tylko to, co chwilowe.** Cień dostają tylko elementy tymczasowe: nawigacja, okna, kalendarz, podpowiedzi wyszukiwarki, komunikat. Treść, która leży na stronie, ma tylko cienką linię.
4. **Kontrast grubości.** Tytuły i liczby są grube (700–800), opisy lekkie (300). Hierarchię robimy grubością, a nie dodatkowymi kolorami, wersalikami czy podpisami pod tytułami.

---

## 2. Kolory

### 2.1 Paleta marki

| Nazwa | Hex | Rola |
|---|---|---|
| **Deep Forest** | `#0F3D3A` | Atrament marki: przyciski główne, aktywna nawigacja, dzień zatwierdzony |
| **Golden Hour** | `#F4B13B` | Zarezerwowany: dzień do zatwierdzenia; baner terminu |
| **Terracotta Clay** | `#E0745E` | Zarezerwowany: nieobecność; ciemny wariant `#9E4232` — błędy, braki ludzi, pilny termin |
| **Warm Sand** | `#F2E6D6` | Ciepłe powierzchnie: weekendy, przerwy w zadaniach, narzędzie Obsada w docku |

### 2.2 Kolory robocze

| Token | Hex | Użycie |
|---|---|---|
| `--ground` | `#EEF2F0` | Tło aplikacji (chłodna szarość z nutą zieleni, nie krem) |
| `--surface` | `#FFFFFF` | Karty, tabele, panele, pusty dzień |
| `--surface-2` | `#F6F8F7` | Wiersze grup, notatka dnia, pola tylko do odczytu |
| `--ink` | `#102826` | Tekst podstawowy |
| `--ink-2` | `#4F605D` | Tekst pomocniczy (kontrast 6.6:1 na białym) |
| `--ink-3` | `#8A9895` | Tylko elementy nieistotne: placeholdery, ikony nieaktywne |
| `--line` | `#DCE3E0` | Obrysy pól i pustych dni |
| `--line-soft` | `#E8EDEB` | Linie podziału w tabelach |
| `--forest-50 / 100` | `#EAF1F0` / `#D5E3E1` | Hover, zaznaczony wiersz, zakres w kalendarzu, panel zadania |
| `--sand-50` | `#FAF5EE` | Kolumny weekendów |
| `--missed`, `--missed-ink` | `#9AA3A1`, `#4A5553` | Stan „nie wysłane do Dataverse" |

### 2.3 Stany dnia — reguła nadrzędna

| Stan | Wypełnienie | Kiedy |
|---|---|---|
| **Zatwierdzony** | Deep Forest `#0F3D3A` | Godziny zatwierdzone przez supervisora (lub wyżej) |
| **Do zatwierdzenia** | Golden Hour `#F4B13B` | Godziny wpisane przez pracownika lub TL, czekają na zatwierdzenie |
| **Nieobecny** | Terracotta Clay `#E0745E` + biała kreska | Nieobecność (L4, urlop, inna) |
| **Błąd — nie wysłany** | Szare ukośne kreski + wykrzyknik w ciemnym kółku; dzień bez wpisu: „Brak wpisu / nie wysłany" | Dzień, przez który timesheet projektu został wstrzymany: bez zatwierdzenia do końca do pn 23:59 albo bez wpisu w dzień roboczy z zadaniem. Zmienia i zatwierdza go tylko administrator; kompletny timesheet idzie w najbliższy wtorek |
| **Wolne / brak wpisu** | Biały + obrys `#DCE3E0`; w weekend piaskowy `#F2E6D6` | Dzień wolny albo nikt nic nie wpisał (w otwartym tygodniu) |

**Tydzień zamknięty** (od wtorku 00:00 po tygodniu) to warstwa na każdym stanie: kolor zostaje, ale jest lekko wyszarzony (`saturate .45–.5`, `opacity .82–.88`) i w ukośne białe paski. Wolne dni zamkniętego tygodnia mają szare paski na `--surface-2`. Komunikat: wszystko z tego tygodnia jest już nienaruszalne.

Znaczniki na dniu:

| Znak | Wygląd | Znaczenie |
|---|---|---|
| **Wysłane do Dataverse** | Zielony ptaszek `--sent #9FE3BB` w kropce; na dużej komórce kółko w rogu. Tylko na dniach z wpisem | Timesheet poszedł we wtorkowej wysyłce; nikt nic nie zmienia |
| **Błąd — nie wysłany** | Wykrzyknik; na dużej komórce ciemne kółko w rogu, godziny przekreślone albo „Brak wpisu" | Patrz wyżej |
| **Zmienione** | Mała kropka w prawym dolnym rogu dużej komórki | Osoba zatwierdzająca zmieniła dzień — szczegóły w notatce dnia |
| **Zaplanowany dzień** | Pusta kropka z obrysem `--forest-100` | Przyszły dzień roboczy w zadaniu osoby |
| **Przerwa** | Ukośne kreski w kolorze tła | Dzień między zadaniami osoby (np. wyjazd do domu) — wtedy nie wpisuje godzin |
| **Dziś** | Obrys Deep Forest wokół kropki, numer dnia w kropce Deep Forest | — |
| **Kreska pn \| wt** | Przerywana linia `--cutoff` na mapie | Do poniedziałku 23:59 trzeba zatwierdzić poprzedni tydzień |

- Nieobecność bez ptaszka ma poziomą białą kreskę w środku — odróżnia się od „do zatwierdzenia" także dla osób, które słabo rozróżniają żółty i pomarańczowy.
- Status zawsze nazywamy „Do zatwierdzenia" (nie „Czeka"). Nie ma stanu „do poprawy" — pracownik poprawia dzień, dopóki nikt go nie zatwierdził, a później zmienia go osoba zatwierdzająca.
- Golden Hour i Terracotta Clay **nie mogą** być użyte jako kolor przycisku, nagłówka, ikony dekoracyjnej ani tła sekcji. Wyjątek: baner terminu (pkt 6) i liczby braków w Obsadzie — to też stan.
- Komunikat dla wszystkich poza administratorem przy wstrzymanym timesheecie, zawsze tymi słowami: „Czas minął. Skontaktuj się z administratorem — Twój timesheet nie został wysłany z powodu błędnie wypełnionego timesheetu."
- Plakietki stanów (tekst) używają jasnych odcieni: `--golden-100` z tekstem `#7A5208`, `--terracotta-100` z tekstem `#9E4232`, `--forest-50` z tekstem Deep Forest, `#E6EAE9` z tekstem `--missed-ink`.

### 2.4 Branże: elektrycy i mechanicy

W całym systemie branża ma stały kolor. To kolor **identyfikacyjny**, nie stan — nigdy nie wypełnia dnia.

| Branża | Kolor | Ciemny (tekst) | Jasny (tło) | Obrys |
|---|---|---|---|---|
| **Elektrycy** | `--el` `#D2373C` | `#A3222A` | `#FBE4E3` | `#F0B3B1` |
| **Mechanicy** | `--me` `#2B67D1` | `#1D4B99` | `#E1EBFB` | `#B3CBF2` |

- Znacznik stanowiska: **E** na jasnej czerwieni, **M** na jasnym błękicie; **TL** ma kreskę u dołu w kolorze swojej branży.
- Słupki obsady (Obsada, plan zespołu), wykres siły roboczej, liczby „6 → 5 z 8" przy wnioskach urlopowych.
- Kolejność zawsze: elektrycy (czerwień) przed mechanikami (błękit).
- Czerwień elektryków jest chłodniejsza i ciemniejsza niż Terracotta nieobecności — nie stoją obok siebie w jednej komórce.

### 2.5 Kolory identyfikacyjne projektów

Projekt ma kolor jako kropkę przy nazwie, pasek zadania w Obsadzie i delikatne tło tygodni projektu (12%). Paleta jest rozstawiona po całym kole barw, o podobnej jasności, i omija żółć oraz czerwień stanów:

`#2F6FA3` kobalt · `#1E9A8A` morski · `#6A9A2E` oliwka · `#7B4FB8` fiolet · `#C24C8C` malina · `#D9822B` pomarańcz · `#3B4FC4` indygo · `#2C8FC9` lazur · `#8C5A3C` orzech · `#A33D5E` wino · `#4F6B7A` grafit · `#9A8A1F` musztarda

Nowy projekt dostaje najrzadziej używany kolor.

---

## 3. Typografia

**Krój: Plus Jakarta Sans (variable, 200–800)** — geometryczny jak Poppins, spokojny jak Helvetica, z cyframi tabelarycznymi (Poppins ich nie ma, a w siatkach godzin muszą się równać) i pełnymi polskimi znakami. Pliki fontu są w aplikacji (pakiet `@fontsource-variable/plus-jakarta-sans`), a nie pobierane z Google Fonts, bo wtedy przeglądarka wysyła IP użytkownika do Google (RODO).

Grubości jako tokeny: `--w-light 300` · `--w-regular 400` · `--w-medium 500` · `--w-semibold 600` · `--w-bold 700` · `--w-heavy 800`.

| Token | Rozmiar / interlinia | Grubość | Użycie |
|---|---|---|---|
| `--text-3xl` | 38 / 41 | 800, tracking −0.03em | Tytuł ekranu |
| `--text-2xl` | 29.5 / 34 | 800, tracking −0.025em | Tytuł okna |
| `--text-xl` | 23.5 / 28 | 700, tracking −0.02em | Nazwa projektu, tytuł karty, baner terminu (300 + 800) |
| `--text-lg` | 18.75 / 26 | 700 | Śródtytuły sekcji formularza |
| `--text-md` | 15 / 22 | 400 | Tekst, pola formularzy |
| `--text-sm` | 13.5 / 19 | 400–500 | Metadane, przyciski małe |
| `--text-xs` | 12 / 16 | 600 | Nagłówki kolumn, grup, dni tygodnia |

Zasady:
- **Tytuł ekranu bez podpisu pod spodem.** Ekran tłumaczy się układem, nie akapitem.
- Opisy, podpisy i drugi plan: 300 (light) w `--ink-2`. Liczby i to, na co trzeba zareagować: 700–800.
- Liczby zawsze `font-variant-numeric: tabular-nums`.
- Bez WERSALIKÓW w etykietach. Wyróżniamy grubością i kolorem `--ink-2`.
- Wielka litera tylko na początku zdania („Nowy projekt", nie „Nowy Projekt").

---

## 4. Przestrzeń, kształt, głębia

**Siatka 4 px.** Odstępy: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.

| Token | Wartość | Obiekt |
|---|---|---|
| `--r-cell` | 25% boku | Kropka dnia — kształt ten sam w każdym rozmiarze |
| `--r-control` | 12 px | Pole, przycisk, chip prostokątny |
| `--r-card` | 20 px | Karta, kalendarz, tabela, baner |
| `--r-sheet` | 28 px | Okno |
| `--r-pill` | 999 px | Dock, plakietki, chipy, wyszukiwarka, licznik terminu |

**Głębia** — jeden cień dla wszystkiego, co pływa: `--shadow-float`. Karty i tabele mają tylko obrys `--line-soft`, bez cienia.

---

## 5. Układ

- **Górna linia bez tła** (nie pasek): znak „Epcido Terminal" → „Cześć, *imię*" z rolą → **wyszukiwarka** → po prawej:
  - licznik terminu **„Masz X dni i Y godzin na zatwierdzenie Z timesheetów"** (Golden Hour 100; gdy do poniedziałku 23:59 została mniej niż doba — Terracotta 100), klikany → Zatwierdzanie. Na ekranach Zatwierdzanie i Pulpit zamiast licznika jest baner,
  - przycisk główny **„Dodaj nowy projekt"** dla Administratora, Planning i Project Managera,
  - przełącznik **„Wersja mobilna / desktopowa"**.
- **Wyszukiwarka u góry**, nie w docku. Podpowiada od pierwszej litery: projekty, ludzie, „Godziny od Supervisora X" (IM), ekrany i „Dodaj nowy projekt". Strzałki + Enter, Escape czyści. Widzisz tylko to, do czego masz dostęp.
- **Dock na wysokość ikon**: jeden rząd, ikona + krótka nazwa, aktywny ekran w pigułce Deep Forest. Narzędzia tylko dla Planningu (Obsada) stoją osobno, za kreską, na piaskowym tle. W wąskiej ramce nazwy znikają poza aktywną. Pracownik z jednym ekranem nie widzi docku.
- Treść wyrównana do lewej, maks. 1440 px, marginesy boczne 32 px (16 px w wąskiej ramce), 104 px zapasu na dock.
- **Przyklejone nagłówki**: na mapie pasek legendy z nawigacją tygodni i wspólny nagłówek dni zostają u góry przy przewijaniu projektów. W planie zespołu nagłówek dni i kolumna osób są przyklejone w obu kierunkach.
- **Edytor projektu na pełnym ekranie**: pasek z „Wróć", nazwą, stanem zapisu i akcją główną; po lewej dane projektu (420 px), po prawej plan zespołu.
- **Okna dialogowe** na środku; w wąskiej ramce wysuwają się od dołu.
- **Wąska ramka**: style reagują na szerokość ramki aplikacji (container queries), nie okna.

---

## 6. Komponenty

### Przyciski
| Wariant | Wygląd | Kiedy |
|---|---|---|
| Główny | Tło Deep Forest, tekst biały, 44 px | Jedna główna akcja w widoku („Zapisz i zatwierdź") |
| Drugorzędny | Białe tło, obrys `--line`, tekst `--ink` | Pozostałe akcje |
| Cichy | Bez tła, tekst `--ink-2`, hover `--forest-50` | Akcje w wierszach, „Anuluj" |
| Niszczący | Biały, tekst `#9E4232`, zawsze z potwierdzeniem | Usunięcie, reset danych |

Tekst przycisku mówi, co się stanie. Komunikat po akcji używa tego samego słowa: „Zaplanuj" → „Zaplanowano".

### Baner terminu
- **Płaska biała karta, bez gradientu**, obrys `--line-soft`. Ikona budzika w kwadracie 44 px na Golden 100.
- Po lewej: „Masz **3 dni i 1 godzinę** na zatwierdzenie **13 timesheetów**" (300 + 800). Po prawej, za pionową linią: „Termin" i **pn, 19 paź, 23:59**, pod spodem wysyłka do Dataverse. Godziny z ustawień systemu.
- Mniej niż doba do terminu → ikona na Terracotta, liczba czasu w `#9E4232`, obrys Terracotta 100.
- Wszystko zatwierdzone → ikona ptaszka na Forest 50.
- **Nigdy nie pokazujemy sumy godzin do zatwierdzenia** — liczy się czas do terminu i liczba timesheetów (timesheet = projekt × tydzień).

### Dock
- Pigułka na wysokość ikon. Grupy rozdzielone kreską: ekrany → narzędzia Planningu (Obsada, piaskowe tło) → narzędzia administratora (Raporty, Użytkownicy, Ustawienia — **same ikony**, nazwa w dymku; aktywna z nazwą).
- **Licznik** (do zatwierdzenia, wnioski urlopowe) to złota pigułka 20 px **za nazwą, w jednej linii**, wyśrodkowana w pionie — nigdy nad ikoną.

### Okno dnia (notatka zmian)
- Otwiera się po kliknięciu dnia na osi czasu i w zatwierdzaniu.
- Góra: plakietka stanu i lekki tekst „Zatwierdzone przez X · data, godzina".
- Praca / Nieobecność (przełącznik), godziny krokami 15 min, przerwa przyciskami, opcjonalny komentarz.
- „Notatka dnia": lista zmian od najnowszej — data, kto, „7:00–18:00 → 7:00–17:00 — „komentarz"". Wpisów nie da się usunąć.
- Przyciski: „Zapisz zmianę" i — gdy osoba może zatwierdzić — „Zapisz i zatwierdź".

### Dymek dnia
- Na dużej komórce: tylko **kto i kiedy** zatwierdził (i zmienił) — bez powtarzania godzin z kafelka.
- Na kropce mapy (bez treści): osoba, data, godziny, potem kto i kiedy zatwierdził.

### Pola formularza
- Wysokość 44 px, promień 12 px, obrys `--line`, fokus: obrys Deep Forest + pierścień `--forest-100` 3 px.
- Etykieta nad polem, `--text-sm`, kolor `--ink-2`. Błąd pod polem w `#9E4232`, mówi co poprawić.

### Lista wyboru
- Zawsze własna lista aplikacji (`SelectMenu`), nigdy systemowa `<select>`.

### Wybór godziny
- Duże cyfry Deep Forest, pod każdą godziną − / + (krok 15 min). Przerwa jako przyciski 0 / 15 / 30 / 45 / 60.
- W oknie dnia wariant zwarty (28 px cyfry).

### Duża komórka dnia
- Oś czasu i zatwierdzanie: komórka 86 px (80 px w wąskiej ramce), promień 10 px.
- „7:00–17:00" (12 px, 700) i „przerwa 30 min" (10.5 px, 400); nieobecność: „L4" / „Urlop".
- Kliknięcie otwiera okno dnia. Bez zaznaczania wielu dni i bez „Zatwierdź wszystko" — zatwierdza się timesheet (wiersz) albo dzień.

### Plan zespołu (zadania)
- **Kafelek = zadanie** osoby w projekcie od–do: `--forest-100`, promień 8 px, etykieta „**Prace elektryczne** 12 paź – 30 lis" (przykleja się do lewej krawędzi przy przewijaniu).
- Osoba może mieć kilka zadań. **Przerwa** między nimi: piaskowe ukośne kreski z napisem „przerwa · 9 dni". W przerwie pracownik nie wpisuje godzin.
- Kliknięcie kafelka → panel zadania nad planem (nazwa, od, do, „Wstaw przerwę" 7/10/14 dni, „Usuń zadanie"). Kliknięcie pustego miejsca w wierszu → nowe zadanie.
- Przeciąganie przesuwa, brzegi zmieniają start lub koniec. Wybrany kafelek: Deep Forest z pierścieniem.
- Kolizja z innym projektem lub innym zadaniem: tło `--terracotta-100`, obrys `#9E4232`.
- Ta sama osoba w innych projektach: szary kreskowany pasek z kreską w kolorze projektu.
- Oś sięga zawsze **3 miesiące za najdalsze zadanie** i rośnie podczas przeciągania.
- **Kolumna nazwisk 300 px**: pełne imię i nazwisko (do dwóch linii), pod spodem umowa i liczba zadań. Wiersz 48 px.
- **Wiersz „Zapotrzebowanie"** na górze: w każdym tygodniu dwa poziome słupki E i M — kreskowany obrys = potrzeba, wypełnienie w kolorze branży = w planie, „6/8".
- **Urlop na wierszu osoby**: blok nad zadaniem — zaakceptowany: Terracotta w ukośne paski z napisem „Urlop · Supervisor 3"; L4: ciemna Terracotta „L4"; wniosek czekający: biało-złote paski z obrysem Golden „Wniosek o urlop". Dymek: kto i kiedy zaakceptował.
- Otwarty z Obsady: dane projektu zwinięte do paska po lewej, plan na całą szerokość.

### Obsada
- U góry dwa przełączniki-filtry (branża, kategoria) i jedno zdanie, jak przeciągać.
- **Wymaga uwagi**: karty 340 px w siatce — ikona (czerwona: braki przed startem, tygodnie bez rezerwy; złota: za mało EPCIDO, długo bez przerwy; zielona: urlopy, ludzie bez przydziału), jedno zdanie z nazwą projektu pogrubioną i jeden przycisk akcji.
- Wszystkie siatki mają te same kolumny tygodni (od bieżącego), szerokość 56 px, nazwa `--staff-name` 230 px, kolumna boczna `--staff-side` 250 px.
- **Oś tygodni jest jedna dla projektów i ludzi** (`.staff-ruler`), przyklejona do góry ekranu w obrębie tablicy. Przy najniższym projekcie wciąż widać, od którego tygodnia zaczyna się kolumna, a moduł „Ludzie” stoi dokładnie pod projektami — tygodnie pokrywają się w pionie. Tablica (`.staff-board`) to jedna karta: oś, projekty, ludzie.
- **Czyj to projekt**: przy nazwie mała plakietka — „moje” (Forest 100 na Deep Forest) albo nazwisko Installation Managera (obrys kreskowany, tekst `--ink-3`). Wiersz cudzego projektu ma stonowaną kolumnę nazwy. Filtr „Moje / Innych IM / Wszystkie” pokazuje się tylko komuś, kto ma i swoje, i cudze projekty.
- **Siła robocza**: wykres 132 px — w każdym tygodniu dwa słupki (E, M): wypełnienie w kolorze branży = w planie, ciemny obrys = potrzeba (czerwony, gdy brakuje), szare kreski nad wypełnieniem = wolni. Pod spodem wiersze brakuje / wolni / bilans.
- **Projekty × tygodnie**: tło tygodni w kolorze projektu (12%), w komórce **dwa pionowe słupki**: kreskowany obrys w kolorze branży = potrzeba, wypełnienie = w planie, białe kreski u góry wypełnienia = na urlopie. Pod słupkiem liczba w planie albo brak „−2" w `#9E4232`. Skala słupków — największa wartość w wierszu projektu.
- Pod nazwą projektu: „koniec … · za N tyg." i „EPCIDO 64% · 11 os." (poniżej celu — `#9E4232`). Po prawej najbliższy brak i ikona „Zaproponuj obsadę".
- **Przeciąganie**: cel to tydzień projektu (obrys Deep Forest, nad komórką ciemna etykieta „Mechanik 24: 23 lis – 5 gru"). Upuszczenie dodaje osobę do końca fazy z „Cofnij"; z Shift — okno z opcjami.
- **Propozycja obsady** (okno lg, 900 px): grupy faza × branża z „2/8 · brakuje 6", wiersze z polem wyboru (stanowisko, osoba, umowa, staż w kategorii, od kiedy, urlop w fazie, „teraz Projekt 2 do 27 lis"). Na dole: „Zaznaczono 13 · EPCIDO po zmianie: 64%".
- **Ludzie × tygodnie**: uchwyt, osoba z umową, „Projekt 6 · kończy cz, 22 paź", staż „KNAPP 4 lata · łącznie 10 lat". Paski projektów, przerwy piaskowe z kubkiem, urlopy w paski Terracotty (wniosek — złote), linia „dziś". Po prawej: „wolny od …", podpowiedź projektu z brakiem, „Zaplanuj" / „Przerwa".
- Filtry ludzi: stanowisko (Wszyscy / Elektrycy / Mechanicy / TL / SV), stan (zwalniają się, wolni, bez przerwy, wszyscy), kolejność, szukanie po nazwisku oraz EPCIDO / agencja i suwaki „Staż łącznie od …”, „Staż w KNAPP od …” (te same w ekranie Ludzie).
- **Zaznaczanie okresu**: naciśnięcie i przeciągnięcie po pasku osoby rysuje prostokąt z obrysem Deep Forest i ciemną etykietą z datami; po puszczeniu otwiera się okno z wyborem „Przypisz do projektu” / „Powrót do domu” (dwa duże pola wyboru z ikoną, tytułem i jednym zdaniem).
- Ten sam moduł „Ludzie” stoi pod planem zespołu w edytorze projektu — z własną, przyklejoną osią tygodni i własnym przewijaniem (maks. 420 px).

### Urlopy
- **Wniosek do akceptacji**: karta w czterech kolumnach — osoba i data wniosku · rodzaj (etykieta „Urlop" / „L4" / „Inna"), daty, dni robocze, uwagi · wpływ na projekt („Projekt 3 · elektrycy w tygodniu 19.10: **6 → 5 z 8**", poniżej potrzeby — na Terracotta 100) i kto jeszcze ma wolne · „Odrzuć" (cichy; wymaga powodu) i „Akceptuj" (główny).
- **Kalendarz nieobecności**: 8 tygodni po 22 px na dzień, wiersz 36 px. Urlop — Terracotta, L4 — `#9E4232`, wniosek — biało-złote paski z obrysem Golden.
- Rodzaje: „Urlop" (Terracotta 100, tekst `#9E4232`), „L4" (Terracotta, biały tekst), „Inna" (szara z obrysem).
- Pracownik: „Zgłoś urlop albo L4", lista „Moje wnioski" ze stanem (czeka — złota plakietka, zaakceptował X — zielona, odrzucony z powodem). L4 obowiązuje od razu.

### Administracja
- **Użytkownicy**: tabela z liczbą uprawnień w zielonej pigułce i „+2 dodane" / „−1 odebrane". Okno lg: dane, rola z opisem, uprawnienia w grupach (Projekty, Planowanie, Godziny, Urlopy, Administracja) — przy każdym „z roli", „dodane" (zielone), „odebrane" (`#9E4232`).
- **Raporty**: po lewej kafle raportów (aktywny — obrys Deep Forest), po prawej opcje (zakres dat z gotowymi okresami, kategorie i projekty jako chipy, branża, umowa, stan godzin) i podgląd 8 wierszy z przyciskiem „Pobierz Excel (.xlsx)".
- **Ustawienia**: karty w dwóch kolumnach (Terminy z przykładem na bieżący tydzień, Integracja Dataverse, Kategorie, Oddziały, Zasady obsady na całą szerokość). Pozycji używanych w projektach nie da się usunąć.

### Kategorie i umowy
- **Kategoria projektu** (KNAPP, KARDEX, FORTNA, OTHER): mała etykieta 20 px, promień 6 px, wersaliki są nazwą własną, nie stylem. Barwy przygaszone i stałe: KNAPP `#1D4F7A` na `#EEF4F9`, KARDEX `#6B3F12` na `#FAF3EA`, FORTNA `#4B2F78` na `#F4F0FA`, OTHER `--ink-2` na `--surface-2`. Nigdy Golden ani Terracotta.
- **Umowa**: UoP i B2B (**EPCIDO**) — pełne tło `--forest-50`, tekst Deep Forest; „Agencja" — tylko obrys `--ink-3`. Różnica jest w kształcie, nie tylko w kolorze.
- Udział EPCIDO przy projekcie: „EPCIDO 64%". Poniżej minimum z ustawień (domyślnie 50%) — tekst `#9E4232`.
- Kategorie dodane w ustawieniach (np. AUTOSTORE) mają neutralną etykietę: `--ink-2` na `--surface-2`.

### Plakietki
- Promień `--r-pill`, wysokość 24 px, `--text-sm` 500, ikona 10 px z odstępem 6 px.

### Kropki dni
- Mapa: 16 px w kolumnie 20 px. Pasek tygodnia przy osobie: 12 px. Kalendarz: 36 px. Zawsze promień 25%.
- Znaczniki stanowisk (SV, TL, E, M) nie mają dymków.

---

## 6a. Wzorce ekranów (do powtarzania w kolejnych modułach)

| Wzorzec | Gdzie | Zasada |
|---|---|---|
| **Karta projektu** | Mapa, oś czasu, zatwierdzanie | Nagłówek: nazwa, numer, kategoria → klient, miasto → supervisor → po prawej **tylko to, co wymaga działania**: „Do zatwierdzenia: X timesheetów" (złota) i „! Nie wysłany: tydz. N" (czerwona). Wysłane widać po ptaszkach i paskach — bez „W Dataverse do…" i bez liczby osób. Pod spodem siatka: **wiersze = ludzie, kolumny = dni**. |
| **Siatka dni** | Mapa, oś czasu | Nagłówek: miesiąc, pod nim numery dni. Na mapie nagłówek jest wspólny i przyklejony u góry. Weekendy piaskowe, kreska pn\|wt, przerwy kreskowane. Bez podświetlania wierszy. |
| **Zatwierdzanie** | Supervisor, IM, administrator | Tytuł → baner terminu → (SV, IM) szara informacja o wstrzymanych timesheetach z komunikatem „Czas minął…" → projekt → „Timesheet · tydz. N" → osoby z przyciskiem „Zatwierdź" (tylko po osobie). Administrator ma na górze sekcję „Wstrzymane timesheety" z osobami, które mają błędy. |
| **Pulpit** | Installation Manager, administrator | Baner terminu i tabela supervisorów: do zatwierdzenia (timesheety), postęp tygodnia (%), czeka na Ciebie, nie wysłane, „Przejrzyj i zatwierdź". |
| **Drzewko** | Struktura | Linie 1.5 px `--line`. IM → projekt → supervisor → grupy (TL, elektrycy, mechanicy) **jedna pod drugą, jedna osoba w wierszu**. |
| **Edytor projektu** | Tworzenie i edycja | Pełny ekran. Dane projektu (z zapotrzebowaniem) po lewej, „Plan zespołu" i „Historia zmian" po prawej. |
| **Obsada** | Planning, administrator | Filtry → wymaga uwagi → wykres siły roboczej → projekty w tygodniach ze słupkami E/M (klik = plan zespołu) → ludzie w tygodniach z filtrami stażu (przeciągnij na tydzień projektu). Propozycja obsady jednym oknem. |
| **Urlopy** | SV, IM, HR, administrator | Do akceptacji (karty z wpływem na obsadę) → L4 do potwierdzenia → kalendarz nieobecności → ostatnie decyzje (z „Cofnij"). |
| **Administracja** | Administrator | Raporty, Użytkownicy, Ustawienia — w docku jako same ikony. Każda zmiana i każde pobranie raportu w dzienniku. |
| **Ekran pracownika** | Telefon | Projekt dnia (albo „Przerwa") → karta dnia → „Zgłoś urlop albo L4" → tydzień jako lista dni z kropką stanu → „Moje wnioski". Bez informacji o wysyłce i wstrzymaniu. Zmiany od supervisora widać pod dniem. |

---

## 7. Ruch

- Ruch odpowiada na działanie użytkownika: okno się pojawia (240 ms), podpowiedzi i panel zadania (160 ms).
- Cały ruch mieszka w `src/styles/motion.css`. Zasada: ruch ma coś mówić (coś się pojawiło, coś zareagowało, coś zniknęło), nigdy zdobić.
- Wejścia: ekran i karty wjeżdżają o 10 px w górę, kafelki „Wymaga uwagi” wsuwają się z lewej z kaskadą 50 ms (pierwsze trzy).
- Reakcje: przycisk podnosi się o 1 px i siada przy naciśnięciu (0,985), ikony i plakietki kurczą się do 0,94; aktywna pozycja przełącznika i docka „siada” z lekkim odbiciem (220 ms); kropka dnia rośnie do 1,22 przy najechaniu.
- Słupki obsady i paski postępu zmieniają wysokość i szerokość płynnie (240 ms) — liczba zmienia się razem z obrazem.
- `prefers-reduced-motion` wyłącza wszystkie animacje; reguła stoi na końcu `motion.css`, czyli na końcu kaskady. Krzywa: `cubic-bezier(.2, .8, .2, 1)`.

### Podgląd osoby
- Lekkie okno (760 px) otwierane kliknięciem w nazwisko — nazwisko ma podkreślenie dopiero przy najechaniu, żeby tabela nie wyglądała jak las odnośników.
- Nagłówek: znacznik stanowiska, imię i nazwisko, stanowisko · branża · umowa. Pod spodem jedno zdanie „Teraz: Projekt 6 · Prace mechaniczne · kończy cz, 29 paź” na Forest 50.
- Trzy zakładki: **Plan tygodniowy** (oś 12 tygodni po 54 px, paski projektów, przerwy z kubkiem, urlopy jako pasek 7 px pod spodem, linia „dziś”, pod osią lista kroków „teraz / 2 lis / przerwa”), **Godziny** (kafelki liczb, tygodnie z kropkami dni i sumą, lista dni bez podpisu na Golden 100), **Dane i doświadczenie**.

### Panel roboczy (tylko prototyp)
- Celowo nie wygląda jak produkt: czarne tło `#07100F`, monospace, małe litery, zielony znak zachęty `$`. Ma się odcinać od aplikacji obok i zniknąć razem z wejściem logowania.
- Po wybraniu osoby panel chowa się sam. Wraca zakładką przy lewej krawędzi.

### Potwierdzenia
- Każdy zapis planisty pyta przed zapisem: tytuł pytaniem („Zapisać zmiany w Projekt 1?”), lista zmian jako karty z lewą kreską (pierwsza pogrubiona), przyciski „Wróć do edycji” (cichy) i „Zapisz zmiany” (główny). Zmiana nieodwracalna albo z kolizją — przycisk w Terracotcie.

---

## 8. Język interfejsu

- Polski, prosty. Nazwy z punktu widzenia użytkownika: „Zadanie", „Przerwa", „Nieobecny", a nie „assignment", „absence record".
- Zawsze **„projekt"**, nigdy „budowa".
- Zawsze **„EPCIDO"** (wersalikami — nazwa własna) dla naszych ludzi na UoP i B2B, nigdy „nasi". Przeciwieństwo: „agencja".
- Branże w liczbie mnogiej: „Elektrycy", „Mechanicy"; skróty w słupkach: E, M.
- Urlopy: „wniosek", „zaakceptował", „odrzucony" (z powodem), „L4 — obowiązuje od zgłoszenia", „dokument potwierdzony".
- Pracownik i Team Leader nie widzą słów „wysłane", „wstrzymany", „Dataverse" — dla nich tydzień jest po prostu „zamknięty".
- **„Timesheet" = wszystkie godziny wszystkich pracowników jednego projektu w jednym tygodniu.** W tygodniu jest tyle timesheetów, ile projektów. Godziny to godziny, zadania to zadania — nie mieszamy tych słów. Odmiana: 1 timesheet, 2 timesheety, 5 timesheetów; „na zatwierdzenie 1 timesheetu / 5 timesheetów".
- Puste stany mówią, co zrobić. Błędy mówią, co się stało i jak to naprawić, bez przeprosin.
- Daty: „13 paź 2026", dni „wt, 13 paź", tygodnie „tydz. 42", godziny zdarzeń „16 paź 2026, 14:32".

---

## 9. Dostępność

- Kontrast tekstu min. 4.5:1 (sprawdzone dla `--ink`, `--ink-2`, `--missed-ink` i plakietek).
- Kolor nigdy nie jest jedyną informacją: nieobecność ma kreskę, błąd ma kreski i wykrzyknik, wysłane ma ptaszek, tydzień zamknięty ma paski, agencja ma obrys zamiast tła.
- Widoczny fokus klawiatury na każdym elemencie interaktywnym; kafelki zadań obsługuje się też klawiaturą (Enter, strzałki).
- Cele dotykowe min. 44 px w aplikacji mobilnej.

---

## 10. Checklista przed oddaniem ekranu

- [ ] Golden Hour i Terracotta użyte tylko jako stan?
- [ ] Tytuł bez podpisu, hierarchia grubością (800 / 300)?
- [ ] Nigdzie suma godzin do zatwierdzenia?
- [ ] Cień tylko na elementach pływających?
- [ ] Liczby tabelaryczne, etykiety bez wersalików, „projekt" zamiast „budowa"?
- [ ] Timesheet liczony jako projekt × tydzień? Zamknięty tydzień wyszarzony w paski?
- [ ] Elektrycy czerwień, mechanicy błękit — i tylko przy branży? „EPCIDO" zamiast „nasi"?
- [ ] Liczniki w jednej linii z nazwą (dock)? Bez gradientów na kartach?
- [ ] Pusty stan i błąd mówią, co zrobić?
- [ ] Działa na 375 px szerokości i z klawiatury?

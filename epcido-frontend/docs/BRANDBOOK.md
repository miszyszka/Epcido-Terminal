# Epcido Terminal — brandbook interfejsu

> Wersja 1.2 · obowiązuje dla wszystkich modułów (planowanie, czas pracy, zatwierdzanie, obsada, komunikacja, aplikacja mobilna).
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
| **Nie wysłane** | Szare ukośne kreski + wykrzyknik w ciemnym kółku | Nie zatwierdzone do końca do poniedziałku 23:59. Od wtorku 00:00 zatwierdza i zmienia je tylko administrator; po zatwierdzeniu idą w najbliższej wtorkowej wysyłce |
| **Wolne / brak wpisu** | Biały + obrys `#DCE3E0`; w weekend piaskowy `#F2E6D6` | Dzień wolny albo nikt nic nie wpisał |

Znaczniki na dniu:

| Znak | Wygląd | Znaczenie |
|---|---|---|
| **Wysłane do Dataverse** | Zielony ptaszek `--sent #9FE3BB` w kropce; na dużej komórce kółko w rogu | Godziny poszły we wtorkowej wysyłce i są zamknięte |
| **Nie wysłane** | Wykrzyknik; na dużej komórce ciemne kółko w rogu, tekst przekreślony | Patrz wyżej |
| **Zmienione** | Mała kropka w prawym dolnym rogu dużej komórki | Osoba zatwierdzająca zmieniła dzień — szczegóły w notatce dnia |
| **Zaplanowany dzień** | Pusta kropka z obrysem `--forest-100` | Przyszły dzień roboczy w zadaniu osoby |
| **Przerwa** | Ukośne kreski w kolorze tła | Dzień między zadaniami osoby (np. wyjazd do domu) — wtedy nie wpisuje godzin |
| **Dziś** | Obrys Deep Forest wokół kropki, numer dnia w kropce Deep Forest | — |
| **Kreska pn \| wt** | Przerywana linia `--cutoff` na mapie | Do poniedziałku 23:59 trzeba zatwierdzić poprzedni tydzień |

- Nieobecność bez ptaszka ma poziomą białą kreskę w środku — odróżnia się od „do zatwierdzenia" także dla osób, które słabo rozróżniają żółty i pomarańczowy.
- Status zawsze nazywamy „Do zatwierdzenia" (nie „Czeka"). Nie ma stanu „do poprawy" — pracownik poprawia dzień, dopóki nikt go nie zatwierdził, a później zmienia go osoba zatwierdzająca.
- Golden Hour i Terracotta Clay **nie mogą** być użyte jako kolor przycisku, nagłówka, ikony dekoracyjnej ani tła sekcji. Wyjątek: baner terminu (pkt 6) i liczby braków w Obsadzie — to też stan.
- Plakietki stanów (tekst) używają jasnych odcieni: `--golden-100` z tekstem `#7A5208`, `--terracotta-100` z tekstem `#9E4232`, `--forest-50` z tekstem Deep Forest, `#E6EAE9` z tekstem `--missed-ink`.

### 2.4 Kolory identyfikacyjne projektów

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
- Karta z gradientem Golden 100 → biały, ikona budzika w kwadracie 52 px.
- Treść: „Masz **3 dni i 1 godzinę** na zatwierdzenie **13 timesheetów**" (300 + 800), pod spodem lekki wiersz: termin (pn 23:59) i wysyłka (wt 23:00).
- Mniej niż doba do terminu → gradient Terracotta 100, ikona na Terracotta.
- Wszystko zatwierdzone → gradient Forest 50, ptaszek.
- **Nigdy nie pokazujemy sumy godzin do zatwierdzenia** — liczy się czas do terminu i liczba timesheetów (timesheet = tydzień jednej osoby w projekcie).

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

### Obsada
- Kafle u góry są filtrami (liczba 36 px, 800): zwalnia się, bez przydziału, długo bez przerwy, projekty z brakami.
- Projekty × tygodnie: tło tygodni w kolorze projektu (12%), w komórce „E 6/8 · M 4/4". Obsadzony — Deep Forest, brak — `#9E4232` grubo, bez zapotrzebowania — `--ink-2`. Koniec projektu: pionowa kreska w kolorze projektu z napisem „koniec".
- Ludzie × tygodnie: paski w kolorach projektów, przerwy piaskowe z ikoną kubka, linia „dziś". Po prawej „co dalej": ostrzeżenie „8 tyg. bez przerwy", podpowiedź projektu z brakiem i przyciski „Zaplanuj dalej" / „Przerwa".

### Plakietki
- Promień `--r-pill`, wysokość 24 px, `--text-sm` 500, ikona 10 px z odstępem 6 px.

### Kropki dni
- Mapa: 16 px w kolumnie 20 px. Pasek tygodnia przy osobie: 12 px. Kalendarz: 36 px. Zawsze promień 25%.
- Znaczniki stanowisk (SV, TL, E, M) nie mają dymków.

---

## 6a. Wzorce ekranów (do powtarzania w kolejnych modułach)

| Wzorzec | Gdzie | Zasada |
|---|---|---|
| **Karta projektu** | Mapa, oś czasu, zatwierdzanie | Nagłówek: nazwa i numer → klient, miasto → supervisor → po prawej: liczba osób, „Do zatwierdzenia: X timesheetów", „Nie wysłane: Y timesheetów", „W Dataverse do …". Pod spodem siatka: **wiersze = ludzie, kolumny = dni**. |
| **Siatka dni** | Mapa, oś czasu | Nagłówek: miesiąc, pod nim numery dni. Na mapie nagłówek jest wspólny i przyklejony u góry. Weekendy piaskowe, kreska pn\|wt, przerwy kreskowane. Bez podświetlania wierszy. |
| **Zatwierdzanie** | Supervisor, IM, administrator | Tytuł → baner terminu → (SV, IM) informacja o timesheetach po terminie → projekt → tydzień → osoby z przyciskiem „Zatwierdź". Administrator widzi też tygodnie po terminie z plakietką „Po terminie · nie wysłane do Dataverse". |
| **Pulpit** | Installation Manager, administrator | Baner terminu i tabela supervisorów: do zatwierdzenia (timesheety), postęp tygodnia (%), czeka na Ciebie, nie wysłane, „Przejrzyj i zatwierdź". |
| **Drzewko** | Struktura | Linie 1.5 px `--line`. IM → projekt → supervisor → grupy (TL, elektrycy, mechanicy) **jedna pod drugą, jedna osoba w wierszu**. |
| **Edytor projektu** | Tworzenie i edycja | Pełny ekran. Dane projektu (z zapotrzebowaniem) po lewej, „Plan zespołu" i „Historia zmian" po prawej. |
| **Obsada** | Planning, administrator | Kafle-filtry → projekty w tygodniach → ludzie w tygodniach z „co dalej". Jedno okno „Zaplanuj dalej": przerwa → start → projekt z brakami jego branży → zadanie. |
| **Ekran pracownika** | Telefon | Projekt dnia (albo „Przerwa") → karta dnia → „Zgłoś nieobecność" → tydzień jako lista dni z kropką stanu. Zmiany od supervisora widać pod dniem. |

---

## 7. Ruch

- Ruch odpowiada na działanie użytkownika: okno się pojawia (240 ms), podpowiedzi i panel zadania (160 ms).
- `prefers-reduced-motion` wyłącza wszystkie animacje. Krzywa: `cubic-bezier(.2, .8, .2, 1)`.

---

## 8. Język interfejsu

- Polski, prosty. Nazwy z punktu widzenia użytkownika: „Zadanie", „Przerwa", „Nieobecny", a nie „assignment", „absence record".
- Zawsze **„projekt"**, nigdy „budowa".
- „Timesheet" = tydzień jednej osoby w jednym projekcie. Odmiana: 1 timesheet, 2 timesheety, 5 timesheetów; „na zatwierdzenie 1 timesheetu / 5 timesheetów".
- Puste stany mówią, co zrobić. Błędy mówią, co się stało i jak to naprawić, bez przeprosin.
- Daty: „13 paź 2026", dni „wt, 13 paź", tygodnie „tydz. 42", godziny zdarzeń „16 paź 2026, 14:32".

---

## 9. Dostępność

- Kontrast tekstu min. 4.5:1 (sprawdzone dla `--ink`, `--ink-2`, `--missed-ink` i plakietek).
- Kolor nigdy nie jest jedyną informacją: nieobecność ma kreskę, „nie wysłane" ma kreski i wykrzyknik, wysłane ma ptaszek.
- Widoczny fokus klawiatury na każdym elemencie interaktywnym; kafelki zadań obsługuje się też klawiaturą (Enter, strzałki).
- Cele dotykowe min. 44 px w aplikacji mobilnej.

---

## 10. Checklista przed oddaniem ekranu

- [ ] Golden Hour i Terracotta użyte tylko jako stan?
- [ ] Tytuł bez podpisu, hierarchia grubością (800 / 300)?
- [ ] Nigdzie suma godzin do zatwierdzenia?
- [ ] Cień tylko na elementach pływających?
- [ ] Liczby tabelaryczne, etykiety bez wersalików, „projekt" zamiast „budowa"?
- [ ] Pusty stan i błąd mówią, co zrobić?
- [ ] Działa na 375 px szerokości i z klawiatury?

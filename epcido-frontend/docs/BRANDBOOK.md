# Epcido Terminal — brandbook interfejsu

> Wersja 1.0 · obowiązuje dla wszystkich modułów (planowanie, czas pracy, akceptacje, komunikacja, aplikacja mobilna).
> Źródło prawdy w kodzie: `src/styles/tokens.css`. Żywy podgląd: ekran **Brandbook** w aplikacji (`/brandbook`).
> Zmiana tokenu = zmiana w tym pliku + w `tokens.css` w tym samym commicie.

---

## 1. Charakter

Epcido montuje instalacje na kilkudziesięciu budowach naraz. Terminal ma działać jak dobrze prowadzona tablica w biurze budowy: wszystko widać od razu, nic nie krzyczy, a kolor oznacza zawsze to samo.

Cztery zasady, które rozstrzygają spory projektowe:

1. **Kolor to stan.** Zielony, żółty i czerwony opisują wyłącznie stan dnia pracy. Nigdy nie służą do dekoracji, wyróżnień ani marketingu.
2. **Dzień to kropka.** Jeden dzień jednej osoby to zawsze ten sam obiekt: zaokrąglony kwadrat. Wygląda tak samo na mapie projektów, na osi czasu, w kalendarzu i w aplikacji mobilnej.
3. **Pływa tylko to, co chwilowe.** Cień dostają tylko elementy tymczasowe: nawigacja, wysuwany panel, kalendarz, komunikat. Treść, która leży na stronie, ma tylko cienką linię.
4. **Gęstość przez szerokość, nie przez rozmiar.** Gdy trzeba zmieścić dużo nazwisk, zwężamy krój (oś szerokości), a nie zmniejszamy liter.

---

## 2. Kolory

### 2.1 Paleta marki

| Nazwa | Hex | Rola |
|---|---|---|
| **Deep Forest** | `#0F3D3A` | Atrament marki: przyciski główne, aktywna nawigacja, dzień zatwierdzony |
| **Golden Hour** | `#F4B13B` | Zarezerwowany: dzień czeka na zatwierdzenie |
| **Terracotta Clay** | `#E0745E` | Zarezerwowany: nieobecność (jego ciemny wariant — błędy) |
| **Warm Sand** | `#F2E6D6` | Ciepłe powierzchnie: weekendy, zaznaczenia, chipy |

### 2.2 Kolory robocze

| Token | Hex | Użycie |
|---|---|---|
| `--ground` | `#EEF2F0` | Tło aplikacji (chłodna szarość z nutą zieleni, nie krem) |
| `--surface` | `#FFFFFF` | Karty, tabele, panele, pusty dzień |
| `--surface-2` | `#F6F8F7` | Wiersze grup, pola tylko do odczytu |
| `--ink` | `#102826` | Tekst podstawowy |
| `--ink-2` | `#4F605D` | Tekst pomocniczy (kontrast 6.6:1 na białym) |
| `--ink-3` | `#8A9895` | Tylko elementy nieistotne: placeholdery, ikony nieaktywne |
| `--line` | `#DCE3E0` | Obrysy pól i pustych dni |
| `--line-soft` | `#E8EDEB` | Linie podziału w tabelach |
| `--forest-50 / 100` | `#EAF1F0` / `#D5E3E1` | Hover, zaznaczony wiersz, zakres w kalendarzu |
| `--sand-50` | `#FAF5EE` | Kolumny weekendów |

### 2.3 Stany dnia — reguła nadrzędna

| Stan | Wypełnienie | Kiedy |
|---|---|---|
| **Zatwierdzony** | Deep Forest `#0F3D3A` | Godziny zatwierdzone przez supervisora (lub wyżej) |
| **Czeka** | Golden Hour `#F4B13B` | Godziny wpisane przez pracownika lub TL, czekają na zatwierdzenie |
| **Nieobecny** | Terracotta Clay `#E0745E` + biała kreska | Nieobecność (L4, urlop) |
| **Wolne / brak wpisu** | Biały + obrys `#DCE3E0` | Dzień wolny albo nikt nic nie wpisał |

- Nieobecność ma dodatkowo poziomą białą kreskę w środku. Dzięki temu odróżnia się od „czeka" także dla osób, które słabo rozróżniają żółty i pomarańczowy.
- Zbiorczy dzień projektu (mapa): **czeka**, jeśli choć jeden wpis czeka; w przeciwnym razie **zatwierdzony**, jeśli ktoś pracował; **nieobecny**, jeśli wszyscy z wpisem byli nieobecni; inaczej **wolne**. Gdy w zatwierdzonym dniu ktoś był nieobecny, w rogu pojawia się mała kropka Terracotta.
- Golden Hour i Terracotta Clay **nie mogą** być użyte jako kolor przycisku, nagłówka, ikony dekoracyjnej ani tła sekcji.
- Plakietki stanów (tekst) używają jasnych odcieni: `--golden-100` z tekstem `#7A5208`, `--terracotta-100` z tekstem `#9E4232`, `--forest-50` z tekstem Deep Forest.

### 2.4 Kolory identyfikacyjne projektów

Projekt może mieć kolor tylko jako małą kropkę (8 px) lub pasek (3 px) przy nazwie. Paleta jest stonowana i nie zbliża się do kolorów stanów:

`#5B7A99` łupek · `#7FA7C9` niebo · `#8C6A8D` śliwka · `#A9A1C7` lawenda · `#A39B8B` kamień · `#3E5368` granat · `#9DB3B0` mgła · `#6F7F96` stal

---

## 3. Typografia

**Krój: Archivo (variable)** — grotesk o technicznym rodowodzie z osią szerokości (62–125%) i grubości (100–900). Pliki fontu są w aplikacji (pakiet `@fontsource-variable/archivo`), a nie pobierane z Google Fonts, bo wtedy przeglądarka wysyła IP użytkownika do Google (RODO).

Jedna rodzina, trzy szerokości:

| Szerokość | `font-stretch` | Zastosowanie |
|---|---|---|
| Rozszerzona | `112%` | Tytuły ekranów i nazwy projektów — charakter marki |
| Normalna | `100%` | Interfejs i tekst |
| Zwężona | `82%` | Nazwiska w gęstych siatkach, tabele, nagłówki kolumn dni |

Skala (tercja wielka 1.25, baza 15 px):

| Token | Rozmiar / interlinia | Grubość | Użycie |
|---|---|---|---|
| `--text-3xl` | 37 / 40 | 640, szer. 112%, tracking −0.025em | Tytuł ekranu |
| `--text-2xl` | 29.5 / 34 | 620, szer. 112% | Tytuł panelu |
| `--text-xl` | 23.5 / 28 | 600, szer. 108% | Nazwa projektu w nagłówku karty |
| `--text-lg` | 18.75 / 26 | 560 | Śródtytuły sekcji |
| `--text-md` | 15 / 22 | 420 | Tekst, pola formularzy |
| `--text-sm` | 13.5 / 19 | 460 | Opisy, metadane, przyciski małe |
| `--text-xs` | 12 / 16 | 500, szer. 82% | Dni tygodnia, numery tygodni |

Zasady:
- Liczby zawsze `font-variant-numeric: tabular-nums` (kolumny godzin się nie rozjeżdżają).
- Bez WERSALIKÓW w etykietach. Wyróżniamy grubością i kolorem `--ink-2`, nie wielkimi literami.
- Wielka litera tylko na początku zdania („Nowy projekt", nie „Nowy Projekt").
- Długość wiersza tekstu ciągłego maks. ~75 znaków.

---

## 4. Przestrzeń, kształt, głębia

**Siatka 4 px.** Odstępy: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.

**Promienie zależne od hierarchii** (nie jeden promień na wszystko):

| Token | Wartość | Obiekt |
|---|---|---|
| `--r-cell` | 25% boku | Kropka dnia (4 px przy 16 px, 9 px przy 36 px) — kształt ten sam w każdym rozmiarze |
| `--r-control` | 12 px | Pole, przycisk, chip prostokątny |
| `--r-card` | 20 px | Karta, kalendarz, tabela |
| `--r-sheet` | 28 px | Wysuwany panel, dock |
| `--r-pill` | 999 px | Plakietki, chipy, wyszukiwarka i przycisk „+" w docku |

**Głębia** — jeden cień dla wszystkiego, co pływa: `--shadow-float`. Karty i tabele mają tylko obrys `--line-soft`, bez cienia.

---

## 5. Układ

- **Brak górnego paska.** U góry po lewej mały znak „Epcido Terminal", po prawej status połączenia z bazą. Pod spodem duży tytuł ekranu wyrównany do lewej.
- **Nawigacja: pływający dock** na dole, na środku ekranu. Ten sam wzór na komputerze i w telefonie, więc pracownik i planista uczą się jednej nawigacji.
  - Pole wyszukiwania nad ikonami.
  - Środkowy okrągły przycisk Deep Forest z „+" — główna akcja ekranu (u planisty: nowy projekt).
  - Aktywna pozycja: ikona i podpis w Deep Forest, nieaktywne w `--ink-3`.
- Treść wyrównana do lewej, maks. szerokość 1440 px, marginesy boczne 32 px (16 px na telefonie). Dół strony ma 148 px zapasu, żeby dock niczego nie zasłaniał.
- **Panele boczne** (szczegóły projektu, nowy projekt) wysuwają się z prawej, szerokość 520 px, na telefonie na cały ekran.

---

## 6. Komponenty

### Przyciski
| Wariant | Wygląd | Kiedy |
|---|---|---|
| Główny | Tło Deep Forest, tekst biały, 44 px wysokości | Jedna główna akcja w widoku („Utwórz projekt") |
| Drugorzędny | Białe tło, obrys `--line`, tekst `--ink` | Pozostałe akcje |
| Cichy | Bez tła, tekst `--ink-2`, hover `--forest-50` | Akcje w wierszach, „Anuluj" |
| Niszczący | Biały, tekst `#9E4232`, zawsze z potwierdzeniem | Usunięcie, reset danych |

Tekst przycisku mówi, co się stanie: „Utwórz projekt", „Zapisz zmiany", „Dodaj do zespołu". Komunikat po akcji używa tego samego słowa: „Projekt utworzony", „Zmiany zapisane".

### Pola formularza
- Wysokość 44 px, promień 12 px, obrys `--line`, fokus: obrys Deep Forest + pierścień `--forest-100` 3 px.
- Etykieta nad polem, `--text-sm`, grubość 520, kolor `--ink-2`.
- Błąd: tekst pod polem w `#9E4232`, mówi co poprawić („Podaj datę startu").
- Pola wpływające na integracje (Dataverse) są w osobnej sekcji z ostrzeżeniem.

### Kalendarz (wybór daty)
- Karta `--r-card`, cień pływający, tydzień od poniedziałku: Pn Wt Śr Cz Pt So Nd.
- Dni jako kwadraty 36 px z promieniem 25% (to ta sama „kropka dnia", tylko większa).
- Wybrany dzień: wypełnienie Deep Forest, biały numer. Dziś: obrys Deep Forest. Zakres: `--forest-50`. Weekendy: numer w `--ink-2`.
- Golden Hour i Terracotta nie pojawiają się w kalendarzu wyboru daty.

### Wybór godziny (moduł czasu pracy — następny etap)
- Duże cyfry `--text-3xl`, szerokość 112%: „7:00 → 17:00".
- Przewijane kolumny godzin i minut (krok 15 min), wybrana wartość w Deep Forest.
- Przerwa jako przyciski 0 / 15 / 30 / 45 / 60 min, nie pole tekstowe.

### Plakietki (stany, role)
- Promień `--r-pill`, wysokość 24 px, `--text-sm` 520.
- Stany: patrz 2.3. Role: tło `--sand`, tekst `--ink`.

### Kropki dni
- Mapa projektów: 16 px, odstęp 4 px.
- Oś czasu: 20 px w kolumnie 26 px.
- Kalendarz: 36 px.
- Zawsze `--r-cell`, zawsze z dymkiem po najechaniu (data, liczba osób, stan).

### Kalendarz w panelu
Kalendarz otwiera się nad stroną (nie wewnątrz panelu), żeby nic go nie przycinało. Gdy pod polem brakuje miejsca, otwiera się w górę.

---

## 6a. Wzorce ekranów (do powtarzania w kolejnych modułach)

| Wzorzec | Gdzie | Zasada |
|---|---|---|
| **Kafelek projektu** | Mapa | Nazwa (szer. 108%) i numer → klient, miasto → supervisor ze znacznikiem → siatka 7 dni × 12 tygodni → stopka z liczbą osób i plakietkami stanów. Klik w nazwę otwiera panel, klik w siatkę otwiera oś czasu. |
| **Siatka osób** | Oś czasu | Lewa kolumna przyklejona (nazwiska zwężone), nagłówek tygodni i dni przyklejony. Weekendy `--sand-50`, dziś `--forest-50` i numer dnia w kropce Deep Forest. Wiersz projektu pokazuje liczbę pracujących i pasek w kolorze stanu zbiorczego. |
| **Drzewko** | Struktura | Linie 1.5 px `--line`. Węzeł nadrzędny z wypełnionym znacznikiem (IM), dzieci jako karty, członkowie zespołu jako chipy na jednym poziomie. |
| **Pasek tygodnia** | Ludzie, zespół | 7 mini-kropek (12 px) bieżącego tygodnia przy osobie. |
| **Panel szczegółów** | Projekt | Tytuł, metadane po przecinku, plakietka statusu, zakładki. Akcja główna w stopce panelu. |

---

## 7. Ruch

- Ruch odpowiada na działanie użytkownika: panel się wysuwa (240 ms), kalendarz się pojawia (160 ms), zaznaczenie w docku się przesuwa.
- Jeden moment „wejścia": przy pierwszym wczytaniu mapy kropki pojawiają się tydzień po tygodniu (łącznie < 500 ms). Nic więcej nie animuje się samo.
- `prefers-reduced-motion` wyłącza wszystkie animacje.
- Krzywa: `cubic-bezier(.2, .8, .2, 1)`.

---

## 8. Język interfejsu

- Polski, prosty, w drugiej osobie tylko gdy to konieczne. Nazwy z punktu widzenia użytkownika: „Zespół", „Nieobecny", a nie „assignment", „absence record".
- Puste stany mówią, co zrobić: „Ten projekt nie ma jeszcze zespołu. Dodaj supervisora i pracowników."
- Błędy mówią, co się stało i jak to naprawić, bez przeprosin.
- Stanowiska: Installation Manager, Supervisor, Team Leader, Elektryk, Mechanik — w tej formie wszędzie.
- Daty: „13 paź 2026", dni „wt, 13 paź", tygodnie „tydz. 42".

---

## 9. Dostępność

- Kontrast tekstu min. 4.5:1 (sprawdzone dla `--ink`, `--ink-2` i plakietek).
- Kolor nigdy nie jest jedyną informacją: kropki mają opis dostępny dla czytników i dymek, nieobecność ma dodatkowy znak.
- Widoczny fokus klawiatury na każdym elemencie interaktywnym.
- Cele dotykowe min. 44 px w aplikacji mobilnej.

---

## 10. Checklista przed oddaniem ekranu

- [ ] Golden Hour i Terracotta użyte tylko jako stan dnia?
- [ ] Cień tylko na elementach pływających?
- [ ] Promień zgodny z hierarchią?
- [ ] Liczby tabelaryczne, etykiety bez wersalików?
- [ ] Pusty stan i błąd mówią, co zrobić?
- [ ] Działa na 375 px szerokości i z klawiatury?

# Epcido Terminal — brandbook interfejsu

> Wersja 1.1 · obowiązuje dla wszystkich modułów (planowanie, czas pracy, akceptacje, komunikacja, aplikacja mobilna).
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
| **Do zatwierdzenia** | Golden Hour `#F4B13B` | Godziny wpisane przez pracownika lub TL, czekają na zatwierdzenie |
| **Nieobecny** | Terracotta Clay `#E0745E` + biała kreska | Nieobecność (L4, urlop, inna) |
| **Wolne / brak wpisu** | Biały + obrys `#DCE3E0`; w weekend piaskowy `#F2E6D6` | Dzień wolny albo nikt nic nie wpisał |

Znaczniki na dniu:

| Znak | Wygląd | Znaczenie |
|---|---|---|
| **Wysłane do Dataverse** | Zielony ptaszek `--sent #9FE3BB` w kropce; na dużej komórce kółko w rogu | Godziny poszły we wtorkowej wysyłce i są zamknięte |
| **Zaplanowany dzień** | Pusta kropka z obrysem `--forest-100` | Przyszły dzień roboczy w okresie pracy osoby w projekcie |
| **Do poprawy** | Obrys `#9E4232` na komórce „do zatwierdzenia" | Supervisor odrzucił dzień z powodem |
| **Dziś** | Obrys Deep Forest wokół kropki, numer dnia w kropce Deep Forest | — |
| **Koniec edycji** | Przerywana kreska `--cutoff` między poniedziałkiem a wtorkiem | Do poniedziałku włącznie można poprawić i zatwierdzić godziny poprzedniego tygodnia; we wtorek o 23:00 wysyłka do Dataverse |

- Nieobecność bez ptaszka ma poziomą białą kreskę w środku. Dzięki temu odróżnia się od „do zatwierdzenia" także dla osób, które słabo rozróżniają żółty i pomarańczowy.
- Sobota i niedziela mają piaskowe tło kolumny; pusty weekend jest piaskową kropką, nie białą — od razu widać, że to dzień zwykle wolny.
- Status zawsze nazywamy „Do zatwierdzenia" (nie „Czeka").
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
| `--r-pill` | 999 px | Plakietki, chipy, wyszukiwarka, licznik pozycji do zatwierdzenia |

**Głębia** — jeden cień dla wszystkiego, co pływa: `--shadow-float`. Karty i tabele mają tylko obrys `--line-soft`, bez cienia.

---

## 5. Układ

- **Górna linia bez tła** (nie pasek): znak „Epcido Terminal" → „Cześć, *imię*" z rolą → po prawej:
  - licznik **„Masz X pozycji do zatwierdzenia"** z sumą godzin (Golden Hour 100, klikany → Zatwierdzanie) dla osób, które zatwierdzają,
  - „Masz X dni do poprawy" (Terracotta 100) dla osób z odrzuconymi dniami,
  - przycisk główny **„Dodaj nowy projekt"** dla Administratora, Planning i Project Managera,
  - przełącznik **„Wersja mobilna / desktopowa"**.
- **Nawigacja: pływający dock** na dole, na środku. Pozycje zależą od roli (`domain/permissions.ts`). Bez przycisku „+". Zatwierdzanie ma licznik w kropce Golden Hour. Pracownik z jednym ekranem nie widzi docku.
- Treść wyrównana do lewej, maks. szerokość 1440 px, marginesy boczne 32 px (16 px w wąskiej ramce). Dół strony ma 148 px zapasu na dock.
- **Edytor projektu na pełnym ekranie**: pasek z „Wróć", nazwą, stanem zapisu i akcją główną; po lewej dane projektu (420 px), po prawej plan zespołu.
- **Okna dialogowe** na środku; w wąskiej ramce wysuwają się od dołu.
- **Wąska ramka**: style reagują na szerokość ramki aplikacji (container queries), nie okna. Dzięki temu podgląd mobilny na komputerze wygląda dokładnie jak telefon.
- **Panel roboczy** (tylko prototyp): po lewej, przerywana linia i plakietka „prototyp", żeby nie mylił się z produktem.

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

### Lista wyboru
- Zawsze własna lista aplikacji (`SelectMenu`), nigdy systemowa `<select>` — systemowa wygląda inaczej w każdej przeglądarce i dochodzi do krawędzi.
- Lista: karta 16 px, odstęp 6 px od krawędzi, pozycje 40 px, wybrana z ptaszkiem w Deep Forest, podpowiedź po prawej w `--ink-2`.
- Warianty: pole formularza, cichy (bez obrysu, w tabelach i panelu), przycisk akcji („Przenieś do…").

### Wybór godziny (ekran pracownika)
- Duże cyfry 44 px, szerokość 112%, Deep Forest: „7:00 → 17:00".
- Pod każdą godziną przyciski − / + (krok 15 min, 52 × 48 px) — wygodne w rękawicach.
- Przerwa jako przyciski 0 / 15 / 30 / 45 / 60 (minuty), wybrana w Deep Forest.
- Pod spodem „Czas pracy: 9 h 30 min" i jeden duży przycisk „Wyślij do zatwierdzenia" (60 px).

### Duża komórka dnia
- Oś czasu i zatwierdzanie: komórka 86 px (80 px w wąskiej ramce), promień 10 px.
- Treść: „7:00–17:00" (12 px, 640, szer. 82%) i „przerwa 30 min"; nieobecność: „L4" / „Urlop" i powód.
- Ptaszek Dataverse w kółku na rogu komórki, z białą obwódką.
- W zatwierdzaniu komórkę „do zatwierdzenia" klika się, żeby ją zaznaczyć (pierścień Deep Forest i ✓).

### Liczby do zatwierdzenia
- Zatwierdzanie i pulpit pokazują liczby dużo (56 px, szer. 112%, Deep Forest): pozycje i godziny. To jedyne miejsce na tak duże liczby — tu są treścią ekranu.
- Po terminie: liczba w `#9E4232`.

### Plan zespołu (paski)
- Pasek = okres pracy osoby w projekcie: `--forest-100`, promień 8 px, etykieta „12 paź – 30 lis".
- Przeciąganie całego paska przesuwa okres, brzegi zmieniają start lub koniec. Podczas przeciągania pasek jest Deep Forest z cieniem.
- Kolizja z innym projektem: tło `--terracotta-100` i obrys `#9E4232`, dymek mówi, z czym koliduje.
- Ta sama osoba w innych projektach: szary, kreskowany pasek w tle wiersza.
- Poza terminem projektu: kreskowane tło; dziś: pionowa linia Deep Forest.

### Plakietki (stany, role)
- Promień `--r-pill`, wysokość 24 px, `--text-sm` 520.
- Stany: patrz 2.3. Role: tło `--sand`, tekst `--ink`.

### Kropki dni
- Mapa projektów: 16 px w kolumnie 20 px.
- Pasek tygodnia przy osobie: 12 px.
- Kalendarz: 36 px.
- Zawsze promień 25%, zawsze z dymkiem po najechaniu (osoba, data, godziny, stan).
- Znaczniki stanowisk (SV, TL, E, M) nie mają dymków — są oczywiste.

### Kalendarz w panelu
Kalendarz otwiera się nad stroną (nie wewnątrz panelu), żeby nic go nie przycinało. Gdy pod polem brakuje miejsca, otwiera się w górę.

---

## 6a. Wzorce ekranów (do powtarzania w kolejnych modułach)

| Wzorzec | Gdzie | Zasada |
|---|---|---|
| **Karta projektu** | Mapa, oś czasu, zatwierdzanie | Nagłówek: nazwa (szer. 108%) i numer → klient, miasto → supervisor → po prawej: liczba osób, „Do zatwierdzenia: X pozycji, Y h", „Do poprawy", „W Dataverse do …". Pod spodem siatka: **wiersze = ludzie, kolumny = dni**. |
| **Siatka dni** | Mapa (kropki 16 px), oś czasu (komórki 86 px) | Nagłówek: miesiąc, pod nim numery dni (na osi czasu także Pn/Wt…). Lewa kolumna z nazwiskami przyklejona. Weekendy na piaskowym tle, kreska pn|wt, dni poza okresem pracy osoby puste. Mapa dobiera liczbę tygodni do szerokości ekranu; oś czasu pokazuje 2 tygodnie. Bez podświetlania wierszy. |
| **Zatwierdzanie** | Supervisor, IM, admin | Duże liczby + termin + „Zatwierdź wszystko". Grupy: projekt → tydzień → osoby. Tygodnie po terminie z plakietką „Po terminie". Zaznaczone dni → czarny pasek akcji u góry. |
| **Pulpit** | Installation Manager, admin | Trzy kafle (supervisorzy, czeka na Ciebie, termin) i tabela supervisorów: do zatwierdzenia, po terminie, postęp tygodnia, czeka na Ciebie. |
| **Drzewko** | Struktura | Linie 1.5 px `--line`. Węzeł nadrzędny z wypełnionym znacznikiem (IM), dzieci jako karty, członkowie zespołu jako chipy na jednym poziomie. |
| **Pasek tygodnia** | Ludzie, zespół | 7 mini-kropek (12 px) bieżącego tygodnia przy osobie. |
| **Edytor projektu** | Tworzenie i edycja | Pełny ekran. Dane projektu po lewej, „Plan zespołu" i „Historia zmian" po prawej. Zapis jednym przyciskiem, stan „Niezapisane zmiany / Wszystko zapisane" przy tytule. |
| **Ekran pracownika** | Telefon | Projekt dnia → karta dnia (godziny, przerwa, wyślij) → „Zgłoś nieobecność" → tydzień jako lista dni z kropką stanu. |

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

# 0006. Supervisor zatwierdza ostatecznie, Installation Manager widzi całą firmę, podgląd osoby i jedna oś tablicy obsady

- Status: Przyjęta
- Data: 2026-10-19
- Decydujący: zespół Epcido Terminal (właściciel)
- Zmienia: ADR 0002 (dwustopniowe zatwierdzanie), ADR 0005 (zakres projektów Installation Managera)

## Kontekst

Przegląd 0.6 u właściciela dał pięć uwag, z których pierwsza zmienia rdzeń domeny:

1. **Project Manager nie zatwierdza godzin w ogóle. Installation Manager zatwierdza godziny wyłącznie swoim supervisorom, a poza tym tylko widzi, co supervisorzy mają jeszcze do podpisania innym.** Dotąd timesheet był kompletny dopiero po zatwierdzeniu wszystkich dni przez IM — przy nowej zasadzie nic by nigdy nie zeszło z `SUPERVISOR_APPROVED` i każdy timesheet byłby po terminie wstrzymany.
2. Installation Manager ma widzieć **wszystkie projekty firmy**, ale w każdym widoku musi wiedzieć, które są jego, a które innego IM.
3. Kliknięcie w nazwisko — gdziekolwiek pada — ma otwierać **podgląd osoby**: gdzie jest teraz, kiedy kończy, kiedy ma przerwę, dokąd leci dalej (tygodniowo), jej godziny (zatwierdzone i nie) oraz dane i doświadczenie.
4. W Obsadzie **oś tygodni ma być jedna i przyklejona**: przy najniższym projekcie wciąż musi być widać, od którego tygodnia zaczyna się kolumna, a moduł „Ludzie" ma stać dokładnie pod projektami, tydzień w tydzień. Moduł „Ludzie" ma być też w planowaniu pojedynczego projektu, z filtrem stanowisk i z zaznaczaniem okresu myszą.
5. Okna z danymi ucinały się na dole ekranu i nie dało się ich przewinąć; panel roboczy prototypu zlewał się z aplikacją; zmiany planisty zapisywały się bez pytania.

## Decyzja

### Ścieżka zatwierdzania godzin

Zatwierdzenie ostateczne zależy od tego, **czyj** to dzień, a nie od poziomu w hierarchii:

- dzień członka zespołu (TL, elektryk, mechanik) domyka **supervisor projektu** — i to jest koniec drogi,
- dzień samego supervisora domyka **Installation Manager projektu** (nikt nie zatwierdza własnych godzin),
- administrator (`hours.approveAll`) może wszystko; **Project Manager nic** — rola nie ma i nie dostaje żadnego uprawnienia `hours.*`.

W kodzie (`src/domain/workflow.ts`):

- `finalLevelFor(project, employeeId)` → `"final"` dla supervisora projektu, `"team"` dla reszty;
- `isComplete(project, employeeId, entry)` zastępuje `isFinal(entry)` wszędzie, gdzie ocenia się kompletność timesheetu (`timesheets.ts`, `aggregate.ts`, `reports.ts`, `supervisorStats`). Dzień zespołu ze statusem `SUPERVISOR_APPROVED` jest kompletny; dzień supervisora wymaga `PM_APPROVED`;
- `approvalLevel` nie zwraca już `"final"` dla dni zespołu — IM ich nie podpisuje;
- `editRight`: IM wchodzi w dzień tylko tam, gdzie sam podpisuje; przy dniach zespołu dostaje jasny powód („Godziny zespołu zatwierdza supervisor projektu — tutaj tylko podgląd").

Statusy w danych (`SUBMITTED` / `SUPERVISOR_APPROVED` / `PM_APPROVED`) zostają bez zmian — zmienia się tylko ich interpretacja. Dzięki temu dane z 0.6 pozostają ważne i nie trzeba migracji.

**Podgląd zamiast podpisu.** `supervisorOversight(model, user, now)` zwraca, czego jeszcze nie podpisali supervisorzy w projektach danego IM (osoba, tydzień, dni). Ekran Zatwierdzanie pokazuje to jako sekcję „Czeka na Twoich supervisorów" — bez przycisku zatwierdzania. `supervisorStats` liczy osobno `pending` (dni zespołu u supervisora) i `awaitingFinal` (własne godziny supervisora, czekające na IM).

### Zakres projektów

- `INSTALLATION_MANAGER` dostaje `projects.all` zamiast `projects.own`.
- `projectScope(model, user, project)` → `"mine"` (prowadzi go jako PM/IM/SV albo w nim pracuje) albo `"other"`.
- `seesOtherProjects` jest prawdziwe tylko wtedy, gdy ktoś ma i swoje, i cudze projekty — Planning widzi wszystko, ale nic nie jest „jego", więc podziału mu nie pokazujemy.
- Wspólny `useScope` + `ScopeFilter` („Moje / Innych IM / Wszystkie", domyślnie wszystkie) i `ProjectScopeMark` są użyte w Pulpicie, Mapie, Osi czasu, Strukturze i Obsadzie.

### Podgląd osoby

`UiContext` dostaje `personId` / `openPerson` / `closePerson`; `PersonSheetHost` jest montowany raz, na poziomie aplikacji. `PersonLink` zastępuje statyczne nazwiska w tabelach, planach, kolejce zatwierdzania, strukturze, urlopach i użytkownikach. Okno ma trzy zakładki: plan tygodniowy (paski projektów, przerwy, urlopy, oś 12 tygodni, kolejne kroki), godziny (ostatnie 4 tygodnie: suma, zatwierdzone, czekające, nieobecności, pasek dni w tygodniu, lista dni do zatwierdzenia) oraz dane i doświadczenie.

### Tablica obsady i moduł „Ludzie"

- `PeopleBoard` jest jednym komponentem używanym w Obsadzie (`variant="staffing"`) i w planie projektu (`variant="project"`). Filtry: stanowisko (elektrycy, mechanicy, TL, SV, wszyscy), stan (zwalniają się, wolni, bez przerwy, wszyscy), kolejność, szukanie oraz dotychczasowe filtry EPCIDO i stażu.
- Supervisorzy wchodzą na tablicę razem z zespołem: nie mają przypisań, więc ich paski to projekty, w których są nadzorem (`personBars`).
- W Obsadzie oś tygodni (`.staff-ruler`) jest jedna dla projektów i ludzi, `position: sticky` w obrębie `.staff-board`. Obie siatki mają tę samą definicję kolumn, więc tygodnie pokrywają się w pionie.
- **Zaznaczanie okresu**: naciśnięcie i przeciągnięcie po pasku osoby otwiera `RangeDialog` z wyborem „przypisz do projektu" albo „powrót do domu" (przerwa w trwającym zadaniu, przez `insertBreak`).
- W planie projektu szary pasek („ta sama osoba w innym projekcie") jest przyciskiem — kliknięcie otwiera tamten projekt.

### Potwierdzenia przed zapisem

`UiContext.confirm(request)` zwraca obietnicę i pokazuje okno z listą zmian. Przechodzą przez nie: zapis projektu i planu zespołu, porzucenie niezapisanych zmian w edytorze, przeciągnięcie osoby na tydzień projektu, propozycja obsady, „Zaplanuj", „Przerwa" i zaznaczenie okresu.

### Okna na środku ekranu

Okna żyją w warstwie `#epcido-overlay` — w ramce aplikacji, ale **poza** przewijaną stroną. Wcześniej były w środku `.app-scroll`, która jest kontenerem zapytań CSS, więc `position: fixed` liczył się względem przewijanej treści. Dodatkowo `.dialog-root` jest flexem, a nie gridem: przy gridzie wiersz dostawał naturalną wysokość okna i `max-height` nie przycinał go do ekranu — wysokie okno (np. „Zaproponuj obsadę") wystawało poniżej krawędzi.

### Panel roboczy

Panel przełączania osób dostał wygląd terminala (czarne tło, monospace, małe litery) i chowa się sam po wybraniu osoby. To rusztowanie prototypu, nie część produktu — ma się odcinać od aplikacji na pierwszy rzut oka i zniknie razem z wejściem logowania.

### Ruch

`src/styles/motion.css` zbiera cały ruch w jednym miejscu: wejścia ekranu i kart, reakcje przycisków, kafelków dni i pasków, przejścia słupków. Reguła `prefers-reduced-motion` jest na końcu tego pliku, czyli na końcu kaskady.

## Konsekwencje

Dobre:

- timesheet domyka się bez udziału IM, więc kompletny tydzień idzie do Dataverse nawet wtedy, gdy IM nic nie kliknie;
- IM ma jedno miejsce, w którym widzi, gdzie stoi podpis, i kogo pogonić przed terminem;
- planista pracuje na jednej osi: projekt i ludzie w tym samym tygodniu, bez przewijania w dwóch miejscach;
- żadna zmiana planu nie trafia do bazy bez potwierdzenia.

Koszty i ryzyka:

- **Jeśli supervisor nie zatwierdzi, nikt poza administratorem tego nie naprawi.** IM nie ma już obejścia. To było świadomym wyborem właściciela; jeśli okaże się za ostre, wystarczy przyznać IM `hours.approveAll` na ekranie Użytkownicy — kod już to obsługuje.
- Nazwa statusu `PM_APPROVED` jest myląca (Project Manager niczego nie zatwierdza). Zmiana nazwy to migracja danych — do zrobienia razem z przejściem na PostgreSQL.
- `projects.all` dla IM zwiększa liczbę projektów w widokach; przy 40 projektach to nie problem, przy kilkuset trzeba będzie stronicowania.
- Podgląd osoby liczy godziny z 4 tygodni przy każdym otwarciu; przy 500 osobach to nadal pojedyncze milisekundy, ale w wersji na API powinno to być jedno zapytanie.

## Poprawki logiki przypisań przy okazji

- `saveProject` sprawdzał nachodzenie zadań tylko **wewnątrz** projektu. Teraz odrzuca też zadanie, które nachodzi na zadanie tej samej osoby w **innym** projekcie — plan zespołu pokazywał taką kolizję na szaro, ale zapis przepuszczał ją po cichu.
- `assignToProject` („Przypisz do…" na liście ludzi) skracał tylko zadania trwające w dniu przeprowadzki. Zadanie zaplanowane **później** zostawało i nachodziło na nowe. Teraz nowe zadanie kończy się dzień przed kolejnym, a gdy to niemożliwe — polecenie odmawia i mówi dlaczego.

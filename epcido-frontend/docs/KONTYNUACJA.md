# Epcido Terminal: instrukcja kontynuacji pracy

Stan na 19.10.2026, wersja prototypu **0.7.0** (PR #6). Dokument jest dla każdego, kto przejmuje pracę w nowej rozmowie z Claude albo w zespole (Valery, Jakub). Kto zacznie od tego pliku, nie musi znać wcześniejszych rozmów.

## 1. Czym jest projekt

Epcido Terminal zastępuje Gantbee w Epcido, partnerze instalacyjnym: ok. 40 projektów jednocześnie, mechanicy i elektrycy, ok. 500 osób. System obejmuje planowanie projektów i obsady, rejestrację i zatwierdzanie godzin, urlopy, uprawnienia i raporty. Jedyna integracja zewnętrzna to Dataverse (administruje nim nav24), przez które godziny trafiają do Business Central i Enovy.

Zasady od właściciela, których nie wolno łamać:

- Najtaniej, jak się da, przy maksymalnym bezpieczeństwie.
- Każda zmiana jest udokumentowana: `CHANGELOG.md`, ADR w `docs/adr/`, `docs/BRANDBOOK.md`.
- Interfejs po polsku, dopracowany. Mówimy „projekt”, nigdy „budowa”.
- Brandbook: bez podtytułów pod tytułami, bez etykiet wielkimi literami, Golden Hour i Terracotta tylko jako stany.
- Godziny zatwierdza się do poniedziałku 23:59 (termin z ustawień), eksport do Dataverse idzie we wtorek 23:00.
- „EPCIDO” (UoP i B2B) zamiast „nasi”. Cel: co najmniej połowa osób na projekcie to EPCIDO. Elektrycy są czerwoni, mechanicy niebiescy, w całym systemie.
- **Zmiany planisty nie zapisują się bez potwierdzenia.** Każdy zapis pokazuje listę zmian i pyta.

## 2. Gdzie co jest

| Co | Gdzie |
|---|---|
| Kod (React) | repozytorium GitHub `miszyszka/Epcido-Terminal`, katalog `epcido-frontend/` |
| Dokumentacja w repo | `epcido-frontend/docs/` (ten plik, `PLAN_I_ARCHITEKTURA.md`, `BRANDBOOK.md`, `adr/`) i `CHANGELOG.md` |
| Dokumentacja w projekcie Claude „Epcido Terminal” | `claude/WYMAGANIA_NIEFUNKCJONALNE.md`, `claude/BRANDBOOK.md`, `claude/KONTYNUACJA.md` (kopia tego pliku), `ERP Fase 2.docx`, `prezentacja erp.pdf`, `zrzut 1.txt` |
| Baza prototypu | Firebase, projekt `epcido-terminal`, Firestore w europe-central2 |

Uwaga: nazwa repozytorium w GitHubie to `Epcido-Terminal`, a adres w `git remote` jest pisany małymi literami. Oba działają.

Gałęzie i wersje: każda wersja to osobna gałąź `vX.Y-opis` i PR do `main`. Zamknięte i scalone: 0.2 (PR #1) do 0.6 (PR #5). **PR #6 (0.7) jest otwarty** do przeglądu właściciela.

## 3. Jak Claude ma dostęp do repozytorium i jak robi pushe

To jest środowisko pracy sesji, nie część aplikacji.

1. **Repozytorium podpina się do sesji** narzędziem `add_repo` (owner `miszyszka`, repo `Epcido-Terminal`, dostęp `push`) i klonuje zgodnie z odpowiedzią narzędzia do `/home/claude/epcido-terminal`. Nie wolno wcześniej „sprawdzać” repozytorium przez `curl` ani `gh repo view`: dla prywatnych repozytoriów dają fałszywe 404.
2. **Sieć idzie przez proxy sesji** (zmienne `HTTPS_PROXY`, `GIT_SSL_CAINFO`, certyfikat w `/root/.ccr/ca-bundle.crt`). Proxy i konfiguracja gita podstawiają uwierzytelnienie, więc **w kodzie, w plikach ani w poleceniach nie ma żadnych tokenów**. Nigdy nie wyłączamy weryfikacji TLS i nie ustawiamy własnego tokena.
3. **`gh auth status` pokazuje, że token jest nieprawidłowy, i to jest normalne.** `gh api` oraz `git ls-remote` i tak działają. Uprawnienia: `gh api repos/miszyszka/Epcido-Terminal --jq .permissions` (powinno być `push: true`).
4. **Commity są podpisywane kluczem SSH** sesji. Autor: `Claude <noreply@anthropic.com>`. GitHub może pokazywać je jako niezweryfikowane — to nie błąd.
5. **Przepływ jednej wersji:**
   - praca w kopii roboczej `/home/claude/epcido-frontend` (z `node_modules`), tam budowanie i testy;
   - kopiowanie zmian do klonu (`/home/claude/epcido-terminal/epcido-frontend`) bez `node_modules` i `dist`;
   - `git switch -c vX.Y-opis`, `git add`, `git commit`, `git push -u origin vX.Y-opis`;
   - PR przez `gh pr create` (albo `gh api` na REST, gdy `gh` zawiedzie);
   - merge robi właściciel. Claude nie scala PR sam.
6. **Stopki.** Commit kończy się dwiema liniami: `Co-Authored-By: Claude <noreply@anthropic.com>` i `Claude-Session: <adres sesji>`. Opis PR kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)` i adresem sesji.
7. **Gdy sesja nie ma sieci do GitHuba** (odmowa 403/407 z proxy): nie próbujemy obejść, tylko zgłaszamy. Diagnostyka: `curl -sS "$HTTPS_PROXY/__agentproxy/status"`.

## 4. Jak uruchomić i sprawdzić

```bash
cd epcido-frontend
npm install
npm run dev          # http://localhost:5173 (Firebase)  |  /?demo = dane w przeglądarce
npx tsc -b           # typy
npm run lint         # oxlint
npm run build        # tsc -b + vite build
```

Przed każdym PR: `tsc`, `lint` i `build` bez błędów oraz przejście głównych ścieżek w przeglądarce.

- Testy przeglądarkowe (Playwright, Chromium z `/opt/pw-browsers`, `vite preview` na porcie 4173) są pisane doraźnie w katalogu roboczym sesji i **nadal nie są w repozytorium**. W 0.7 sprawdzały: brak zatwierdzania u PM, zatwierdzanie zespołu przez SV, kolejkę podglądu u IM, filtr zakresu projektów i znaczniki „moje / innych IM”, podgląd osoby (trzy zakładki), zaznaczanie okresu na pasku osoby, okno potwierdzenia zapisu, skok z szarego paska do innego projektu, położenie okien po zjechaniu strony na dół. **Zadanie na start:** przenieść je do `e2e/` w repozytorium i podpiąć do CI.
- Dane testowe: generator `src/data/seed.ts` (deterministyczny, `SEED_VERSION = 6`, klucz demo `epcido-demo-v6`). Po zmianie struktury danych podnosimy wersję, a aplikacja proponuje wymianę starych danych.
- Reguły bazy `firestore.rules` trzeba po każdej zmianie wkleić ręcznie w konsoli Firebase (Firestore, Reguły, Publish).

## 5. Architektura tymczasowa (prototyp, dziś)

```
Przeglądarka (React 19, TypeScript, Vite 8, react-router 7)
  ├─ src/domain/     czyste reguły biznesowe, bez bazy i bez Reacta
  ├─ src/data/       Repository (interfejs) + firestoreRepo + memoryRepo (demo) + commands + seed
  ├─ src/app/        DataContext (model), SessionContext (kto jest zalogowany: tylko prototyp), UiContext
  └─ src/features/   ekrany: map, timeline, approvals, hours, leaves, staffing, people, project, admin...
        │
        ▼  Firebase Firestore (europe-central2), nasłuch na żywo, kopia w przeglądarce
```

Cechy, które trzeba znać:

- **Wzorzec Repository.** Cały zapis idzie jedną drogą: polecenie w `commands.ts` zwraca `{ writes, audit }`, a `Repository.apply(ChangeSet)` zapisuje to atomowo (`writeBatch`). Dziennik zmian (`auditLog`) jest dopisywany w tym samym batchu i nigdy nie jest edytowany.
- **Kolekcje:** `employees`, `projects`, `assignments`, `timesheets` (jeden dokument na projekt i tydzień: `{projectId}_{poniedziałek}`), `leaves`, `auditLog`, `meta/settings`.
- **Uprawnienia jako dane** (`domain/permissions.ts`): uprawnienia osoby = domyślne dla roli + `grants` − `revokes`. Role: ADMIN, PLANNING, PROJECT_MANAGER, INSTALLATION_MANAGER, SUPERVISOR, HR, WORKER, CUSTOM. Funkcja `can(user, permission)`; kto widzi informacje o wysyłce, rozstrzyga `seesDispatch`; czyj jest projekt — `projectScope`.
- **Ustawienia** (`meta/settings`, `domain/settings.ts`): terminy zatwierdzania i wysyłki, kategorie, oddziały, minimalny udział EPCIDO, zasady przerw.
- **Warstwa okien.** Okna dialogowe, podgląd osoby i potwierdzenia renderują się przez portal do `#epcido-overlay` — w ramce aplikacji, ale poza przewijaną stroną. Inaczej `position: fixed` liczy się względem przewijanej treści (bo `.app-scroll` jest kontenerem zapytań CSS) i okno ucieka poza ekran.
- **Integracja z Dataverse jest symulowana:** wysyłka we wtorek 23:00 to tylko stan w interfejsie.
- **Logowania nie ma.** Osobę wybiera się w panelu roboczym (DevPanel, wygląd terminala), który jest tylko w prototypie i chowa się po wyborze.

Co prototyp **gwarantuje**: spójną logikę domenową, dziennik zmian, dane na żywo między przeglądarkami, działanie przy słabym zasięgu (kopia lokalna).

Czego prototyp **nie gwarantuje** (blokuje wejście z prawdziwymi danymi):

- Uprawnienia sprawdza tylko przeglądarka i polecenia. Każdy, kto zna adres bazy, może czytać i zapisywać dane. Reguły wygasają 31.12.2026. Urlopy, L4 i raporty to dane osobowe, więc **w tym stanie nie wolno wgrywać prawdziwych danych**.
- Brak idempotencji i blokady edycji równoległej po stronie serwera, brak testów automatycznych w CI, brak kopii zapasowych poza mechanizmem Firebase, brak monitoringu.
- `npm audit` zgłasza znane podatności `@grpc/grpc-js` (zależność serwerowa Firebase, nieużywana w przeglądarce).
- Klucz konfiguracji Firebase w `src/lib/firebase.ts` jest publiczny z założenia; bezpieczeństwo opiera się na regułach, a te dziś są otwarte.

## 6. Architektura docelowa

Źródła: `docs/PLAN_I_ARCHITEKTURA.md` (sekcje 6, 7, 8) i `claude/WYMAGANIA_NIEFUNKCJONALNE.md`.

```
Użytkownicy: pracownik (PWA, telefon) · TL/SV (PWA + komputer) · biuro (komputer)
        │ HTTPS (reverse proxy: Caddy/Nginx albo usługa zarządzana)
        ▼
Frontend PWA (React + Vite)  ──►  API (NestJS na Fastify, REST + OpenAPI)
                                      │  moduły: identity, employees, projects, time,
                                      │  leaves, audit, reports, integration-dataverse
                                      ▼
                                 PostgreSQL 16 (jedyna baza: dane, audyt, kolejka zadań pg-boss)
Worker (ten sam kod, osobny proces): eksport wtorek 23:00, synchronizacja pracowników, powiadomienia
        │ Dataverse Web API (OData v4), OAuth2 z certyfikatem, tabela staging
        ▼
Dataverse (nav24)  ──►  Business Central, Enova
```

Zasady docelowe bez zmian względem 0.6: modularny monolit, jedna baza PostgreSQL, uprawnienia sprawdzane na serwerze, transakcje i idempotencja, logowanie własne (Argon2id, TOTP dla ról zatwierdzających), dziennik tylko do dopisywania, kopie zapasowe, hosting w UE, CI/CD w GitHub Actions, integracja z Dataverse tylko przez tabelę staging.

### Droga z prototypu do celu

1. **Teraz (prototyp):** pokazy, zbieranie uwag, dane testowe. Bez prawdziwych danych.
2. **Krok pośredni:** Firebase Authentication plus reguły Firestore oparte o `permissionsOf`.
3. **Docelowo:** nowa implementacja interfejsu `Repository` wywołująca API; polecenia z `commands.ts` stają się usługami backendu (te same reguły, te same wpisy audytu).
4. Migracja z Gantbee: sposób nieustalony.

## 7. Zasady domenowe, które łatwo zepsuć

- **Timesheet = wszystkie godziny wszystkich osób jednego projektu w jednym tygodniu.** Zatwierdza się po osobie. Jeśli choć jeden dzień nie jest zatwierdzony albo brakuje wpisu, **cały timesheet jest wstrzymany**; poprawia go tylko ktoś z `hours.fixWithheld`. Od wtorku 00:00 tydzień jest zamknięty.
- **Kto zatwierdza godziny (ADR 0012, zmiana w 0.7):** dzień członka zespołu (TL, elektryk, mechanik) domyka **supervisor projektu** i to jest zatwierdzenie ostateczne; dzień samego supervisora domyka **Installation Manager projektu**; **Project Manager nie zatwierdza godzin w ogóle**; administrator (`hours.approveAll`) może wszystko. W kodzie decyduje `finalLevelFor` i `isComplete` — **nie** `isFinal`, który mówi tylko o `PM_APPROVED`/`exported`. Jeśli gdzieś ocenia się kompletność timesheetu, musi to być `isComplete(project, employeeId, entry)`.
- **Installation Manager widzi wszystkie projekty firmy** (`projects.all`), ale w każdym widoku musi być widać, które są jego (`projectScope`, `ScopeFilter`, `ProjectScopeMark`). Na ekranie Zatwierdzanie ma dodatkowo sekcję podglądu „Czeka na Twoich supervisorów” (`supervisorOversight`) — bez przycisku zatwierdzania.
- **Pracownik i TL nie widzą** informacji o wysyłce ani wstrzymaniu; dla nich tydzień jest „zamknięty” (`seesDispatch`).
- **Urlop:** akceptuje HR/administrator (`leave.approveAll`) albo SV, IM lub PM projektu, w którym osoba wtedy pracuje (`leave.approveProject`); nikt nie akceptuje własnego wniosku. L4 jest ważny od razu, HR potwierdza dokument. Akceptacja zapisuje dni nieobecności w timesheetach, zatwierdzone. Odrzucenie wymaga powodu.
- **Obsada:** osoba jest nieobecna w tygodniu, gdy wniosek zabiera jej co najmniej 3 dni robocze. Kolejność kandydatów: najmniejsze opóźnienie, EPCIDO (gdy udział jest za niski), brak urlopu, staż w kategorii projektu.
- **Nikt nie pracuje w dwóch projektach naraz.** `saveProject` odrzuca zadanie nachodzące na zadanie tej samej osoby w innym projekcie, `planAssignment` sprawdza to samo, a `assignToProject` przycina nowe zadanie do dnia przed kolejnym.
- **Kategorie i oddziały** to dane z ustawień. Nie można usunąć używanej kategorii ani oddziału.
- **Administrator nie może odebrać sobie `users.manage`.**
- Każda zmiana danych musi przejść przez polecenie, które zwraca wpis do dziennika. Nie zapisujemy do bazy z komponentów.

## 8. Co zrobić na początku nowej rozmowy

1. Przeczytać ten plik, `CHANGELOG.md` (sekcja 0.7.0) i najnowszy ADR (`0012-…`).
2. Sprawdzić stan: `git status -sb`, `git log --oneline | head`, `gh pr view 6`. Jeśli PR #6 jest scalony, zaczynać od świeżego `main`.
3. Zapytać właściciela o priorytet, jeśli nie wskazał go sam. Nie zaczynać od dużej przebudowy bez pytania.
4. Pracować w gałęzi `vX.Y-opis`, dopisać wpis w `CHANGELOG.md`, ADR dla każdej decyzji architektonicznej, zaktualizować brandbook przy zmianach wyglądu.
5. Na końcu: build, lint, test w przeglądarce, PR, krótkie podsumowanie po polsku z ograniczeniami.

## 9. Otwarte sprawy i kolejne kroki

Do decyzji właściciela:

- Czy brak podpisu supervisora ma mieć wentyl bezpieczeństwa poza administratorem (ADR 0012 opisuje ryzyko: dziś IM nie może go zastąpić).
- Który kierunek planistyczny pierwszy: kwalifikacje (SEP, UDT, podnośniki) przy doborze osób, zakwaterowanie i przejazdy, scenariusze „co jeśli”, projekty niepodpisane z prawdopodobieństwem.
- Hosting docelowy (Azure czy własny serwer w UE) i budżet.
- Skąd bierzemy projekty i stawki (źródło prawdy: Dataverse czy nasz system).
- Sposób migracji z Gantbee.
- Szczegóły raportów, logo i pozostałe elementy marki.

Do zrobienia technicznie, w tej kolejności:

1. Merge PR #6.
2. Testy E2E do repozytorium plus CI (GitHub Actions: tsc, lint, build, E2E).
3. Logowanie i reguły oparte o role (krok pośredni) albo od razu start backendu.
4. ADR o hostingu i o schemacie PostgreSQL; kontrakt Dataverse z nav24.
5. Szkielet backendu (NestJS, Drizzle, migracje) i implementacja `Repository` po API. Przy okazji zmienić nazwę statusu `PM_APPROVED` — Project Manager niczego nie zatwierdza.
6. PWA dla pracowników (wpis godzin offline z szkicem lokalnym), powiadomienia.
7. Aktualizacja Firebase (podatności `@grpc/grpc-js`).

## 10. Historia wersji (skrót)

| Wersja | Zakres |
|---|---|
| 0.2 | Widok planisty, mapa projektów |
| 0.3 | Zatwierdzanie godzin, role, pulpit IM, edytor projektu, ekran pracownika |
| 0.4 | Obsada, zadania z przerwami, blokada po terminie, notatka zmian |
| 0.5 | Timesheet projekt × tydzień, zamknięcie we wtorek, kategorie, EPCIDO/agencja, Obsada 2.0 |
| 0.6 | Urlopy z akceptacją, HR i uprawnienia per osoba, ustawienia systemu, raporty Excel, Obsada 3.0 |
| 0.7 | SV zatwierdza ostatecznie, IM widzi całą firmę i kolejkę supervisorów, podgląd osoby, jedna oś tablicy obsady, moduł Ludzie w planie projektu, potwierdzenia zapisu, ruch w interfejsie |

Szczegóły każdej wersji: `CHANGELOG.md` i `docs/adr/`.

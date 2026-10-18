# Epcido Terminal: instrukcja kontynuacji pracy

Stan na 18.10.2026, wersja prototypu **0.6.0** (PR #5). Dokument jest dla każdego, kto przejmuje pracę w nowej rozmowie z Claude albo w zespole (Valery, Jakub). Kto zacznie od tego pliku, nie musi znać wcześniejszych rozmów.

## 1. Czym jest projekt

Epcido Terminal zastępuje Gantbee w Epcido, partnerze instalacyjnym: ok. 40 projektów jednocześnie, mechanicy i elektrycy, ok. 500 osób. System obejmuje planowanie projektów i obsady, rejestrację i zatwierdzanie godzin, urlopy, uprawnienia i raporty. Jedyna integracja zewnętrzna to Dataverse (administruje nim nav24), przez które godziny trafiają do Business Central i Enovy.

Zasady od właściciela, których nie wolno łamać:

- Najtaniej, jak się da, przy maksymalnym bezpieczeństwie.
- Każda zmiana jest udokumentowana: `CHANGELOG.md`, ADR w `docs/adr/`, `docs/BRANDBOOK.md`.
- Interfejs po polsku, dopracowany. Mówimy „projekt”, nigdy „budowa”.
- Brandbook: bez podtytułów pod tytułami, bez etykiet wielkimi literami, Golden Hour i Terracotta tylko jako stany.
- Godziny zatwierdza się do poniedziałku 23:59 (termin z ustawień), eksport do Dataverse idzie we wtorek 23:00.
- „EPCIDO” (UoP i B2B) zamiast „nasi”. Cel: co najmniej połowa osób na projekcie to EPCIDO. Elektrycy są czerwoni, mechanicy niebiescy, w całym systemie.

## 2. Gdzie co jest

| Co | Gdzie |
|---|---|
| Kod (React) | repozytorium GitHub `miszyszka/Epcido-Terminal`, katalog `epcido-frontend/` |
| Dokumentacja w repo | `epcido-frontend/docs/` (ten plik, `PLAN_I_ARCHITEKTURA.md`, `BRANDBOOK.md`, `adr/`) i `CHANGELOG.md` |
| Dokumentacja w projekcie Claude „Epcido Terminal” | `claude/WYMAGANIA_NIEFUNKCJONALNE.md`, `claude/BRANDBOOK.md`, `claude/KONTYNUACJA.md` (kopia tego pliku), `ERP Fase 2.docx`, `prezentacja erp.pdf`, `zrzut 1.txt` |
| Baza prototypu | Firebase, projekt `epcido-terminal`, Firestore w europe-central2 |

Uwaga: nazwa repozytorium w GitHubie to `Epcido-Terminal`, a adres w `git remote` jest pisany małymi literami. Oba działają.

Gałęzie i wersje: każda wersja to osobna gałąź `vX.Y-opis` i PR do `main`. Zamknięte i scalone: 0.2 (PR #1) do 0.5 (PR #4). **PR #5 (0.6) jest otwarty** do przeglądu właściciela.

## 3. Jak Claude ma dostęp do repozytorium i jak robi pushe

To jest środowisko pracy sesji, nie część aplikacji. Tak działało w sesji, w której powstało 0.6.

1. **Repozytorium jest podpięte do sesji** i sklonowane do `/home/claude/epcido-terminal`. W nowej sesji, jeśli klonu nie ma, Claude używa narzędzia `add_repo` (owner `miszyszka`, repo `Epcido-Terminal`, dostęp `push`) i klonuje zgodnie z odpowiedzią narzędzia. Nie wolno wcześniej „sprawdzać” repozytorium przez `curl` ani `gh repo view`: dla prywatnych repozytoriów dają fałszywe 404.
2. **Sieć idzie przez proxy sesji** (zmienne `HTTPS_PROXY`, `GIT_SSL_CAINFO`, certyfikat w `/root/.ccr/ca-bundle.crt`). Proxy i konfiguracja gita (`GIT_CONFIG_*`, `GIT_ASKPASS`) podstawiają uwierzytelnienie, więc **w kodzie, w plikach ani w poleceniach nie ma żadnych tokenów**. Nigdy nie wyłączamy weryfikacji TLS i nie ustawiamy własnego tokena.
3. **Polecenie `gh auth status` pokazuje, że token jest nieprawidłowy, i to jest normalne w tej sesji.** `gh api` oraz `git ls-remote` i tak działają, bo uwierzytelnienie wstawia proxy. Uprawnienia sprawdzamy poleceniem `gh api repos/miszyszka/Epcido-Terminal --jq .permissions` (powinno być `push: true`).
4. **Commity są podpisywane kluczem SSH** sesji (`user.signingkey`). Autor: `Claude <noreply@anthropic.com>`. GitHub może pokazywać je jako niezweryfikowane. To nie jest błąd.
5. **Przepływ jednej wersji:**
   - praca w kopii roboczej `/home/claude/epcido-frontend` (z `node_modules`), tam budowanie i testy;
   - kopiowanie zmian do klonu (`/home/claude/epcido-terminal/epcido-frontend`) bez `node_modules` i `dist`;
   - `git switch -c vX.Y-opis`, `git add`, `git commit`, `git push -u origin vX.Y-opis`;
   - PR przez `gh pr create` (albo `gh api` na REST, gdy `gh` zawiedzie);
   - merge robi właściciel. Claude nie scala PR sam.
6. **Stopki.** Commit kończy się dwiema liniami: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: <adres sesji>`. Opis PR kończy się linią `🤖 Generated with [Claude Code](https://claude.com/claude-code)` i adresem sesji. Dokładne wartości podaje przypomnienie sesji.
7. **Gdy sesja nie ma sieci do GitHuba** (odmowa 403/407 z proxy): nie próbujemy obejść, tylko zgłaszamy. Diagnostyka: `curl -sS http://127.0.0.1:34009/__agentproxy/status`.

Dostępu do komputera właściciela sesja zwykle nie ma. Pliki z jego komputera trzeba dołączyć do rozmowy.

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

- Testy przeglądarkowe (Playwright, Chromium z `/opt/pw-browsers/chromium`, `vite preview` na porcie 4173) były dotąd pisane doraźnie w katalogu roboczym sesji i **nie są w repozytorium**. Skrypt `flow6.mjs` sprawdzał: wniosek urlopowy, akceptację i odrzucenie, urlop w planie zespołu, L4, przeciąganie z cofnięciem, propozycję obsady, dodanie użytkownika i zmianę uprawnień, nową kategorię, pobranie .xlsx. **Zadanie na start:** przenieść je do `e2e/` w repozytorium i podpiąć do CI.
- Dane testowe: generator `src/data/seed.ts` (deterministyczny, `SEED_VERSION = 6`, klucz demo `epcido-demo-v6`). Po zmianie struktury danych podnosimy wersję, a aplikacja proponuje wymianę starych danych („Usuń i wgraj nowe dane testowe” w panelu roboczym).
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

- **Wzorzec Repository.** Cały zapis idzie jedną drogą: polecenie w `commands.ts` zwraca `{ writes, audit }`, a `Repository.apply(ChangeSet)` zapisuje to atomowo (`writeBatch`). Dziennik zmian (`auditLog`) jest dopisywany w tym samym batchu i nigdy nie jest edytowany. Dzięki temu logika nie zna bazy.
- **Kolekcje:** `employees`, `projects`, `assignments`, `timesheets` (jeden dokument na projekt i tydzień: `{projectId}_{poniedziałek}`), `leaves`, `auditLog`, `meta/settings`.
- **Uprawnienia jako dane** (`domain/permissions.ts`): uprawnienia osoby = domyślne dla roli + `grants` − `revokes`. Role: ADMIN, PLANNING, PROJECT_MANAGER, INSTALLATION_MANAGER, SUPERVISOR, HR, WORKER, CUSTOM. Funkcja `can(user, permission)`; kto widzi informacje o wysyłce, rozstrzyga `seesDispatch`.
- **Ustawienia** (`meta/settings`, `domain/settings.ts`): terminy zatwierdzania i wysyłki, kategorie, oddziały, minimalny udział EPCIDO, zasady przerw. Funkcje domeny czytają je przez `getSettings`.
- **Integracja z Dataverse jest symulowana:** wysyłka we wtorek 23:00 to tylko stan w interfejsie.
- **Logowania nie ma.** Osobę wybiera się w panelu roboczym (DevPanel), który jest tylko w prototypie.

Co prototyp **gwarantuje**: spójną logikę domenową, dziennik zmian, dane na żywo między przeglądarkami, działanie przy słabym zasięgu (kopia lokalna).

Czego prototyp **nie gwarantuje** (blokuje wejście z prawdziwymi danymi):

- Uprawnienia sprawdza tylko przeglądarka i polecenia. Każdy, kto zna adres bazy, może czytać i zapisywać dane. Reguły wygasają 31.12.2026. Urlopy, L4 i raporty to dane osobowe, więc **w tym stanie nie wolno wgrywać prawdziwych danych**.
- Brak idempotencji i blokady edycji równoległej po stronie serwera, brak testów automatycznych w CI, brak kopii zapasowych poza mechanizmem Firebase, brak monitoringu.
- `npm audit` zgłasza znane podatności `@grpc/grpc-js` (zależność serwerowa Firebase, nieużywana w przeglądarce). Do zamknięcia przy aktualizacji Firebase.
- Klucz konfiguracji Firebase w `src/lib/firebase.ts` jest publiczny z założenia (identyfikuje projekt, nie daje uprawnień). Bezpieczeństwo opiera się na regułach, a te dziś są otwarte.

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

Zasady docelowe:

- **Modularny monolit**, jedna baza PostgreSQL, bez mikroserwisów, Kubernetesa, kolejek zdarzeń i API gateway (świadomie odrzucone w wymaganiach niefunkcjonalnych).
- **Uprawnienia sprawdzane na serwerze przy każdym żądaniu**, w zakresie globalnym lub projektowym. Funkcje z `domain/permissions.ts` i `domain/workflow.ts` przechodzą do wspólnego pakietu (`packages/shared`), żeby frontend i backend liczyły to samo.
- **Transakcje** dla zatwierdzania godzin, urlopów i przesuwania czasu; **idempotencja** (klucz generowany na kliencie); **optimistic locking**; walidacja na backendzie (brak nakładania się godzin, maks. 24 h, zamknięty okres tylko z uprawnieniem).
- **Logowanie własne:** Argon2id, sesje w httpOnly cookies, TOTP dla ról zatwierdzających i administratora, opcjonalnie Entra ID dla biura; ograniczenie prób logowania.
- **Dziennik zmian** w tabeli tylko do dopisywania (trigger blokuje UPDATE i DELETE).
- **Kopie zapasowe** codziennie plus odtwarzanie do punktu w czasie, test odtworzenia co kwartał; cele: utrata maks. 1 h, przywrócenie w 4 h.
- **Hosting w UE** z umową powierzenia przetwarzania. Plan wskazuje Azure (Container Apps, PostgreSQL Flexible Server, Key Vault), wymagania niefunkcjonalne dopuszczają Docker na jednym serwerze. **To jest otwarta decyzja** (koszt kontra praca własna przy zabezpieczeniach) i wymaga ADR.
- **CI/CD** w GitHub Actions: testy, lint, skan zależności (CodeQL, npm audit), wdrożenie na staging automatycznie, na produkcję po zatwierdzeniu. Niezależny przegląd kodu przed startem produkcyjnym.
- **Integracja z Dataverse** tylko przez tabelę staging, z ponawianiem (backoff), ekranem „Integracje” i dziennikiem paczek. Warunek konieczny: sandbox Dataverse i kontrakt (nazwy tabel i kolumn) od nav24, zapisany w `docs/integration/dataverse-contract.md`.

### Droga z prototypu do celu

1. **Teraz (prototyp):** pokazy, zbieranie uwag, dane testowe. Bez prawdziwych danych.
2. **Krok pośredni, jeśli potrzebny wcześniejszy pilotaż:** Firebase Authentication plus reguły Firestore oparte o `permissionsOf` (rola i grants/revokes w dokumencie pracownika). Tańsze, ale to rozwiązanie przejściowe i bez gwarancji transakcyjnych z pkt 6.
3. **Docelowo:** nowa implementacja interfejsu `Repository` wywołująca API; polecenia z `commands.ts` stają się usługami backendu (te same reguły, te same wpisy audytu); model `domain/types.ts` jest już zgodny z planem bazy PostgreSQL. Ekrany zmieniają się minimalnie.
4. Migracja z Gantbee: sposób nieustalony (otwarte pytanie w planie).

Przy przejściu zachowujemy: kolekcje → tabele, `meta/settings` → tabela ustawień, `timesheets` jako wiersz na projekt i tydzień z dniami w JSONB albo osobnej tabeli dni (do decyzji w ADR).

## 7. Zasady domenowe, które łatwo zepsuć

- **Timesheet = wszystkie godziny wszystkich osób jednego projektu w jednym tygodniu.** Zatwierdza się po osobie. Jeśli choć jeden dzień nie jest zatwierdzony albo brakuje wpisu, **cały timesheet jest wstrzymany**; poprawia go tylko ktoś z `hours.fixWithheld`. Od wtorku 00:00 tydzień jest zamknięty.
- **Pracownik i TL nie widzą** informacji o wysyłce ani wstrzymaniu; dla nich tydzień jest „zamknięty” (`seesDispatch`).
- **Urlop:** akceptuje HR/administrator (`leave.approveAll`) albo SV, IM lub PM projektu, w którym osoba wtedy pracuje (`leave.approveProject`); nikt nie akceptuje własnego wniosku. L4 jest ważny od razu, HR potwierdza dokument. Akceptacja zapisuje dni nieobecności w timesheetach, zatwierdzone. Odrzucenie wymaga powodu. Cofnięcie trwającego urlopu skraca go do wczoraj.
- **Obsada:** osoba jest nieobecna w tygodniu, gdy wniosek zabiera jej co najmniej 3 dni robocze. Kolejność kandydatów: najmniejsze opóźnienie, EPCIDO (gdy udział jest za niski), brak urlopu, staż w kategorii projektu.
- **Kategorie i oddziały** to dane z ustawień. Nie można usunąć używanej kategorii ani oddziału.
- **Administrator nie może odebrać sobie `users.manage`.**
- Każda zmiana danych musi przejść przez polecenie, które zwraca wpis do dziennika. Nie zapisujemy do bazy z komponentów.

## 8. Co zrobić na początku nowej rozmowy

1. Przeczytać ten plik, `CHANGELOG.md` (sekcja 0.6.0) i najnowszy ADR (`0011-…`).
2. Sprawdzić stan: `git status -sb`, `git log --oneline | head`, `gh pr view 5`. Jeśli PR #5 jest scalony, zaczynać od świeżego `main`.
3. Zapytać właściciela o priorytet, jeśli nie wskazał go sam. Nie zaczynać od dużej przebudowy bez pytania.
4. Pracować w gałęzi `vX.Y-opis`, dopisać wpis w `CHANGELOG.md`, ADR dla każdej decyzji architektonicznej, zaktualizować brandbook przy zmianach wyglądu, pamiętając o zasadach z sekcji 1.
5. Na końcu: build, lint, test w przeglądarce, PR, krótkie podsumowanie po polsku z ograniczeniami.

## 9. Otwarte sprawy i kolejne kroki

Do decyzji właściciela:

- Który kierunek planistyczny pierwszy: kwalifikacje (SEP, UDT, podnośniki) przy doborze osób, zakwaterowanie i przejazdy, scenariusze „co jeśli”, projekty niepodpisane z prawdopodobieństwem.
- Hosting docelowy (Azure czy własny serwer w UE) i budżet.
- Skąd bierzemy projekty i stawki (źródło prawdy: Dataverse czy nasz system).
- Sposób migracji z Gantbee.
- Szczegóły raportów („możemy to dopracować później”), logo i pozostałe elementy marki.

Do zrobienia technicznie, w tej kolejności:

1. Merge PR #5, publikacja `firestore.rules` z kolekcją `leaves`.
2. Testy E2E do repozytorium plus CI (GitHub Actions: tsc, lint, build, E2E).
3. Logowanie i reguły oparte o role (krok pośredni) albo od razu start backendu.
4. ADR o hostingu i o schemacie PostgreSQL; kontrakt Dataverse z nav24.
5. Szkielet backendu (NestJS, Drizzle, migracje) i implementacja `Repository` po API.
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

Szczegóły każdej wersji: `CHANGELOG.md` i `docs/adr/`.

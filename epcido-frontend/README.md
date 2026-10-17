# Epcido Terminal

System planowania projektów i czasu pracy dla Epcido — następca Gantbee.
Etap: **prototyp 0.6** — planowanie, obsada, zatwierdzanie godzin, urlopy, ekran pracownika, administracja (React + Firebase). Plan i architektura docelowa: `PLAN_I_ARCHITEKTURA.md` w projekcie.

## Uruchomienie

```bash
npm install
npm run dev
```

- `http://localhost:5173` — dane z Firebase (na żywo).
- `http://localhost:5173/?demo` — tryb demo: dane testowe w przeglądarce, bez bazy.

## Pierwsze połączenie z Firebase (jednorazowo)

1. Otwórz [konsolę Firebase → Firestore](https://console.firebase.google.com/project/epcido-terminal/firestore).
2. **Create database** → lokalizacja **europe-central2 (Warszawa)** → tryb **production**.
   Lokalizacji nie da się później zmienić.
3. Zakładka **Rules** → wklej zawartość pliku `firestore.rules` → **Publish**.
4. Uruchom aplikację. Zobaczysz „Baza jest pusta" → kliknij **Wgraj dane testowe**.
5. Otwórz aplikację w drugiej przeglądarce — zmiany pojawiają się u obu na żywo.

> Reguły prototypu wpuszczają każdego do 31.12.2026 (brak logowania). **Tylko dane testowe.**
> Następny krok bezpieczeństwa: Firebase Authentication i reguły oparte o role.

## Co jest w środku

Po lewej **panel roboczy** (tylko prototyp): przełączasz osobę i widzisz system jej oczami. Tam też jest macierz uprawnień i obsługa danych testowych.

| Ekran | Adres | Kto | Co robi |
|---|---|---|---|
| Pulpit | `/pulpit` | Installation Manager, Admin | Supervisorzy i ich zaległości w zatwierdzaniu |
| Zatwierdzanie | `/zatwierdzanie` | Supervisor, IM, Admin | Czas do terminu i timesheety do zatwierdzenia; zmiana dnia z notatką; po terminie tylko Admin |
| Moje godziny | `/moje-godziny` | Pracownik, TL, Supervisor | Wpis dnia na telefonie, tydzień, wnioski o urlop i L4, zmiany od supervisora |
| Mapa | `/mapa` | wszyscy poza pracownikami | Projekty: wiersze = ludzie, kolumny = dni |
| Oś czasu | `/os-czasu` | jw. | Godziny od–do, przerwa, powód nieobecności; kliknięcie dnia otwiera okno dnia |
| Struktura | `/struktura` | Planning, PM, IM, Admin | IM → projekt i Supervisor → zespół |
| Ludzie | `/ludzie` | Planning, IM, Admin | Lista osób, przypisywanie do projektów |
| Urlopy | `/urlopy` | Supervisor, IM, HR, Admin | Wnioski do akceptacji z wpływem na obsadę, L4 do potwierdzenia, kalendarz nieobecności |
| Obsada | `/obsada` | Planning, Admin | Wymaga uwagi, wykres siły roboczej, projekty ze słupkami E/M, ludzie z filtrami stażu; przeciąganie = przypisanie, propozycja obsady |
| Raporty | `/raporty` | Admin | Raporty do Excela (.xlsx) z filtrami |
| Użytkownicy | `/uzytkownicy` | Admin | Konta, role, dodawanie i odbieranie uprawnień |
| Ustawienia | `/ustawienia` | Admin | Terminy, wysyłka, kategorie, oddziały, zasady obsady |
| Brandbook | `/brandbook` | wszyscy | Kolory, krój, komponenty |

„Dodaj nowy projekt" u góry (Admin, Planning, PM) i kliknięcie nazwy projektu otwierają **edytor na pełnym ekranie**: dane projektu z zapotrzebowaniem, plan zespołu z zadaniami od–do i przerwami, historię zmian.

U góry jest wyszukiwarka z podpowiedziami (projekty, ludzie, ekrany). Przycisk „Wersja mobilna" pokazuje aplikację w ramce telefonu.

### Timesheet i wtorek

**Timesheet = wszystkie godziny wszystkich pracowników jednego projektu w jednym tygodniu** (w tygodniu jest tyle timesheetów, ile projektów). Zatwierdza się po osobie do poniedziałku 23:59. Od wtorku 00:00 tydzień jest zamknięty (wyszarzony, w paski); kompletny timesheet idzie do Dataverse we wtorek 23:00. Jeśli choć jeden dzień nie jest zatwierdzony albo brakuje wpisu, **cały timesheet jest wstrzymany** — poprawia go tylko administrator, a pozostali widzą „Czas minął. Skontaktuj się z administratorem…". Szczegóły: `docs/adr/0010-…`.

Projekty mają kategorię (domyślnie KNAPP, KARDEX, FORTNA, OTHER — lista w ustawieniach) i zapotrzebowanie w fazach (od–do, elektrycy, mechanicy). Pracownicy mają umowę (UoP, B2B, agencja — **EPCIDO** to UoP i B2B, cel: co najmniej połowa na projekcie) i doświadczenie w miesiącach, łącznie i w każdej kategorii. Elektrycy mają w całym systemie kolor czerwony, mechanicy — niebieski.

### Urlopy i uprawnienia

Urlop i inną nieobecność akceptuje supervisor albo Installation Manager projektu, w którym osoba wtedy pracuje, albo HR. L4 obowiązuje od zgłoszenia, HR potwierdza dokument. Zaakceptowane dni trafiają do timesheetu. Uprawnienia osoby = rola + dodane − odebrane (ekran Użytkownicy). Szczegóły: `docs/adr/0011-…`.

### Kolory i znaki dni (obowiązują w całym systemie)

| Znak | Znaczenie |
|---|---|
| Deep Forest `#0F3D3A` | Zatwierdzone przez supervisora |
| Golden Hour `#F4B13B` | Do zatwierdzenia |
| Terracotta Clay `#E0745E` | Nieobecny |
| Biały / piaskowy w weekend | Wolne lub brak wpisu |
| Wyszarzony, w ukośne paski | Tydzień zamknięty (od wtorku) — nienaruszalny |
| Szary, kreskowany, wykrzyknik | Błąd — timesheet wstrzymany, nie wysłany; poprawia tylko Admin |
| Zielony ptaszek | Wysłane do Dataverse |
| Przerywana kreska pn \| wt | Termin zatwierdzenia poprzedniego tygodnia (pn 23:59) |
| Kreskowane pole między zadaniami | Przerwa (bez zadania, bez wpisu godzin) |

### Dane testowe

Wersja 6: administrator, planista, 3 Project Managerów, 4 Installation Managerów, 12 supervisorów, 3 osoby z HR, 1 użytkownik z własnymi uprawnieniami (controlling), 20 Team Leaderów, 50 elektryków, 50 mechaników (umowy UoP / B2B / agencja mniej więcej po równo, doświadczenie w kategoriach), 10 bieżących projektów i 5 przyszłych (start za 3–13 tygodni) z kategoriami i fazami zapotrzebowania, zadania od–do (część z przerwami na wyjazd), godziny z ostatnich 10 tygodni z osobami i godzinami zatwierdzeń, 3 wstrzymane timesheety, kilka zmian od supervisorów, wnioski urlopowe (zaakceptowane, czekające, odrzucony, trwające L4). Generator: `src/data/seed.ts` (deterministyczny). Jeśli w Firebase są dane ze starszej wersji, aplikacja zaproponuje ich wymianę.

## Struktura kodu

```
src/
  app/          DataContext (dane + akcje), UiContext (wyszukiwanie, panel, komunikaty)
  data/         repository.ts (granica z bazą), commands.ts (zmiany + dziennik),
                firestoreRepo.ts, memoryRepo.ts (demo), seed.ts
  domain/       typy, etykiety, permissions.ts (role), workflow.ts (terminy, kolejki, prawa do zmian),
                timesheets.ts (timesheet projekt × tydzień, zamknięcie, wstrzymanie),
                leaves.ts (wpływ urlopu na obsadę), settings.ts (ustawienia systemu), reports.ts (raporty),
                staffing.ts (obsada, fazy, kandydaci, przerwy, braki)
  components/   kropka dnia, dock, panel, kalendarz, pola formularza…
  features/     approvals, dashboard, hours (okno dnia), worker, leaves, map, timeline, grid, project, staffing,
                structure, people, admin (raporty, użytkownicy, ustawienia), brandbook
  styles/       tokens.css (źródło prawdy designu), base, components, views
docs/
  BRANDBOOK.md  zasady designu dla wszystkich modułów
  adr/          decyzje architektoniczne
firestore.rules reguły bezpieczeństwa bazy
```

Zasada: ekrany nie rozmawiają z bazą. Każda zmiana to polecenie w `commands.ts`, które zwraca zapisy **i wpis do dziennika zmian**; repozytorium zapisuje je razem (w Firestore jednym batchem). Przejście na docelowy backend = nowa implementacja `Repository`.

## Wdrożenie (Vercel)

Repozytorium → vercel.com → Add Project → preset **Vite**, **Root Directory: `epcido-frontend`** → Deploy. Plik `vercel.json` obsługuje adresy podstron.

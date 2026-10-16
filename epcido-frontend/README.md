# Epcido Terminal

System planowania projektów i czasu pracy dla Epcido — następca Gantbee.
Etap: **prototyp 0.3** — planowanie, zatwierdzanie godzin, ekran pracownika (React + Firebase). Plan i architektura docelowa: `PLAN_I_ARCHITEKTURA.md` w projekcie.

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
| Zatwierdzanie | `/zatwierdzanie` | Supervisor, IM, Admin | Pozycje i godziny do zatwierdzenia, zatwierdź / odrzuć z powodem |
| Moje godziny | `/moje-godziny` | Pracownik, TL, Supervisor | Wpis dnia na telefonie, tydzień, nieobecność |
| Mapa | `/mapa` | wszyscy poza pracownikami | Projekty: wiersze = ludzie, kolumny = dni |
| Oś czasu | `/os-czasu` | jw. | Godziny od–do, przerwa, powód nieobecności |
| Struktura | `/struktura` | Planning, PM, IM, Admin | IM → projekt i Supervisor → zespół |
| Ludzie | `/ludzie` | Planning, IM, Admin | Lista osób, przypisywanie do projektów |
| Brandbook | `/brandbook` | wszyscy | Kolory, krój, komponenty |

„Dodaj nowy projekt" u góry (Admin, Planning, PM) i kliknięcie nazwy projektu otwierają **edytor na pełnym ekranie**: dane projektu, plan zespołu z paskami od–do i historię zmian.

Przycisk „Wersja mobilna" pokazuje aplikację w ramce telefonu.

### Kolory i znaki dni (obowiązują w całym systemie)

| Znak | Znaczenie |
|---|---|
| Deep Forest `#0F3D3A` | Zatwierdzone przez supervisora |
| Golden Hour `#F4B13B` | Do zatwierdzenia |
| Terracotta Clay `#E0745E` | Nieobecny |
| Biały / piaskowy w weekend | Wolne lub brak wpisu |
| Zielony ptaszek | Wysłane do Dataverse |
| Przerywana kreska pn \| wt | Koniec edycji godzin poprzedniego tygodnia |

### Dane testowe

Administrator, Planista, 3 Project Managerów, 4 Installation Managerów, 10 Supervisorów, 20 Team Leaderów, 50 elektryków, 50 mechaników, 10 projektów, okresy pracy od–do i godziny z ostatnich 10 tygodni. Generator: `src/data/seed.ts` (deterministyczny). Jeśli w Firebase są dane z wersji 0.2, aplikacja zaproponuje ich wymianę.

## Struktura kodu

```
src/
  app/          DataContext (dane + akcje), UiContext (wyszukiwanie, panel, komunikaty)
  data/         repository.ts (granica z bazą), commands.ts (zmiany + dziennik),
                firestoreRepo.ts, memoryRepo.ts (demo), seed.ts
  domain/       typy, etykiety, permissions.ts (role), workflow.ts (terminy, kolejki)
  components/   kropka dnia, dock, panel, kalendarz, pola formularza…
  features/     approvals, dashboard, worker, map, timeline, grid, project, structure, people, brandbook
  styles/       tokens.css (źródło prawdy designu), base, components, views
docs/
  BRANDBOOK.md  zasady designu dla wszystkich modułów
  adr/          decyzje architektoniczne
firestore.rules reguły bezpieczeństwa bazy
```

Zasada: ekrany nie rozmawiają z bazą. Każda zmiana to polecenie w `commands.ts`, które zwraca zapisy **i wpis do dziennika zmian**; repozytorium zapisuje je razem (w Firestore jednym batchem). Przejście na docelowy backend = nowa implementacja `Repository`.

## Wdrożenie (Vercel)

Repozytorium → vercel.com → Add Project → preset **Vite**, **Root Directory: `epcido-frontend`** → Deploy. Plik `vercel.json` obsługuje adresy podstron.

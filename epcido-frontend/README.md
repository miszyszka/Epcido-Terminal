# Epcido Terminal

System planowania projektów i czasu pracy dla Epcido — następca Gantbee.
Etap: **prototyp widoku planisty** (React + Firebase). Plan i architektura docelowa: `PLAN_I_ARCHITEKTURA.md` w projekcie.

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

| Ekran | Adres | Co robi |
|---|---|---|
| Mapa | `/mapa` | Wszystkie projekty jako siatki dni (12 tygodni). Kolor dnia = stan godzin. |
| Oś czasu | `/os-czasu` | Każda osoba dzień po dniu, grupowane po projektach. `?projekt=ID` pokazuje jeden projekt. |
| Struktura | `/struktura` | Drzewko: Installation Manager → projekt i Supervisor → zespół. |
| Ludzie | `/ludzie` | Lista osób, filtry, przypisywanie i przenoszenie między projektami. |
| Brandbook | `/brandbook` | Żywy podgląd kolorów, kroju i komponentów. |

Przycisk **+** w docku tworzy nowy projekt. Kliknięcie nazwy projektu otwiera panel: zespół, dane projektu, historia zmian.

### Kolory dni (obowiązują w całym systemie)

| Kolor | Znaczenie |
|---|---|
| Deep Forest `#0F3D3A` | Zatwierdzone przez supervisora |
| Golden Hour `#F4B13B` | Czeka na zatwierdzenie |
| Terracotta Clay `#E0745E` | Nieobecny |
| Biały | Wolne lub brak wpisu |

### Dane testowe

4 Installation Managerów, 10 Supervisorów, 20 Team Leaderów, 50 elektryków, 50 mechaników, 10 projektów, godziny z ostatnich 10 tygodni. Generator: `src/data/seed.ts` (deterministyczny — u każdego te same dane).

## Struktura kodu

```
src/
  app/          DataContext (dane + akcje), UiContext (wyszukiwanie, panel, komunikaty)
  data/         repository.ts (granica z bazą), commands.ts (zmiany + dziennik),
                firestoreRepo.ts, memoryRepo.ts (demo), seed.ts
  domain/       typy, etykiety, reguła stanu dnia projektu
  components/   kropka dnia, dock, panel, kalendarz, pola formularza…
  features/     map, timeline, structure, people, project, brandbook
  styles/       tokens.css (źródło prawdy designu), base, components, views
docs/
  BRANDBOOK.md  zasady designu dla wszystkich modułów
  adr/          decyzje architektoniczne
firestore.rules reguły bezpieczeństwa bazy
```

Zasada: ekrany nie rozmawiają z bazą. Każda zmiana to polecenie w `commands.ts`, które zwraca zapisy **i wpis do dziennika zmian**; repozytorium zapisuje je razem (w Firestore jednym batchem). Przejście na docelowy backend = nowa implementacja `Repository`.

## Wdrożenie (Vercel)

Repozytorium → vercel.com → Add Project → preset **Vite** → Deploy. Plik `vercel.json` obsługuje adresy podstron.

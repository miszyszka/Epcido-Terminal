# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje: SemVer.

## [0.2.0] - 2026-10-16

### Nowe funkcje
- Widok planisty: mapa projektów (siatki dni), oś czasu, struktura zespołów, lista ludzi.
- Tworzenie i edycja projektu (numer, klient, termin, oddział, Installation Manager, Supervisor, kolor, pola Dataverse).
- Zespół projektu: dodawanie, usuwanie i przenoszenie Team Leaderów, elektryków i mechaników.
- Historia zmian projektu (kto, kiedy, co zmienił — przed i po).
- Synchronizacja na żywo przez Firebase Firestore; tryb demo bez bazy (`?demo`).
- Dane testowe jednym przyciskiem: 134 osoby, 10 projektów, godziny z 10 tygodni.
- Brandbook (`docs/BRANDBOOK.md`) i jego żywy podgląd (`/brandbook`).

### Zmiany
- Nowy design: paleta Deep Forest / Golden Hour / Terracotta Clay / Warm Sand, krój Archivo, pływająca nawigacja zamiast górnego paska.
- Usunięto ekrany prototypu 0.1 (wpis godzin, akceptacje SV i PM) — wrócą w nowym designie w kolejnym etapie.

## [0.1.0] - 2026-10-16

### Nowe funkcje
- Pierwszy prototyp: wpis godzin, akceptacja przez Supervisora i PM, planowanie (dane w localStorage).

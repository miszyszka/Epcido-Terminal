# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje: SemVer.

## [0.3.0] - 2026-10-16

### Nowe funkcje
- **Zatwierdzanie godzin** (Supervisor, Installation Manager, Administrator): duże liczby pozycji i godzin, termin i godzina wysyłki, zaznaczanie dni, zatwierdzanie tygodnia osoby, projektu albo wszystkiego, odrzucanie z powodem.
- **Pulpit Installation Managera**: supervisorzy, ich zaległości, „po terminie", postęp tygodnia i to, co czeka na IM.
- **Ekran pracownika** (telefon): duże godziny start/koniec z krokami 15 min, przerwa przyciskami, wysyłka, tydzień w kolorach, zgłoszenie nieobecności (urlop, L4, inna), dni do poprawy.
- **Edytor projektu na pełnym ekranie** z planem zespołu: paski od–do przeciągane i rozciągane, „Przypisz pracowników" z informacją, kto jest wolny, kolizje z innymi projektami, historia zmian.
- **Role i uprawnienia**: Administrator, Planning, Project Manager, Installation Manager, Supervisor, Team Leader, pracownik. Nawigacja i widoczne projekty zależą od roli.
- **Panel roboczy** (prototyp): przełączanie użytkowników i macierz „kto co może".
- „Cześć, *imię*" i „Masz X pozycji do zatwierdzenia" u góry; przycisk „Dodaj nowy projekt" dla Admina, Planning i PM.
- Przełącznik wersja mobilna / desktopowa (podgląd telefonu).
- Okresy pracy od–do i przechodzenie osób między projektami; wysyłka do Dataverse oznaczana zielonym ptaszkiem.

### Zmiany
- Mapa: wiersze = ludzie, kolumny = dni, nad kropkami numery dni i miesiąc, weekendy inaczej, kreska końca edycji między poniedziałkiem a wtorkiem. Liczba tygodni dopasowuje się do szerokości ekranu.
- Oś czasu: duże komórki z godzinami od–do, przerwą i powodem nieobecności; bez podświetlania wierszy i dymków na znacznikach.
- Status „Czeka" → „Do zatwierdzenia".
- Własne listy wyboru zamiast systemowych; poprawione marginesy w tabelach.
- Usunięto „+" z docku.
- Dane testowe v3 (Project Managerowie, okresy pracy, wysłane tygodnie, odrzucenia).

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

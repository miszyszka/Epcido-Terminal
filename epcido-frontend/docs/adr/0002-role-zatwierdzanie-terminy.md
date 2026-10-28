# 0002. Role, ścieżka zatwierdzania, terminy i okresy pracy

- Status: Przyjęta, częściowo zastąpiona przez ADR 0003 (odrzucanie i termin edycji)
- Data: 2026-10-16
- Decydujący: zespół Epcido Terminal

## Kontekst

Sercem systemu jest zatwierdzanie godzin. Godziny muszą być zatwierdzone do poniedziałku, a we wtorek o 23:00 tydzień idzie do Dataverse. Planning planuje, kto i kiedy pracuje w projekcie; ta sama osoba przechodzi między projektami.

## Decyzja

**Role** (macierz w `src/domain/permissions.ts`, widoczna w panelu roboczym):

| Rola | Najważniejsze |
|---|---|
| Administrator | Wszystko |
| Planning | Wszystkie projekty, tworzenie i edycja, plan zespołów (paski od–do) |
| Project Manager | Swoje projekty, tworzenie i edycja danych projektu (bez planu zespołu) |
| Installation Manager | Swoje projekty, pulpit supervisorów, zatwierdzanie po supervisorach |
| Supervisor | Zatwierdzanie godzin zespołu, własne godziny |
| Team Leader / elektryk / mechanik | Własne godziny i nieobecności |

**Ścieżka zatwierdzania**: pracownik/TL → Supervisor (`SUPERVISOR_APPROVED`, kolor zielony) → Installation Manager (`PM_APPROVED`) → wysyłka do Dataverse (`exported`, ptaszek). Godziny samego supervisora zatwierdza Installation Manager. Odrzucenie wymaga powodu i wraca do pracownika jako „do poprawy".

**Terminy** (`src/domain/workflow.ts`): pracownik poprawia dzień, dopóki nikt go nie zatwierdził i nie minął poniedziałek następnego tygodnia. Kreska między poniedziałkiem a wtorkiem na siatkach oznacza ten termin.

**Okresy pracy**: przypisanie ma pola `from` i `to` (null = do końca projektu). Osoba może mieć kolejne przypisania w różnych projektach; edytor pokazuje kolizje.

**Zapis dnia**: karta tygodnia jest scalana (`merge`), więc zapis jednego dnia jednej osoby nie nadpisuje dni innych osób zapisywanych w tym samym czasie.

## Konsekwencje

- Jeśli zatwierdzać po supervisorach ma Project Manager, a nie Installation Manager, zmiana jest w jednym miejscu (`queueFor` + tabela uprawnień).
- Wysyłka do Dataverse jest na razie symulowana w danych testowych (pole `exported`). Prawdziwa wysyłka wymaga backendu i kontraktu z nav24 (PLAN, sekcja 8).
- Dane testowe v3 nie są zgodne z v2 — aplikacja proponuje ich wymianę jednym przyciskiem.

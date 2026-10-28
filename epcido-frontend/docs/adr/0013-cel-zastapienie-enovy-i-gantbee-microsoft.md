# 0013. Cel nadrzędny: zastąpienie Enovy i Gantbee systemem w środowisku Microsoft, etapami

- Status: Propozycja (do przyjęcia przez właściciela)
- Data: 2026-10-28
- Decydujący: właściciel projektu
- Uzupełnia: `docs/PLAN_I_ARCHITEKTURA.md` (sekcje 1–3, pozycje Z2, Z11). Nie zmienia zasad ADR 0007–0012.

## Kontekst

Dotąd dokumenty mówiły o zastąpieniu Gantbee, a Enova była tylko odbiorcą danych przez Dataverse (`PLAN_I_ARCHITEKTURA.md`, sekcja 2: „System nie łączy się bezpośrednio z BC ani Enovą"). Właściciel określił cel nadrzędny: wycofanie Gantbee i Enovy, a system ma być zbudowany w środowisku Microsoft.

## Decyzja (propozycja)

Etapy, każdy z warunkiem przejścia:

0. **Prototyp w testowym środowisku Dataverse `cre_26`** z docelową strukturą bazy, backendu i frontendu. Cel: pokaz dla COO, który ma przekonać, że system ma sens, i zobaczyć działanie.
1. **Praca równoległa z Gantbee i Enovą.** Dane trafiają do obu systemów. Warunek przejścia: zgodność danych potwierdzona.
2. **Odejście od Gantbee.** Warunek: wszystkie projekty przeniesione, migracja zakończona.
3. **Odejście od Enovy.** Warunek: płace i Business Central działają bez Enovy.

## Konsekwencje

- Zmienia się pozycja Enovy: z odbiorcy danych na system do wycofania. Integracja z Enovą w etapie 1 trwa, bo płace nadal z niej idą.
- Otwarte: architektura docelowa w Microsoft (Dataverse jako warstwa danych i interfejs, czy osobny backend z integracją). Do rozstrzygnięcia w osobnym ADR przed etapem 2.
- Otwarte: źródło prawdy w etapie 1 (który system wygrywa przy rozjeździe danych).
- Data pokazu dla COO: do ustalenia przez właściciela.

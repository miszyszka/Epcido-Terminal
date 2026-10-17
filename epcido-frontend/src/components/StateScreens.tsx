import { useData } from "../app/DataContext";

/** Ekrany stanu połączenia: ładowanie, błąd, pusta baza. Mówią, co zrobić. */
export function DataGate({ children }: { children: React.ReactNode }) {
  const data = useData();
  const { status } = data;

  if (status.state === "error") {
    return (
      <section className="gate">
        <h2>Nie udało się połączyć z bazą</h2>
        <p>{status.error.message}</p>
        <ol className="gate__steps">
          <li>
            Otwórz <a href="https://console.firebase.google.com/project/epcido-terminal/firestore" target="_blank" rel="noreferrer">konsolę Firebase → Firestore</a>.
          </li>
          <li>Jeśli bazy nie ma, wybierz „Create database", lokalizację europe-central2 (Warszawa) i tryb produkcyjny.</li>
          <li>W zakładce Rules wklej zawartość pliku firestore.rules z repozytorium i kliknij Publish.</li>
          <li>Odśwież tę stronę.</li>
        </ol>
        <div className="gate__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Spróbuj ponownie
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => data.switchMode("demo")}>
            Otwórz tryb demo
          </button>
        </div>
      </section>
    );
  }

  if (status.state === "loading" || !data.model) {
    return (
      <section className="gate gate--quiet" aria-busy="true">
        <div className="loader" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
        <p>Wczytuję dane{data.mode === "firebase" ? " z Firebase" : ""}…</p>
        {status.state === "loading" && status.slow && (
          <div className="gate__slow">
            <p>To trwa dłużej niż zwykle. Sprawdź, czy w konsoli Firebase utworzono bazę Firestore i opublikowano reguły.</p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => data.switchMode("demo")}>
              Otwórz tryb demo
            </button>
          </div>
        )}
      </section>
    );
  }

  const version = data.model.snapshot.seedVersion;
  if (data.model.snapshot.seeded && version !== null && version < 6) {
    return (
      <section className="gate">
        <h2>Dane testowe są ze starszej wersji</h2>
        <p>
          Nowa wersja ma kategorie projektów, fazy zapotrzebowania, przyszłe projekty, formy zatrudnienia i doświadczenie
          pracowników oraz timesheety projektów. Usuń stare dane testowe i wgraj nowe — dziennik zmian zostanie.
        </p>
        <div className="gate__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              if (await data.clearData()) await data.loadTestData();
            }}
          >
            Usuń i wgraj nowe dane testowe
          </button>
        </div>
      </section>
    );
  }

  if (!data.model.snapshot.seeded && data.model.projects.length === 0) {
    return (
      <section className="gate">
        <h2>Baza jest pusta</h2>
        <p>
          Wgraj dane testowe: 50 elektryków, 50 mechaników, 20 Team Leaderów, 10 supervisorów, 4 Installation Managerów,
          3 Project Managerów, 10 projektów i godziny z ostatnich 10 tygodni.
        </p>
        <div className="gate__actions">
          <button type="button" className="btn btn--primary" onClick={() => data.loadTestData()}>
            Wgraj dane testowe
          </button>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

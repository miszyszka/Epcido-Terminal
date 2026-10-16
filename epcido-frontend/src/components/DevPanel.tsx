import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Database, PanelLeftClose } from "lucide-react";
import { useData } from "../app/DataContext";
import { useSession } from "../app/SessionContext";
import { PERMISSION_LABEL, PERMISSION_ORDER, ROLE_PERMISSIONS, homeFor } from "../domain/permissions";
import type { AccessRole, Employee } from "../domain/types";
import { PositionMark } from "./PersonBadge";
import { SelectMenu } from "./SelectMenu";

interface RoleRow {
  key: string;
  label: string;
  short: string;
  role: AccessRole;
  match: (e: Employee) => boolean;
}

const ROWS: RoleRow[] = [
  { key: "admin", label: "Administrator", short: "AD", role: "ADMIN", match: (e) => e.role === "ADMIN" },
  { key: "planning", label: "Planning", short: "PL", role: "PLANNING", match: (e) => e.role === "PLANNING" },
  { key: "pm", label: "Project Manager", short: "PM", role: "PROJECT_MANAGER", match: (e) => e.role === "PROJECT_MANAGER" },
  { key: "im", label: "Installation Manager", short: "IM", role: "INSTALLATION_MANAGER", match: (e) => e.role === "INSTALLATION_MANAGER" },
  { key: "sv", label: "Supervisor", short: "SV", role: "SUPERVISOR", match: (e) => e.role === "SUPERVISOR" },
  { key: "tl", label: "Team Leader", short: "TL", role: "WORKER", match: (e) => e.position === "TEAM_LEADER" },
  {
    key: "worker",
    label: "Elektryk lub mechanik",
    short: "E/M",
    role: "WORKER",
    match: (e) => e.position === "ELECTRICIAN" || e.position === "MECHANIC",
  },
];

/**
 * Panel roboczy prototypu: przełączanie między użytkownikami i podgląd, co może każda rola.
 * W wersji produkcyjnej zniknie — użytkownik będzie przychodził z logowania.
 */
export function DevPanel() {
  const data = useData();
  const { userId, setUserId, setPreview, setPanelOpen } = useSession();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const model = data.model;
  const current = data.user;

  const switchTo = (e: Employee) => {
    setUserId(e.id);
    setPreview(e.role === "WORKER" ? "mobile" : "desktop");
    navigate(homeFor(e));
  };

  const activeRow = current ? ROWS.find((r) => r.match(current)) : undefined;
  const seeded = model?.snapshot.seeded ?? false;
  const outdated = Boolean(model && seeded && (model.snapshot.seedVersion ?? 1) < 3);

  return (
    <aside className="devpanel" aria-label="Panel roboczy">
      <header className="devpanel__head">
        <div>
          <strong>Panel roboczy</strong>
          <span className="devpanel__tag">prototyp</span>
        </div>
        <button type="button" className="icon-btn icon-btn--sm" onClick={() => setPanelOpen(false)} aria-label="Zwiń panel roboczy">
          <PanelLeftClose size={18} />
        </button>
      </header>
      <p className="devpanel__lead">Przełącz osobę, żeby zobaczyć system jej oczami. Wybór zapamiętuje się w tej przeglądarce.</p>

      <section className="devpanel__section">
        <h3>Zalogowany jako</h3>
        {model ? (
          <ul className="devpanel__roles">
            {ROWS.map((row) => {
              const people = model.employees.filter(row.match);
              if (people.length === 0) return null;
              const selectedId = (row === activeRow && current ? current.id : picked[row.key]) ?? people[0].id;
              const selected = people.find((p) => p.id === selectedId) ?? people[0];
              const isActive = row === activeRow;
              return (
                <li key={row.key} className={`devrole ${isActive ? "is-active" : ""}`}>
                  <button type="button" className="devrole__switch" onClick={() => switchTo(selected)} aria-pressed={isActive}>
                    <PositionMark employee={selected} />
                    <span className="devrole__label">{row.label}</span>
                    {isActive && <Check size={16} className="devrole__check" aria-label="aktywny" />}
                  </button>
                  {people.length > 1 && (
                    <SelectMenu
                      compact
                      variant="quiet"
                      ariaLabel={`Wybierz osobę: ${row.label}`}
                      value={selected.id}
                      options={people.map((p) => ({ value: p.id, label: p.name }))}
                      onChange={(id) => {
                        setPicked((m) => ({ ...m, [row.key]: id }));
                        const p = people.find((x) => x.id === id);
                        if (p) switchTo(p);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="devpanel__muted">Najpierw wczytaj dane.</p>
        )}
      </section>

      <section className="devpanel__section">
        <h3>Kto co może</h3>
        <div className="matrix-wrap">
          <table className="perm-matrix">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Uprawnienie</span>
                </th>
                {ROWS.map((r) => (
                  <th key={r.key} scope="col" className={r === activeRow ? "is-active" : ""} title={r.label}>
                    {r.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ORDER.map((p) => (
                <tr key={p}>
                  <th scope="row">{PERMISSION_LABEL[p]}</th>
                  {ROWS.map((r) => {
                    const yes = ROLE_PERMISSIONS[r.role].includes(p);
                    return (
                      <td key={r.key} className={r === activeRow ? "is-active" : ""}>
                        {yes ? <Check size={14} aria-label="tak" /> : <span aria-label="nie">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="devpanel__section">
        <h3>Dane</h3>
        <div className="devpanel__source">
          <Database size={16} aria-hidden />
          <span>
            {data.mode === "demo" ? "Tryb demo, dane w tej przeglądarce" : "Firebase: epcido-terminal, na żywo"}
          </span>
        </div>
        {outdated && <p className="devpanel__warn">Dane testowe są ze starszej wersji. Usuń je i wgraj ponownie.</p>}
        <div className="devpanel__actions">
          {model && !seeded && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => data.loadTestData()}>
              Wgraj dane testowe
            </button>
          )}
          {model && seeded && !confirmClear && (
            <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmClear(true)}>
              Usuń dane testowe
            </button>
          )}
          {confirmClear && (
            <div className="confirm">
              <p>Usunąć wszystkie projekty, osoby i godziny? Dziennik zmian zostanie.</p>
              <div className="confirm__row">
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmClear(false)}>
                  Anuluj
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={async () => {
                    await data.clearData();
                    setConfirmClear(false);
                  }}
                >
                  Usuń dane
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => data.switchMode(data.mode === "demo" ? "firebase" : "demo")}
          >
            {data.mode === "demo" ? "Przełącz na Firebase" : "Przełącz na tryb demo"}
          </button>
        </div>
        {current && <p className="devpanel__muted">Aktywny: {current.name} ({userId})</p>}
      </section>
    </aside>
  );
}

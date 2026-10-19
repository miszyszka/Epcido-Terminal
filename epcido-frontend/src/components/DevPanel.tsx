import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Database, Terminal, X } from "lucide-react";
import { useData } from "../app/DataContext";
import { useSession } from "../app/SessionContext";
import { PERMISSION_LABEL, PERMISSION_ORDER, ROLE_PERMISSIONS, homeFor, permissionsOf, type Permission } from "../domain/permissions";
import type { AccessRole, Employee } from "../domain/types";

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
  { key: "hr", label: "HR", short: "HR", role: "HR", match: (e) => e.role === "HR" },
  { key: "custom", label: "Własne uprawnienia", short: "WŁ", role: "CUSTOM", match: (e) => e.role === "CUSTOM" },
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
 * Celowo wygląda jak terminal na czarnym tle — to rusztowanie, a nie część produktu, i ma się
 * odcinać od aplikacji obok. Po wybraniu osoby chowa się sam, żeby nie zasłaniał ekranu.
 * W wersji produkcyjnej zniknie — użytkownik będzie przychodził z logowania.
 */
export function DevPanel() {
  const data = useData();
  const { userId, setUserId, setPreview, setPanelOpen } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const model = data.model;
  const current = data.user;

  const switchTo = (e: Employee) => {
    setUserId(e.id);
    setPreview(e.role === "WORKER" ? "mobile" : "desktop");
    navigate(homeFor(e));
    setOpen(null);
    // Wybór dokonany — panel znika i oddaje ekran aplikacji
    setPanelOpen(false);
  };

  const activeRow = current ? ROWS.find((r) => r.match(current)) : undefined;
  const seeded = model?.snapshot.seeded ?? false;
  const outdated = Boolean(model && seeded && (model.snapshot.seedVersion ?? 1) < 6);
  const rolePerms = (r: RoleRow): Set<Permission> => {
    if (r.role !== "CUSTOM") return new Set(ROLE_PERMISSIONS[r.role]);
    const someone = model?.employees.find(r.match);
    return someone ? permissionsOf(someone) : new Set();
  };

  return (
    <aside className="devpanel" aria-label="Panel roboczy prototypu">
      <header className="devpanel__head">
        <span className="devpanel__brand">
          <Terminal size={15} aria-hidden />
          epcido<span>@prototyp</span>
        </span>
        <button type="button" className="devpanel__close" onClick={() => setPanelOpen(false)} aria-label="Zamknij panel roboczy">
          <X size={16} />
        </button>
      </header>

      <p className="devpanel__lead">
        <span className="devpanel__prompt">$</span> wybierz osobę — zobaczysz system jej oczami. Panel schowa się sam.
      </p>

      <section className="devpanel__section">
        <h3>login as</h3>
        {model ? (
          <ul className="devpanel__roles">
            {ROWS.map((row) => {
              const people = model.employees.filter(row.match);
              if (people.length === 0) return null;
              const isActive = row === activeRow;
              const shown = isActive && current ? current : people[0];
              const expanded = open === row.key;
              return (
                <li key={row.key} className={`devrole ${isActive ? "is-active" : ""} ${expanded ? "is-open" : ""}`}>
                  <div className="devrole__line">
                    <button type="button" className="devrole__switch" onClick={() => switchTo(shown)} aria-pressed={isActive}>
                      <span className="devrole__short">{row.short}</span>
                      <span className="devrole__text">
                        <span className="devrole__label">{row.label}</span>
                        <span className="devrole__person">{shown.name}</span>
                      </span>
                      {isActive && <span className="devrole__dot" aria-label="aktywny" />}
                    </button>
                    {people.length > 1 && (
                      <button
                        type="button"
                        className="devrole__more"
                        onClick={() => setOpen((k) => (k === row.key ? null : row.key))}
                        aria-expanded={expanded}
                        aria-label={`Inne osoby: ${row.label}`}
                      >
                        <ChevronDown size={14} aria-hidden />
                        {people.length}
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <ul className="devrole__list">
                      {people.map((p) => (
                        <li key={p.id}>
                          <button type="button" className={`devrole__pick ${p.id === userId ? "is-active" : ""}`} onClick={() => switchTo(p)}>
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
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
        <button type="button" className="devpanel__toggle" onClick={() => setMatrix((v) => !v)} aria-expanded={matrix}>
          <ChevronDown size={14} aria-hidden className={matrix ? "is-open" : ""} />
          kto co może
        </button>
        {matrix && (
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
                      const yes = rolePerms(r).has(p);
                      return (
                        <td key={r.key} className={r === activeRow ? "is-active" : ""}>
                          {yes ? <b aria-label="tak">●</b> : <span aria-label="nie">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="devpanel__section devpanel__section--foot">
        <h3>dane</h3>
        <div className="devpanel__source">
          <Database size={14} aria-hidden />
          <span>{data.mode === "demo" ? "demo — dane w tej przeglądarce" : "firebase: epcido-terminal (na żywo)"}</span>
        </div>
        {outdated && <p className="devpanel__warn">Dane testowe są ze starszej wersji. Usuń je i wgraj ponownie.</p>}
        <div className="devpanel__actions">
          {model && !seeded && (
            <button type="button" className="devbtn devbtn--go" onClick={() => data.loadTestData()}>
              wgraj dane testowe
            </button>
          )}
          {model && seeded && !confirmClear && (
            <button type="button" className="devbtn devbtn--danger" onClick={() => setConfirmClear(true)}>
              usuń dane testowe
            </button>
          )}
          {confirmClear && (
            <div className="devconfirm">
              <p>Usunąć wszystkie projekty, osoby i godziny? Dziennik zmian zostanie.</p>
              <div className="devconfirm__row">
                <button type="button" className="devbtn" onClick={() => setConfirmClear(false)}>
                  anuluj
                </button>
                <button
                  type="button"
                  className="devbtn devbtn--danger"
                  onClick={async () => {
                    await data.clearData();
                    setConfirmClear(false);
                  }}
                >
                  usuń
                </button>
              </div>
            </div>
          )}
          <button type="button" className="devbtn" onClick={() => data.switchMode(data.mode === "demo" ? "firebase" : "demo")}>
            {data.mode === "demo" ? "przełącz na firebase" : "przełącz na demo"}
          </button>
        </div>
        {current && (
          <p className="devpanel__muted">
            <span className="devpanel__prompt">&gt;</span> {current.name} <em>({userId})</em>
          </p>
        )}
      </section>
    </aside>
  );
}

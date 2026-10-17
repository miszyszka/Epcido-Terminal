import { useMemo, useState } from "react";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import { useData, useModel, useUser } from "../../app/DataContext";
import { Dialog } from "../../components/Dialog";
import { Field, TextInput } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { EmploymentTag, PositionMark } from "../../components/PersonBadge";
import { Segmented } from "../../components/Segmented";
import { SelectMenu } from "../../components/SelectMenu";
import type { UserInput } from "../../data/commands";
import { EMPLOYMENT_LABEL, POSITION_LABEL, ROLE_LABEL } from "../../domain/labels";
import { PERMISSION_GROUPS, PERMISSION_LABEL, permissionsOf, ROLE_PERMISSIONS, type Permission } from "../../domain/permissions";
import { FIELD_POSITIONS } from "../../domain/staffing";
import type { AccessRole, Employee, Employment, Position } from "../../domain/types";
import { matches } from "../../lib/search";

type Group = "office" | "field" | "off" | "all";

const ROLE_HINT: Record<AccessRole, string> = {
  ADMIN: "Wszystko, także użytkownicy, ustawienia, raporty i poprawa wstrzymanych timesheetów",
  PLANNING: "Projekty, plan zespołów, Obsada, ludzie, kalendarz urlopów",
  PROJECT_MANAGER: "Swoje projekty: dane i zapotrzebowanie",
  INSTALLATION_MANAGER: "Swoje projekty: zatwierdza godziny po supervisorach i urlopy, pulpit",
  SUPERVISOR: "Swój projekt: zatwierdza godziny zespołu i urlopy, wpisuje swoje godziny",
  HR: "Ludzie, akceptacja urlopów wszystkich, potwierdzanie L4",
  WORKER: "Swoje godziny i wnioski urlopowe",
  CUSTOM: "Bez uprawnień z roli — zaznaczasz je ręcznie",
};

const ROLES: AccessRole[] = ["ADMIN", "PLANNING", "PROJECT_MANAGER", "INSTALLATION_MANAGER", "SUPERVISOR", "HR", "WORKER", "CUSTOM"];
const POSITIONS: Position[] = ["ADMIN", "PLANNER", "PROJECT_MANAGER", "INSTALLATION_MANAGER", "SUPERVISOR", "HR", "OFFICE", "TEAM_LEADER", "ELECTRICIAN", "MECHANIC"];

/**
 * Użytkownicy i uprawnienia (administrator): lista wszystkich kont, dodawanie (np. HR, controlling),
 * zmiana roli i pojedynczych uprawnień (dodaj / odbierz). Każda zmiana zostaje w dzienniku zmian.
 */
export function UsersView() {
  const model = useModel();
  const [group, setGroup] = useState<Group>("office");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const isField = (e: Employee) => FIELD_POSITIONS.includes(e.position);
  const passes = (e: Employee, g: Group) =>
    g === "all" ? true : g === "off" ? e.active === false : e.active !== false && (g === "field" ? isField(e) : !isField(e));
  const rows = model.employees.filter((e) => passes(e, group) && matches(search, e.name, e.email, POSITION_LABEL[e.position], ROLE_LABEL[e.role]));
  const count = (g: Group) => model.employees.filter((e) => passes(e, g)).length;

  return (
    <div className="page users">
      <PageHeader
        title="Użytkownicy"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
            <UserPlus size={18} aria-hidden />
            Dodaj użytkownika
          </button>
        }
      />
      <div className="list-tools">
        <Segmented<Group>
          label="Grupa"
          value={group}
          onChange={setGroup}
          options={[
            { value: "office", label: "Biuro i zarząd", count: count("office") },
            { value: "field", label: "Pracownicy w projektach", count: count("field") },
            { value: "off", label: "Wyłączone konta", count: count("off") },
            { value: "all", label: "Wszyscy", count: count("all") },
          ]}
        />
        <label className="inline-search">
          <Search size={16} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj po nazwisku, e-mailu, roli" aria-label="Szukaj użytkownika" />
        </label>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Osoba</th>
              <th scope="col">Stanowisko</th>
              <th scope="col">Rola</th>
              <th scope="col">Uprawnienia</th>
              <th scope="col">Konto</th>
              <th scope="col">
                <span className="sr-only">Akcje</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const perms = permissionsOf(e);
              const added = (e.grants ?? []).length;
              const removed = (e.revokes ?? []).length;
              return (
                <tr key={e.id} className={e.active === false ? "is-off" : ""}>
                  <th scope="row">
                    <span className="person-cell">
                      <PositionMark employee={e} />
                      <span className="user-cell">
                        <span>{e.name}</span>
                        {e.email && <small>{e.email}</small>}
                      </span>
                    </span>
                  </th>
                  <td className="muted">
                    {POSITION_LABEL[e.position]} {e.employment && <EmploymentTag employee={e} />}
                  </td>
                  <td>{ROLE_LABEL[e.role]}</td>
                  <td>
                    <span className="perm-count" data-tip={[...perms].map((p) => PERMISSION_LABEL[p]).join("\n") || "Brak uprawnień"}>
                      {perms.size}
                    </span>
                    {added > 0 && <span className="perm-diff perm-diff--add">+{added} dodane</span>}
                    {removed > 0 && <span className="perm-diff perm-diff--remove">−{removed} odebrane</span>}
                  </td>
                  <td>{e.active === false ? <span className="badge badge--neutral">Wyłączone</span> : <span className="muted">Aktywne</span>}</td>
                  <td className="cell-action">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(e)}>
                      <ShieldCheck size={15} aria-hidden />
                      Uprawnienia
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty empty--inline">Nikt nie pasuje do wyszukiwania.</p>}
      </div>
      {editing && <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: Employee | null; onClose: () => void }) {
  const data = useData();
  const me = useUser();
  const [form, setForm] = useState<UserInput>(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    position: user?.position ?? "HR",
    role: user?.role ?? "HR",
    employment: user?.employment ?? null,
    grants: (user?.grants ?? []) as Permission[],
    revokes: (user?.revokes ?? []) as Permission[],
    active: user?.active !== false,
  }));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<UserInput>) => setForm((f) => ({ ...f, ...patch }));
  const roleSet = new Set(ROLE_PERMISSIONS[form.role]);
  const effective = useMemo(() => permissionsOf({ id: "x", name: "", role: form.role, position: form.position, active: true, grants: form.grants, revokes: form.revokes }), [form]);
  const field = FIELD_POSITIONS.includes(form.position);

  const toggle = (p: Permission) => {
    if (roleSet.has(p)) set({ revokes: form.revokes.includes(p) ? form.revokes.filter((x) => x !== p) : [...form.revokes, p] });
    else set({ grants: form.grants.includes(p) ? form.grants.filter((x) => x !== p) : [...form.grants, p] });
  };

  return (
    <Dialog
      title={user ? user.name : "Nowy użytkownik"}
      description={user ? `${POSITION_LABEL[user.position]} · ${ROLE_LABEL[user.role]}` : "Np. osoba z HR albo controllingu. Rola ustawia uprawnienia na start — możesz je zmienić niżej."}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="users__summary">{effective.size} uprawnień</span>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const id = await data.saveUser({ ...form, id: user?.id ?? null });
              setSaving(false);
              if (id) onClose();
            }}
          >
            {user ? "Zapisz zmiany" : "Dodaj użytkownika"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Imię i nazwisko" htmlFor="u-name">
          <TextInput id="u-name" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="E-mail" htmlFor="u-email" optional>
          <TextInput id="u-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Stanowisko" htmlFor="u-pos">
          <SelectMenu<Position> id="u-pos" value={form.position} options={POSITIONS.map((p) => ({ value: p, label: POSITION_LABEL[p] }))} onChange={(position) => set({ position })} />
        </Field>
        <Field label="Rola" htmlFor="u-role" hint={ROLE_HINT[form.role]}>
          <SelectMenu<AccessRole>
            id="u-role"
            value={form.role}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            onChange={(role) => set({ role, grants: [], revokes: [] })}
          />
        </Field>
        {field && (
          <Field label="Umowa" htmlFor="u-emp">
            <SelectMenu<Employment>
              id="u-emp"
              value={form.employment ?? "UOP"}
              options={(Object.keys(EMPLOYMENT_LABEL) as Employment[]).map((e) => ({ value: e, label: EMPLOYMENT_LABEL[e] }))}
              onChange={(employment) => set({ employment })}
            />
          </Field>
        )}
        <Field label="Konto" htmlFor="u-active">
          <Segmented<"on" | "off">
            label="Konto"
            value={form.active ? "on" : "off"}
            onChange={(v) => set({ active: v === "on" })}
            options={[
              { value: "on", label: "Aktywne" },
              { value: "off", label: "Wyłączone" },
            ]}
          />
        </Field>
      </div>

      <div className="perms">
        <h3>Uprawnienia</h3>
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.label} className="perms__group">
            <legend>{g.label}</legend>
            {g.items.map((p) => {
              const on = effective.has(p);
              const fromRole = roleSet.has(p);
              const state = fromRole ? (on ? "z roli" : "odebrane") : on ? "dodane" : "";
              const locked = user?.id === me.id && p === "users.manage";
              return (
                <label key={p} className={`perm ${on ? "is-on" : ""} ${state === "dodane" ? "is-added" : ""} ${state === "odebrane" ? "is-removed" : ""}`}>
                  <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(p)} />
                  <span>{PERMISSION_LABEL[p]}</span>
                  {state && <em>{state}</em>}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}

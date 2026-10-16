import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { Field, TextInput } from "../../components/Field";
import { SelectMenu } from "../../components/SelectMenu";
import { BRANCHES, PROJECT_COLORS, PROJECT_STATUS_LABEL } from "../../domain/labels";
import type { Project, ProjectInput, ProjectStatus } from "../../domain/types";
import { todayISO } from "../../lib/dates";

interface ProjectFormProps {
  values: ProjectInput;
  onChange: <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => void;
  errors: Record<string, string>;
  projectId: string | null;
  readOnly?: boolean;
}

export function projectToInput(p: Project): ProjectInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = p;
  void _id;
  void _c;
  void _u;
  return input;
}

export function emptyProjectInput(projects: Project[], pmId: string | null): ProjectInput {
  const max = projects.reduce((m, p) => Math.max(m, Number.parseInt(p.number, 10) || 0), 26000);
  const usage = new Map(PROJECT_COLORS.map((c) => [c.value, 0]));
  projects.forEach((p) => usage.set(p.color, (usage.get(p.color) ?? 0) + 1));
  const color = [...usage.entries()].sort((a, b) => a[1] - b[1])[0][0];
  return {
    number: String(max + 1),
    name: "",
    customerName: "",
    customerOrderNo: "",
    siteAddress: "",
    country: "",
    branch: "Polska",
    color,
    startDate: todayISO(),
    endDate: null,
    status: "PLANNED",
    projectManagerId: pmId,
    installationManagerId: null,
    supervisorId: null,
    needElectricians: null,
    needMechanics: null,
    dataverseId: "",
    dataverseNumber: "",
  };
}

function toCount(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Math.min(500, Number.parseInt(digits, 10)) : null;
}

/** Dane projektu — te same pola przy tworzeniu i edycji. Sekcje jak w Gantbee, bez zbędnych pól. */
export function ProjectForm({ values, onChange: set, errors, projectId, readOnly }: ProjectFormProps) {
  const model = useModel();
  const pms = model.employees.filter((e) => e.position === "PROJECT_MANAGER");
  const ims = model.employees.filter((e) => e.position === "INSTALLATION_MANAGER");
  const svs = model.employees.filter((e) => e.position === "SUPERVISOR");
  const customers = useMemo(() => [...new Set(model.projects.map((p) => p.customerName))].sort(), [model.projects]);

  return (
    <fieldset className="form" disabled={readOnly}>
      <section className="form-section">
        <h3 className="form-section__title">Ogólne</h3>
        <div className="form-grid">
          <Field label="Numer projektu" htmlFor="f-number" error={errors.number}>
            <TextInput id="f-number" inputMode="numeric" value={values.number} onChange={(e) => set("number", e.target.value)} invalid={!!errors.number} />
          </Field>
          <Field label="Status" htmlFor="f-status">
            <SelectMenu<ProjectStatus>
              id="f-status"
              value={values.status}
              onChange={(v) => set("status", v)}
              options={(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))}
              disabled={readOnly}
            />
          </Field>
        </div>
        <Field label="Nazwa projektu" htmlFor="f-name" error={errors.name} hint="Np. P26011-Klient-Miasto">
          <TextInput id="f-name" value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Klient i miejsce</h3>
        <Field label="Klient" htmlFor="f-customer" error={errors.customerName}>
          <TextInput
            id="f-customer"
            list="customers"
            value={values.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            invalid={!!errors.customerName}
          />
          <datalist id="customers">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Nr zamówienia klienta" htmlFor="f-order" optional>
          <TextInput id="f-order" value={values.customerOrderNo} onChange={(e) => set("customerOrderNo", e.target.value)} />
        </Field>
        <div className="form-grid">
          <Field label="Adres projektu" htmlFor="f-address" optional>
            <TextInput id="f-address" value={values.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
          </Field>
          <Field label="Kraj" htmlFor="f-country" optional>
            <TextInput id="f-country" value={values.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Termin</h3>
        <div className="form-grid">
          <Field label="Start" htmlFor="f-start" error={errors.startDate}>
            <DatePicker id="f-start" value={values.startDate || null} onChange={(v) => set("startDate", v ?? "")} invalid={!!errors.startDate} />
          </Field>
          <Field label="Koniec" htmlFor="f-end" error={errors.endDate} optional>
            <DatePicker
              id="f-end"
              value={values.endDate}
              onChange={(v) => set("endDate", v)}
              min={values.startDate || null}
              rangeStart={values.startDate || null}
              placeholder="Nieznany"
              clearable
              invalid={!!errors.endDate}
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Zapotrzebowanie</h3>
        <p className="form-section__lead">Ilu ludzi potrzeba w projekcie (razem z Team Leaderami). Planning widzi braki w Obsadzie.</p>
        <div className="form-grid">
          <Field label="Elektrycy" htmlFor="f-need-el" error={errors.needElectricians} optional>
            <TextInput
              id="f-need-el"
              inputMode="numeric"
              value={values.needElectricians ?? ""}
              onChange={(e) => set("needElectricians", toCount(e.target.value))}
              invalid={!!errors.needElectricians}
              placeholder="np. 8"
            />
          </Field>
          <Field label="Mechanicy" htmlFor="f-need-me" error={errors.needMechanics} optional>
            <TextInput
              id="f-need-me"
              inputMode="numeric"
              value={values.needMechanics ?? ""}
              onChange={(e) => set("needMechanics", toCount(e.target.value))}
              invalid={!!errors.needMechanics}
              placeholder="np. 6"
            />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Organizacja</h3>
        <div className="form-grid">
          <Field label="Oddział" htmlFor="f-branch" error={errors.branch}>
            <SelectMenu
              id="f-branch"
              value={values.branch || null}
              onChange={(v) => set("branch", v)}
              options={BRANCHES.map((b) => ({ value: b, label: b }))}
              placeholder="Wybierz oddział"
              invalid={!!errors.branch}
              disabled={readOnly}
            />
          </Field>
          <Field label="Project Manager" htmlFor="f-pm" optional>
            <SelectMenu
              id="f-pm"
              value={values.projectManagerId}
              onChange={(v) => set("projectManagerId", v)}
              options={pms.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Jeszcze nie wybrany"
              disabled={readOnly}
            />
          </Field>
        </div>
        <Field label="Installation Manager" htmlFor="f-im" error={errors.installationManagerId} hint="Zatwierdza godziny po supervisorze.">
          <SelectMenu
            id="f-im"
            value={values.installationManagerId}
            onChange={(v) => set("installationManagerId", v)}
            options={ims.map((e) => ({ value: e.id, label: e.name }))}
            placeholder="Wybierz osobę"
            invalid={!!errors.installationManagerId}
            disabled={readOnly}
          />
        </Field>
        <Field label="Supervisor" htmlFor="f-sv" optional hint="Zatwierdza godziny zespołu. Może prowadzić kilka projektów.">
          <SelectMenu
            id="f-sv"
            value={values.supervisorId}
            onChange={(v) => set("supervisorId", v)}
            options={svs.map((sv) => {
              const current = model.projects.filter((p) => p.supervisorId === sv.id && p.id !== projectId);
              return { value: sv.id, label: sv.name, hint: current.length ? current.map((p) => p.name).join(", ") : "wolny" };
            })}
            placeholder="Jeszcze nie wybrany"
            disabled={readOnly}
          />
        </Field>
        <Field label="Kolor projektu" htmlFor="f-color-0" hint="Kolor tylko rozróżnia projekty na listach. Nie oznacza stanu.">
          <div className="swatches" role="radiogroup" aria-label="Kolor projektu">
            {PROJECT_COLORS.map((c, i) => (
              <button
                key={c.value}
                id={`f-color-${i}`}
                type="button"
                role="radio"
                aria-checked={values.color === c.value}
                aria-label={c.name}
                className={`swatch ${values.color === c.value ? "is-selected" : ""}`}
                style={{ background: c.value }}
                onClick={() => set("color", c.value)}
              />
            ))}
          </div>
        </Field>
      </section>

      <section className="form-section form-section--integration">
        <h3 className="form-section__title">Połączenie z Dataverse</h3>
        <div className="notice">
          <TriangleAlert size={18} aria-hidden />
          <p>Zmiana tych pól wpływa na połączenie z Business Central. Zwykle uzupełnia je nav24 — zostaw puste, jeśli nie masz numerów.</p>
        </div>
        <div className="form-grid">
          <Field label="Dataverse Id" htmlFor="f-dv-id" optional>
            <TextInput id="f-dv-id" value={values.dataverseId} onChange={(e) => set("dataverseId", e.target.value)} />
          </Field>
          <Field label="Dataverse Number" htmlFor="f-dv-number" optional>
            <TextInput id="f-dv-number" value={values.dataverseNumber} onChange={(e) => set("dataverseNumber", e.target.value)} />
          </Field>
        </div>
      </section>
    </fieldset>
  );
}

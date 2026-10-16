import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { Field, Select, TextInput } from "../../components/Field";
import { validateProject } from "../../data/commands";
import { BRANCHES, PROJECT_COLORS, PROJECT_STATUS_LABEL } from "../../domain/labels";
import type { Project, ProjectInput, ProjectStatus } from "../../domain/types";
import { todayISO } from "../../lib/dates";

export const PROJECT_FORM_ID = "project-form";

interface ProjectFormProps {
  initial?: Project;
  onSubmit: (input: ProjectInput) => Promise<void>;
}

export function projectToInput(p: Project): ProjectInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = p;
  void _id;
  void _c;
  void _u;
  return input;
}

/** Formularz projektu — te same pola przy tworzeniu i edycji. Sekcje jak w Gantbee, bez zbędnych pól. */
export function ProjectForm({ initial, onSubmit }: ProjectFormProps) {
  const model = useModel();
  const [values, setValues] = useState<ProjectInput>(() => (initial ? projectToInput(initial) : emptyInput(model.projects)));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = useMemo(
    () => (attempted ? validateProject(values, model.snapshot, initial?.id) : {}),
    [attempted, values, model.snapshot, initial?.id]
  );
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  const ims = model.employees.filter((e) => e.position === "INSTALLATION_MANAGER");
  const svs = model.employees.filter((e) => e.position === "SUPERVISOR");
  const customers = useMemo(() => [...new Set(model.projects.map((p) => p.customerName))].sort(), [model.projects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validateProject(values, model.snapshot, initial?.id)).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={PROJECT_FORM_ID} className="form" onSubmit={handleSubmit} noValidate aria-busy={saving}>
      <fieldset className="form-section">
        <legend>Ogólne</legend>
        <div className="form-grid">
          <Field label="Numer projektu" htmlFor="f-number" error={errors.number}>
            <TextInput id="f-number" inputMode="numeric" value={values.number} onChange={(e) => set("number", e.target.value)} invalid={!!errors.number} />
          </Field>
          <Field label="Status" htmlFor="f-status">
            <Select id="f-status" value={values.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Nazwa projektu" htmlFor="f-name" error={errors.name} hint="Np. P26011-Klient-Miasto">
          <TextInput id="f-name" value={values.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
      </fieldset>

      <fieldset className="form-section">
        <legend>Klient i budowa</legend>
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
          <Field label="Adres budowy" htmlFor="f-address" optional>
            <TextInput id="f-address" value={values.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
          </Field>
          <Field label="Kraj" htmlFor="f-country" optional>
            <TextInput id="f-country" value={values.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Termin</legend>
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
      </fieldset>

      <fieldset className="form-section">
        <legend>Organizacja</legend>
        <div className="form-grid">
          <Field label="Oddział" htmlFor="f-branch" error={errors.branch}>
            <Select id="f-branch" value={values.branch} onChange={(e) => set("branch", e.target.value)} invalid={!!errors.branch}>
              <option value="">Wybierz oddział</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Installation Manager" htmlFor="f-im" error={errors.installationManagerId}>
            <Select
              id="f-im"
              value={values.installationManagerId ?? ""}
              onChange={(e) => set("installationManagerId", e.target.value || null)}
              invalid={!!errors.installationManagerId}
            >
              <option value="">Wybierz osobę</option>
              {ims.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Supervisor" htmlFor="f-sv" optional hint="Supervisor zatwierdza godziny zespołu. Może prowadzić kilka projektów.">
          <Select id="f-sv" value={values.supervisorId ?? ""} onChange={(e) => set("supervisorId", e.target.value || null)}>
            <option value="">Jeszcze nie wybrany</option>
            {svs.map((sv) => {
              const current = model.projects.filter((p) => p.supervisorId === sv.id && p.id !== initial?.id);
              return (
                <option key={sv.id} value={sv.id}>
                  {sv.name}
                  {current.length ? ` (prowadzi: ${current.map((p) => p.name).join(", ")})` : ""}
                </option>
              );
            })}
          </Select>
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
                data-tip={c.name}
                className={`swatch ${values.color === c.value ? "is-selected" : ""}`}
                style={{ background: c.value }}
                onClick={() => set("color", c.value)}
              />
            ))}
          </div>
        </Field>
      </fieldset>

      <fieldset className="form-section form-section--integration">
        <legend>Połączenie z Dataverse</legend>
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
      </fieldset>
    </form>
  );
}

function emptyInput(projects: Project[]): ProjectInput {
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
    installationManagerId: null,
    supervisorId: null,
    dataverseId: "",
    dataverseNumber: "",
  };
}

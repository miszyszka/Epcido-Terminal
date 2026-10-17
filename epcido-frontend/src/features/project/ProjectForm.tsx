import { useMemo } from "react";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useModel } from "../../app/DataContext";
import { DatePicker } from "../../components/DatePicker";
import { Field, TextInput } from "../../components/Field";
import { SelectMenu } from "../../components/SelectMenu";
import { Segmented } from "../../components/Segmented";
import { branches, categories, PROJECT_COLORS, PROJECT_STATUS_LABEL } from "../../domain/labels";
import type { DemandPhase, Project, ProjectCategory, ProjectInput, ProjectStatus } from "../../domain/types";
import { addDays, todayISO } from "../../lib/dates";
import { newId } from "../../lib/random";

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
    category: categories()[0],
    demand: [],
    dataverseId: "",
    dataverseNumber: "",
  };
}

function toCount(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits ? Math.min(500, Number.parseInt(digits, 10)) : 0;
}

/** Dane projektu — te same pola przy tworzeniu i edycji. Sekcje jak w Gantbee, bez zbędnych pól. */
export function ProjectForm({ values, onChange: set, errors, projectId, readOnly }: ProjectFormProps) {
  const model = useModel();
  const pms = model.employees.filter((e) => e.position === "PROJECT_MANAGER");
  const ims = model.employees.filter((e) => e.position === "INSTALLATION_MANAGER");
  const svs = model.employees.filter((e) => e.position === "SUPERVISOR");
  const customers = useMemo(() => [...new Set(model.projects.map((p) => p.customerName))].sort(), [model.projects]);
  const setDemand = (demand: DemandPhase[]) => set("demand", demand);
  const patchPhase = (id: string, patch: Partial<DemandPhase>) => setDemand(values.demand.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const addPhase = () => {
    const last = values.demand[values.demand.length - 1];
    const from = last ? addDays(last.to, 1) : values.startDate || todayISO();
    const to = values.endDate && values.endDate > from ? values.endDate : addDays(from, 55);
    setDemand([...values.demand, { id: newId("d"), from, to, electricians: last?.electricians ?? 0, mechanics: last?.mechanics ?? 0 }]);
  };

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
        <Field label="Kategoria" htmlFor="f-category" error={errors.category}>
          <Segmented<ProjectCategory>
            label="Kategoria projektu"
            value={values.category}
            onChange={(v) => set("category", v)}
            options={categories().map((c) => ({ value: c, label: c }))}
          />
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
        <p className="form-section__lead">
          Ile osób potrzeba w jakim czasie (razem z Team Leaderami danej branży). Planning widzi to w Obsadzie i dobiera ludzi.
        </p>
        {values.demand.length === 0 && <p className="phase-empty">Brak faz — dodaj pierwszą, żeby Planning wiedział, kogo szukać.</p>}
        {values.demand.map((d, i) => (
          <div key={d.id} className="phase">
            <div className="phase__head">
              <strong>Faza {i + 1}</strong>
              {!readOnly && (
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setDemand(values.demand.filter((x) => x.id !== d.id))} aria-label={`Usuń fazę ${i + 1}`}>
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="form-grid">
              <Field label="Od" htmlFor={`f-ph-from-${i}`}>
                <DatePicker id={`f-ph-from-${i}`} value={d.from} onChange={(v) => v && patchPhase(d.id, { from: v })} />
              </Field>
              <Field label="Do" htmlFor={`f-ph-to-${i}`}>
                <DatePicker id={`f-ph-to-${i}`} value={d.to} onChange={(v) => v && patchPhase(d.id, { to: v })} min={d.from} rangeStart={d.from} />
              </Field>
              <Field label="Elektrycy" htmlFor={`f-ph-el-${i}`}>
                <TextInput id={`f-ph-el-${i}`} inputMode="numeric" value={d.electricians} onChange={(e) => patchPhase(d.id, { electricians: toCount(e.target.value) })} />
              </Field>
              <Field label="Mechanicy" htmlFor={`f-ph-me-${i}`}>
                <TextInput id={`f-ph-me-${i}`} inputMode="numeric" value={d.mechanics} onChange={(e) => patchPhase(d.id, { mechanics: toCount(e.target.value) })} />
              </Field>
            </div>
          </div>
        ))}
        {errors.demand && <p className="field__error">{errors.demand}</p>}
        {!readOnly && (
          <button type="button" className="btn btn--secondary btn--sm phase-add" onClick={addPhase}>
            <Plus size={16} aria-hidden />
            Dodaj fazę
          </button>
        )}
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Organizacja</h3>
        <div className="form-grid">
          <Field label="Oddział" htmlFor="f-branch" error={errors.branch}>
            <SelectMenu
              id="f-branch"
              value={values.branch || null}
              onChange={(v) => set("branch", v)}
              options={branches().map((b) => ({ value: b, label: b }))}
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

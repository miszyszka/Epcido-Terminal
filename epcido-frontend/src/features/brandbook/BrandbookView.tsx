import { useState } from "react";
import { DatePicker } from "../../components/DatePicker";
import { DayCard, DayCell } from "../../components/DayCell";
import { DeadlineBanner } from "../../components/DeadlineBanner";
import { Field, TextInput } from "../../components/Field";
import { SelectMenu } from "../../components/SelectMenu";
import { PageHeader } from "../../components/PageHeader";
import { Segmented } from "../../components/Segmented";
import { DAY_STATE_LABEL, PROJECT_COLORS } from "../../domain/labels";
import type { DayEntry, DayState } from "../../domain/types";
import { todayISO } from "../../lib/dates";

const BRAND = [
  { name: "Deep Forest", hex: "#0F3D3A", role: "Atrament marki, główne akcje, dzień zatwierdzony", dark: true },
  { name: "Golden Hour", hex: "#F4B13B", role: "Tylko stan: do zatwierdzenia" },
  { name: "Terracotta Clay", hex: "#E0745E", role: "Tylko stan: nieobecny; tekst alarmów (braki, termin)" },
  { name: "Warm Sand", hex: "#F2E6D6", role: "Weekendy, zaznaczenia, plakietki ról" },
];

const WORKING = [
  { name: "Tło", token: "--ground", hex: "#EEF2F0" },
  { name: "Powierzchnia", token: "--surface", hex: "#FFFFFF" },
  { name: "Tekst", token: "--ink", hex: "#102826", dark: true },
  { name: "Tekst pomocniczy", token: "--ink-2", hex: "#4F605D", dark: true },
  { name: "Linia", token: "--line", hex: "#DCE3E0" },
  { name: "Las 50", token: "--forest-50", hex: "#EAF1F0" },
];

const STATES: DayState[] = ["approved", "pending", "absent", "missed", "off"];
const SAMPLE: Record<DayState, DayEntry | undefined> = {
  approved: { kind: "WORK", status: "SUPERVISOR_APPROVED", start: 420, end: 1020, breakMin: 30 },
  pending: { kind: "WORK", status: "SUBMITTED", start: 420, end: 1080, breakMin: 60 },
  absent: { kind: "ABSENCE", status: "SUBMITTED", absence: "SICK" },
  missed: { kind: "WORK", status: "SUBMITTED", start: 420, end: 1080, breakMin: 30 },
  off: undefined,
};

const NOW = Date.now();
const BANNER = {
  week: "2026-10-12",
  approveBy: "2026-10-19",
  lockAt: new Date(NOW + 3 * 86_400_000),
  exportAt: new Date(NOW + 3 * 86_400_000 + 23 * 3_600_000),
  timesheets: 24,
  later: 0,
  laterApproveBy: null,
  missed: 0,
};

/** Żywy brandbook: tokeny i komponenty dokładnie tak, jak są w aplikacji. Opis: docs/BRANDBOOK.md */
export function BrandbookView() {
  const [date, setDate] = useState<string | null>(todayISO());
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [branch, setBranch] = useState("Polska");

  return (
    <div className="page brandbook">
      <PageHeader title="Brandbook" />

      <section className="bb-section">
        <h2 className="section-title">Cztery zasady</h2>
        <ol className="bb-principles">
          <li>
            <strong>Kolor to stan.</strong> Zielony, żółty i czerwony opisują tylko stan dnia pracy.
          </li>
          <li>
            <strong>Dzień to kropka.</strong> Ten sam zaokrąglony kwadrat na mapie, osi czasu i w kalendarzu.
          </li>
          <li>
            <strong>Pływa tylko to, co chwilowe.</strong> Cień mają dock, panele, kalendarz i komunikaty.
          </li>
          <li>
            <strong>Kontrast grubości.</strong> Tytuły i liczby grube, opisy lekkie — bez dodatkowych kolorów.
          </li>
        </ol>
      </section>

      <section className="bb-section">
        <h2 className="section-title">Paleta marki</h2>
        <div className="bb-swatches">
          {BRAND.map((c) => (
            <div key={c.hex} className={`bb-swatch ${c.dark ? "is-dark" : ""}`} style={{ background: c.hex }}>
              <strong>{c.name}</strong>
              <span>{c.hex}</span>
              <p>{c.role}</p>
            </div>
          ))}
        </div>
        <div className="bb-chips">
          {WORKING.map((c) => (
            <div key={c.token} className="bb-chip">
              <span className="bb-chip__color" style={{ background: c.hex }} />
              <span>
                <strong>{c.name}</strong> {c.token} {c.hex}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bb-section">
        <h2 className="section-title">Stany dnia</h2>
        <p className="section-lead">Jedyne miejsce, gdzie Golden Hour i Terracotta Clay wypełniają powierzchnię.</p>
        <div className="bb-states">
          {STATES.map((s) => (
            <div key={s} className="bb-state">
              <div className="bb-state__cells">
                <DayCell state={s} size="mini" label={DAY_STATE_LABEL[s]} />
                <DayCell state={s} size="map" label={DAY_STATE_LABEL[s]} />
                <DayCard entry={SAMPLE[s]} state={s} expected />
              </div>
              <strong>{DAY_STATE_LABEL[s]}</strong>
            </div>
          ))}
          <div className="bb-state">
            <div className="bb-state__cells">
              <DayCell state="approved" size="map" sent label="Wysłane do Dataverse" />
              <DayCard entry={{ ...SAMPLE.approved!, exported: true }} state="approved" sent />
              <DayCard
                entry={{ ...SAMPLE.approved!, history: [{ at: new Date(NOW).toISOString(), byId: "sv-1", byName: "Supervisor 1", text: "7:00–18:00 → 7:00–17:00" }] }}
                state="approved"
                tip="Zmienione przez Supervisor 1"
              />
              <DayCell state="pending" size="map" today label="Dziś" />
              <DayCell state="off" size="map" planned label="Zaplanowany dzień" />
            </div>
            <strong>Wysłane do Dataverse, zmienione przez supervisora, dziś, dzień zaplanowany</strong>
          </div>
        </div>
      </section>

      <section className="bb-section">
        <h2 className="section-title">Typografia: Plus Jakarta Sans</h2>
        <div className="bb-type">
          <p className="bb-type__sample bb-type__sample--display">Plan projektów</p>
          <p className="bb-type__meta">Tytuł ekranu: 38 px, grubość 800, odstęp −0,03 em</p>
          <p className="bb-type__sample bb-type__sample--xl">Projekt 3, Tilburg</p>
          <p className="bb-type__meta">Nazwa projektu: 23,5 px, grubość 700</p>
          <p className="bb-type__sample">Supervisor zatwierdza godziny zespołu do poniedziałku.</p>
          <p className="bb-type__meta">Tekst: 15 px, grubość 400</p>
          <p className="bb-type__sample bb-type__sample--light">Godziny wpisane przez zespół w tym tygodniu</p>
          <p className="bb-type__meta">Opis, podpis, drugi plan: grubość 300</p>
          <p className="bb-type__sample bb-type__sample--nums">7:00 → 17:00, 9 h 30 min</p>
          <p className="bb-type__meta">Liczby zawsze tabelaryczne</p>
        </div>
      </section>

      <section className="bb-section">
        <h2 className="section-title">Projekty: kolory identyfikacyjne</h2>
        <p className="section-lead">Tylko jako kropka lub pasek przy nazwie. Nie oznaczają stanu.</p>
        <div className="swatches">
          {PROJECT_COLORS.map((c) => (
            <span key={c.value} className="swatch is-static" style={{ background: c.value }} data-tip={`${c.name} ${c.value}`} />
          ))}
        </div>
      </section>

      <section className="bb-section">
        <h2 className="section-title">Komponenty</h2>
        <div className="bb-components">
          <div className="bb-row">
            <button type="button" className="btn btn--primary">
              Utwórz projekt
            </button>
            <button type="button" className="btn btn--secondary">
              Dodaj elektryka
            </button>
            <button type="button" className="btn btn--quiet">
              Anuluj
            </button>
            <button type="button" className="btn btn--danger">
              Usuń dane
            </button>
          </div>
          <div className="bb-row">
            <span className="badge badge--approved">Zatwierdzone</span>
            <span className="badge badge--pending">12 timesheetów do zatwierdzenia</span>
            <span className="badge badge--absent">3 dni nieob.</span>
            <span className="badge badge--missed">Nie wysłane</span>
            <span className="badge badge--status badge--active">W realizacji</span>
          </div>
          <DeadlineBanner summary={{ ...BANNER, remainingMs: 3 * 86_400_000 + 3_600_000, urgent: false }} />
          <DeadlineBanner summary={{ ...BANNER, timesheets: 5, remainingMs: 5 * 3_600_000, urgent: true }} />
          <Segmented
            label="Przykład"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "a", label: "Wszyscy", count: 135 },
              { value: "b", label: "Elektrycy", count: 50 },
              { value: "c", label: "Mechanicy", count: 50 },
            ]}
          />
          <div className="bb-form">
            <Field label="Nazwa projektu" htmlFor="bb-name" hint="Np. P26011-Klient-Miasto">
              <TextInput id="bb-name" defaultValue="P26011-Nordhavn-Wrexham" />
            </Field>
            <Field label="Oddział" htmlFor="bb-branch">
              <SelectMenu
                id="bb-branch"
                value={branch}
                onChange={setBranch}
                options={[
                  { value: "Polska", label: "Polska" },
                  { value: "Niemcy", label: "Niemcy" },
                  { value: "Beneluks", label: "Beneluks" },
                ]}
              />
            </Field>
            <Field label="Start" htmlFor="bb-date">
              <DatePicker id="bb-date" value={date} onChange={setDate} />
            </Field>
            <Field label="Numer projektu" htmlFor="bb-err" error="Projekt o tym numerze już istnieje.">
              <TextInput id="bb-err" defaultValue="26003" invalid />
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}

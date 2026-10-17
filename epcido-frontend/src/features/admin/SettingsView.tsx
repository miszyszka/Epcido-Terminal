import { useMemo, useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { useData, useModel } from "../../app/DataContext";
import { useNow } from "../../app/hooks";
import { Field, TextInput } from "../../components/Field";
import { PageHeader } from "../../components/PageHeader";
import { SelectMenu } from "../../components/SelectMenu";
import { DEFAULT_SETTINGS, validateSettings, WEEKDAY_AFTER } from "../../domain/settings";
import { closingWeek } from "../../domain/workflow";
import type { SystemSettings } from "../../domain/types";
import { addDays, formatDay, formatTimestamp, isoWeek, startOfWeek, toISO } from "../../lib/dates";
import { plural } from "../../lib/text";

/**
 * Ustawienia systemu (administrator): terminy zatwierdzania i wysyłki do Dataverse, kategorie projektów,
 * oddziały, zasady obsady. Zmiany obowiązują od razu u wszystkich i zostają w dzienniku zmian.
 */
export function SettingsView() {
  const model = useModel();
  const data = useData();
  const now = useNow();
  const [form, setForm] = useState<SystemSettings>(model.settings);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<SystemSettings>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(model.settings);
  const error = validateSettings(form);
  const used = useMemo(() => {
    const cat = new Map<string, number>();
    const br = new Map<string, number>();
    for (const p of model.projects) {
      cat.set(p.category, (cat.get(p.category) ?? 0) + 1);
      br.set(p.branch, (br.get(p.branch) ?? 0) + 1);
    }
    return { cat, br };
  }, [model.projects]);

  // Przykład na bieżący tydzień z ustawień w formularzu (przed zapisem)
  const week = startOfWeek(toISO(now));
  const approveDay = addDays(week, form.approveDayOffset);
  const exportDay = addDays(week, form.exportDayOffset);
  const lastSent = closingWeek(now);

  return (
    <div className="page settings">
      <PageHeader
        title="Ustawienia"
        actions={
          <>
            <button type="button" className="btn btn--quiet" onClick={() => setForm(DEFAULT_SETTINGS)} disabled={JSON.stringify(form) === JSON.stringify(DEFAULT_SETTINGS)}>
              <RotateCcw size={16} aria-hidden />
              Domyślne
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!dirty || Boolean(error) || saving}
              onClick={async () => {
                setSaving(true);
                await data.saveSettings(form);
                setSaving(false);
              }}
            >
              Zapisz ustawienia
            </button>
          </>
        }
      />
      {error && dirty && <p className="notice notice--warn">{error}</p>}

      <div className="settings__grid">
        <section className="settings-card">
          <h2>Terminy</h2>
          <div className="settings-row">
            <Field label="Zatwierdzanie godzin do" htmlFor="s-approve">
              <div className="settings-pair">
                <SelectMenu<string>
                  id="s-approve"
                  value={String(form.approveDayOffset)}
                  options={WEEKDAY_AFTER.slice(0, 3).map((w) => ({ value: String(w.offset), label: `${w.label} po tygodniu` }))}
                  onChange={(v) => set({ approveDayOffset: Number(v) })}
                />
                <TextInput className="settings-time" value={form.approveTime} onChange={(e) => set({ approveTime: e.target.value })} aria-label="Godzina terminu" inputMode="numeric" />
              </div>
            </Field>
            <Field label="Wysyłka do Dataverse" htmlFor="s-export">
              <div className="settings-pair">
                <SelectMenu<string>
                  id="s-export"
                  value={String(form.exportDayOffset)}
                  options={WEEKDAY_AFTER.map((w) => ({ value: String(w.offset), label: `${w.label} po tygodniu` }))}
                  onChange={(v) => set({ exportDayOffset: Number(v) })}
                />
                <TextInput className="settings-time" value={form.exportTime} onChange={(e) => set({ exportTime: e.target.value })} aria-label="Godzina wysyłki" inputMode="numeric" />
              </div>
            </Field>
          </div>
          <p className="settings-example">
            Tydzień {isoWeek(week).week}: godziny zatwierdzane do <b>{formatDay(approveDay)}, {form.approveTime}</b>, minutę później tydzień się zamyka; kompletne timesheety
            idą do Dataverse <b>{formatDay(exportDay)}, {form.exportTime}</b>.
          </p>
        </section>

        <section className="settings-card">
          <h2>Integracja Dataverse</h2>
          <dl className="settings-facts">
            <div>
              <dt>Tryb</dt>
              <dd>Symulacja (prototyp) — wysyłka liczona z czasu, bez połączenia</dd>
            </div>
            <div>
              <dt>Najbliższa wysyłka</dt>
              <dd>{formatTimestamp(lastSent.exportAt.toISOString())}</dd>
            </div>
            <div>
              <dt>Zakres</dt>
              <dd>Timesheety projekt × tydzień: godziny i nieobecności</dd>
            </div>
          </dl>
        </section>

        <ListCard
          title="Kategorie projektów"
          items={form.categories}
          used={used.cat}
          upper
          placeholder="Np. AUTOSTORE"
          onChange={(categories) => set({ categories })}
        />
        <ListCard title="Oddziały" items={form.branches} used={used.br} placeholder="Np. Hiszpania" onChange={(branches) => set({ branches })} />

        <section className="settings-card settings-card--wide">
          <h2>Zasady obsady</h2>
          <div className="settings-row settings-row--3">
            <Field label="Minimalny udział EPCIDO na projekcie" htmlFor="s-share" hint="UoP i B2B wśród wszystkich ludzi projektu">
              <div className="settings-range">
                <input id="s-share" type="range" min={0} max={100} step={5} value={form.minEpcidoShare} onChange={(e) => set({ minEpcidoShare: Number(e.target.value) })} />
                <b>{form.minEpcidoShare}%</b>
              </div>
            </Field>
            <Field label="Przerwa na wyjazd od" htmlFor="s-break" hint="Krótsza luka między zadaniami (np. weekend) nie jest przerwą">
              <div className="settings-pair">
                <TextInput id="s-break" type="number" min={1} max={30} value={form.breakMinDays} onChange={(e) => set({ breakMinDays: Number(e.target.value) })} />
                <span className="muted">{plural(form.breakMinDays, "dnia", "dni", "dni")}</span>
              </div>
            </Field>
            <Field label="„Długo bez przerwy” od" htmlFor="s-long" hint="Ostrzeżenie w Obsadzie">
              <div className="settings-pair">
                <TextInput id="s-long" type="number" min={2} max={52} value={form.longStretchWeeks} onChange={(e) => set({ longStretchWeeks: Number(e.target.value) })} />
                <span className="muted">tygodni</span>
              </div>
            </Field>
          </div>
        </section>
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  used,
  upper,
  placeholder,
  onChange,
}: {
  title: string;
  items: string[];
  used: Map<string, number>;
  upper?: boolean;
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = upper ? value.trim().toUpperCase() : value.trim();
    if (!v || items.some((i) => i.toLowerCase() === v.toLowerCase())) return;
    onChange([...items, v]);
    setValue("");
  };
  return (
    <section className="settings-card">
      <h2>
        {title} <em>{items.length}</em>
      </h2>
      <ul className="settings-list">
        {items.map((i) => {
          const n = used.get(i) ?? 0;
          return (
            <li key={i}>
              <span>{i}</span>
              {n > 0 && <em>{n} {plural(n, "projekt", "projekty", "projektów")}</em>}
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                disabled={n > 0}
                onClick={() => onChange(items.filter((x) => x !== i))}
                aria-label={`Usuń ${i}`}
                data-tip={n > 0 ? "Używane w projektach — najpierw zmień im wartość" : "Usuń"}
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="settings-add">
        <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === "Enter" && add()} aria-label={`Nowa pozycja: ${title}`} maxLength={30} />
        <button type="button" className="btn btn--secondary btn--sm" onClick={add} disabled={!value.trim()}>
          <Plus size={15} aria-hidden />
          Dodaj
        </button>
      </div>
    </section>
  );
}

import { formatMonthsShort } from "../domain/labels";
import { isEpcido } from "../domain/labels";
import type { Employee, ProjectCategory } from "../domain/types";
import { Segmented } from "./Segmented";
import { SelectMenu } from "./SelectMenu";

export type EmploymentFilter = "all" | "epcido" | "agency";

export interface PeopleFilterValue {
  employment: EmploymentFilter;
  /** Minimalny staż łącznie (miesiące) */
  minTotal: number;
  /** Minimalny staż w kategorii (miesiące) */
  minCategory: number;
  /** Kategoria dla stażu; null = dowolna (najdłuższy staż w jednej kategorii) */
  category: ProjectCategory | null;
}

export const EMPTY_PEOPLE_FILTER: PeopleFilterValue = { employment: "all", minTotal: 0, minCategory: 0, category: null };

export function passesPeopleFilter(e: Employee, f: PeopleFilterValue): boolean {
  if (f.employment === "epcido" && (!e.employment || !isEpcido(e))) return false;
  if (f.employment === "agency" && e.employment !== "AGENCY") return false;
  const exp = e.experience;
  if (f.minTotal > 0 && (exp?.totalMonths ?? 0) < f.minTotal) return false;
  if (f.minCategory > 0) {
    const v = f.category ? exp?.byCategory?.[f.category] ?? 0 : Math.max(0, ...Object.values(exp?.byCategory ?? {}));
    if (v < f.minCategory) return false;
  }
  return true;
}

const TOTAL_STEPS = [0, 6, 12, 24, 36, 60, 96, 120];
const CATEGORY_STEPS = [0, 3, 6, 12, 24, 36, 60];

/**
 * Filtry ludzi: EPCIDO / agencja i suwaki minimalnego stażu (łącznie i w kategorii projektów).
 * Wspólne dla Obsady i Ludzi.
 */
export function PeopleFilters({
  value,
  onChange,
  categories,
  lockedCategory,
  counts,
}: {
  value: PeopleFilterValue;
  onChange: (v: PeopleFilterValue) => void;
  categories: ProjectCategory[];
  /** Kategoria narzucona z góry (np. filtr kategorii w Obsadzie) */
  lockedCategory?: ProjectCategory | null;
  counts?: { all: number; epcido: number; agency: number };
}) {
  const category = lockedCategory ?? value.category;
  const set = (patch: Partial<PeopleFilterValue>) => onChange({ ...value, ...patch });
  const active = value.employment !== "all" || value.minTotal > 0 || value.minCategory > 0;
  return (
    <div className="pfilters" role="group" aria-label="Filtry ludzi">
      <Segmented<EmploymentFilter>
        label="Forma zatrudnienia"
        value={value.employment}
        onChange={(employment) => set({ employment })}
        options={[
          { value: "all", label: "Wszyscy", count: counts?.all },
          { value: "epcido", label: "EPCIDO", count: counts?.epcido },
          { value: "agency", label: "Agencja", count: counts?.agency },
        ]}
      />
      <Slider
        label="Staż łącznie"
        steps={TOTAL_STEPS}
        value={value.minTotal}
        onChange={(minTotal) => set({ minTotal })}
      />
      <div className="pfilters__cat">
        <Slider
          label={`Staż w ${category ?? "kategorii"}`}
          steps={CATEGORY_STEPS}
          value={value.minCategory}
          onChange={(minCategory) => set({ minCategory })}
        />
        {!lockedCategory && (
          <SelectMenu
            variant="quiet"
            compact
            ariaLabel="Kategoria stażu"
            value={value.category ?? "__any"}
            options={[{ value: "__any", label: "dowolnej" }, ...categories.map((c) => ({ value: c, label: c }))]}
            onChange={(v) => set({ category: v === "__any" ? null : v })}
          />
        )}
      </div>
      {active && (
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => onChange({ ...EMPTY_PEOPLE_FILTER })}>
          Wyczyść filtry
        </button>
      )}
    </div>
  );
}

function Slider({ label, steps, value, onChange }: { label: string; steps: number[]; value: number; onChange: (v: number) => void }) {
  const index = Math.max(0, steps.findIndex((s) => s >= value));
  return (
    <label className={`pslider ${value > 0 ? "is-active" : ""}`}>
      <span className="pslider__label">
        {label} <b>{value > 0 ? `od ${formatMonthsShort(value)}` : "dowolny"}</b>
      </span>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(steps[Number(e.target.value)])}
        aria-valuetext={value > 0 ? `od ${formatMonthsShort(value)}` : "dowolny"}
      />
    </label>
  );
}

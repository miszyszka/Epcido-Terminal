import { EMPLOYMENT_LABEL, EMPLOYMENT_LONG, POSITION_SHORT } from "../domain/labels";
import type { Employee, ProjectCategory } from "../domain/types";

/** Znacznik stanowiska: IM, SV, TL, E, M. Kolory marki, nigdy kolory stanów. Bez dymka. */
export function PositionMark({ employee }: { employee: Employee }) {
  return (
    <span className={`pos pos--${employee.position.toLowerCase()}`} aria-hidden>
      {POSITION_SHORT[employee.position]}
    </span>
  );
}

export function PersonChip({ employee }: { employee: Employee }) {
  return (
    <span className="chip">
      <PositionMark employee={employee} />
      <span className="chip__name">{employee.name}</span>
    </span>
  );
}

export function ProjectDot({ color }: { color: string }) {
  return <span className="project-dot" style={{ background: color }} aria-hidden />;
}

/** Forma zatrudnienia: UoP i B2B („nasi") pełne, agencja — obrysowana. */
export function EmploymentTag({ employee }: { employee: Employee }) {
  if (!employee.employment) return null;
  const e = employee.employment;
  return (
    <span className={`emp emp--${e.toLowerCase()}`} data-tip={EMPLOYMENT_LONG[e]}>
      {EMPLOYMENT_LABEL[e]}
    </span>
  );
}

/** Kategoria projektu jako mała etykieta. */
export function CategoryTag({ category }: { category: ProjectCategory }) {
  return <span className={`cat cat--${category.toLowerCase()}`}>{category}</span>;
}

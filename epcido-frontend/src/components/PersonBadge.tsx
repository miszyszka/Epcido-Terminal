import { POSITION_SHORT } from "../domain/labels";
import type { Employee } from "../domain/types";

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

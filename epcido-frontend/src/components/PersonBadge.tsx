import { POSITION_LABEL, POSITION_SHORT } from "../domain/labels";
import type { Employee } from "../domain/types";

/** Znacznik stanowiska: IM, SV, TL, E, M. Kolory marki, nigdy kolory stanów. */
export function PositionMark({ employee }: { employee: Employee }) {
  return (
    <span
      className={`pos pos--${employee.position.toLowerCase()}`}
      data-tip={POSITION_LABEL[employee.position] + (employee.position === "TEAM_LEADER" && employee.trade ? `, ${employee.trade === "ELECTRICAL" ? "elektryka" : "mechanika"}` : "")}
      aria-hidden
    >
      {POSITION_SHORT[employee.position]}
    </span>
  );
}

export function PersonChip({ employee, onClick }: { employee: Employee; onClick?: () => void }) {
  const content = (
    <>
      <PositionMark employee={employee} />
      <span className="chip__name">{employee.name}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="chip" onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className="chip">{content}</span>
  );
}

export function ProjectDot({ color }: { color: string }) {
  return <span className="project-dot" style={{ background: color }} aria-hidden />;
}

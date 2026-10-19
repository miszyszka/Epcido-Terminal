import { useUi } from "../app/UiContext";
import type { Employee } from "../domain/types";
import { PositionMark } from "./PersonBadge";

/**
 * Imię i nazwisko jako wejście do podglądu osoby. Klikalne wszędzie, gdzie pada nazwisko:
 * w tabelach, na planach, w kolejce zatwierdzania. Otwiera lekkie okno z tygodniem osoby,
 * jej godzinami i danymi — bez opuszczania bieżącego ekranu.
 */
export function PersonLink({
  employee,
  mark = true,
  className = "",
  children,
}: {
  employee: Employee;
  /** Znacznik stanowiska przed nazwiskiem */
  mark?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { openPerson } = useUi();
  return (
    <button
      type="button"
      className={`person-link ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        openPerson(employee.id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`Podgląd osoby: ${employee.name}`}
    >
      {mark && <PositionMark employee={employee} />}
      <span className="person-link__name">{children ?? employee.name}</span>
    </button>
  );
}

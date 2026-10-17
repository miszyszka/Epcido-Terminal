import { DAY_STATE_LABEL } from "../domain/labels";
import type { DayState } from "../domain/types";
import { DayCell } from "./DayCell";

const ORDER: DayState[] = ["approved", "pending", "absent", "off"];
const SHORT: Record<DayState, string> = {
  approved: "Zatwierdzone",
  pending: "Do zatwierdzenia",
  absent: "Nieobecny",
  off: "Wolne",
  missed: "Nie wysłane",
};

export function Legend() {
  return (
    <ul className="legend" aria-label="Legenda">
      {ORDER.map((s) => (
        <li key={s} className="legend__item">
          <DayCell state={s} size="legend" label={DAY_STATE_LABEL[s]} />
          <span>{SHORT[s]}</span>
        </li>
      ))}
      <li className="legend__item">
        <DayCell state="approved" size="legend" sent closed label="Tydzień zamknięty i wysłany do Dataverse — nienaruszalny" />
        <span>Wysłane (zamknięte)</span>
      </li>
      <li className="legend__item">
        <DayCell state="missed" size="legend" label="Błąd w zamkniętym timesheecie (brak zatwierdzenia albo wpisu) — timesheet nie został wysłany" />
        <span>Błąd — nie wysłany</span>
      </li>
    </ul>
  );
}

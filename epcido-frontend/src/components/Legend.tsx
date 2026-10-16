import { DAY_STATE_LABEL } from "../domain/labels";
import type { DayState } from "../domain/types";
import { DayCell } from "./DayCell";

const ORDER: DayState[] = ["approved", "pending", "absent", "off"];
const SHORT: Record<DayState, string> = {
  approved: "Zatwierdzone",
  pending: "Czeka",
  absent: "Nieobecny",
  off: "Wolne",
};

export function Legend() {
  return (
    <ul className="legend" aria-label="Legenda kolorów dni">
      {ORDER.map((s) => (
        <li key={s} className="legend__item">
          <DayCell state={s} size="mini" label={DAY_STATE_LABEL[s]} />
          <span>{SHORT[s]}</span>
        </li>
      ))}
    </ul>
  );
}

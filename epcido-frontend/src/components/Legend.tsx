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
        <DayCell state="approved" size="legend" sent label="Wysłane do Dataverse" />
        <span>Wysłane do Dataverse</span>
      </li>
      <li className="legend__item">
        <DayCell state="missed" size="legend" label="Nie zatwierdzone do poniedziałku 23:59 — nie wysłane do Dataverse" />
        <span>Nie wysłane</span>
      </li>
    </ul>
  );
}

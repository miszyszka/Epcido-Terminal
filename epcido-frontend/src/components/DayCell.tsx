import type { DayState } from "../domain/types";

interface DayCellProps {
  state: DayState;
  size?: "map" | "timeline" | "mini";
  /** Mała kropka w rogu: ktoś był nieobecny w dniu zbiorczym */
  flag?: boolean;
  today?: boolean;
  future?: boolean;
  /** Treść dymka i opisu dla czytników ekranu */
  label: string;
  style?: React.CSSProperties;
}

/** Kropka dnia — ten sam obiekt na mapie, osi czasu i w kalendarzu (brandbook 2.3 i 6). */
export function DayCell({ state, size = "map", flag, today, future, label, style }: DayCellProps) {
  const cls = [
    "day",
    `day--${state}`,
    `day--${size}`,
    flag ? "day--flag" : "",
    today ? "day--today" : "",
    future ? "day--future" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} data-tip={label} role="img" aria-label={label} style={style} />;
}

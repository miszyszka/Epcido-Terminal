import { Minus, Plus } from "lucide-react";
import { formatMinutes } from "../lib/dates";

export const BREAK_OPTIONS = [0, 15, 30, 45, 60];

/** Godzina z krokami co 15 minut — duże przyciski, wygodne na telefonie. */
export function TimeStepper({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const set = (v: number) => onChange(Math.min(24 * 60 - 15, Math.max(0, v)));
  return (
    <div className={`stepper ${compact ? "stepper--compact" : ""}`} role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <span className="stepper__value" aria-live="polite">
        {formatMinutes(value)}
      </span>
      <div className="stepper__buttons">
        <button type="button" onClick={() => set(value - 15)} aria-label={`${label}: 15 minut wcześniej`}>
          <Minus size={compact ? 16 : 20} />
        </button>
        <button type="button" onClick={() => set(value + 15)} aria-label={`${label}: 15 minut później`}>
          <Plus size={compact ? 16 : 20} />
        </button>
      </div>
    </div>
  );
}

/** Przerwa w minutach — wybór jednym dotknięciem. */
export function BreakChoice({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="break-choice" role="radiogroup" aria-label="Przerwa">
      <span className="break-choice__label">Przerwa (minuty)</span>
      <div className="break-choice__options">
        {BREAK_OPTIONS.map((b) => (
          <button key={b} type="button" role="radio" aria-checked={value === b} className={value === b ? "is-selected" : ""} onClick={() => onChange(b)}>
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

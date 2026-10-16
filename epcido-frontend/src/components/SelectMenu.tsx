import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { usePopover } from "./usePopover";

export interface MenuOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface SelectMenuProps<T extends string> {
  value: T | null;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** Opis dla czytników ekranu, gdy brak widocznej etykiety */
  ariaLabel?: string;
  id?: string;
  invalid?: boolean;
  /** field = jak pole formularza, quiet = bez obrysu, action = przycisk akcji z własnym tekstem */
  variant?: "field" | "quiet" | "action";
  /** Tekst przycisku w wariancie action */
  actionLabel?: ReactNode;
  compact?: boolean;
  disabled?: boolean;
}

/** Lista wyboru w stylu aplikacji — zastępuje systemową listę <select> (brandbook 6). */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Wybierz",
  ariaLabel,
  id,
  invalid,
  variant = "field",
  actionLabel,
  compact,
  disabled,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  const style = usePopover(open, trigger, pop, close, { matchWidth: variant !== "action" });

  const selected = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const openMenu = () => {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : enabled[0] ?? 0);
    setOpen(true);
  };
  const choose = (o: MenuOption<T>) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const move = (delta: number) => {
    const pos = enabled.indexOf(active);
    const next = enabled[Math.min(enabled.length - 1, Math.max(0, pos + delta))];
    if (next !== undefined) {
      setActive(next);
      pop.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const headers = options.map((o, i) => (o.group && o.group !== options[i - 1]?.group ? o.group : null));
  const cls =
    variant === "action"
      ? `btn btn--secondary ${compact ? "btn--sm" : ""}`
      : `control control--button ${variant === "quiet" ? "control--quiet" : ""} ${compact ? "control--compact" : ""} ${invalid ? "is-invalid" : ""}`;

  return (
    <>
      <button
        type="button"
        id={id}
        ref={trigger}
        className={`menu-trigger ${cls}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        {variant === "action" ? (
          actionLabel
        ) : (
          <span className={`menu-trigger__value ${selected ? "" : "control__placeholder"}`}>
            {selected?.icon}
            {selected ? selected.label : placeholder}
          </span>
        )}
        <ChevronDown size={16} aria-hidden className="control__icon" />
      </button>
      {open &&
        createPortal(
          <div className="popover menu" ref={pop} style={style} role="listbox" id={listId} aria-label={ariaLabel} onKeyDown={onKeyDown}>
            {options.length === 0 && <p className="menu__empty">Brak pozycji</p>}
            {options.map((o, i) => {
              const header = headers[i];
              return (
                <div key={`${o.value}-${i}`}>
                  {header && <div className="menu__group">{header}</div>}
                  <div
                    role="option"
                    data-index={i}
                    aria-selected={o.value === value}
                    aria-disabled={o.disabled}
                    className={`menu__item ${i === active ? "is-active" : ""} ${o.value === value ? "is-selected" : ""} ${o.disabled ? "is-disabled" : ""}`}
                    onPointerEnter={() => !o.disabled && setActive(i)}
                    onClick={() => choose(o)}
                  >
                    {o.icon}
                    <span className="menu__label">{o.label}</span>
                    {o.hint && <span className="menu__hint">{o.hint}</span>}
                    {o.value === value && <Check size={16} className="menu__check" aria-hidden />}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

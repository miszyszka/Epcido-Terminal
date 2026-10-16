import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/**
 * Pozycjonowanie elementu pływającego (lista, kalendarz) względem przycisku.
 * Element jest renderowany w <body>, więc nie przycina go żaden przewijany kontener.
 * Otwiera się w dół, a gdy brak miejsca — w górę. Zamyka się po kliknięciu obok i Escape.
 */
export function usePopover(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  pop: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts: { matchWidth?: boolean; deps?: unknown[] } = {}
) {
  const [style, setStyle] = useState<React.CSSProperties>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const h = pop.current?.offsetHeight ?? 320;
      const w = Math.max(pop.current?.offsetWidth ?? 240, opts.matchWidth ? r.width : 0);
      const below = window.innerHeight - r.bottom >= h + 12 || r.top < h + 12;
      setStyle({
        top: below ? r.bottom + 6 : Math.max(8, r.top - h - 6),
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
        ...(opts.matchWidth ? { minWidth: r.width } : {}),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...(opts.deps ?? [])]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !pop.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, trigger, pop]);

  return style;
}

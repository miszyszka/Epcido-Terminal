import { useEffect, useRef, useState } from "react";

/**
 * Jeden dymek dla całej aplikacji. Element pokazuje dymek, jeśli ma atrybut data-tip.
 * Delegacja zdarzeń zamiast tysięcy osobnych komponentów — siatki mają po kilka tysięcy kropek.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const show = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest("[data-tip]") : null;
      if (el === current.current) return;
      current.current = el;
      if (!el) return setTip(null);
      const text = el.getAttribute("data-tip");
      if (!text) return setTip(null);
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const over = (e: Event) => show(e.target);
    const hide = () => {
      current.current = null;
      setTip(null);
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", over);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("pointerdown", hide);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", over);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("pointerdown", hide);
    };
  }, []);

  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 120), window.innerWidth - 120);
  return (
    <div
      className={`tooltip ${tip.below ? "tooltip--below" : ""}`}
      style={{ left, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  );
}

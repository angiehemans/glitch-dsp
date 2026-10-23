import { useEffect, useRef } from "preact/hooks";
import { onMeters } from "../store/glitch";

const FLOOR_DB = -60;
const CEIL_DB = 6;

/**
 * Returns a ref for a meter's root element. Writes `--level` (0..1) at meter rate without
 * re-rendering, and sets `data-clip` at or above 0 dBFS. Clip stays latched until the element is clicked.
 */
export function useMeter(key: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resetClip = () => el.removeAttribute("data-clip");
    el.addEventListener("click", resetClip);
    const unsubscribe = onMeters(({ levels }) => {
      const db = levels[key];
      if (db === undefined) return;
      const level = Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));
      el.style.setProperty("--level", level.toFixed(3));
      if (db >= 0) el.setAttribute("data-clip", "");
    });
    return () => {
      unsubscribe();
      el.removeEventListener("click", resetClip);
    };
  }, [key]);

  return ref;
}

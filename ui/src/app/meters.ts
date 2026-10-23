import { onMeters } from "../store/glitch";

const FLOOR_DB = -60;
const CEIL_DB = 6;

/**
 * Also drives CPU bars ([data-cpu-meter]). Drives every element with a `data-meter="<key>"` attribute (key from the meters event, e.g. "in:1",
 * "chain:<id>:out"): writes `--level` (0..1) without re-rendering, and sets `data-clip` at or above
 * 0 dBFS. Clip stays latched until the meter is clicked.
 */
export function startMeters() {
  onMeters(({ levels, cpu }) => {
    // CPU bars: linear 0..1, on any element marked data-cpu-meter (TopBar's CPU track).
    document.querySelectorAll<HTMLElement>("[data-cpu-meter]").forEach((el) => {
      el.style.setProperty("--level", Math.min(1, Math.max(0, cpu)).toFixed(3));
    });

    document.querySelectorAll<HTMLElement>("[data-meter]").forEach((el) => {
      const db = levels[el.dataset.meter!];
      if (db === undefined) return;
      el.style.setProperty("--level", Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB))).toFixed(3));
      if (db >= 0) el.setAttribute("data-clip", "");
    });
  });

  document.addEventListener("click", (e) => {
    (e.target as Element).closest?.("[data-meter][data-clip]")?.removeAttribute("data-clip");
  });
}

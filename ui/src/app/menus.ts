/**
 * Closes open menus on a press anywhere outside them. Scamp's runtime applies a component's
 * data-scamp-outside rules ("menu:open=closed …") only for presses outside the whole component, so a
 * chain's add menu stayed open while you clicked another pedal in that chain. This applies the same rules
 * to presses inside the component too, except in one of its own menus or on one of its own buttons that
 * open or close them (their data-scamp-click rules handle those).
 */
export function closeMenusOnOutsidePress(doc: Document) {
  doc.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target as Element;
      for (const root of doc.querySelectorAll<HTMLElement>("[data-scamp-outside]")) {
        if (!root.contains(target)) continue; // outside it: the runtime closes its menus
        const own = (el: Element | null) => !!el && el.closest("[data-scamp-outside]") === root;
        if (own(target.closest('[role="menu"]')) || own(target.closest("[data-scamp-click]"))) continue;
        for (const rule of (root.dataset.scampOutside ?? "").split(/\s+/).filter(Boolean)) {
          const [axis, changes = ""] = rule.split(":");
          for (const change of changes.split(",")) {
            const [from, to] = change.split("=");
            if (root.getAttribute(`data-${axis}`) === from) {
              root.setAttribute(`data-${axis}`, to);
              break;
            }
          }
        }
      }
    },
    true,
  );
}

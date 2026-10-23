import { signal } from "@preact/signals";

/** Current path + query, e.g. "/rig?project=ab12". */
export const route = signal(location.pathname + location.search);

export function navigate(to: string) {
  history.pushState(null, "", to);
  route.value = to;
}

export function startRouter() {
  addEventListener("popstate", () => (route.value = location.pathname + location.search));

  // Scamp's views link with plain <a href="/...">. Handle those in-page instead of reloading,
  // so state (and the mock engine in a browser) survives navigation.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element).closest?.("a");
    const href = link?.getAttribute("href");
    if (!link || !href?.startsWith("/") || link.target) return;
    e.preventDefault();
    navigate(href);
  });
}

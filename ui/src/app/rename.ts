import { effect } from "@preact/signals";
import { glitch, send } from "../store/glitch";
import { cancelPendingNavigation } from "./router";

/**
 * Double-click any element with data-rename="project:<id>", "chain:<id>", "preset:<id>" or "song:<id>" to edit its text in place
 * (contenteditable keeps Scamp's styling). Enter or clicking away saves, Escape cancels. The engine
 * is the source of truth: on save the text waits for the state that carries the new name.
 */
type Done = (how: "enter" | "blur" | "cancel") => void;

function startRenaming(el: HTMLElement, onDone?: Done) {
  if (el.isContentEditable) return;
  const [kind, id] = (el.dataset.rename ?? "").split(":");
  if (!id || !["project", "chain", "preset", "song"].includes(kind)) return;

  const original = el.textContent ?? "";
  // A name inside a button (the top bar's preset): while editing, a space or a click in the text
  // would press the button.
  const host = el.closest("button");
  const block = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  host?.addEventListener("click", block, true);
  el.contentEditable = "plaintext-only";
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);

  const finish = (how: "enter" | "blur" | "cancel") => {
    el.removeEventListener("keydown", onKey);
    el.removeEventListener("blur", onBlur);
    host?.removeEventListener("click", block, true);
    el.contentEditable = "false";
    const name = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (how === "cancel" || !name || name === original) {
      el.textContent = original;
    } else if (kind === "project") {
      send({ type: "project.rename", projectId: id, name });
    } else if (kind === "preset") {
      send({ type: "preset.rename", presetId: id, name });
    } else if (kind === "song") {
      send({ type: "song.rename", songId: id, title: name });
    } else {
      send({ type: "chain.rename", chainId: id, name });
    }
    onDone?.(how);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish("enter");
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also close Scamp menus
      finish("cancel");
    }
  };
  const onBlur = () => finish("blur");
  el.addEventListener("keydown", onKey);
  el.addEventListener("blur", onBlur);
}

/** The visible element for a key: the same project can be named in a hidden header and on its card. */
function findVisible(key: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-rename="${CSS.escape(key)}"]`)].find((el) => el.getClientRects().length > 0);
}

/** Start renaming the element for a key ("project:<id>"), e.g. from a menu's Rename item. */
export function renameByKey(key: string) {
  const el = findVisible(key);
  if (el) startRenaming(el);
}

/**
 * Start renaming the next project or chain to appear (after project.create / chain.create), so new
 * things get a name straight away.
 */
export function renameWhenCreated(kind: "project" | "chain" | "preset", onDone?: (id: string, how: "enter" | "blur" | "cancel") => void) {
  const ids = (s = glitch.value) => (kind === "project" ? s?.projects : kind === "preset" ? s?.presets : s?.chains)?.map((x) => x.id) ?? [];
  const known = new Set(ids());
  const dispose = effect(() => {
    const added = ids(glitch.value).find((id) => !known.has(id));
    if (!added) return;
    queueMicrotask(() => dispose());
    // After Preact renders the new item.
    requestAnimationFrame(() => {
      const el = findVisible(`${kind}:${added}`);
      if (el) startRenaming(el, (how) => onDone?.(added, how));
    });
  });
  setTimeout(dispose, 5000); // never left waiting if the engine refused
}

export function startRename() {
  document.addEventListener("dblclick", (e) => {
    const el = (e.target as Element).closest?.<HTMLElement>("[data-rename]");
    if (!el?.dataset.rename) return;
    e.preventDefault();
    cancelPendingNavigation(); // the first click of a double-click on a project name
    startRenaming(el);
  });
}

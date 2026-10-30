import type { AbyBlock, ActionRef, Block, GlitchState } from "@glitch/protocol";
import FootswitchPanel from "@scamp/components/FootswitchPanel/FootswitchPanel";
import { useRef, useState } from "preact/hooks";
import { send } from "../../store/glitch";

/** Everything a switch can do in this rig, labelled, for a switch's menu: presets first. */
function assignable(state: GlitchState): { name: string; action: ActionRef }[] {
  const list: { name: string; action: ActionRef }[] = [];
  for (const p of state.presets) list.push({ name: `Preset: ${p.name}`, action: { type: "preset.load", presetId: p.id } });
  list.push({ name: "Next preset", action: { type: "preset.next" } }, { name: "Previous preset", action: { type: "preset.prev" } });
  for (const c of state.chains) {
    const pedal = (b: Block) => list.push({ name: `${c.name} · ${b.name}`, action: { type: "block.toggle", blockId: b.id } });
    for (const b of c.blocks) {
      if (b.type !== "aby") {
        pedal(b);
        continue;
      }
      const aby = b as AbyBlock;
      [...aby.pathA.blocks, ...aby.pathB.blocks].forEach(pedal);
      list.push({ name: `${c.name} · ABY A/B`, action: { type: "aby.toggleAB", blockId: aby.id } });
      list.push({ name: `${c.name} · ABY Y`, action: { type: "aby.toggleY", blockId: aby.id } });
    }
    list.push({ name: `Mute ${c.name}`, action: { type: "chain.toggleMute", chainId: c.id } });
  }
  list.push(
    { name: "Play / stop the song", action: { type: "transport.toggle" } },
    { name: "Next song (in the setlist)", action: { type: "transport.next" } },
    { name: "Previous song", action: { type: "transport.prev" } },
    { name: "Restart the song", action: { type: "transport.restart" } },
    { name: "Tune mode (mute all but vocals, open the tuner)", action: { type: "tune.toggle" } },
    { name: "Panic (mute all outputs)", action: { type: "panic.toggle" } },
    { name: "Next page", action: { type: "page.next" } },
  );
  return list;
}

/** What an action is called on a switch, and whether its target is on (lit). */
export function describe(state: GlitchState, action: ActionRef | null): { label: string; lit: boolean } {
  if (!action) return { label: "—", lit: false };
  const blocks = state.chains.flatMap((c) =>
    c.blocks.flatMap((b) => (b.type === "aby" ? [b, ...(b as AbyBlock).pathA.blocks, ...(b as AbyBlock).pathB.blocks] : [b])),
  );
  const block = blocks.find((b) => b.id === action.blockId);
  const chain = state.chains.find((c) => c.id === action.chainId);
  switch (action.type) {
    case "block.toggle":
      return { label: block?.name ?? "Missing block", lit: !!block?.enabled };
    case "chain.toggleMute":
      return { label: `Mute ${chain?.name ?? "chain"}`, lit: !!chain?.muted };
    case "preset.load": {
      const preset = state.presets.find((p) => p.id === action.presetId);
      return { label: preset?.name ?? "Missing preset", lit: preset?.id === state.currentPresetId };
    }
    case "preset.next":
      return { label: "Next preset", lit: false };
    case "preset.prev":
      return { label: "Previous preset", lit: false };
    case "aby.toggleAB":
      return { label: "ABY A/B", lit: (block as AbyBlock | undefined)?.active === "B" };
    case "aby.toggleY":
      return { label: "ABY Y", lit: (block as AbyBlock | undefined)?.mode === "Y" };
    case "aby.select":
      return { label: `ABY ${action.path}`, lit: (block as AbyBlock | undefined)?.active === action.path };
    case "page.next":
      return { label: "Next page", lit: false };
    case "panic.toggle":
      return { label: "Panic", lit: state.panic };
    case "tune.toggle":
      return { label: "Tune mode", lit: state.tuneMode.active };
    case "transport.toggle":
      return { label: "Play / stop", lit: state.transport.playing };
    case "transport.next":
      return { label: "Next song", lit: false };
    case "transport.prev":
      return { label: "Previous song", lit: false };
    case "transport.restart":
      return { label: "Restart song", lit: false };
    default:
      return { label: action.type, lit: false };
  }
}

const sameAction = (a: ActionRef | null | undefined, b: ActionRef) => !!a && JSON.stringify(a) === JSON.stringify(b);
export const parseSwitch = (id: string) => {
  const [channel, cc] = id.split(":").map(Number);
  return { channel, cc };
};
/** Switches found, plus any mapped in a project from elsewhere, sorted; named A, B, C… by CC. */
export function listSwitches({ midi, mappings }: GlitchState) {
  const ids = [...new Set([...midi.switches, ...mappings.map((m) => m.switch)].map((s) => `${s.channel}:${s.cc}`))].sort(
    (a, b) => parseSwitch(a).channel - parseSwitch(b).channel || parseSwitch(a).cc - parseSwitch(b).cc,
  );
  const name = (id: string) => (ids.indexOf(id) < 26 ? String.fromCharCode(65 + ids.indexOf(id)) : `CC ${parseSwitch(id).cc}`);
  const mappingOf = (id: string) => mappings.find((m) => `${m.switch.channel}:${m.switch.cc}` === id && m.page === midi.page);
  // On the page past the last one, which is where a new page starts, it counts too.
  return { ids, name, mappingOf, pages: Math.max(midi.pageCount, midi.page + 1) };
}

/**
 * Handlers for a wrapper around switch tiles (elements with data-switch): a tile pressed with the mouse
 * (or Enter/Space) is the switch pressed, down then up, so holds work too.
 */
export function useSwitchPress() {
  const pressed = useRef<string | null>(null);
  const press = (id: string | null | undefined, down: boolean) => {
    if (!id || (down ? pressed.current : pressed.current !== id)) return;
    pressed.current = down ? id : null;
    send({ type: "footswitch.press", ...parseSwitch(id), down });
  };
  const tileOf = (e: Event) => (e.target as Element).closest<HTMLElement>("[data-switch]");
  return {
    onPointerDown: (e: PointerEvent) => {
      const tile = tileOf(e);
      if (!tile || e.button !== 0) return;
      tile.setPointerCapture(e.pointerId); // its release comes here even off the tile
      press(tile.dataset.switch, true);
    },
    onPointerUp: () => press(pressed.current, false),
    onPointerCancel: () => press(pressed.current, false),
    onKeyDown: (e: KeyboardEvent) => {
      const tile = tileOf(e);
      if (!tile || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault(); // Space would scroll
      if (!e.repeat) press(tile.dataset.switch, true);
    },
    onKeyUp: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && press(tileOf(e)?.dataset.switch, false),
  };
}

/** It sends Program Change (cc past 127, see Footswitch.h): a press with no release, so it can't hold. */
const tapOnly = (id: string) => parseSwitch(id).cc >= 128;

/**
 * The footswitch: MIDI input and pages, and a tile per switch found on the device (pressed at least
 * once, since MIDI doesn't list them). Clicking a tile presses the switch; its Edit opens its menu: what its tap and hold do.
 */
export function FootswitchView({ state }: { state: GlitchState }) {
  const { midi } = state;
  const [editing, setEditing] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null); // the switch whose Forget was clicked once
  const actions = assignable(state);
  const { ids, name, mappingOf, pages } = listSwitches(state);
  const open = editing && ids.includes(editing) ? editing : null;
  const pressing = useSwitchPress();
  const current = open ? mappingOf(open) : undefined;
  const set = (gesture: "tap" | "hold") => (id: string) => {
    const action = actions[Number(id)]?.action;
    if (!open || !action) return;
    // Picking what it already does clears it.
    if (sameAction(current?.[gesture], action)) send({ type: "mapping.clear", ...parseSwitch(open), page: midi.page, gesture });
    else send({ type: "mapping.set", ...parseSwitch(open), page: midi.page, gesture, action });
  };
  const clear = (gesture: "tap" | "hold") => () => open && send({ type: "mapping.clear", ...parseSwitch(open), page: midi.page, gesture });

  return (
    <div
      class="gl-footswitch"
      {...pressing}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(null);
        pressing.onKeyDown(e);
      }}
    >
      <FootswitchPanel
        editing={open ? "open" : "closed"}
        connected={midi.connected ? "on" : "off"}
        deviceName={midi.device ? (midi.connected ? midi.device : `${midi.device} (not connected)`) : "No MIDI input"}
        devices={midi.devices.map((d, i) => ({ id: String(i), name: d, current: d === midi.device }))}
        pageLabel={`PAGE ${midi.page + 1} / ${pages}`}
        switches={ids.map((id) => {
          const m = mappingOf(id);
          const tap = describe(state, m?.tap ?? null);
          const hold = tapOnly(id) && !m?.hold ? { label: "Tap only", lit: false } : describe(state, m?.hold ?? null);
          return {
            id,
            name: name(id),
            label: `Press switch ${name(id)}: tap ${tap.label}, hold ${hold.label}`,
            editLabel: `Choose what switch ${name(id)} does`,
            lit: tap.lit ? "on" : "off",
            editing: id === open ? "on" : "off",
            tap: tap.label,
            hold: hold.label,
          };
        })}
        editTitle={
          open ? `SWITCH ${name(open)} · PAGE ${midi.page + 1}${tapOnly(open) ? " · SENDS PROGRAM CHANGE, SO TAP ONLY: SET THE PEDAL TO MOMENTARY CC FOR HOLD" : ""}` : ""
        }
        canClearTap={!!current?.tap}
        canClearHold={!!current?.hold}
        forgetLabel={open && forgetting === open ? `Forget ${name(open)} and its mappings?` : "Forget switch"}
        forgetConfirm={open && forgetting === open ? "on" : "off"}
        onForget={() => {
          if (!open) return;
          if (forgetting !== open) return setForgetting(open);
          send({ type: "midi.forgetSwitch", ...parseSwitch(open) });
          setForgetting(null);
          setEditing(null);
        }}
        actions={actions.map((a, i) => ({
          id: String(i),
          name: a.name,
          tap: sameAction(current?.tap, a.action) ? "on" : "off",
          hold: sameAction(current?.hold, a.action) ? "on" : "off",
        }))}
        noSwitches={ids.length === 0}
        onSelectDevice={(id) => send({ type: "midi.selectDevice", name: midi.devices[Number(id)] })}
        onNoDevice={() => send({ type: "midi.selectDevice", name: null })}
        onPrevPage={() => send({ type: "footswitch.setPage", page: (midi.page + pages - 1) % pages })}
        onNextPage={() => send({ type: "footswitch.setPage", page: midi.page + 1 < pages ? midi.page + 1 : midi.page < midi.pageCount ? midi.pageCount : 0 })}
        onEditSwitch={(id) => {
          setForgetting(null);
          setEditing(id === open ? null : id);
        }}
        onClearTap={clear("tap")}
        onClearHold={clear("hold")}
        onDone={() => {
          setForgetting(null);
          setEditing(null);
        }}
        onSetTap={set("tap")}
        onSetHold={set("hold")}
      />
    </div>
  );
}

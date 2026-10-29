import type { ComponentChildren } from "preact";
import { SILENCE_DB, type AbyBlock, type Block, type Chain, type GlitchState, type OutputRef } from "@glitch/protocol";
import AbyFork from "@scamp/components/AbyFork/AbyFork";
import AbyPedal from "@scamp/components/AbyPedal/AbyPedal";
import BlockTile from "@scamp/components/BlockTile/BlockTile";
import ChainStrip from "@scamp/components/ChainStrip/ChainStrip";
import Rig from "@scamp/views/Rig/Rig";
import { send } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { renameByKey, renameWhenCreated } from "../rename";
import { FootswitchView } from "./FootswitchView";

type ChainColor = "orange" | "cyan" | "pink" | "lime" | "violet";

export const outputLabel = (channels: number[]) => `Out ${channels.join("/")}`;

/** Output choices for a device with n outputs: stereo pairs first, then each output alone. */
export function outputChoices(n: number): number[][] {
  const pairs = Array.from({ length: Math.floor(n / 2) }, (_, i) => [i * 2 + 1, i * 2 + 2]);
  const singles = Array.from({ length: n }, (_, i) => [i + 1]);
  return [...pairs, ...singles];
}

/** The chain's last block when it's an ABY: only that one can split to separate outputs. */
const endAby = (chain: Chain) => {
  const last = chain.blocks[chain.blocks.length - 1];
  return last?.type === "aby" ? (last as AbyBlock) : undefined;
};

/**
 * Dropdown rows for a chain's input and output chips. Ids are the channel numbers ("2", "1-2"). A chain
 * ending in an ABY also gets a row to split or merge it, and a split lists each path's choices ("A:1-2").
 */
function ioOptions(chain: Chain, inputNames: string[], outputNames: string[]) {
  const choices = outputNames.length ? outputChoices(outputNames.length) : []; // none open: say so, don't invent a pair
  const rows = (prefix: string, current: OutputRef[] | undefined) =>
    choices.map((channels) => ({
      id: prefix + channels.join("-"),
      label: prefix.replace(":", " · ") + outputLabel(channels),
      detail: channels.map((ch) => outputNames[ch - 1] ?? `Output ${ch}`).join(" / "),
      current: channels.join("-") === current?.[0]?.hwChannels.join("-"),
    }));
  const aby = endAby(chain);
  const split = aby?.exit === "split" ? aby.splitOutputs : undefined;
  // Split: the A chip's menu has A's choices and the way back to a merge; the B chip's has B's.
  const outputs = split
    ? [...rows("A:", split.A), { id: "exit:merge", label: "Merge A and B", detail: "Both paths to one output", current: false }]
    : [...rows("", chain.outputs), ...(aby ? [{ id: "exit:split", label: "Split A and B", detail: "Each path to its own outputs", current: false }] : [])];
  return {
    inputs: (inputNames.length ? inputNames : ["Input 1"]).map((name, i) => ({
      id: String(i + 1),
      label: `In ${i + 1}`,
      detail: name,
      current: chain.inputs[0].hwChannel === i + 1,
    })),
    outputs,
    outputsB: split ? rows("B:", split.B) : [],
  };
}

const PLUGIN_IMAGE = "/assets/plugin.svg";

const FINISHES = ["orange", "black", "cream", "blue", "red", "hammer", "green", "purple"] as const;
/** A pedal finish that stays with the block: picked from its id. */
export const finishOf = (id: string) => FINISHES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % FINISHES.length];

/** The small type line under a pedal's name. */
const kindOf = (b: Block) =>
  b.type === "nam" ? "NAM model" : b.type === "ir" ? "Cab IR" : b.type === "plugin" ? b.plugin?.manufacturer || b.plugin?.format || "Plugin" : b.type;

function blockState(b: Block) {
  if (b.missing) return "error";
  return b.enabled ? "active" : "bypassed";
}

/**
 * A block in a chain as a pedal (a slim one inside an ABY path), with the plugin window's snapshot
 * on its face when there is one. Its stomp switch bypasses it; clicking its face opens the plugin's
 * own window (native: it can't render in the WebView) for everything else.
 */
function BlockView({ block, snapshotBase, small = false }: { block: Block; snapshotBase: string; small?: boolean }) {
  // Engine-captured picture of the plugin's window; the version busts the image cache after each capture.
  const art = block.snapshotAt && snapshotBase ? `${snapshotBase}${block.id}.png?v=${block.snapshotAt}` : "";

  return (
    <BlockTile
      state={blockState(block)}
      size={small ? "small" : "regular"}
      finish={finishOf(block.id)}
      name={block.name}
      kind={kindOf(block)}
      bypassLabel={block.enabled ? "Bypass" : "Turn on"}
      onOpen={() => send({ type: "block.openEditor", blockId: block.id })}
      onBypass={() => send({ type: "block.toggle", blockId: block.id })}
      onRemove={() => send({ type: "block.remove", blockId: block.id })}
    >
      {art && <img class="gl-block-art" src={art} alt="" draggable={false} />}
    </BlockTile>
  );
}

type MenuRow = { id: string; name: string; kind: string; image: string };
const ABY_ROW: MenuRow = { id: "aby", name: "ABY splitter", kind: "Built-in · split into paths A and B", image: PLUGIN_IMAGE };

/** Adds the block a + menu row stands for ("nam:<file>", "ir:<file>", "plugin:<id>"), to the chain or into an ABY path. */
function addFromMenu(chainId: string, rowId: string, into?: { abyId: string; path: "A" | "B" }) {
  // A lane's in-between + opened this menu: add at its spot.
  const spot = insertAt;
  insertAt = null;
  const index = spot && spot.chainId === chainId && spot.abyId === into?.abyId && spot.path === into?.path ? spot.index : undefined;

  if (rowId === ABY_ROW.id) return send({ type: "chain.splitAt", chainId, index });
  const [kind, ...rest] = rowId.split(":");
  const ref = rest.join(":"); // plugin ids and file names can contain ":"
  send({
    type: "block.add",
    chainId,
    block: kind === "plugin" ? { type: "plugin", pluginId: ref } : { type: kind as "nam" | "ir", file: ref },
    index,
    ...into,
  });
}

/** Set by a lane's in-between +, which then opens the chain's or path's own + menu. */
let insertAt: { chainId: string; abyId?: string; path?: "A" | "B"; index: number } | null = null;
// The real + buttons add at the end: a click on one by hand (not ours, which isn't trusted) forgets the spot.
document.addEventListener("click", (e) => e.isTrusted && (e.target as Element).closest?.('[data-scamp-id^="add_"]') && (insertAt = null), true);

/** Blocks in a chain, counting those inside ABY paths but not the ABY itself. */
const blockCount = (c: Chain) =>
  c.blocks.reduce((n, b) => n + (b.type === "aby" ? (b as AbyBlock).pathA.blocks.length + (b as AbyBlock).pathB.blocks.length : 1), 0);

/**
 * Wraps a tile or ABY so it can be dragged by its grip (its Scamp id starts "grip_"), so clicks on the
 * tile still open it. Dragging follows the pointer by hand: JUCE's Linux WebView never delivers
 * HTML drag-and-drop events.
 */
function Draggable({ id, children }: { id: string; children: ComponentChildren }) {
  return (
    <div class="gl-drag" onPointerDown={(e) => startDrag(e, id)}>
      {children}
    </div>
  );
}

function startDrag(down: PointerEvent, blockId: string) {
  if (down.button !== 0 || !(down.target as Element).closest('[data-scamp-id^="grip_"]')) return;
  down.preventDefault(); // no text selection
  down.stopPropagation(); // an ABY's wrapper holds its paths' tiles

  // A small copy of the pedal follows the pointer: the ABY's pedal, or the block's.
  const wrapper = down.currentTarget as HTMLElement;
  const abyPedal = wrapper.querySelector('[aria-label="ABY splitter pedal"]');
  const source = abyPedal ?? wrapper.querySelector('[data-scamp-id="root"]');
  let preview: HTMLElement | null = null;
  let lane: HTMLElement | null = null;

  const move = (e: PointerEvent) => {
    if (!preview) {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < 4) return; // still a click
      preview = (source?.cloneNode(true) as HTMLElement) ?? document.createElement("div");
      preview.classList.add("gl-drag-preview");
      // Inline: the pedal's own Scamp class (position: relative) loads after app.css. Half size.
      Object.assign(preview.style, { position: "fixed", top: "0", left: "0", margin: "0", scale: "0.5" });
      document.body.append(preview);
      document.body.classList.add("gl-dragging");
    }
    preview.style.translate = `${e.clientX - preview.offsetWidth / 2}px ${e.clientY - preview.offsetHeight / 2}px`;

    lane?.removeAttribute("data-over");
    lane = laneAt(e.clientX, e.clientY, !!abyPedal);
    if (lane) {
      lane.dataset.over = "";
      lane.style.setProperty("--drop-x", `${spot(lane, e.clientX).x}px`);
    }
  };
  const end = (e: PointerEvent | KeyboardEvent) => {
    removeEventListener("pointermove", move, true);
    removeEventListener("pointerup", end, true);
    removeEventListener("keydown", escape);
    lane?.removeAttribute("data-over");
    preview?.remove();
    document.body.classList.remove("gl-dragging");
    if (!preview || !lane || !(e instanceof PointerEvent)) return; // a click, a drop outside, or Escape
    const { chain, aby, path } = lane.dataset;
    send({ type: "block.move", blockId, chainId: chain!, index: spot(lane, e.clientX).index, abyId: aby, path: path as "A" | "B" | undefined });
  };
  const escape = (e: KeyboardEvent) => e.key === "Escape" && end(e);
  // Capture: lanes stop pointermove for their + (and Scamp may stop events), but the drag needs them all.
  addEventListener("pointermove", move, true);
  addEventListener("pointerup", end, true);
  addEventListener("keydown", escape);
}

/** The lane under the pointer: the path lane of an A/B box anywhere over that box, or a chain's.
 * An ABY can't go inside a path, so dragging one only finds chains. */
function laneAt(x: number, y: number, chainsOnly: boolean) {
  const el = document.elementFromPoint(x, y);
  if (chainsOnly) return el?.closest<HTMLElement>(".gl-lane:not([data-aby])") ?? null;
  const box = el?.closest('[data-scamp-id^="lane_a_"], [data-scamp-id^="lane_b_"]');
  return box?.querySelector<HTMLElement>(".gl-lane") ?? el?.closest<HTMLElement>(".gl-lane") ?? null;
}

/**
 * A row of Draggables: a chain, or one path of its ABY (abyId and path set), where drags land.
 * Hovering a gap shows a + that adds a block there.
 */
function Lane({ chainId, abyId, path, children }: { chainId: string; abyId?: string; path?: "A" | "B"; children: ComponentChildren }) {
  return (
    <div
      class="gl-lane"
      data-chain={chainId}
      data-aby={abyId}
      data-path={path}
      onPointerMove={(e) => {
        const lane = e.currentTarget;
        if ((e.target as Element).closest(".gl-insert")) return; // keep it where it is while it's pointed at
        e.stopPropagation(); // a path lane sits inside the chain's lane, whose + it hides
        lane.parentElement?.closest<HTMLElement>(".gl-lane")?.removeAttribute("data-gap");
        const overTile = (e.target as Element).closest(".gl-drag, .gl-lane") !== lane && (e.target as Element).closest(".gl-drag");
        const at = spot(lane, e.clientX);
        // Nothing can follow a split to separate outputs.
        const afterSplit = at.index === tiles(lane).length && lane.lastElementChild?.querySelector('[data-exit="split"]');
        if (overTile || afterSplit) return delete lane.dataset.gap;
        lane.dataset.gap = String(at.index);
        lane.style.setProperty("--add-x", `${at.x}px`);
      }}
      onPointerLeave={(e) => delete e.currentTarget.dataset.gap}
    >
      {children}
      <button
        class="gl-insert"
        type="button"
        aria-label="Add a block here"
        onClick={(e) => {
          const lane = e.currentTarget.parentElement as HTMLElement;
          insertAt = { chainId, abyId, path, index: Number(lane.dataset.gap) };
          // Open the lane's own + menu: the chain's, or the A/B box's.
          const box = path ? lane.closest(`[data-scamp-id^="lane_${path.toLowerCase()}_"]`) : lane.closest("section");
          box?.querySelector<HTMLElement>(path ? `[data-scamp-id^="add_${path.toLowerCase()}_"]` : '[data-scamp-id="add_btn_690a"]')?.click();
        }}
      >
        +
      </button>
    </div>
  );
}

const tiles = (lane: HTMLElement) => [...lane.children].filter((el) => el.classList.contains("gl-drag"));

/** Where a drop or insert at clientX lands in a lane: before the first tile whose middle is right of
 * it. x is the marker's position in the lane, halfway across the gap there. */
function spot(lane: HTMLElement, clientX: number) {
  const box = lane.getBoundingClientRect();
  const rects = tiles(lane).map((el) => el.getBoundingClientRect());
  const index = rects.filter((r) => r.left + r.width / 2 < clientX).length;
  const before = rects[index - 1], after = rects[index];
  const x =
    before && after ? (before.right + after.left) / 2
    : after ? after.left - 8
    : before ? before.right + 8
    : box.left + 8;
  return { index, x: Math.max(8, x - box.left) };
}

/**
 * An ABY block: the pedal switches A/B and Y, and each path is its own lane of blocks with a + menu.
 * Removing it keeps path A in the chain.
 */
function AbyView({ chainId, aby, plugins, snapshotBase }: { chainId: string; aby: AbyBlock; plugins: MenuRow[]; snapshotBase: string }) {
  const mode = aby.mode === "Y" ? "y" : aby.active === "B" ? "b" : "a";
  const other = aby.active === "A" ? "B" : "A";
  const lane = (path: "A" | "B", blocks: Block[]) => (
    <Lane chainId={chainId} abyId={aby.id} path={path}>
      {blocks.map((b) => (
        <Draggable key={b.id} id={b.id}>
          <BlockView block={b} snapshotBase={snapshotBase} small />
        </Draggable>
      ))}
    </Lane>
  );
  const goneB = aby.pathB.blocks.length;

  return (
    <AbyFork
      mode={mode}
      exit={aby.exit}
      removeLabel={goneB ? `Keep A, remove B's ${goneB === 1 ? "block" : `${goneB} blocks`}` : "Remove split"}
      pluginsB={plugins}
      pluginsA={plugins}
      onRemove={() => send({ type: "block.remove", blockId: aby.id })}
      onAddB={(id) => addFromMenu(chainId, id, { abyId: aby.id, path: "B" })}
      onAddA={(id) => addFromMenu(chainId, id, { abyId: aby.id, path: "A" })}
      pedal={
        <AbyPedal
          mode={mode}
          // A/B picks the other path; from Y it drops back to the path that was active.
          onToggleAb={() =>
            aby.mode === "Y"
              ? send({ type: "aby.setMode", blockId: aby.id, mode: "AB" })
              : send({ type: "aby.select", blockId: aby.id, path: other })
          }
          onToggleY={() => send({ type: "aby.setMode", blockId: aby.id, mode: aby.mode === "Y" ? "AB" : "Y" })}
        />
      }
      laneB={lane("B", aby.pathB.blocks)}
      laneA={lane("A", aby.pathA.blocks)}
    />
  );
}

/** Acts on an output menu row from ioOptions. */
function selectOutput(c: Chain, id: string) {
  const [what, channels] = id.includes(":") ? id.split(":") : ["", id];
  const blockId = endAby(c)?.id ?? "";
  const outputs = [{ hwChannels: channels.split("-").map(Number) }];
  if (what === "exit") send({ type: "aby.setExit", blockId, exit: channels as "merge" | "split" });
  else if (what === "A" || what === "B") send({ type: "aby.setOutputs", blockId, path: what, outputs });
  else send({ type: "chain.setOutputs", chainId: c.id, outputs });
}

/** A chain ending in a split ABY sends each path to its own outputs; otherwise there's one output. */
function exitOutputs(c: Chain) {
  const last = c.blocks[c.blocks.length - 1];
  const split = last?.type === "aby" && (last as AbyBlock).exit === "split" ? (last as AbyBlock).splitOutputs : undefined;
  return split
    ? {
        exit: "split" as const,
        outputA: split.A.length ? outputLabel(split.A[0].hwChannels) : "No output",
        outputB: split.B.length ? outputLabel(split.B[0].hwChannels) : "No output",
      }
    : { exit: "single" as const };
}

/** The rig of the open project, with the footswitch panel under it. */
export function RigView({ state }: { state: GlitchState }) {
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const inputNames = state.device?.inputs ?? [];
  const outputNames = state.device?.outputs ?? [];
  // The + menu: NAM models, then cab IRs, then plugins. Ids carry the kind: "nam:<file>", "ir:<file>", "plugin:<id>".
  const plugins: MenuRow[] = [
    ...state.library.nam.map((f) => ({ id: `nam:${f.id}`, name: f.name, kind: "NAM model", image: PLUGIN_IMAGE })),
    ...state.library.ir.map((f) => ({ id: `ir:${f.id}`, name: f.name, kind: "Cab IR", image: PLUGIN_IMAGE })),
    ...state.plugins.list.map((p) => ({
      id: `plugin:${p.id}`,
      name: p.name,
      kind: [p.format, p.category.replace(/\|/g, " · ")].filter(Boolean).join(" · "),
      image: PLUGIN_IMAGE,
    })),
  ];
  const counts = [
    [state.library.nam.length, "model"],
    [state.library.ir.length, "IR"],
    [state.plugins.list.length, "plugin"],
  ].filter(([n]) => n) as [number, string][];
  const pluginNote = state.plugins.scanning
    ? `Scanning… ${Math.round((state.plugins.progress ?? 0) * 100)}%${state.plugins.current ? ` · ${state.plugins.current}` : ""}`
    : counts.length === 0
      ? "Nothing yet. Scan for plugins, or add NAM models, IRs or plugins."
      : counts.map(([n, what]) => `${n} ${what}${n === 1 ? "" : "s"}`).join(" · ");

  return (
    <>
      <Rig
        content="live"
        showTopBar={false}
        showPlaylist={false}
        onAddChain={() => {
          renameWhenCreated("chain");
          send({ type: "chain.create" });
        }}
        liveChains={state.chains.map((c) => (
          <ChainStrip
            key={c.id}
            color={c.color as ChainColor}
            name={c.name}
            renameKey={`chain:${c.id}`}
            removeLabel={blockCount(c) ? `Remove “${c.name}” and its ${blockCount(c) === 1 ? "plugin" : `${blockCount(c)} plugins`}` : `Remove “${c.name}”`}
            onRename={() => renameByKey(`chain:${c.id}`)}
            onRemove={() => send({ type: "chain.remove", chainId: c.id })}
            input={`In ${c.inputs[0].hwChannel}`}
            {...ioOptions(c, inputNames, outputNames)}
            level={String(Math.round(dbToPosition(c.level) * 100))}
            levelText={formatDb(c.level, SILENCE_DB)}
            muted={c.muted}
            // One bar per input channel: the hardware inputs, before the chain.
            inputMeter={`in:${c.inputs[0].hwChannel}`}
            stereo={c.inputs.length > 1}
            inputMeterR={c.inputs[1] ? `in:${c.inputs[1].hwChannel}` : ""}
            output={c.outputs.length ? outputLabel(c.outputs[0].hwChannels) + (c.outputs.length > 1 ? ` +${c.outputs.length - 1}` : "") : "No output"}
            {...exitOutputs(c)}
            plugins={[ABY_ROW, ...plugins]}
            menuNote={pluginNote}
            scanning={state.plugins.scanning}
            onSelectInput={(id) => send({ type: "chain.setInputs", chainId: c.id, inputs: [{ hwChannel: Number(id) }] })}
            onSelectOutput={(id) => selectOutput(c, id)}
            onSelectOutputB={(id) => selectOutput(c, id)}
            onLevelChange={(value) =>
              send({ type: "chain.setLevel", chainId: c.id, levelDb: Math.max(SILENCE_DB, positionToDb(Number(value) / 100)) })
            }
            onMuteToggle={() => send({ type: "chain.setMute", chainId: c.id, muted: !c.muted })}
            onAddPlugin={(id) => addFromMenu(c.id, id)}
            onScanPlugins={() => send({ type: "plugins.scan" })}
            onImportPlugin={() => send({ type: "library.import" })}
          >
            <Lane chainId={c.id}>
              {c.blocks.map((b) => (
                <Draggable key={b.id} id={b.id}>
                  {b.type === "aby" ? (
                    <AbyView chainId={c.id} aby={b as AbyBlock} plugins={plugins} snapshotBase={state.snapshotBase} />
                  ) : (
                    <BlockView block={b} snapshotBase={state.snapshotBase} />
                  )}
                </Draggable>
              ))}
            </Lane>
          </ChainStrip>
        ))}
      />
      <FootswitchView state={state} />
    </>
  );
}

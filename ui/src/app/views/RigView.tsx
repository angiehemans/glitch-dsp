import { SILENCE_DB, type AbyBlock, type Block, type Chain, type GlitchState, type OutputRef } from "@glitch/protocol";
import AbyFork from "@scamp/components/AbyFork/AbyFork";
import AbyPedal from "@scamp/components/AbyPedal/AbyPedal";
import BlockTile from "@scamp/components/BlockTile/BlockTile";
import ChainStrip from "@scamp/components/ChainStrip/ChainStrip";
import Rig from "@scamp/views/Rig/Rig";
import { send } from "../../store/glitch";
import { dbToPosition, positionToDb } from "../faderLaw";
import { renameByKey, renameWhenCreated } from "../rename";
import { MonitorView } from "./MonitorView";

type ChainColor = "orange" | "cyan" | "pink" | "lime" | "violet";

const outputLabel = (channels: number[]) => `Out ${channels.join("/")}`;

/** Output choices for a device with n outputs: stereo pairs first, then each output alone. */
function outputChoices(n: number): number[][] {
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

function blockState(b: Block) {
  if (b.missing) return "error";
  return b.enabled ? "active" : "bypassed";
}

/**
 * A block in a chain, at a fixed height (half height inside an ABY path); its picture keeps its
 * aspect ratio. Its header bypasses or removes it; clicking it opens the plugin's own window
 * (native: it can't render in the WebView) for everything else.
 */
function BlockView({ block, snapshotBase, small = false }: { block: Block; snapshotBase: string; small?: boolean }) {
  // Engine-captured picture of the plugin's window; the version busts the image cache after each capture.
  const art = block.snapshotAt && snapshotBase ? `${snapshotBase}${block.id}.png?v=${block.snapshotAt}` : PLUGIN_IMAGE;

  return (
    <BlockTile
      state={blockState(block)}
      size={small ? "small" : "regular"}
      name={block.name}
      bypassLabel={block.enabled ? "Bypass" : "Turn on"}
      onOpen={() => send({ type: "block.openEditor", blockId: block.id })}
      onBypass={() => send({ type: "block.toggle", blockId: block.id })}
      onRemove={() => send({ type: "block.remove", blockId: block.id })}
    >
      <img class="gl-block-art" src={art} alt="" draggable={false} />
    </BlockTile>
  );
}

type MenuRow = { id: string; name: string; kind: string; image: string };
const ABY_ROW: MenuRow = { id: "aby", name: "ABY splitter", kind: "Built-in · split into paths A and B", image: PLUGIN_IMAGE };

/** Adds the block a + menu row stands for ("nam:<file>", "ir:<file>", "plugin:<id>"), to the chain or into an ABY path. */
function addFromMenu(chainId: string, rowId: string, into?: { abyId: string; path: "A" | "B" }) {
  if (rowId === ABY_ROW.id) return send({ type: "chain.splitAt", chainId });
  const [kind, ...rest] = rowId.split(":");
  const ref = rest.join(":"); // plugin ids and file names can contain ":"
  send({
    type: "block.add",
    chainId,
    block: kind === "plugin" ? { type: "plugin", pluginId: ref } : { type: kind as "nam" | "ir", file: ref },
    ...into,
  });
}

/** Blocks in a chain, counting those inside ABY paths but not the ABY itself. */
const blockCount = (c: Chain) =>
  c.blocks.reduce((n, b) => n + (b.type === "aby" ? (b as AbyBlock).pathA.blocks.length + (b as AbyBlock).pathB.blocks.length : 1), 0);

const DRAG_TYPE = "application/x-glitch-block"; // data: "<abyId> <blockId>"

/**
 * An ABY block: the pedal switches A/B and Y, and each path is its own lane of blocks with a level,
 * a mute and a + menu. Removing it keeps path A in the chain.
 */
function AbyView({ chainId, aby, plugins, snapshotBase }: { chainId: string; aby: AbyBlock; plugins: MenuRow[]; snapshotBase: string }) {
  const mode = aby.mode === "Y" ? "y" : aby.active === "B" ? "b" : "a";
  const other = aby.active === "A" ? "B" : "A";
  const lane = (path: "A" | "B", blocks: Block[]) => (
    <div
      class="gl-lane"
      onDragOver={(e) => {
        if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
        e.preventDefault(); // allows the drop
        e.currentTarget.dataset.over = "";
      }}
      onDragLeave={(e) => delete e.currentTarget.dataset.over}
      onDrop={(e) => {
        delete e.currentTarget.dataset.over;
        const [fromAby, moveId] = (e.dataTransfer?.getData(DRAG_TYPE) ?? "").split(" ");
        if (fromAby !== aby.id || !moveId) return; // only between this ABY's lanes
        e.preventDefault();
        // Dropped before the first tile whose middle is right of the pointer.
        const tiles = [...e.currentTarget.children].map((el) => el.getBoundingClientRect());
        const index = tiles.filter((r) => r.left + r.width / 2 < e.clientX).length;
        send({ type: "aby.moveBlock", blockId: aby.id, moveId, path, index });
      }}
    >
      {blocks.map((b) => (
        <div key={b.id} class="gl-drag" draggable onDragStart={(e) => e.dataTransfer?.setData(DRAG_TYPE, `${aby.id} ${b.id}`)}>
          <BlockView block={b} snapshotBase={snapshotBase} small />
        </div>
      ))}
    </div>
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

/** The rig of the open project, with the monitor strip under it. */
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
            level={String(Math.round(dbToPosition(c.outputs[0].level) * 100))}
            muted={c.muted}
            inputMeter={`chain:${c.id}:in`}
            output={outputLabel(c.outputs[0].hwChannels)}
            {...exitOutputs(c)}
            outputMeter={`chain:${c.id}:out`}
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
            {c.blocks.map((b) =>
              b.type === "aby" ? (
                <AbyView key={b.id} chainId={c.id} aby={b as AbyBlock} plugins={plugins} snapshotBase={state.snapshotBase} />
              ) : (
                <BlockView key={b.id} block={b} snapshotBase={state.snapshotBase} />
              ),
            )}
          </ChainStrip>
        ))}
      />
      <MonitorView state={state} />
    </>
  );
}

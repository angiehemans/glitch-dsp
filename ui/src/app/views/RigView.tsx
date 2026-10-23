import { SILENCE_DB, type Block, type Chain, type GlitchState } from "@glitch/protocol";
import BlockTile from "@scamp/components/BlockTile/BlockTile";
import Rig from "@scamp/views/Rig/Rig";
import { send } from "../../store/glitch";
import { dbToPosition, positionToDb } from "../faderLaw";
import { renameWhenCreated } from "../rename";
import { MonitorView } from "./MonitorView";

type ChainColor = "orange" | "cyan" | "pink" | "lime" | "violet";

const outputLabel = (channels: number[]) => `Out ${channels.join("/")}`;

/** Output choices for a device with n outputs: stereo pairs first, then each output alone. */
function outputChoices(n: number): number[][] {
  const pairs = Array.from({ length: Math.floor(n / 2) }, (_, i) => [i * 2 + 1, i * 2 + 2]);
  const singles = Array.from({ length: n }, (_, i) => [i + 1]);
  return [...pairs, ...singles];
}

/** Dropdown rows for a chain's input and output chips. Ids are the channel numbers ("2", "1-2"). */
function ioOptions(chain: Chain, inputNames: string[], outputNames: string[]) {
  const outputs = outputNames.length ? outputChoices(outputNames.length) : []; // none open: say so, don't invent a pair
  const current = chain.outputs[0].hwChannels.join("-");
  return {
    inputs: (inputNames.length ? inputNames : ["Input 1"]).map((name, i) => ({
      id: String(i + 1),
      label: `In ${i + 1}`,
      detail: name,
      current: chain.inputs[0].hwChannel === i + 1,
    })),
    outputs: outputs.map((channels) => ({
      id: channels.join("-"),
      label: outputLabel(channels),
      detail: channels.map((ch) => outputNames[ch - 1] ?? `Output ${ch}`).join(" / "),
      current: channels.join("-") === current,
    })),
  };
}

const PLUGIN_IMAGE = "/assets/plugin.svg";
const MAX_ART_HEIGHT = 400; // a very tall plugin window is scaled down so it can't blow up the chain strip

function blockState(b: Block) {
  if (b.missing) return "error";
  return b.enabled ? "active" : "bypassed";
}

/**
 * A block in a chain. Clicking it opens the plugin's own window (native: it can't render in the
 * WebView), whose header has Bypass and Remove from chain.
 */
function BlockView({ block, snapshotBase }: { block: Block; snapshotBase: string }) {
  // Engine-captured picture of the plugin's window; the version busts the image cache after each capture.
  const art = block.snapshotAt && snapshotBase ? `${snapshotBase}${block.id}.png?v=${block.snapshotAt}` : null;
  // The tile hugs the snapshot at the plugin window's size (older snapshots without a size: the image's own).
  const w = block.snapshotWidth ?? 0, h = block.snapshotHeight ?? 0;
  const scale = h > MAX_ART_HEIGHT ? MAX_ART_HEIGHT / h : 1;
  const size = w && h ? { width: `${Math.round(w * scale)}px`, height: `${Math.round(h * scale)}px` } : { maxHeight: `${MAX_ART_HEIGHT}px` };

  return (
    <BlockTile
      state={blockState(block)}
      art={art ? "hug" : "fixed"}
      typeLabel={block.plugin?.format ?? block.type.toUpperCase()}
      name={block.name}
      detail={block.missing ? "Not installed" : block.plugin?.manufacturer || block.plugin?.category || ""}
      onOpen={() => send({ type: "block.openEditor", blockId: block.id })}
    >
      {art ? <img class="gl-block-art" src={art} style={size} alt="" /> : <img src={PLUGIN_IMAGE} alt="" />}
    </BlockTile>
  );
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
  const byId = new Map(state.chains.map((c) => [c.id, c]));
  const withChain = (id: string, fn: (c: Chain) => void) => {
    const c = byId.get(id);
    if (c) fn(c);
  };

  return (
    <>
      <Rig
        content="live"
        showTopBar={false}
        showPlaylist={false}
        chains={state.chains.map((c) => ({
          id: c.id,
          color: c.color as ChainColor,
          name: c.name,
          renameKey: `chain:${c.id}`,
          input: `In ${c.inputs[0].hwChannel}`,
          ...ioOptions(c, inputNames, outputNames),
          level: String(Math.round(dbToPosition(c.outputs[0].level) * 100)),
          muted: c.muted,
          inputMeter: `chain:${c.id}:in`,
          output: outputLabel(c.outputs[0].hwChannels),
          outputMeter: `chain:${c.id}:out`,
          blocks: c.blocks.map((b) => <BlockView key={b.id} block={b} snapshotBase={state.snapshotBase} />),
        }))}
        plugins={state.plugins.list.map((p) => ({ id: p.id, name: p.name, kind: [p.format, p.category.replace(/\|/g, " · ")].filter(Boolean).join(" · "), image: PLUGIN_IMAGE }))}
        pluginNote={
          state.plugins.scanning
            ? "Scanning for plugins…"
            : state.plugins.list.length === 0
              ? "No plugins yet. Scan the standard folders, or add one."
              : `${state.plugins.list.length} plugin${state.plugins.list.length === 1 ? "" : "s"}`
        }
        scanning={state.plugins.scanning}
        onChainAddPlugin={(chainId, pluginId) => send({ type: "block.add", chainId, block: { type: "plugin", pluginId } })}
        onScanPlugins={() => send({ type: "plugins.scan" })}
        onImportPlugin={() => send({ type: "plugins.import" })}
        onAddChain={() => {
          renameWhenCreated("chain");
          send({ type: "chain.create" });
        }}
        onChainInput={(chainId, optionId) => send({ type: "chain.setInputs", chainId, inputs: [{ hwChannel: Number(optionId) }] })}
        onChainOutput={(chainId, optionId) =>
          send({ type: "chain.setOutputs", chainId, outputs: [{ hwChannels: optionId.split("-").map(Number) }] })
        }
        onChainLevel={(id, value) =>
          send({ type: "chain.setLevel", chainId: id, levelDb: Math.max(SILENCE_DB, positionToDb(Number(value) / 100)) })
        }
        onChainMute={(id) => withChain(id, (c) => send({ type: "chain.setMute", chainId: id, muted: !c.muted }))}
      />
      <MonitorView state={state} />
    </>
  );
}

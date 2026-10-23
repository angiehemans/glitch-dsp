import { SILENCE_DB, type Block, type Chain, type GlitchState } from "@glitch/protocol";
import BlockTile from "@scamp/components/BlockTile/BlockTile";
import Rig from "@scamp/views/Rig/Rig";
import { send } from "../../store/glitch";
import { dbToPosition, positionToDb } from "../faderLaw";
import { MonitorView } from "./MonitorView";

type ChainColor = "orange" | "cyan" | "pink" | "lime" | "violet";

const outputLabel = (channels: number[]) => `Out ${channels.join("/")}`;

/** Output choices for a device with n outputs: stereo pairs first, then each output alone. */
function outputChoices(n: number): number[][] {
  const pairs = Array.from({ length: Math.floor(n / 2) }, (_, i) => [i * 2 + 1, i * 2 + 2]);
  const singles = Array.from({ length: n }, (_, i) => [i + 1]);
  return [...pairs, ...singles];
}

const PLUGIN_IMAGE = "/assets/plugin.svg";

function blockState(b: Block) {
  if (b.missing) return "error";
  return b.enabled ? "active" : "bypassed";
}

/**
 * A block in a chain. Clicking its artwork opens BlockTile's modal (a Scamp interaction), which holds
 * the block's actions. The plugin's own editor opens as a native window, since it can't render in the WebView.
 */
function BlockView({ block }: { block: Block }) {
  return (
    <BlockTile
      state={blockState(block)}
      typeLabel={block.plugin?.format ?? block.type.toUpperCase()}
      name={block.name}
      detail={block.missing ? "Not installed" : block.plugin?.manufacturer || block.plugin?.category || ""}
      plugin={
        <div class="gl-block-actions">
          {!block.missing && (
            <button type="button" data-scamp-click="modal:open=closed" onClick={() => send({ type: "block.openEditor", blockId: block.id })}>
              Open plugin window
            </button>
          )}
          <button type="button" onClick={() => send({ type: "block.toggle", blockId: block.id })}>
            {block.enabled ? "Bypass" : "Enable"}
          </button>
          <button type="button" class="gl-danger" data-scamp-click="modal:open=closed" onClick={() => send({ type: "block.remove", blockId: block.id })}>
            Remove from chain
          </button>
        </div>
      }
    >
      <img src={PLUGIN_IMAGE} alt="" />
    </BlockTile>
  );
}

/** The rig of the open project, with the monitor strip under it. Clicking an I/O chip steps to the next choice. */
export function RigView({ state }: { state: GlitchState }) {
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const numInputs = Math.max(1, state.device?.inputs.length ?? 1);
  const choices = outputChoices(Math.max(1, state.device?.outputs.length ?? 2));
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
          input: `In ${c.inputs[0].hwChannel}`,
          level: String(Math.round(dbToPosition(c.outputs[0].level) * 100)),
          muted: c.muted,
          inputMeter: `chain:${c.id}:in`,
          output: outputLabel(c.outputs[0].hwChannels),
          outputMeter: `chain:${c.id}:out`,
          blocks: c.blocks.map((b) => <BlockView key={b.id} block={b} />),
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
        onAddChain={() => send({ type: "chain.create" })}
        onChainInput={(id) =>
          withChain(id, (c) =>
            send({ type: "chain.setInputs", chainId: id, inputs: [{ hwChannel: (c.inputs[0].hwChannel % numInputs) + 1 }] }),
          )
        }
        onChainOutput={(id) =>
          withChain(id, (c) => {
            const current = choices.findIndex((ch) => ch.join() === c.outputs[0].hwChannels.join());
            send({ type: "chain.setOutputs", chainId: id, outputs: [{ hwChannels: choices[(current + 1) % choices.length] }] });
          })
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

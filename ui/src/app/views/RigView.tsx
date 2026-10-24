import { SILENCE_DB, type Block, type Chain, type GlitchState } from "@glitch/protocol";
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

function blockDetail(b: Block) {
  if (b.missing) return b.type === "plugin" ? "Not installed" : "File missing";
  if (b.note) return b.note;
  if (b.type === "nam") return "NAM model";
  if (b.type === "ir") return "Cab IR";
  return b.plugin?.manufacturer || b.plugin?.category || "";
}

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
      detail={blockDetail(block)}
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
  // The + menu: NAM models, then cab IRs, then plugins. Ids carry the kind: "nam:<file>", "ir:<file>", "plugin:<id>".
  const plugins = [
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
            removeLabel={c.blocks.length ? `Remove “${c.name}” and its ${c.blocks.length === 1 ? "plugin" : `${c.blocks.length} plugins`}` : `Remove “${c.name}”`}
            onRename={() => renameByKey(`chain:${c.id}`)}
            onRemove={() => send({ type: "chain.remove", chainId: c.id })}
            input={`In ${c.inputs[0].hwChannel}`}
            {...ioOptions(c, inputNames, outputNames)}
            level={String(Math.round(dbToPosition(c.outputs[0].level) * 100))}
            muted={c.muted}
            inputMeter={`chain:${c.id}:in`}
            output={outputLabel(c.outputs[0].hwChannels)}
            outputMeter={`chain:${c.id}:out`}
            plugins={plugins}
            menuNote={pluginNote}
            scanning={state.plugins.scanning}
            onSelectInput={(id) => send({ type: "chain.setInputs", chainId: c.id, inputs: [{ hwChannel: Number(id) }] })}
            onSelectOutput={(id) => send({ type: "chain.setOutputs", chainId: c.id, outputs: [{ hwChannels: id.split("-").map(Number) }] })}
            onLevelChange={(value) =>
              send({ type: "chain.setLevel", chainId: c.id, levelDb: Math.max(SILENCE_DB, positionToDb(Number(value) / 100)) })
            }
            onMuteToggle={() => send({ type: "chain.setMute", chainId: c.id, muted: !c.muted })}
            onAddPlugin={(id) => {
              const [kind, ...rest] = id.split(":");
              const ref = rest.join(":"); // plugin ids and file names can contain ":"
              send({
                type: "block.add",
                chainId: c.id,
                block: kind === "plugin" ? { type: "plugin", pluginId: ref } : { type: kind as "nam" | "ir", file: ref },
              });
            }}
            onScanPlugins={() => send({ type: "plugins.scan" })}
            onImportPlugin={() => send({ type: "library.import" })}
          >
            {c.blocks.map((b) => (
              <BlockView key={b.id} block={b} snapshotBase={state.snapshotBase} />
            ))}
          </ChainStrip>
        ))}
      />
      <MonitorView state={state} />
    </>
  );
}

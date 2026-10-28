import { SILENCE_DB, type AbyBlock, type Block, type Chain, type Command, type EngineEvent, type GlitchState, type Project } from "@glitch/protocol";
import type { EngineBridge } from "./engine";

export function emptyState(): GlitchState {
  return {
    device: null,
    devices: [],
    plugins: { scanning: false, progress: 0, current: "", list: [] },
    snapshotBase: "",
    library: { nam: [], ir: [] },
    monitor: { gainDb: 0, muted: false },
    panic: false,
    project: null,
    projects: [],
    chains: [],
    presets: [],
    currentPresetId: null,
    presetModified: false,
    mappings: [],
    setlists: [],
    songs: [],
    transport: { playing: false, songId: null, position: 0 },
    tuneMode: { active: false, tunerInput: 1, reference: 440, vocalChainId: null, backingTracks: "pause" },
    midi: { device: null },
  };
}

const COLOURS = ["orange", "cyan", "pink", "lime", "violet"];
const MAX_CHAINS = 8;
const newId = () => Math.random().toString(16).slice(2, 10);

/**
 * Browser stand-in for the JUCE engine: same commands and validation, starts blank like a fresh
 * install, fake input signal. Projects live in memory only (the real engine saves them).
 */
export function createMockEngine(): EngineBridge {
  const listeners = new Set<(e: EngineEvent) => void>();
  type MockPreset = { id: string; name: string; chains: Chain[] };
  const projects: (Project & { chains: Chain[]; openedAt: number; presets: MockPreset[]; currentPresetId: string | null })[] = [];
  // The rig as saved: without what the engine fills in as it runs (as ProjectStore's rigJson).
  const rigJson = (chains: Chain[]) =>
    JSON.stringify(chains, (key, value) => (["missing", "note", "snapshotAt", "snapshotWidth", "snapshotHeight"].includes(key) ? undefined : value));
  const state: GlitchState = {
    ...emptyState(),
    device: {
      name: "Mock M4",
      type: "Mock",
      sampleRate: 48000,
      bufferSize: 128,
      latencyMs: 5.3,
      inputs: ["Input 1", "Input 2"],
      outputs: ["Output 1", "Output 2", "Output 3", "Output 4"], // like the M4
      sampleRates: [44100, 48000, 96000],
      bufferSizes: [32, 64, 128, 256, 512, 1024],
    },
    devices: [
      { type: "Mock", name: "Mock M4", label: "Mock M4", current: true },
      { type: "Mock", name: "Mock built-in audio", label: "Mock built-in audio", current: false },
    ],
  };

  // Async like the real bridge, so the UI never relies on synchronous replies.
  const emit = (e: EngineEvent) => setTimeout(() => listeners.forEach((fn) => fn(e)));
  const emitState = () => {
    const current = projects.find((p) => p.id === state.project?.id) ?? null;
    state.project = current;
    state.chains = current?.chains ?? [];
    state.presets = current?.presets.map(({ id, name }) => ({ id, name })) ?? [];
    state.currentPresetId = current?.currentPresetId ?? null;
    const preset = current?.presets.find((p) => p.id === current.currentPresetId);
    state.presetModified = !!preset && rigJson(preset.chains) !== rigJson(current!.chains);
    state.projects = [...projects]
      .sort((a, b) => b.openedAt - a.openedAt)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, chainCount: p.chains.length, openedAt: p.openedAt }));
    emit({ type: "state", state: JSON.parse(JSON.stringify(state)) });
  };
  const error = (message: string) => emit({ type: "error", message });
  const open = (id: string) => {
    const p = projects.find((p) => p.id === id);
    if (p) {
      p.openedAt = Date.now();
      state.project = p;
    }
    return p;
  };
  const chain = (id: string) => state.chains.find((c) => c.id === id);
  // Every block list of a chain: its own, then each ABY's paths (as ProjectStore::getBlockLists).
  const blockLists = (c: Chain) => [
    c.blocks,
    ...c.blocks.filter((b): b is AbyBlock => b.type === "aby").flatMap((a) => [a.pathA.blocks, a.pathB.blocks]),
  ];
  const findBlock = (id: string) => {
    for (const c of state.chains)
      for (const list of blockLists(c)) {
        const i = list.findIndex((b) => b.id === id);
        if (i >= 0) return { chain: c, list, index: i, block: list[i] };
      }
    return null;
  };
  const findAby = (id: string) => {
    const found = findBlock(id);
    return found?.block.type === "aby" ? (found.block as AbyBlock) : null;
  };
  const newPath = () => ({ blocks: [] as Block[], mute: false });
  const endsInSplit = (c: Chain) => {
    const last = c.blocks[c.blocks.length - 1];
    return last?.type === "aby" && (last as AbyBlock).exit === "split";
  };

  let t = 0;
  setInterval(() => {
    t += 1 / 30;
    // A strummed-guitar-ish envelope, occasionally peaking over 0 dBFS so clip shows up.
    const env = Math.abs(Math.sin(t * 1.3)) ** 3;
    const signal = -50 + 52 * env + Math.random() * 3; // the same fake signal on every input
    const levels: Record<string, number> = { "in:1": signal };
    const outs = state.device!.outputs.map(() => SILENCE_DB);
    for (const c of state.chains) {
      const out = c.muted ? SILENCE_DB : Math.max(SILENCE_DB, signal + c.level);
      levels[`chain:${c.id}:in`] = signal;
      levels[`chain:${c.id}:out`] = out;
      const split = endsInSplit(c) ? (c.blocks[c.blocks.length - 1] as AbyBlock).splitOutputs : undefined;
      for (const send of split ? [...split.A, ...split.B] : c.outputs)
        if (!send.mute) for (const ch of send.hwChannels) if (ch <= outs.length) outs[ch - 1] = Math.max(outs[ch - 1], out + send.level);
    }
    const master = state.monitor.muted || state.panic ? SILENCE_DB : state.monitor.gainDb;
    outs.forEach((o, i) => (levels[`out:${i + 1}`] = Math.max(SILENCE_DB, o + master)));
    emit({ type: "meters", levels, cpu: 0.08 + Math.random() * 0.04 });
  }, 1000 / 30);

  return {
    send(cmd: Command) {
      switch (cmd.type) {
        case "app.ready":
          break;
        case "monitor.setGain":
          state.monitor.gainDb = cmd.gainDb;
          break;
        case "monitor.setMute":
          state.monitor.muted = cmd.muted;
          break;
        case "panic.toggle":
          state.panic = !state.panic;
          break;
        case "project.create": {
          const id = newId();
          projects.push({
            id,
            name: cmd.name?.trim() || `New project ${projects.length + 1}`,
            color: COLOURS[projects.length % COLOURS.length],
            mainOutput: [1, 2],
            setlists: [],
            songPresets: {},
            trackMix: {},
            chains: [],
            openedAt: Date.now(),
            presets: [],
            currentPresetId: null,
          });
          open(id);
          break;
        }
        case "project.open":
          if (!open(cmd.projectId)) return error(`Unknown project: ${cmd.projectId}`);
          break;
        case "project.rename": {
          const p = projects.find((p) => p.id === cmd.projectId);
          const name = cmd.name.replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (!name) return error("A project needs a name");
          if (!p) return error(`Unknown project: ${cmd.projectId}`);
          p.name = name;
          break;
        }
        case "preset.save":
        case "preset.saveAs":
        case "preset.load":
        case "preset.rename":
        case "preset.delete": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (!p) return error("No project open");
          const clean = (name?: string) => (name ?? "").replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (cmd.type === "preset.save" || cmd.type === "preset.saveAs") {
            const existing = cmd.type === "preset.save" ? p.presets.find((x) => x.id === p.currentPresetId) : undefined;
            const preset = existing ?? { id: newId(), name: clean(cmd.name) || `Preset ${p.presets.length + 1}`, chains: [] };
            if (existing && clean(cmd.name)) existing.name = clean(cmd.name);
            preset.chains = structuredClone(p.chains);
            if (!existing) p.presets.push(preset);
            p.currentPresetId = preset.id;
            break;
          }
          const preset = p.presets.find((x) => x.id === cmd.presetId);
          if (!preset) return error(`Unknown preset: ${cmd.presetId}`);
          if (cmd.type === "preset.load") {
            p.chains = structuredClone(preset.chains);
            p.currentPresetId = preset.id;
          }
          if (cmd.type === "preset.rename") {
            if (!clean(cmd.name)) return error("A preset needs a name");
            preset.name = clean(cmd.name);
          }
          if (cmd.type === "preset.delete") {
            p.presets.splice(p.presets.indexOf(preset), 1);
            if (p.currentPresetId === preset.id) p.currentPresetId = null;
          }
          break;
        }
        case "chain.create": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (!p) return error("Open a project first");
          if (p.chains.length >= MAX_CHAINS) return error(`A project can have up to ${MAX_CHAINS} chains`);
          p.chains.push({
            id: newId(),
            name: cmd.name?.trim() || `Chain ${p.chains.length + 1}`,
            color: COLOURS[p.chains.length % COLOURS.length],
            inputs: [{ hwChannel: 1, gain: 0 }],
            mode: "mono",
            blocks: [],
            level: 0,
            outputs: [{ hwChannels: [1, 2], level: 0, pan: 0, mute: false }],
            bypassed: false,
            muted: false,
          });
          break;
        }
        case "chain.remove": {
          const p = projects.find((p) => p.id === state.project?.id);
          const i = p?.chains.findIndex((c) => c.id === cmd.chainId) ?? -1;
          if (!p || i < 0) return error(`Unknown chain: ${cmd.chainId}`);
          p.chains.splice(i, 1);
          break;
        }
        case "chain.rename": {
          const c = chain(cmd.chainId);
          const name = cmd.name.replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (!name) return error("A chain needs a name");
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          c.name = name;
          break;
        }
        case "chain.setInputs":
        case "chain.setOutputs":
        case "chain.setLevel":
        case "chain.setMute": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          if (cmd.type === "chain.setInputs") c.inputs[0].hwChannel = cmd.inputs[0].hwChannel;
          if (cmd.type === "chain.setOutputs") {
            if (!c.outputs.length) c.outputs.push({ hwChannels: [], level: 0, pan: 0, mute: false });
            c.outputs[0].hwChannels = cmd.outputs[0].hwChannels;
          }
          if (cmd.type === "chain.setLevel") c.level = Math.min(10, Math.max(SILENCE_DB, cmd.levelDb));
          if (cmd.type === "chain.setMute") c.muted = cmd.muted;
          break;
        }
        case "device.scan":
          break;
        case "device.setFormat": {
          const d = state.device!;
          if (cmd.sampleRate && !d.sampleRates.includes(cmd.sampleRate)) return error(`Audio device: ${d.name} can't run at ${cmd.sampleRate / 1000} kHz`);
          if (cmd.bufferSize && !d.bufferSizes.includes(cmd.bufferSize)) return error(`Audio device: ${d.name} doesn't offer a ${cmd.bufferSize}-sample buffer`);
          d.sampleRate = cmd.sampleRate || d.sampleRate;
          d.bufferSize = cmd.bufferSize || d.bufferSize;
          d.latencyMs = (2000 * d.bufferSize) / d.sampleRate + 1.5; // in + out, plus converters
          break;
        }
        case "device.select": {
          const d = state.devices.find((d) => d.type === cmd.deviceType && d.name === cmd.name);
          if (!d) return error(`Audio device: Device not found: ${cmd.name}`);
          state.devices.forEach((x) => (x.current = x === d));
          state.device = { ...state.device!, name: d.name, type: d.type };
          break;
        }
        case "plugins.scan":
          state.plugins.scanning = true;
          setTimeout(() => {
            state.plugins = {
              scanning: false,
              progress: 0,
              current: "",
              list: [
                { id: "mock-gain", name: "Mock Gain", manufacturer: "Glitch", format: "VST3", category: "Fx" },
                { id: "mock-delay", name: "Mock Delay", manufacturer: "Glitch", format: "VST3", category: "Fx|Delay" },
              ],
            };
            emitState();
          }, 800);
          break;
        case "library.import":
          return error("Adding files needs the app (not available in the browser)");
        case "block.add": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          const aby = cmd.abyId ? findAby(cmd.abyId) : null;
          if (cmd.abyId && !aby) return error(`Unknown ABY block: ${cmd.abyId}`);
          const list = aby ? (cmd.path === "B" ? aby.pathB : aby.pathA).blocks : c.blocks;
          if (!aby && endsInSplit(c) && (cmd.index ?? list.length) >= list.length)
            return error("This chain ends in a split to separate outputs: add blocks to path A or B");
          const spec = cmd.block;
          if (spec.type === "plugin") {
            const plugin = state.plugins.list.find((p) => p.id === spec.pluginId);
            if (!plugin) return error("Unknown plugin");
            list.splice(cmd.index ?? list.length, 0, { id: newId(), type: "plugin", name: plugin.name, enabled: true, plugin });
          } else {
            const file = state.library[spec.type].find((f) => f.id === spec.file);
            if (!file) return error("That file isn't in the library");
            list.splice(cmd.index ?? list.length, 0, { id: newId(), type: spec.type, name: file.name, enabled: true, file: file.id });
          }
          break;
        }
        case "chain.splitAt": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          const index = Math.max(0, Math.min(cmd.index ?? c.blocks.length, c.blocks.length));
          if (endsInSplit(c) && index >= c.blocks.length) return error("This chain ends in a split to separate outputs");
          if (c.blocks.slice(index).some((b) => b.type === "aby")) return error("An ABY can't go inside another ABY's path");
          const aby: AbyBlock = {
            id: newId(), type: "aby", name: "ABY", enabled: true, mode: "AB", active: "A",
            pathA: { ...newPath(), blocks: c.blocks.splice(index) }, pathB: newPath(),
            exit: "merge", crossfadeMs: 10, alignLatency: true,
          };
          c.blocks.push(aby);
          break;
        }
        case "aby.setMode":
        case "aby.select":
        case "aby.setMute": {
          const aby = findAby(cmd.blockId);
          if (!aby) return error(`Unknown ABY block: ${cmd.blockId}`);
          if (cmd.type === "aby.setMode") aby.mode = cmd.mode;
          if (cmd.type === "aby.select") aby.active = cmd.path;
          if (cmd.type === "aby.setMute") (cmd.path === "B" ? aby.pathB : aby.pathA).mute = cmd.muted;
          break;
        }
        case "aby.setExit":
        case "aby.setOutputs": {
          const found = findBlock(cmd.blockId);
          const aby = found?.block.type === "aby" ? (found.block as AbyBlock) : null;
          if (!found || !aby) return error(`Unknown ABY block: ${cmd.blockId}`);
          if (cmd.type === "aby.setExit") {
            if (cmd.exit === "split" && found.chain.blocks[found.chain.blocks.length - 1] !== aby)
              return error("Only an ABY at the end of a chain can split to separate outputs");
            aby.splitOutputs ??= { A: structuredClone(found.chain.outputs), B: structuredClone(found.chain.outputs) };
            aby.exit = cmd.exit;
          }
          if (cmd.type === "aby.setOutputs") {
            const out = aby.splitOutputs?.[cmd.path][0];
            if (!out || !cmd.outputs[0]?.hwChannels.length) return error("Invalid output channels");
            out.hwChannels = [...cmd.outputs[0].hwChannels];
          }
          break;
        }
        case "route.set":
        case "route.remove": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          const split = endsInSplit(c) ? (c.blocks[c.blocks.length - 1] as AbyBlock).splitOutputs : undefined;
          if (!!cmd.path !== !!split)
            return error(split ? "This chain splits to separate outputs: route path A or B" : "This chain doesn't split to separate outputs");
          const sends = split ? split[cmd.path!] : c.outputs;
          const n = state.device?.outputs.length ?? 0;
          if (!cmd.hwChannels.length || cmd.hwChannels.length > 2 || new Set(cmd.hwChannels).size !== cmd.hwChannels.length || cmd.hwChannels.some((ch) => ch < 1 || ch > Math.max(n, 8)))
            return error("Invalid output channels");
          const i = sends.findIndex((s) => s.hwChannels.join() === cmd.hwChannels.join());
          if (cmd.type === "route.remove") {
            if (i >= 0) sends.splice(i, 1);
            break;
          }
          const send = i >= 0 ? sends[i] : sends[sends.push({ hwChannels: [...cmd.hwChannels], level: 0, pan: 0, mute: false }) - 1];
          if (cmd.level !== undefined) send.level = Math.min(10, Math.max(SILENCE_DB, cmd.level));
          if (cmd.mute !== undefined) send.mute = cmd.mute;
          break;
        }
        case "block.move": {
          const found = findBlock(cmd.blockId);
          const c = chain(cmd.chainId);
          const aby = cmd.abyId ? findAby(cmd.abyId) : null;
          if (!found || !c) return error("Unknown block or chain");
          if (cmd.abyId && (!aby || !c.blocks.includes(aby))) return error(`Unknown ABY block: ${cmd.abyId}`);
          if (aby && found.block.type === "aby") return error("An ABY can't go inside another ABY's path");
          const to = aby ? (cmd.path === "B" ? aby.pathB : aby.pathA).blocks : c.blocks;
          const index = found.list === to && cmd.index > found.index ? cmd.index - 1 : cmd.index; // counted the block in its old place
          found.list.splice(found.index, 1);
          to.splice(Math.min(index, to.length), 0, found.block);
          if (state.chains.some((ch) => ch.blocks.slice(0, -1).some((b) => b.type === "aby" && (b as AbyBlock).exit === "split"))) {
            to.splice(to.indexOf(found.block), 1);
            found.list.splice(found.index, 0, found.block);
            return error("A split to separate outputs has to stay at the end of its chain");
          }
          break;
        }
        case "block.remove":
        case "block.toggle":
        case "block.openEditor": {
          const found = findBlock(cmd.blockId);
          if (!found) return error(`Unknown block: ${cmd.blockId}`);
          if (found.block.type === "aby" && cmd.type !== "block.remove") return error("An ABY block has no window or bypass of its own");
          // Removing an ABY keeps path A in the chain, in its place.
          if (cmd.type === "block.remove")
            found.list.splice(found.index, 1, ...(found.block.type === "aby" ? (found.block as AbyBlock).pathA.blocks : []));
          if (cmd.type === "block.toggle") found.block.enabled = !found.block.enabled;
          if (cmd.type === "block.openEditor") return error("Plugin windows need the app (not available in the browser)");
          break;
        }
        default:
          return error(`Unknown command: ${cmd.type}`);
      }
      emitState();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

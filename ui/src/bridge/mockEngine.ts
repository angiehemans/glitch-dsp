import { SILENCE_DB, type Chain, type Command, type EngineEvent, type GlitchState, type Project } from "@glitch/protocol";
import type { EngineBridge } from "./engine";

export function emptyState(): GlitchState {
  return {
    device: null,
    devices: [],
    plugins: { scanning: false, list: [] },
    snapshotBase: "",
    monitor: { gainDb: 0, muted: false },
    panic: false,
    project: null,
    projects: [],
    chains: [],
    presets: [],
    currentPresetId: null,
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
  const projects: (Project & { chains: Chain[]; openedAt: number })[] = [];
  const state: GlitchState = {
    ...emptyState(),
    device: {
      name: "Mock M4",
      type: "Mock",
      sampleRate: 48000,
      bufferSize: 128,
      latencyMs: 5.3,
      inputs: ["Input 1", "Input 2"],
      outputs: ["Output 1", "Output 2"],
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
  const findBlock = (id: string) => {
    for (const c of state.chains) {
      const i = c.blocks.findIndex((b) => b.id === id);
      if (i >= 0) return { chain: c, index: i, block: c.blocks[i] };
    }
    return null;
  };

  let t = 0;
  setInterval(() => {
    t += 1 / 30;
    // A strummed-guitar-ish envelope, occasionally peaking over 0 dBFS so clip shows up.
    const env = Math.abs(Math.sin(t * 1.3)) ** 3;
    const signal = -50 + 52 * env + Math.random() * 3; // the same fake signal on every input
    const levels: Record<string, number> = { "in:1": signal };
    const outs = [SILENCE_DB, SILENCE_DB];
    for (const c of state.chains) {
      const out = c.muted ? SILENCE_DB : Math.max(SILENCE_DB, signal + c.outputs[0].level);
      levels[`chain:${c.id}:in`] = signal;
      levels[`chain:${c.id}:out`] = out;
      for (const ch of c.outputs[0].hwChannels) if (ch <= 2) outs[ch - 1] = Math.max(outs[ch - 1], out);
    }
    const master = state.monitor.muted || state.panic ? SILENCE_DB : state.monitor.gainDb;
    levels["out:1"] = Math.max(SILENCE_DB, outs[0] + master);
    levels["out:2"] = Math.max(SILENCE_DB, outs[1] + master);
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
            outputs: [{ hwChannels: [1, 2], level: 0, pan: 0 }],
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
          if (cmd.type === "chain.setOutputs") c.outputs[0].hwChannels = cmd.outputs[0].hwChannels;
          if (cmd.type === "chain.setLevel") c.outputs[0].level = Math.min(10, Math.max(SILENCE_DB, cmd.levelDb));
          if (cmd.type === "chain.setMute") c.muted = cmd.muted;
          break;
        }
        case "device.scan":
          break;
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
              list: [
                { id: "mock-gain", name: "Mock Gain", manufacturer: "Glitch", format: "VST3", category: "Fx" },
                { id: "mock-delay", name: "Mock Delay", manufacturer: "Glitch", format: "VST3", category: "Fx|Delay" },
              ],
            };
            emitState();
          }, 800);
          break;
        case "plugins.import":
          return error("Adding plugin files needs the app (not available in the browser)");
        case "block.add": {
          const c = chain(cmd.chainId);
          const plugin = state.plugins.list.find((p) => p.id === cmd.block.pluginId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          if (!plugin) return error("Unknown plugin");
          c.blocks.splice(cmd.index ?? c.blocks.length, 0, { id: newId(), type: "plugin", name: plugin.name, enabled: true, plugin });
          break;
        }
        case "block.remove":
        case "block.toggle":
        case "block.openEditor": {
          const found = findBlock(cmd.blockId);
          if (!found) return error(`Unknown block: ${cmd.blockId}`);
          if (cmd.type === "block.remove") found.chain.blocks.splice(found.index, 1);
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

import { SILENCE_DB, type Command, type EngineEvent, type GlitchState } from "@glitch/protocol";
import type { EngineBridge } from "./engine";

export function emptyState(): GlitchState {
  return {
    device: null,
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

/** Browser stand-in for the JUCE engine: same commands, plausible state, moving meters. */
export function createMockEngine(): EngineBridge {
  const listeners = new Set<(e: EngineEvent) => void>();
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
  };

  // Async like the real bridge, so the UI never relies on synchronous replies.
  const emit = (e: EngineEvent) => setTimeout(() => listeners.forEach((fn) => fn(e)));
  const emitState = () => emit({ type: "state", state: JSON.parse(JSON.stringify(state)) });

  let t = 0;
  setInterval(() => {
    t += 1 / 30;
    // A strummed-guitar-ish envelope, occasionally peaking over 0 dBFS so clip shows up.
    const env = Math.abs(Math.sin(t * 1.3)) ** 3;
    const input = -50 + 52 * env + Math.random() * 3;
    const out = state.monitor.muted || state.panic ? SILENCE_DB : Math.max(SILENCE_DB, input + state.monitor.gainDb);
    emit({ type: "meters", levels: { "in:1": input, "out:1": out, "out:2": out }, cpu: 0.08 + Math.random() * 0.04 });
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
        default:
          emit({ type: "error", message: `Unknown command: ${cmd.type}` });
          return;
      }
      emitState();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

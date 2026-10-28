// Data model from docs/plan.md. Live so far: device, monitor (master level), panic, projects
// and chains (input -> level/mute -> outputs, no blocks yet). The rest is stubbed so later
// milestones fill it in without reshaping the state.

/** Anything at or below this is silence (-inf). JSON can't carry -Infinity. */
export const SILENCE_DB = -100;

export interface DeviceInfo {
  name: string;
  type: string;
  sampleRate: number;
  bufferSize: number;
  /** What the driver reports for input + output; the true round trip can be longer. */
  latencyMs: number;
  /** What this device can run at (buffer sizes: powers of two only). */
  sampleRates: number[];
  bufferSizes: number[];
  inputs: string[];
  outputs: string[];
}

/** An audio device the engine can switch to. */
export interface AudioDeviceOption {
  type: string;
  /** The device's name to the engine (send it back to select it). */
  name: string;
  /** A shorter name to show. */
  label: string;
  current: boolean;
}

/** An imported plugin. `id` is JUCE's identifier string for it. */
export interface PluginInfo {
  id: string;
  name: string;
  manufacturer: string;
  format: string;
  category: string;
}

/** A NAM model or IR in the library. `id` is its path inside the library, e.g. "nam/Plexi.nam". */
export interface LibraryFile {
  id: string;
  name: string;
}

export interface PluginLibraryState {
  scanning: boolean;
  /** While scanning: 0..1, and the plugin being scanned. */
  progress: number;
  current: string;
  list: PluginInfo[];
}

export interface MonitorState {
  gainDb: number;
  muted: boolean;
}

export interface InputRef { hwChannel: number; gain: number }
/**
 * A send to hardware outputs: a left/right pair, or one output that gets left and right at half each.
 * For a chain it's a crosspoint of the output matrix, with its own level and mute.
 */
export interface OutputRef { hwChannels: number[]; level: number; pan: number; mute?: boolean }

export type BlockType = "nam" | "ir" | "plugin" | "utility" | "aby";

export interface Block {
  id: string;
  type: BlockType;
  name: string;
  enabled: boolean;
  mix?: number;
  params?: Record<string, number>;
  /** type "plugin": which plugin. */
  plugin?: PluginInfo;
  /** type "nam" / "ir": the library file (a LibraryFile id). */
  file?: string;
  /** It failed to load: the plugin isn't installed, or the file is missing or unreadable. */
  missing?: boolean;
  /** Something to tell the user, e.g. a NAM model trained at another sample rate. */
  note?: string;
  /** When the plugin window was last snapshotted (ms since epoch); the image is snapshotBase + id + ".png". */
  snapshotAt?: number;
  /** The snapshot's on-screen size in CSS pixels (the image itself may be up to 2x for Retina). */
  snapshotWidth?: number;
  snapshotHeight?: number;
}

/** A path plays at full level, or -3 dB each in Y mode so the sum doesn't jump. */
export interface AbyPath { blocks: Block[]; mute: boolean }

export interface AbyBlock extends Block {
  type: "aby";
  mode: "Y" | "AB";
  active: "A" | "B";
  pathA: AbyPath;
  pathB: AbyPath;
  exit: "merge" | "split";
  splitOutputs?: { A: OutputRef[]; B: OutputRef[] };
  crossfadeMs: number;
  alignLatency: boolean;
}

export interface Chain {
  id: string;
  name: string;
  color: string;
  inputs: InputRef[];
  mode: "mono" | "stereo";
  blocks: Block[];
  /** The chain's fader, in dB. */
  level: number;
  /** Its sends in the output matrix; a split exit's ABY has its own (splitOutputs). */
  outputs: OutputRef[];
  bypassed: boolean;
  muted: boolean;
}

export interface PresetSummary { id: string; name: string }

/**
 * What a footswitch does. Commands: { type: "block.toggle", blockId }, { type: "preset.load", presetId },
 * { type: "aby.select", blockId, path }, { type: "panic.toggle" }. Footswitch-only: { type: "chain.toggleMute", chainId },
 * { type: "preset.next" }, { type: "preset.prev" }, { type: "aby.toggleAB", blockId },
 * { type: "aby.toggleY", blockId }, { type: "page.next" }.
 */
export interface ActionRef { type: string; [key: string]: unknown }

/**
 * A footswitch on a page, in the project: a tap and a hold action. holdMs defaults to 500. A switch
 * that sends Program Change has cc 128 + program; it can only tap (it never sends a release).
 */
export interface Mapping {
  switch: { channel: number; cc: number };
  page: number;
  tap: ActionRef | null;
  hold: ActionRef | null;
  holdMs?: number;
}

export interface Track {
  id: string;
  name: string;
  file: string;
  channels: number;
  role: "backing" | "click" | "stem" | "cue";
  defaultLevel: number;
}

export interface Song { id: string; title: string; bpm?: number; notes?: string; tracks: Track[] }

export interface Setlist {
  id: string;
  name: string;
  owner: "library" | string;
  songs: string[];
  autoAdvance: boolean;
}

export interface TrackMixEntry { outputs: OutputRef[]; level: number; pan: number; mute: boolean }

export interface ProjectSummary {
  id: string;
  name: string;
  color: string;
  chainCount: number;
  /** ms since epoch */
  openedAt: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  /** ms since epoch */
  openedAt: number;
  mainOutput: number[];
  setlists: string[];
  songPresets: Record<string, string>;
  trackMix: Record<string, Record<string, TrackMixEntry>>;
}

export interface TransportState { playing: boolean; songId: string | null; position: number }

export interface TuneModeState {
  active: boolean;
  tunerInput: number;
  reference: number;
  vocalChainId: string | null;
  backingTracks: "pause" | "mute";
}

export interface GlitchState {
  device: DeviceInfo | null;
  devices: AudioDeviceOption[];
  plugins: PluginLibraryState;
  /** NAM models and cabinet IRs in the library. */
  library: { nam: LibraryFile[]; ir: LibraryFile[] };
  /** URL prefix for the open project's block snapshots, or "" when there are none to serve. */
  snapshotBase: string;
  monitor: MonitorState;
  panic: boolean;
  /** The open project. */
  project: Project | null;
  /** All projects, most recently opened first. */
  projects: ProjectSummary[];
  /** The open project's chains. */
  chains: Chain[];
  /** The open project's presets, oldest first, and the one the rig was last loaded from or saved to. */
  presets: PresetSummary[];
  currentPresetId: string | null;
  /** The rig differs from that preset: chains, blocks, routing, levels or plugin settings. */
  presetModified: boolean;
  mappings: Mapping[];
  setlists: Setlist[];
  songs: Song[];
  transport: TransportState;
  tuneMode: TuneModeState;
  midi: {
    /** The chosen MIDI input, by name; connected says whether it's plugged in and open. */
    device: string | null;
    connected: boolean;
    devices: string[];
    /** MIDI learn: the next switch pressed gets this action. */
    learning: { action: ActionRef; gesture: "tap" | "hold"; page: number } | null;
    page: number;
    pageCount: number;
    lastSwitch: { channel: number; cc: number } | null;
    /** Every switch pressed so far (MIDI doesn't list a controller's switches), kept with the MIDI setup. */
    switches: { channel: number; cc: number }[];
  };
}

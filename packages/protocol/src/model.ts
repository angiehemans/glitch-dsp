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
  latencyMs: number;
  inputs: string[];
  outputs: string[];
}

/** An audio device the engine can switch to. */
export interface AudioDeviceOption {
  type: string;
  name: string;
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

export interface PluginLibraryState {
  scanning: boolean;
  list: PluginInfo[];
}

export interface MonitorState {
  gainDb: number;
  muted: boolean;
}

export interface InputRef { hwChannel: number; gain: number }
export interface OutputRef { hwChannels: number[]; level: number; pan: number }

export type BlockType = "nam" | "ir" | "plugin" | "utility" | "aby";

export interface Block {
  id: string;
  type: BlockType;
  name: string;
  enabled: boolean;
  mix?: number;
  params?: Record<string, number>;
  /** type "plugin": which plugin, and whether it failed to load (not installed). */
  plugin?: PluginInfo;
  missing?: boolean;
}

export interface AbyPath { blocks: Block[]; level: number; pan: number; mute: boolean }

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
  outputs: OutputRef[];
  bypassed: boolean;
  muted: boolean;
}

export interface PresetSummary { id: string; name: string }

export interface ActionRef { type: string; [key: string]: unknown }

export interface Mapping {
  switch: { device: string; channel: number; cc: number };
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
  monitor: MonitorState;
  panic: boolean;
  /** The open project. */
  project: Project | null;
  /** All projects, most recently opened first. */
  projects: ProjectSummary[];
  /** The open project's chains. */
  chains: Chain[];
  presets: PresetSummary[];
  currentPresetId: string | null;
  mappings: Mapping[];
  setlists: Setlist[];
  songs: Song[];
  transport: TransportState;
  tuneMode: TuneModeState;
  midi: { device: string | null };
}

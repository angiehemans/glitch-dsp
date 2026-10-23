// Data model from docs/plan.md. Only device, monitor and panic are live in M0;
// the rest is stubbed so later milestones fill it in without reshaping the state.

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

export interface ProjectSummary { id: string; name: string; color: string }

export interface Project extends ProjectSummary {
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
  monitor: MonitorState;
  panic: boolean;
  project: Project | null;
  projects: ProjectSummary[];
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

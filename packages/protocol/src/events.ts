import type { GlitchState } from "./model";

export interface StateEvent { type: "state"; state: GlitchState }

/** ~30 Hz. Keys like "in:1", "out:1"; values in dBFS (SILENCE_DB for silence). cpu is 0..1. */
export interface MetersEvent { type: "meters"; levels: Record<string, number>; cpu: number }

export interface TransportEvent { type: "transport"; position: number; songId: string; playing: boolean }
export interface TunerEvent { type: "tuner"; note: string; cents: number; hz: number }
export interface SwitchEvent { type: "switch"; switchId: string; state: "down" | "held" | "up" }
export interface ErrorEvent { type: "error"; message: string }

/** Engine -> UI. */
export type EngineEvent = StateEvent | MetersEvent | TransportEvent | TunerEvent | SwitchEvent | ErrorEvent;

import { signal } from "@preact/signals";
import type { Command, GlitchState, MetersEvent, TransportState, TunerEvent } from "@glitch/protocol";
import { engine } from "../bridge/engine";

export const glitch = signal<GlitchState | null>(null);
export const lastError = signal<string | null>(null);
/** Whole-percent CPU; signals skip equal values, so this re-renders rarely despite 30 Hz meters. */
export const cpuPercent = signal(0);
/** The latest tuner reading, while tune mode is on (~15 Hz). Only the tuner view reads it. */
export const tuner = signal<TunerEvent | null>(null);
/** Where the song is (~10 Hz while playing), from transport events and every state. */
export const transport = signal<TransportState>({ playing: false, songId: null, position: 0 });

const meterSubscribers = new Set<(m: MetersEvent) => void>();

/** Meters bypass the store: subscribers write straight to the DOM. */
export function onMeters(fn: (m: MetersEvent) => void) {
  meterSubscribers.add(fn);
  return () => {
    meterSubscribers.delete(fn);
  };
}

export function send(cmd: Command) {
  engine.send(cmd);
}

export function startStore() {
  engine.subscribe((event) => {
    switch (event.type) {
      case "state":
        glitch.value = event.state;
        transport.value = event.state.transport;
        break;
      case "transport":
        transport.value = { playing: event.playing, songId: event.songId, position: event.position };
        break;
      case "meters":
        cpuPercent.value = Math.round(event.cpu * 100);
        meterSubscribers.forEach((fn) => fn(event));
        break;
      case "tuner":
        tuner.value = event;
        break;
      case "error":
        lastError.value = event.message;
        break;
    }
  });
  send({ type: "app.ready" });
}

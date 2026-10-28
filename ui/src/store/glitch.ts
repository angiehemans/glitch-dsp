import { signal } from "@preact/signals";
import type { Command, GlitchState, MetersEvent, TunerEvent } from "@glitch/protocol";
import { engine } from "../bridge/engine";

export const glitch = signal<GlitchState | null>(null);
export const lastError = signal<string | null>(null);
/** Whole-percent CPU; signals skip equal values, so this re-renders rarely despite 30 Hz meters. */
export const cpuPercent = signal(0);
/** The latest tuner reading, while tune mode is on (~15 Hz). Only the tuner view reads it. */
export const tuner = signal<TunerEvent | null>(null);

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

import { COMMAND_EVENT, ENGINE_EVENT, type Command, type EngineEvent } from "@glitch/protocol";
import { createMockEngine } from "./mockEngine";

export interface EngineBridge {
  send(cmd: Command): void;
  subscribe(fn: (event: EngineEvent) => void): () => void;
}

const juce = window.__JUCE__;

export const isMock = !juce;

export const engine: EngineBridge = juce
  ? {
      send: (cmd) => juce.backend.emitEvent(COMMAND_EVENT, cmd),
      subscribe: (fn) => {
        const token = juce.backend.addEventListener(ENGINE_EVENT, fn);
        return () => juce.backend.removeEventListener(token);
      },
    }
  : createMockEngine();

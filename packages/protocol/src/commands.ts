import type { ActionRef, InputRef, OutputRef } from "./model";

/** UI -> engine. Add a type here, its string in Protocol.h, a handler in WebUi.cpp and a branch in mockEngine.ts. */
export type Command =
  // M0
  | { type: "app.ready" }
  | { type: "monitor.setGain"; gainDb: number }
  | { type: "monitor.setMute"; muted: boolean }
  | { type: "panic.toggle" }
  // Stubbed from the plan; not handled until their milestone.
  | { type: "chain.create"; name: string }
  | { type: "chain.setInputs"; chainId: string; inputs: InputRef[] }
  | { type: "chain.setOutputs"; chainId: string; outputs: OutputRef[] }
  | { type: "block.add"; chainId: string; block: { type: string; [key: string]: unknown }; index?: number }
  | { type: "block.setParam"; blockId: string; param: string; value: number }
  | { type: "block.toggle"; blockId: string }
  | { type: "chain.splitAt"; chainId: string; index: number; duplicate?: boolean }
  | { type: "aby.setMode"; blockId: string; mode: "Y" | "AB" }
  | { type: "aby.select"; blockId: string; path: "A" | "B" }
  | { type: "aby.moveBlock"; blockId: string; toPath: "A" | "B" | "main"; index: number }
  | { type: "project.create"; name: string; from?: string }
  | { type: "project.open"; projectId: string }
  | { type: "project.setMainOutput"; outputs: number[] }
  | { type: "setlist.create"; name: string; projectId?: string }
  | { type: "setlist.addToProject"; setlistId: string; projectId: string }
  | { type: "setlist.import"; path: string; projectId?: string }
  | { type: "song.import"; files: string[]; title: string }
  | { type: "song.addTrack"; songId: string; file: string; name: string }
  | {
      type: "trackMix.set";
      songId: string;
      trackId: string;
      outputs?: OutputRef[];
      level?: number;
      pan?: number;
      mute?: boolean;
    }
  | { type: "transport.play" }
  | { type: "transport.stop" }
  | { type: "transport.next" }
  | { type: "midi.learn"; action: ActionRef; gesture: "tap" | "hold" }
  | { type: "tune.toggle" }
  | { type: "tune.setInput"; hwChannel: number }
  | { type: "preset.load"; presetId: string };

export type CommandType = Command["type"];

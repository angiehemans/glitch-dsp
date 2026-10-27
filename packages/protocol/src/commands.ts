import type { ActionRef, InputRef, OutputRef } from "./model";

/** UI -> engine. Add a type here, its string in Protocol.h, a handler in WebUi.cpp and a branch in mockEngine.ts. */
export type Command =
  // M0
  | { type: "app.ready" }
  | { type: "monitor.setGain"; gainDb: number }
  | { type: "monitor.setMute"; muted: boolean }
  | { type: "panic.toggle" }
  // Projects and chains. A new project is opened straight away.
  | { type: "project.create"; name?: string; from?: string }
  | { type: "project.open"; projectId: string }
  | { type: "project.rename"; projectId: string; name: string }
  | { type: "chain.create"; name?: string }
  | { type: "chain.rename"; chainId: string; name: string }
  | { type: "chain.remove"; chainId: string }
  | { type: "chain.setInputs"; chainId: string; inputs: Pick<InputRef, "hwChannel">[] }
  | { type: "chain.setOutputs"; chainId: string; outputs: Pick<OutputRef, "hwChannels">[] }
  | { type: "chain.setLevel"; chainId: string; levelDb: number }
  | { type: "chain.setMute"; chainId: string; muted: boolean }
  // Audio device
  | { type: "device.scan" }
  | { type: "device.select"; deviceType: string; name: string }
  | { type: "device.setFormat"; sampleRate?: number; bufferSize?: number }
  // Plugins and the library: scan the standard plugin folders (and re-read the library), or pick
  // plugins, folders, .nam models or IRs in a native file chooser (models and IRs are copied in).
  | { type: "plugins.scan" }
  | { type: "library.import" }
  | {
      type: "block.add";
      chainId: string;
      block: { type: "plugin"; pluginId: string } | { type: "nam" | "ir"; file: string };
      index?: number;
      /** Add into a path of this chain's ABY block instead of the chain itself. */
      abyId?: string;
      path?: "A" | "B";
    }
  | { type: "block.remove"; blockId: string }
  | { type: "block.toggle"; blockId: string }
  | { type: "block.openEditor"; blockId: string }
  // ABY: splitAt inserts one at index (default: the end), moving the blocks after it into path A.
  // block.remove on an ABY keeps path A in the chain and deletes path B.
  | { type: "chain.splitAt"; chainId: string; index?: number }
  | { type: "aby.setMode"; blockId: string; mode: "Y" | "AB" }
  | { type: "aby.select"; blockId: string; path: "A" | "B" }
  | { type: "aby.setLevel"; blockId: string; path: "A" | "B"; levelDb: number }
  | { type: "aby.setMute"; blockId: string; path: "A" | "B"; muted: boolean }
  // Stubbed from the plan; not handled until their milestone.
  | { type: "block.setParam"; blockId: string; param: string; value: number }
  | { type: "aby.moveBlock"; blockId: string; toPath: "A" | "B" | "main"; index: number }
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

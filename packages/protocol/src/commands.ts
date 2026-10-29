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
  /** The output chip's shortcut: sets the chain's first send to these outputs (adding one if it has none). */
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
  /**
   * Moves a block, or an ABY with its paths, to index in a chain, or into a path of that chain's ABY
   * abyId. The index counts the block in its old place. A split exit has to stay its chain's last block.
   */
  | { type: "block.move"; blockId: string; chainId: string; index: number; abyId?: string; path?: "A" | "B" }
  // Output matrix: a chain's send to hwChannels (one output, or a left/right pair). set adds it at
  // 0 dB if it's missing, then applies level and mute; remove drops it. A chain that splits to
  // separate outputs routes path A and B (path); any other routes the chain (no path).
  // A backing track of the current song routes the same way, with trackId instead of chainId.
  | { type: "route.set"; chainId?: string; trackId?: string; path?: "A" | "B"; hwChannels: number[]; level?: number; mute?: boolean }
  | { type: "route.remove"; chainId?: string; trackId?: string; path?: "A" | "B"; hwChannels: number[] }
  // Backing tracks. import opens a file chooser: the chosen WAV/AIFF files become one song (a track
  // each), copied into the library, and the current song. select puts a song in the player (null: none).
  | { type: "song.import" }
  | { type: "song.select"; songId: string | null }
  | { type: "song.rename"; songId: string; title: string }
  | { type: "song.delete"; songId: string }
  /** A track of the current song in this project's track mix: its level or mute, or outputs, which
   * (like chain.setOutputs) sets its first send. */
  | { type: "trackMix.set"; trackId: string; outputs?: Pick<OutputRef, "hwChannels">[]; level?: number; mute?: boolean }
  | { type: "transport.play" }
  | { type: "transport.stop" }
  | { type: "transport.restart" }
  // ABY: splitAt inserts one at index (default: the end), moving the blocks after it into path A.
  // block.remove on an ABY keeps path A in the chain and deletes path B.
  | { type: "chain.splitAt"; chainId: string; index?: number }
  | { type: "aby.setMode"; blockId: string; mode: "Y" | "AB" }
  | { type: "aby.select"; blockId: string; path: "A" | "B" }
  | { type: "aby.setMute"; blockId: string; path: "A" | "B"; muted: boolean }
  // A split exit sends each path to its own outputs (splitOutputs) and ends the chain, so only the
  // chain's last block can split. It starts with both paths on the chain's outputs.
  | { type: "aby.setExit"; blockId: string; exit: "merge" | "split" }
  | { type: "aby.setOutputs"; blockId: string; path: "A" | "B"; outputs: Pick<OutputRef, "hwChannels">[] }
  // Presets: a project's whole rig (chains, blocks, plugin states, routing). save overwrites the
  // current preset (or makes one when there's none); saveAs always makes one. load swaps the rig
  // in while every chain is faded out; blocks the presets share keep running.
  | { type: "preset.save"; name?: string }
  | { type: "preset.saveAs"; name?: string }
  | { type: "preset.load"; presetId: string }
  | { type: "preset.rename"; presetId: string; name: string }
  | { type: "preset.delete"; presetId: string }
  // Footswitch. name null = no MIDI input. set maps a switch's tap or hold on a page; learn instead
  // waits for the next switch pressed and maps that (on page, default the current one); clear removes
  // one gesture of a switch's mapping. press acts as if
  // the switch were pressed (down) or released, for on-screen switches and tests.
  | { type: "midi.selectDevice"; name: string | null }
  | { type: "midi.learn"; action: ActionRef; gesture: "tap" | "hold"; page?: number }
  | { type: "midi.cancelLearn" }
  /** Drops a found switch, and its mappings in the open project. Pressing it again finds it again. */
  | { type: "midi.forgetSwitch"; channel: number; cc: number }
  | { type: "mapping.set"; channel: number; cc: number; page: number; gesture: "tap" | "hold"; action: ActionRef }
  | { type: "mapping.clear"; channel: number; cc: number; page: number; gesture: "tap" | "hold" }
  | { type: "mapping.setHoldMs"; channel: number; cc: number; page: number; holdMs: number }
  | { type: "footswitch.setPage"; page: number }
  | { type: "footswitch.press"; channel: number; cc: number; down: boolean }
  // Stubbed from the plan; not handled until their milestone.
  | { type: "block.setParam"; blockId: string; param: string; value: number }
  | { type: "project.setMainOutput"; outputs: number[] }
  | { type: "setlist.create"; name: string; projectId?: string }
  | { type: "setlist.addToProject"; setlistId: string; projectId: string }
  | { type: "setlist.import"; path: string; projectId?: string }
  | { type: "song.addTrack"; songId: string; file: string; name: string }
  | { type: "transport.next" }
  | { type: "tune.toggle" }
  | { type: "tune.setInput"; hwChannel: number }
  /** A4 in Hz, 415 to 466. */
  | { type: "tune.setReference"; hz: number }
  /** The chain that stays live in tune mode, or null to mute everything. */
  | { type: "tune.setVocalChain"; chainId: string | null };

export type CommandType = Command["type"];

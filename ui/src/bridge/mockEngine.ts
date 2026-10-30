import {
  SILENCE_DB,
  type AbyBlock,
  type ActionRef,
  type Block,
  type Chain,
  type Command,
  type EngineEvent,
  type GlitchState,
  type Mapping,
  type Project,
  type TrackMixEntry,
} from "@glitch/protocol";
import type { EngineBridge } from "./engine";

export function emptyState(): GlitchState {
  return {
    device: null,
    devices: [],
    plugins: { scanning: false, progress: 0, current: "", list: [] },
    snapshotBase: "",
    library: { nam: [], ir: [] },
    monitor: { gainDb: 0, muted: false },
    panic: false,
    project: null,
    projects: [],
    chains: [],
    presets: [],
    currentPresetId: null,
    presetModified: false,
    mappings: [],
    setlists: [],
    librarySetlists: [],
    songs: [],
    transport: { playing: false, songId: null, position: 0 },
    tuneMode: { active: false, tunerInput: 1, reference: 440, vocalChainId: null, backingTracks: "pause" },
    midi: { device: null, connected: false, devices: [], page: 0, pageCount: 1, lastSwitch: null, switches: [] },
  };
}

const COLOURS = ["orange", "cyan", "pink", "lime", "violet"];
const MAX_CHAINS = 8;
const newId = () => Math.random().toString(16).slice(2, 10);

/**
 * Browser stand-in for the JUCE engine: same commands and validation, starts blank like a fresh
 * install, fake input signal. Projects live in memory only (the real engine saves them).
 */
export function createMockEngine(): EngineBridge {
  const listeners = new Set<(e: EngineEvent) => void>();
  type Bypass = { chains: Record<string, boolean>; blocks: Record<string, boolean> };
  type MockPreset = { id: string; name: string; bypass: Bypass };
  const projects: (Project & { chains: Chain[]; openedAt: number; presets: MockPreset[]; currentPresetId: string | null; mappings: Mapping[] })[] = [];
  // What a preset keeps of the rig: chain mutes and block bypasses (as ProjectStore's bypassOf).
  const blocksOf = (c: Chain) => c.blocks.flatMap((b) => (b.type === "aby" ? [...(b as AbyBlock).pathA.blocks, ...(b as AbyBlock).pathB.blocks] : [b]));
  const bypassOf = (chains: Chain[]): Bypass => ({
    chains: Object.fromEntries(chains.map((c) => [c.id, c.muted])),
    blocks: Object.fromEntries(chains.flatMap(blocksOf).map((b) => [b.id, b.enabled])),
  });
  const state: GlitchState = {
    ...emptyState(),
    device: {
      name: "Mock M4",
      type: "Mock",
      sampleRate: 48000,
      bufferSize: 128,
      latencyMs: 5.3,
      inputs: ["Input 1", "Input 2"],
      outputs: ["Output 1", "Output 2", "Output 3", "Output 4"], // like the M4
      sampleRates: [44100, 48000, 96000],
      bufferSizes: [32, 64, 128, 256, 512, 1024],
    },
    devices: [
      { type: "Mock", name: "Mock M4", label: "Mock M4", current: true },
      { type: "Mock", name: "Mock built-in audio", label: "Mock built-in audio", current: false },
    ],
  };

  // Async like the real bridge, so the UI never relies on synchronous replies.
  const emit = (e: EngineEvent) => setTimeout(() => listeners.forEach((fn) => fn(e)));
  const emitState = () => {
    const current = projects.find((p) => p.id === state.project?.id) ?? null;
    state.project = current;
    state.chains = current?.chains ?? [];
    state.presets = current?.presets.map(({ id, name }) => ({ id, name })) ?? [];
    state.currentPresetId = current?.currentPresetId ?? null;
    const preset = current?.presets.find((p) => p.id === current.currentPresetId);
    const rig = bypassOf(current?.chains ?? []);
    state.presetModified =
      !!preset &&
      (Object.entries(rig.chains).some(([id, muted]) => preset.bypass.chains[id] !== muted) ||
        Object.entries(rig.blocks).some(([id, on]) => preset.bypass.blocks[id] !== on));
    state.mappings = current?.mappings ?? [];
    state.setlists = current?.setlists ?? [];
    state.midi = { ...state.midi, connected: state.midi.device !== null, devices: ["Mock Chocolate"], pageCount: pageCount() };
    state.projects = [...projects]
      .sort((a, b) => b.openedAt - a.openedAt)
      .map((p) => ({ id: p.id, name: p.name, color: p.color, chainCount: p.chains.length, openedAt: p.openedAt }));
    emit({ type: "state", state: JSON.parse(JSON.stringify(state)) });
  };
  const error = (message: string) => emit({ type: "error", message });
  const open = (id: string) => {
    const p = projects.find((p) => p.id === id);
    if (p) {
      p.openedAt = Date.now();
      state.project = p;
    }
    return p;
  };
  const chain = (id: string) => state.chains.find((c) => c.id === id);
  // Every block list of a chain: its own, then each ABY's paths (as ProjectStore::getBlockLists).
  const blockLists = (c: Chain) => [
    c.blocks,
    ...c.blocks.filter((b): b is AbyBlock => b.type === "aby").flatMap((a) => [a.pathA.blocks, a.pathB.blocks]),
  ];
  const findBlock = (id: string) => {
    for (const c of state.chains)
      for (const list of blockLists(c)) {
        const i = list.findIndex((b) => b.id === id);
        if (i >= 0) return { chain: c, list, index: i, block: list[i] };
      }
    return null;
  };
  const findAby = (id: string) => {
    const found = findBlock(id);
    return found?.block.type === "aby" ? (found.block as AbyBlock) : null;
  };
  const newPath = () => ({ blocks: [] as Block[], mute: false });
  const endsInSplit = (c: Chain) => {
    const last = c.blocks[c.blocks.length - 1];
    return last?.type === "aby" && (last as AbyBlock).exit === "split";
  };

  let t = 0;
  setInterval(() => {
    t += 1 / 30;
    // A strummed-guitar-ish envelope, occasionally peaking over 0 dBFS so clip shows up.
    const env = Math.abs(Math.sin(t * 1.3)) ** 3;
    const signal = -50 + 52 * env + Math.random() * 3; // the same fake signal on every input
    const levels: Record<string, number> = Object.fromEntries((state.device?.inputs ?? []).map((_, i) => [`in:${i + 1}`, signal]));
    const outs = state.device!.outputs.map(() => SILENCE_DB);
    for (const c of state.chains) {
      const out = c.muted ? SILENCE_DB : Math.max(SILENCE_DB, signal + c.level);
      levels[`chain:${c.id}:in`] = signal;
      levels[`chain:${c.id}:out`] = out;
      const split = endsInSplit(c) ? (c.blocks[c.blocks.length - 1] as AbyBlock).splitOutputs : undefined;
      for (const send of split ? [...split.A, ...split.B] : c.outputs)
        if (!send.mute) for (const ch of send.hwChannels) if (ch <= outs.length) outs[ch - 1] = Math.max(outs[ch - 1], out + send.level);
    }
    const master = state.monitor.muted || state.panic ? SILENCE_DB : state.monitor.gainDb;
    outs.forEach((o, i) => (levels[`out:${i + 1}`] = Math.max(SILENCE_DB, o + master)));
    emit({ type: "meters", levels, cpu: 0.08 + Math.random() * 0.04 });
    // The song plays on, and stops at its end.
    const song = currentSong();
    if (state.transport.playing && song) {
      state.transport.position = Math.min(song.length, state.transport.position + 1 / 30);
      if (state.transport.position >= song.length) {
        state.transport.playing = false;
        // The setlist moves on, when it auto-advances.
        const next = currentSetlist()?.autoAdvance ? setlistNeighbour(1) : undefined;
        if (next) {
          selectSong(next);
          state.transport.playing = true;
        }
        emitState();
      }
      if (Math.round(t * 30) % 3 === 0) emit({ type: "transport", ...state.transport, songId: song.id });
    }
    // A guitar's low E drifting a few cents either side, with gaps between notes.
    if (state.tuneMode.active && Math.round(t * 30) % 2 === 0) {
      const hz = Math.sin(t * 0.8) > -0.6 ? 82.41 * 2 ** ((12 * Math.sin(t * 0.5)) / 1200) * (state.tuneMode.reference / 440) : 0;
      const midi = hz ? 69 + 12 * Math.log2(hz / state.tuneMode.reference) : 0;
      const n = Math.round(midi);
      const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      emit({ type: "tuner", hz, note: hz ? names[((n % 12) + 12) % 12] : "", octave: Math.floor(n / 12) - 1, cents: hz ? (midi - n) * 100 : 0 });
    }
  }, 1000 / 30);

  // Setlists, as WebUi: the project's current one, and a song's neighbours in it.
  const currentSetlist = () => {
    const p = projects.find((p) => p.id === state.project?.id);
    return p?.setlists.find((l) => l.id === p.setlistId);
  };
  const setlistNeighbour = (step: number) => {
    const ids = (currentSetlist()?.songs ?? []).filter((id) => state.songs.some((s) => s.id === id));
    const at = ids.indexOf(projects.find((p) => p.id === state.project?.id)?.songId ?? "");
    if (at < 0) return step > 0 ? ids[0] : undefined;
    return ids[at + step];
  };
  /** The project's set: its current setlist (or first), made when create and it has none (as WebUi). */
  const projectList = (p: (typeof projects)[number], create: boolean) => {
    let list = p.setlists.find((x) => x.id === p.setlistId) ?? p.setlists[0];
    if (!list && create) {
      list = { id: newId(), name: p.name, owner: p.id, songs: [], autoAdvance: false };
      p.setlists.push(list);
    }
    if (list) p.setlistId = list.id;
    return list;
  };

  const selectSong = (songId: string | null) => {
    const p = projects.find((p) => p.id === state.project?.id);
    if (p) p.songId = songId;
    state.transport = { playing: false, songId, position: 0 };
    // Its linked preset, unless that's already the rig's (as WebUi).
    const presetId = songId && p?.songPresets[songId];
    if (presetId && presetId !== p.currentPresetId) bridge.send({ type: "preset.load", presetId });
  };

  // Backing tracks, as WebUi: the project's current song, and its track mix (default: main output).
  const currentSong = () => state.songs.find((s) => s.id === projects.find((p) => p.id === state.project?.id)?.songId);
  const trackMixEntry = (trackId: string, create: boolean): TrackMixEntry | undefined => {
    const p = projects.find((p) => p.id === state.project?.id);
    const song = currentSong();
    const track = song?.tracks.find((t) => t.id === trackId);
    if (!p || !song || !track) return undefined;
    const existing = p.trackMix[song.id]?.[trackId];
    if (existing) return existing;
    const entry = { outputs: [{ hwChannels: [...p.mainOutput], level: 0, pan: 0, mute: false }], level: track.defaultLevel, pan: 0, mute: false };
    if (create) (p.trackMix[song.id] ??= {})[trackId] = entry;
    return entry;
  };

  // Footswitch, as the engine's Footswitch and WebUi: tap/hold, pages, actions.
  const mappings = () => projects.find((p) => p.id === state.project?.id)?.mappings;
  const findMapping = (channel: number, cc: number, page: number) =>
    mappings()?.find((m) => m.switch.channel === channel && m.switch.cc === cc && m.page === page);
  const pageCount = () => Math.max(1, ...(mappings() ?? []).map((m) => m.page + 1));
  const held = new Map<string, { done: boolean; timer?: ReturnType<typeof setTimeout> }>();
  const press = (channel: number, cc: number) => {
    const key = `${channel}:${cc}`;
    if (held.has(key)) return; // a repeated press
    state.midi.lastSwitch = { channel, cc };
    if (!state.midi.switches.some((s) => s.channel === channel && s.cc === cc)) state.midi.switches.push({ channel, cc });
    if (state.tuneMode.active) {
      // Any switch leaves tune mode, whatever it's mapped to.
      state.tuneMode.active = false;
      held.set(key, { done: true });
      return emitState();
    }
    const m = findMapping(channel, cc, state.midi.page);
    if (!m?.hold) {
      held.set(key, { done: true });
      return m?.tap ? run(m.tap) : emitState(); // no hold action: tap on press
    }
    const h: { done: boolean; timer?: ReturnType<typeof setTimeout> } = { done: false };
    h.timer = setTimeout(() => {
      h.done = true;
      run(m.hold!);
    }, m.holdMs ?? 500);
    held.set(key, h);
  };
  const release = (channel: number, cc: number) => {
    const key = `${channel}:${cc}`;
    const h = held.get(key);
    if (!h) return; // a release with no press
    held.delete(key);
    clearTimeout(h.timer);
    const tap = findMapping(channel, cc, state.midi.page)?.tap;
    if (!h.done && tap) run(tap);
  };
  const run = (action: ActionRef) => {
    const p = projects.find((p) => p.id === state.project?.id);
    if (action.type === "page.next") {
      state.midi.page = (state.midi.page + 1) % pageCount();
      return emitState();
    }
    if ((action.type === "preset.next" || action.type === "preset.prev") && p?.presets.length) {
      const at = p.presets.findIndex((x) => x.id === p.currentPresetId);
      const n = p.presets.length;
      const next = action.type === "preset.next" ? (at + 1) % n : at <= 0 ? n - 1 : at - 1;
      return bridge.send({ type: "preset.load", presetId: p.presets[next].id });
    }
    if (action.type === "chain.toggleMute") {
      const c = chain(action.chainId as string);
      return c ? bridge.send({ type: "chain.setMute", chainId: c.id, muted: !c.muted }) : emitState();
    }
    if (action.type === "aby.toggleAB" || action.type === "aby.toggleY") {
      const aby = findAby(action.blockId as string);
      if (!aby) return emitState();
      if (action.type === "aby.toggleY" || aby.mode === "Y") return bridge.send({ type: "aby.setMode", blockId: aby.id, mode: aby.mode === "Y" ? "AB" : "Y" });
      return bridge.send({ type: "aby.select", blockId: aby.id, path: aby.active === "A" ? "B" : "A" });
    }
    if (action.type === "transport.toggle") return bridge.send({ type: state.transport.playing ? "transport.stop" : "transport.play" });
    if (["block.toggle", "preset.load", "aby.select", "panic.toggle", "tune.toggle", "transport.next", "transport.prev", "transport.restart"].includes(action.type))
      return bridge.send(action as unknown as Command);
    error(`The footswitch can't do ${action.type} yet`);
  };

  const bridge: EngineBridge = {
    send(cmd: Command) {
      switch (cmd.type) {
        case "app.ready":
          break;
        case "monitor.setGain":
          state.monitor.gainDb = cmd.gainDb;
          break;
        case "monitor.setMute":
          state.monitor.muted = cmd.muted;
          break;
        case "panic.toggle":
          state.panic = !state.panic;
          if (state.panic) state.transport = { ...state.transport, playing: false }; // as WebUi: the song stops
          break;
        case "project.create": {
          const id = newId();
          projects.push({
            id,
            name: cmd.name?.trim() || `New project ${projects.length + 1}`,
            color: COLOURS[projects.length % COLOURS.length],
            mainOutput: [1, 2],
            setlists: [],
            songPresets: {},
            trackMix: {},
            chains: [],
            openedAt: Date.now(),
            presets: [],
            currentPresetId: null,
            mappings: [],
          });
          open(id);
          break;
        }
        case "project.open":
          if (!open(cmd.projectId)) return error(`Unknown project: ${cmd.projectId}`);
          break;
        case "project.rename": {
          const p = projects.find((p) => p.id === cmd.projectId);
          const name = cmd.name.replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (!name) return error("A project needs a name");
          if (!p) return error(`Unknown project: ${cmd.projectId}`);
          p.name = name;
          break;
        }
        case "preset.save":
        case "preset.saveAs":
        case "preset.load":
        case "preset.rename":
        case "preset.delete": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (!p) return error("No project open");
          const clean = (name?: string) => (name ?? "").replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (cmd.type === "preset.save" || cmd.type === "preset.saveAs") {
            const existing = cmd.type === "preset.save" ? p.presets.find((x) => x.id === p.currentPresetId) : undefined;
            const preset = existing ?? { id: newId(), name: clean(cmd.name) || `Preset ${p.presets.length + 1}`, bypass: bypassOf([]) };
            if (existing && clean(cmd.name)) existing.name = clean(cmd.name);
            preset.bypass = bypassOf(p.chains);
            if (!existing) p.presets.push(preset);
            p.currentPresetId = preset.id;
            break;
          }
          const preset = p.presets.find((x) => x.id === cmd.presetId);
          if (!preset) return error(`Unknown preset: ${cmd.presetId}`);
          if (cmd.type === "preset.load") {
            for (const c of p.chains) {
              c.muted = preset.bypass.chains[c.id] ?? c.muted;
              for (const b of blocksOf(c)) b.enabled = preset.bypass.blocks[b.id] ?? b.enabled;
            }
            p.currentPresetId = preset.id;
          }
          if (cmd.type === "preset.rename") {
            if (!clean(cmd.name)) return error("A preset needs a name");
            preset.name = clean(cmd.name);
          }
          if (cmd.type === "preset.delete") {
            p.presets.splice(p.presets.indexOf(preset), 1);
            if (p.currentPresetId === preset.id) p.currentPresetId = null;
            for (const [songId, linked] of Object.entries(p.songPresets)) if (linked === preset.id) delete p.songPresets[songId];
          }
          break;
        }
        case "tune.toggle":
          if (!state.project) return error("No project open");
          state.tuneMode.active = !state.tuneMode.active;
          if (state.tuneMode.active) state.transport.playing = false; // the song pauses while tuning
          break;
        case "song.import": {
          const p = projects.find((p) => p.id === state.project?.id);
          // A browser can't open the engine's file chooser: a sample song stands in.
          const id = newId();
          state.songs.push({
            id,
            title: ["Midnight City", "Dancing in the Dark", "Seven Nation Army"][state.songs.length % 3],
            length: 180 + 30 * state.songs.length,
            tracks: [
              { id: newId(), name: "Backing", file: "backing.wav", channels: 2, role: "backing", defaultLevel: 0 },
              { id: newId(), name: "Click", file: "click.wav", channels: 1, role: "click", defaultLevel: 0 },
              { id: newId(), name: "Guitar 2", file: "gtr2.wav", channels: 2, role: "stem", defaultLevel: 0 },
            ],
          });
          // Into the project's set as its current song, or a library setlist (as WebUi).
          if (cmd.into === "project" && p) {
            projectList(p, true)!.songs.push(id);
            p.songId = id;
            state.transport = { playing: false, songId: id, position: 0 };
          } else state.librarySetlists.find((l) => l.id === cmd.into)?.songs.push(id);
          break;
        }
        case "song.addTracks": {
          const song = state.songs.find((s) => s.id === cmd.songId);
          if (!song) return error(`Unknown song: ${cmd.songId}`);
          song.tracks.push({ id: newId(), name: "Drums", file: "drums.wav", channels: 2, role: "stem", defaultLevel: 0 });
          break;
        }
        case "song.select": {
          if (!state.project) return error("Open a project first");
          if (cmd.songId && !state.songs.some((s) => s.id === cmd.songId)) return error(`Unknown song: ${cmd.songId}`);
          selectSong(cmd.songId);
          break;
        }
        case "song.setPreset": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (!p) return error("Open a project first");
          if (!state.songs.some((s) => s.id === cmd.songId)) return error(`Unknown song: ${cmd.songId}`);
          if (cmd.presetId && !p.presets.some((x) => x.id === cmd.presetId)) return error(`Unknown preset: ${cmd.presetId}`);
          if (cmd.presetId) p.songPresets[cmd.songId] = cmd.presetId;
          else delete p.songPresets[cmd.songId];
          break;
        }
        case "song.rename":
        case "song.delete": {
          const song = state.songs.find((s) => s.id === cmd.songId);
          if (!song) return error(`Unknown song: ${cmd.songId}`);
          if (cmd.type === "song.rename") song.title = cmd.title.trim() || song.title;
          else {
            state.songs.splice(state.songs.indexOf(song), 1);
            for (const p of projects) if (p.songId === song.id) p.songId = null;
            if (state.transport.songId === song.id) state.transport = { playing: false, songId: null, position: 0 };
          }
          break;
        }
        case "trackMix.set": {
          const entry = trackMixEntry(cmd.trackId, true);
          if (!entry) return error("That track isn't in the current song");
          if (cmd.outputs) {
            if (!cmd.outputs[0]?.hwChannels.length) return error("Invalid output channels");
            if (entry.outputs.length) entry.outputs[0].hwChannels = [...cmd.outputs[0].hwChannels];
            else entry.outputs.push({ hwChannels: [...cmd.outputs[0].hwChannels], level: 0, pan: 0, mute: false });
          }
          if (cmd.level !== undefined) entry.level = Math.min(10, Math.max(SILENCE_DB, cmd.level));
          if (cmd.mute !== undefined) entry.mute = cmd.mute;
          break;
        }
        case "transport.play":
          if (!currentSong()) return error("Choose a song first");
          if (state.transport.position >= currentSong()!.length) state.transport.position = 0;
          state.transport.playing = true;
          break;
        case "transport.stop":
          state.transport.playing = false;
          break;
        case "transport.restart":
          state.transport.position = 0;
          break;
        case "transport.next":
        case "transport.prev": {
          const id = setlistNeighbour(cmd.type === "transport.next" ? 1 : -1);
          if (!id) return error(currentSetlist() ? "That's the end of the setlist" : "Choose a setlist first");
          selectSong(id);
          break;
        }
        case "setlist.create": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (cmd.library) {
            const n = state.librarySetlists.length + 1;
            state.librarySetlists.push({ id: newId(), name: cmd.name?.trim() || `Setlist ${n}`, owner: "library", songs: [], autoAdvance: false });
            break;
          }
          if (!p) return error("Open a project first");
          const setlist = { id: newId(), name: cmd.name?.trim() || `Setlist ${p.setlists.length + 1}`, owner: p.id, songs: [], autoAdvance: false };
          p.setlists.push(setlist);
          p.setlistId = setlist.id;
          break;
        }
        case "setlist.saveToLibrary": {
          const p = projects.find((p) => p.id === state.project?.id);
          const set = p && projectList(p, false);
          if (!set?.songs.length) return error(p ? "Add songs before saving them as a setlist" : "Open a project first");
          state.librarySetlists.push({ id: newId(), name: cmd.name?.trim() || set.name, owner: "library", songs: [...set.songs], autoAdvance: false });
          break;
        }
        case "setlist.append":
        case "setlist.select":
        case "setlist.rename":
        case "setlist.delete":
        case "setlist.addSong":
        case "setlist.removeSong":
        case "setlist.moveSong":
        case "setlist.setAutoAdvance": {
          const p = projects.find((p) => p.id === state.project?.id);
          const library = state.librarySetlists.find((x) => x.id === cmd.setlistId);
          if (!p && !library) return error("Open a project first");
          // No setlistId: the project's set, as WebUi (made when a song or setlist is added).
          const l =
            library ??
            (cmd.setlistId === undefined && cmd.type !== "setlist.select"
              ? projectList(p!, cmd.type === "setlist.addSong" || cmd.type === "setlist.append")
              : p?.setlists.find((x) => x.id === cmd.setlistId));
          if (cmd.type === "setlist.append") {
            const from = [...state.librarySetlists, ...(p?.setlists ?? [])].find((x) => x.id === cmd.fromId);
            if (!l || !from) return error(`Unknown setlist: ${cmd.fromId}`);
            l.songs.push(...from.songs);
            break;
          }
          if (cmd.type === "setlist.select") {
            if (!p) return error("Open a project first");
            if (library) return error("Add that setlist to the project to play it");
            if (cmd.setlistId && !l) return error(`Unknown setlist: ${cmd.setlistId}`);
            p.setlistId = cmd.setlistId;
            break;
          }
          if (!l) return error(`Unknown setlist: ${cmd.setlistId}`);
          if (cmd.type === "setlist.rename") l.name = cmd.name.trim() || l.name;
          if (cmd.type === "setlist.delete") {
            const lists = library ? state.librarySetlists : p!.setlists;
            lists.splice(lists.indexOf(l), 1);
            if (p?.setlistId === l.id) p.setlistId = null;
          }
          if (cmd.type === "setlist.addSong") {
            if (!state.songs.some((s) => s.id === cmd.songId)) return error(`Unknown song: ${cmd.songId}`);
            l.songs.splice(cmd.index ?? l.songs.length, 0, cmd.songId);
          }
          if (cmd.type === "setlist.removeSong" || cmd.type === "setlist.moveSong") {
            if (cmd.index < 0 || cmd.index >= l.songs.length) return error("No song at that place in the setlist");
            const [id] = l.songs.splice(cmd.index, 1);
            if (cmd.type === "setlist.moveSong") l.songs.splice(Math.max(0, Math.min(l.songs.length, cmd.to)), 0, id);
          }
          if (cmd.type === "setlist.setAutoAdvance") l.autoAdvance = cmd.on;
          break;
        }
        case "tune.setInput":
          state.tuneMode.tunerInput = cmd.hwChannel;
          break;
        case "tune.setReference":
          state.tuneMode.reference = Math.min(466, Math.max(415, cmd.hz));
          break;
        case "tune.setVocalChain":
          state.tuneMode.vocalChainId = cmd.chainId;
          break;
        case "midi.selectDevice":
          state.midi.device = cmd.name || null;
          break;
        case "footswitch.press":
          return cmd.down ? press(cmd.channel, cmd.cc) : release(cmd.channel, cmd.cc);
        case "midi.forgetSwitch": {
          const same = (s: { channel: number; cc: number }) => s.channel === cmd.channel && s.cc === cmd.cc;
          state.midi.switches = state.midi.switches.filter((s) => !same(s));
          const list = mappings();
          if (list) list.splice(0, list.length, ...list.filter((m) => !same(m.switch)));
          break;
        }
        case "mapping.set": {
          if (!mappings()) return error("No project open");
          const m = findMapping(cmd.channel, cmd.cc, cmd.page) ?? { switch: { channel: cmd.channel, cc: cmd.cc }, page: cmd.page, tap: null, hold: null };
          if (!mappings()!.includes(m)) mappings()!.push(m);
          m[cmd.gesture] = cmd.action;
          break;
        }
        case "mapping.clear":
        case "mapping.setHoldMs": {
          const m = findMapping(cmd.channel, cmd.cc, cmd.page);
          if (!m) return error("No mapping for that switch");
          if (cmd.type === "mapping.setHoldMs") m.holdMs = Math.min(3000, Math.max(100, cmd.holdMs));
          else {
            m[cmd.gesture] = null;
            if (!m.tap && !m.hold) mappings()!.splice(mappings()!.indexOf(m), 1);
          }
          break;
        }
        case "footswitch.setPage":
          state.midi.page = Math.min(pageCount(), Math.max(0, cmd.page)); // one past the last: a new, empty page
          break;
        case "chain.create": {
          const p = projects.find((p) => p.id === state.project?.id);
          if (!p) return error("Open a project first");
          if (p.chains.length >= MAX_CHAINS) return error(`A project can have up to ${MAX_CHAINS} chains`);
          p.chains.push({
            id: newId(),
            name: cmd.name?.trim() || `Chain ${p.chains.length + 1}`,
            color: COLOURS[p.chains.length % COLOURS.length],
            inputs: [{ hwChannel: 1, gain: 0 }],
            mode: "mono",
            blocks: [],
            level: 0,
            outputs: [{ hwChannels: [1, 2], level: 0, pan: 0, mute: false }],
            bypassed: false,
            muted: false,
          });
          break;
        }
        case "chain.remove": {
          const p = projects.find((p) => p.id === state.project?.id);
          const i = p?.chains.findIndex((c) => c.id === cmd.chainId) ?? -1;
          if (!p || i < 0) return error(`Unknown chain: ${cmd.chainId}`);
          p.chains.splice(i, 1);
          break;
        }
        case "chain.rename": {
          const c = chain(cmd.chainId);
          const name = cmd.name.replace(/\s+/g, " ").trim().slice(0, 60).trim();
          if (!name) return error("A chain needs a name");
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          c.name = name;
          break;
        }
        case "chain.setInputs":
        case "chain.setOutputs":
        case "chain.setLevel":
        case "chain.setMute": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          if (cmd.type === "chain.setInputs") c.inputs[0].hwChannel = cmd.inputs[0].hwChannel;
          if (cmd.type === "chain.setOutputs") {
            if (!c.outputs.length) c.outputs.push({ hwChannels: [], level: 0, pan: 0, mute: false });
            c.outputs[0].hwChannels = cmd.outputs[0].hwChannels;
          }
          if (cmd.type === "chain.setLevel") c.level = Math.min(10, Math.max(SILENCE_DB, cmd.levelDb));
          if (cmd.type === "chain.setMute") c.muted = cmd.muted;
          break;
        }
        case "device.scan":
          break;
        case "device.setFormat": {
          const d = state.device!;
          if (cmd.sampleRate && !d.sampleRates.includes(cmd.sampleRate)) return error(`Audio device: ${d.name} can't run at ${cmd.sampleRate / 1000} kHz`);
          if (cmd.bufferSize && !d.bufferSizes.includes(cmd.bufferSize)) return error(`Audio device: ${d.name} doesn't offer a ${cmd.bufferSize}-sample buffer`);
          d.sampleRate = cmd.sampleRate || d.sampleRate;
          d.bufferSize = cmd.bufferSize || d.bufferSize;
          d.latencyMs = (2000 * d.bufferSize) / d.sampleRate + 1.5; // in + out, plus converters
          break;
        }
        case "device.select": {
          const d = state.devices.find((d) => d.type === cmd.deviceType && d.name === cmd.name);
          if (!d) return error(`Audio device: Device not found: ${cmd.name}`);
          state.devices.forEach((x) => (x.current = x === d));
          state.device = { ...state.device!, name: d.name, type: d.type };
          break;
        }
        case "plugins.scan":
          state.plugins.scanning = true;
          setTimeout(() => {
            state.plugins = {
              scanning: false,
              progress: 0,
              current: "",
              list: [
                { id: "mock-gain", name: "Mock Gain", manufacturer: "Glitch", format: "VST3", category: "Fx" },
                { id: "mock-delay", name: "Mock Delay", manufacturer: "Glitch", format: "VST3", category: "Fx|Delay" },
              ],
            };
            emitState();
          }, 800);
          break;
        case "library.import":
          return error("Adding files needs the app (not available in the browser)");
        case "block.add": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          const aby = cmd.abyId ? findAby(cmd.abyId) : null;
          if (cmd.abyId && !aby) return error(`Unknown ABY block: ${cmd.abyId}`);
          const list = aby ? (cmd.path === "B" ? aby.pathB : aby.pathA).blocks : c.blocks;
          if (!aby && endsInSplit(c) && (cmd.index ?? list.length) >= list.length)
            return error("This chain ends in a split to separate outputs: add blocks to path A or B");
          const spec = cmd.block;
          if (spec.type === "plugin") {
            const plugin = state.plugins.list.find((p) => p.id === spec.pluginId);
            if (!plugin) return error("Unknown plugin");
            list.splice(cmd.index ?? list.length, 0, { id: newId(), type: "plugin", name: plugin.name, enabled: true, plugin });
          } else {
            const file = state.library[spec.type].find((f) => f.id === spec.file);
            if (!file) return error("That file isn't in the library");
            list.splice(cmd.index ?? list.length, 0, { id: newId(), type: spec.type, name: file.name, enabled: true, file: file.id });
          }
          break;
        }
        case "chain.splitAt": {
          const c = chain(cmd.chainId);
          if (!c) return error(`Unknown chain: ${cmd.chainId}`);
          const index = Math.max(0, Math.min(cmd.index ?? c.blocks.length, c.blocks.length));
          if (endsInSplit(c) && index >= c.blocks.length) return error("This chain ends in a split to separate outputs");
          if (c.blocks.slice(index).some((b) => b.type === "aby")) return error("An ABY can't go inside another ABY's path");
          const aby: AbyBlock = {
            id: newId(), type: "aby", name: "ABY", enabled: true, mode: "AB", active: "A",
            pathA: { ...newPath(), blocks: c.blocks.splice(index) }, pathB: newPath(),
            exit: "merge", crossfadeMs: 10, alignLatency: true,
          };
          c.blocks.push(aby);
          break;
        }
        case "aby.setMode":
        case "aby.select":
        case "aby.setMute": {
          const aby = findAby(cmd.blockId);
          if (!aby) return error(`Unknown ABY block: ${cmd.blockId}`);
          if (cmd.type === "aby.setMode") aby.mode = cmd.mode;
          if (cmd.type === "aby.select") aby.active = cmd.path;
          if (cmd.type === "aby.setMute") (cmd.path === "B" ? aby.pathB : aby.pathA).mute = cmd.muted;
          break;
        }
        case "aby.setExit":
        case "aby.setOutputs": {
          const found = findBlock(cmd.blockId);
          const aby = found?.block.type === "aby" ? (found.block as AbyBlock) : null;
          if (!found || !aby) return error(`Unknown ABY block: ${cmd.blockId}`);
          if (cmd.type === "aby.setExit") {
            if (cmd.exit === "split" && found.chain.blocks[found.chain.blocks.length - 1] !== aby)
              return error("Only an ABY at the end of a chain can split to separate outputs");
            aby.splitOutputs ??= { A: structuredClone(found.chain.outputs), B: structuredClone(found.chain.outputs) };
            aby.exit = cmd.exit;
          }
          if (cmd.type === "aby.setOutputs") {
            const out = aby.splitOutputs?.[cmd.path][0];
            if (!out || !cmd.outputs[0]?.hwChannels.length) return error("Invalid output channels");
            out.hwChannels = [...cmd.outputs[0].hwChannels];
          }
          break;
        }
        case "route.set":
        case "route.remove": {
          let sends;
          if (cmd.trackId) {
            const entry = trackMixEntry(cmd.trackId, true);
            if (!entry) return error("That track isn't in the current song");
            sends = entry.outputs;
          } else {
            const c = chain(cmd.chainId ?? "");
            if (!c) return error(`Unknown chain: ${cmd.chainId}`);
            const split = endsInSplit(c) ? (c.blocks[c.blocks.length - 1] as AbyBlock).splitOutputs : undefined;
            if (!!cmd.path !== !!split)
              return error(split ? "This chain splits to separate outputs: route path A or B" : "This chain doesn't split to separate outputs");
            sends = split ? split[cmd.path!] : c.outputs;
          }
          const n = state.device?.outputs.length ?? 0;
          if (!cmd.hwChannels.length || cmd.hwChannels.length > 2 || new Set(cmd.hwChannels).size !== cmd.hwChannels.length || cmd.hwChannels.some((ch) => ch < 1 || ch > Math.max(n, 8)))
            return error("Invalid output channels");
          const i = sends.findIndex((s) => s.hwChannels.join() === cmd.hwChannels.join());
          if (cmd.type === "route.remove") {
            if (i >= 0) sends.splice(i, 1);
            break;
          }
          const send = i >= 0 ? sends[i] : sends[sends.push({ hwChannels: [...cmd.hwChannels], level: 0, pan: 0, mute: false }) - 1];
          if (cmd.level !== undefined) send.level = Math.min(10, Math.max(SILENCE_DB, cmd.level));
          if (cmd.mute !== undefined) send.mute = cmd.mute;
          break;
        }
        case "block.move": {
          const found = findBlock(cmd.blockId);
          const c = chain(cmd.chainId);
          const aby = cmd.abyId ? findAby(cmd.abyId) : null;
          if (!found || !c) return error("Unknown block or chain");
          if (cmd.abyId && (!aby || !c.blocks.includes(aby))) return error(`Unknown ABY block: ${cmd.abyId}`);
          if (aby && found.block.type === "aby") return error("An ABY can't go inside another ABY's path");
          const to = aby ? (cmd.path === "B" ? aby.pathB : aby.pathA).blocks : c.blocks;
          const index = found.list === to && cmd.index > found.index ? cmd.index - 1 : cmd.index; // counted the block in its old place
          found.list.splice(found.index, 1);
          to.splice(Math.min(index, to.length), 0, found.block);
          if (state.chains.some((ch) => ch.blocks.slice(0, -1).some((b) => b.type === "aby" && (b as AbyBlock).exit === "split"))) {
            to.splice(to.indexOf(found.block), 1);
            found.list.splice(found.index, 0, found.block);
            return error("A split to separate outputs has to stay at the end of its chain");
          }
          break;
        }
        case "block.remove":
        case "block.toggle":
        case "block.openEditor": {
          const found = findBlock(cmd.blockId);
          if (!found) return error(`Unknown block: ${cmd.blockId}`);
          if (found.block.type === "aby" && cmd.type !== "block.remove") return error("An ABY block has no window or bypass of its own");
          // Removing an ABY keeps path A in the chain, in its place.
          if (cmd.type === "block.remove")
            found.list.splice(found.index, 1, ...(found.block.type === "aby" ? (found.block as AbyBlock).pathA.blocks : []));
          if (cmd.type === "block.toggle") found.block.enabled = !found.block.enabled;
          if (cmd.type === "block.openEditor") return error("Plugin windows need the app (not available in the browser)");
          break;
        }
        default:
          return error(`Unknown command: ${(cmd as Command).type}`);
      }
      emitState();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return bridge;
}

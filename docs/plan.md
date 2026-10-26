# Glitch: Amp Modeler + Backing Track Player

A plan for a Helix/HeadRush-style live rig built as custom software: multiple signal chains with flexible input and output routing, an ABY splitter for parallel or switchable paths, neural amp models, VST3/AU hosting, and a multitrack backing track player, all organized into projects. Mac first, Linux later.

---

## 1. Goals

- **Signal chains:** create any number of chains, each fed by one or more hardware inputs and sent to one or more hardware outputs.
- **ABY splitter:** split a chain at any point into two parallel paths, run both (Y) or switch between them (AB).
- **Plugins and models:** built-in neural amps (NAM), cab IRs, and hosted VST3/AU plugins as blocks in a chain.
- **Projects:** a project is one complete rig. Setlists can be added to a project, and each project keeps its own routing and track levels for every song.
- **Backing tracks:** songs are collections of tracks (a backing track, stems, click, cues). Each track defaults to the project's main stereo out and can be rerouted and leveled per track.
- **Hands-free control:** footswitch control of effect bypass, presets, and playback.
- **Stage-ready:** no dropouts, no clicks, fast to read and operate in the dark.
- **Portable codebase:** the same engine builds on Linux later with no rewrite.

### Non-goals (for v1)
- Recording or DAW features
- Time-stretching or pitch-shifting backing tracks
- Out-of-process plugin sandboxing

---

## 2. Hardware

| Part | Role |
|---|---|
| Mid-2015 15" MacBook Pro (2.2 GHz quad-core i7, 16GB, macOS Monterey 12.7.6) | Runs the app at shows; test machine during development |
| MOTU M4 | 4 in / 4 out audio interface (class compliant; connects with its included USB-C to USB-A cable) |
| M-Vave Chocolate | 4-switch USB/Bluetooth MIDI footswitch (USB-A cable or Bluetooth) |
| TRS-to-XLR cables | Balanced feeds to front of house from outs 1/2 |

**M4 I/O as the app sees it**
- Inputs 1-2: combo mic/line/Hi-Z (guitar, bass, vocal mic)
- Inputs 3-4: balanced line (returns from real pedals, keys, a second instrument)
- Outputs 1-2: main pair (typically FOH)
- Outputs 3-4: line pair (amp, monitor, in-ear click, or effects send)

The MacBook has USB-A ports and no USB-C, so no hub is needed.

The app must not hardcode this. Devices are enumerated at startup, and channel names are user-editable.

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Audio engine | C++20 + JUCE 8 | Industry-standard host framework, cross-platform |
| Build | CMake | Not tied to Xcode, Linux is just another target |
| Plugin hosting | JUCE `AudioPluginFormatManager` | VST3 + AU on Mac, VST3 + LV2 on Linux |
| Neural amps | NeuralAmpModelerCore (embedded) | Native block, no plugin wrapper overhead |
| Cab IRs | `juce::dsp::Convolution` | Built in, background loading |
| File playback | `AudioFormatReader` + `BufferingAudioSource` | Disk streaming off the audio thread |
| MIDI | `juce::MidiInput` | Footswitch input, MIDI learn |
| UI | Scamp (Preact) in JUCE 8 `WebBrowserComponent` | Design in Scamp, ship real TSX/CSS |
| UI bridge | JUCE native functions + events | Typed command/event layer between Preact and C++ |
| Persistence | JSON files | Human-readable projects, presets, setlists, songs |

**Development setup:** code is written on a Linux machine, where the engine also builds and runs. The MacBook is the test machine, built over SSH and tested with the real rig at every milestone. See `glitch-monorepo-setup.md` for the workflow.

**Older Mac constraints:** Monterey's newest Xcode is 14.2, so engine code avoids C++20 library features that compiler lacks (e.g. `std::format`). The app's WebView uses Safari 17.6's engine (keep Safari updated), so the UI targets Safari 15 and up.

**Licensing check:** JUCE 8 is AGPLv3 or a free tier with a revenue cap. Decide before any public or commercial release.

---

## 4. Architecture

```
┌──────────────────────── App process ────────────────────────┐
│                                                              │
│  UI (Scamp / Preact in WebView)                              │
│    │  commands (JSON)              ▲ state + meters (JSON)   │
│    ▼                               │                         │
│  Bridge: Command handler  ──►  Engine controller (msg thread)│
│                                    │                         │
│                     lock-free queues / atomic swaps          │
│                                    ▼                         │
│  Audio thread:                                               │
│    Hardware inputs ─► Chains ─┐                              │
│    Backing track player ──────┼─► Output mixer ─► HW outputs │
│                               │                              │
│  Background threads: plugin/model/IR loading, disk streaming │
│  MIDI thread: footswitch ─► action mapper ─► engine          │
└──────────────────────────────────────────────────────────────┘
```

### Threading rules (the most important section)
1. The audio thread never allocates, locks, logs, or touches files.
2. All structural changes (adding a chain, loading a plugin, swapping a model) are built on a background thread, then swapped in atomically.
3. Parameter changes go through atomics or lock-free FIFOs and are smoothed.
4. Bypass toggles and chain switches crossfade over 5 to 20 ms to avoid clicks.
5. The engine is the source of truth. The UI sends commands and renders state; it never assumes a change succeeded.

---

## 5. Routing Model

Everything ends up in an **output mixer**: a matrix of sources to hardware outputs, each crosspoint with gain and mute.

### Sources
- Each **signal chain** output (mono or stereo)
- Each **track** of the current song, using the current project's track mix (see section 7)
- Optional: **click** (generated, or a track in the song)

### Signal chains
```
Chain
├── id, name, color
├── inputs:  [{ hwChannel: 1, gain: 0 dB }]      // one or more hardware inputs, summed
├── mode:    mono | stereo                         // stereo after a stereo block
├── blocks:  [Block, Block, ...]                   // series, in order
├── outputs: [{ hwChannels: [1,2], level: 0 dB, pan: 0 }]
└── bypassed: false
```

**Blocks**
- `nam`: neural amp model file (`.nam`)
- `ir`: cab impulse response (`.wav`)
- `plugin`: hosted VST3/AU (format, identifier, state blob)
- `utility`: gain, EQ, noise gate, tuner tap
- `aby`: built-in splitter that turns the chain into two parallel paths (see section 6)
- Every block has `enabled`, `mix` (where it makes sense), and MIDI mappings.

**Examples this supports**
- Guitar (in 1) → NAM → IR → delay → outs 1/2 (FOH), plus a dry or amp-only feed to out 3 (stage amp)
- Bass (in 2) → own chain → out 4 (bass amp) and outs 1/2 (FOH)
- Mic (in 1) → vocal chain, guitar on in 2, both to FOH
- Two chains fed by the same input (e.g. a clean DI and a dirty chain blended at the outputs)
- Guitar → drive → ABY → (path A: clean NAM + IR, path B: high-gain NAM + IR) → delay → FOH, switching amps with one footswitch

### v1 limits (keep it shippable)
- Parallel processing inside a chain is done with the ABY block. Two chains sharing an input still works for fully independent rigs.
- No nested ABY blocks in v1 (an ABY path can't contain another ABY).
- Max chains: soft limit of 8, bounded by CPU.

---

## 6. ABY Splitter (built-in block)

An ABY block can be dropped anywhere in a chain. Everything before it feeds both paths; each path is its own series of blocks; the paths either merge back into the chain or exit to their own outputs.

```
in ─► drive ─► [ABY] ─┬─ Path A: NAM clean ─► IR ─┬─► [merge] ─► delay ─► out
                      └─ Path B: NAM lead  ─► IR ─┘
```

### Data model
```
Block (type: "aby")
├── id, name
├── mode:     "Y" | "AB"
├── active:   "A" | "B"                 // used in AB mode
├── pathA:    { blocks: [...], level: 0 dB, pan: 0, mute: false }
├── pathB:    { blocks: [...], level: 0 dB, pan: 0, mute: false }
├── exit:     "merge" | "split"
│     merge: paths sum back into the chain and continue to the next block
│     split: each path goes to its own outputs and the chain ends here
├── splitOutputs: { A: OutputRef[], B: OutputRef[] }   // only when exit = "split"
├── crossfadeMs: 10                     // AB switch time
└── alignLatency: true                  // delay-compensate the faster path
```

### Modes
- **Y mode:** both paths run in parallel. On merge, they're summed with per-path level and pan (e.g. clean amp hard left, dirty amp hard right, or a wet/dry blend). On split, they feed different outputs (e.g. path A to a stage amp, path B to FOH).
- **AB mode:** only the active path is heard. Switching crossfades over `crossfadeMs` so there are no clicks or volume drops.

### Engine details
- **Inactive path keeps running in AB mode** (default). This keeps delay and reverb tails, NAM state and plugin buffers warm, so switching is seamless and tails ring out naturally. Option per block to suspend the inactive path to save CPU, at the cost of a less seamless switch.
- **Latency alignment:** hosted plugins can report latency. In Y mode the shorter path is delayed to match the longer one so the merge doesn't comb filter.
- **Gain staging:** in Y mode with merge, the sum is not automatically attenuated. Show a merge meter and a clip warning, and default each path to -3 dB when a block is first set to Y.
- **Mono/stereo:** if either path is stereo, the merge is stereo. A mono path is centered unless panned.
- **Splitting an existing chain:** "Split here" in the UI inserts an ABY at that position, moves the blocks after it into path A, and leaves path B empty (or duplicates path A, as an option).

### Footswitch actions
- Toggle A/B (AB mode)
- Select A / select B
- Toggle Y on and off (Y ↔ AB)
- Mute path A / mute path B (useful in Y mode)

### UI
- In the Rig view, an ABY renders as a fork: the strip splits into two stacked lanes and rejoins at a merge node (or ends in two output chips when split).
- The ABY node shows a large mode toggle (Y / AB), the active path highlight, and per-path level faders.
- Blocks can be dragged between lanes.

---

## 7. Projects, Setlists, Songs and Tracks

### Hierarchy
```
Library (app-wide)
├── Songs            ── each song is a collection of tracks (audio files)
└── Setlists         ── standalone setlists, not tied to any project

Project (one complete rig)
├── Rig              ── chains, ABY blocks, presets, footswitch mappings, tune mode settings
├── Main output      ── the stereo pair new tracks route to (default outs 1/2)
├── Setlists         ── created in the project, or added from the library
└── Track mix        ── per song, per track: outputs, level, pan, mute
```

- **Project:** a unique rig. Switching projects swaps the whole rig: chains, presets, footswitch mappings, setlists and track mixes. Use one per band, venue setup, or rig (e.g. "Full band, IEMs" vs. "Solo acoustic").
- **Setlist:** an ordered collection of songs. Can be created in the library (outside any project) or inside a project.
- **Song:** a collection of tracks that play together, sample-locked. No fixed slot count. A typical song is a backing track plus a few stems, a click and cues.
- **Track:** one audio file plus metadata. The track itself holds no routing; routing and level live in the project's track mix, so the same song can be routed differently in different projects.

### Data model
```
Song (library)
├── id, title, bpm (info only), notes
└── tracks: [
      { id, name: "Backing",  file: "backing.wav", channels: 2, role: "backing", defaultLevel: 0 dB },
      { id, name: "Click",    file: "click.wav",   channels: 1, role: "click",   defaultLevel: 0 dB },
      { id, name: "Guitar 2", file: "gtr2.wav",    channels: 2, role: "stem",    defaultLevel: 0 dB }
    ]

Setlist
├── id, name
├── owner: "library" | projectId
├── songs: [songId, ...]
└── autoAdvance: true | false

Project
├── id, name, color
├── rig: { chains, presets, currentPresetId, mappings, tuneMode }
├── mainOutput: [1, 2]
├── setlists: [setlistId, ...]                 // project-owned copies
├── songPresets: { [songId]: presetId }        // optional preset recall per song
└── trackMix: {
      [songId]: {
        [trackId]: { outputs: OutputRef[], level: dB, pan, mute }
      }
    }
```

### Adding setlists to a project
- **Create inside a project:** the setlist is owned by that project.
- **Add from the library:** the project gets its own copy of the setlist (song order, autoAdvance). Reordering it in the project doesn't change the library version or other projects. Songs and audio files are referenced, never duplicated.
- **Import from a file:** a setlist file (JSON, or a folder of songs) is imported into the library and added to the project in one step.

### Default routing
When a setlist is built or imported into a project, every track of every song gets a track mix entry:
- **Outputs:** the project's main stereo out (default outs 1/2).
- **Level:** the track's `defaultLevel` (0 dB unless set in the song).
- **Pan:** center. **Mute:** off.

A mono track sent to the stereo main out plays equally in both sides. A stereo track sent to a single mono output is summed to mono at -3 dB.

After that, the user can edit any track: route it to different outputs (e.g. click to out 4 for in-ears only, a guitar stem to out 3 for the stage amp), change its level, pan or mute. Edits are saved in the project.

If a track is added to a song later, it appears in every project that uses the song, routed to that project's main out with its default level. Removed tracks drop out of track mixes automatically.

### Playback behavior
- **Sample-locked playback:** all tracks in a song start on the same sample and share one transport. Tracks are streamed from disk with read-ahead buffers.
- **Per-track level, pan and mute:** adjustable live, smoothed, saved to the project.
- **Preload:** the next song in the setlist is opened and buffered while the current one plays, so there's no gap on advance.
- **Format handling:** WAV and AIFF in v1. Files at a different sample rate than the device are resampled on import (not at playback).
- **Length mismatch:** the song ends when the longest track ends.
- **Transport:** play, stop, restart song, next, previous. Optional auto-advance; gaps and count-ins live in the audio files themselves.
- **Preset recall:** optionally switch to a project preset when a song is selected (`songPresets`).
- **Track count:** no fixed limit. Soft limit of 16 tracks per song in v1 for disk and CPU headroom.

---

## 8. Footswitch Control (M-Vave Chocolate)

The Chocolate sends MIDI CC or notes per switch. The app maps incoming messages to **actions**.

### Device setup
- Configure every Chocolate switch in **momentary mode**: CC 127 on press, CC 0 on release.
- The Chocolate's own long-press modes are not used. All tap/hold logic lives in the app, so it works the same with any momentary MIDI footswitch (including a future DIY Pico controller).

### Tap and hold (handled in software)
Each switch can have two actions: **tap** and **hold**.

```
press (127)  ─► start hold timer (default 500 ms, adjustable)
release (0) before timer fires ─► run TAP action
timer fires while still held   ─► run HOLD action, ignore the release
```

- **Instant response when there's no hold action:** if a switch has only a tap action, it fires on press, not release, so effect toggles feel immediate.
- **Deferred tap when there is a hold action:** the tap fires on release instead. This is the unavoidable cost of sharing a switch, and a reason to keep hold actions on switches where a few ms of extra delay doesn't matter.
- **Visual feedback:** the Performance view shows a fill/progress ring on the switch label while held, so you know when the hold registered.
- **Edge cases:** a release with no matching press is ignored; a hold timer is cancelled if the MIDI device disconnects; repeated 127s without a release are treated as one press.
- **Implementation:** the hold timer runs on the message thread (not the audio thread). The resulting action is posted to the engine through the normal command queue.

```
Mapping
├── switch:   { device, channel, cc }
├── tap:      ActionRef | null
├── hold:     ActionRef | null
└── holdMs:   500                 // optional per-switch override
```

### Tune mode (built-in action)
A single action, designed to be assigned to a hold:

1. **Fade out** every output source except the designated vocal chain, over ~20 ms, so you can keep talking to the crowd.
2. **Open the tuner** fullscreen in the Performance view (large note name, cents offset, and a strobe or needle readable from 6 feet away).
3. **Tuner input:** listens to a chosen hardware input, before any chain processing, so effects and amp models don't affect the reading.
4. **Exit** by tapping any switch or holding again. Everything fades back in over ~20 ms.

Settings:
- `vocalChainId`: which chain stays live (per preset, with a project default). If none is set, tune mode mutes everything.
- `tunerInput`: hardware input to analyze (default input 1). A quick toggle in the tuner view switches between inputs, e.g. guitar and bass.
- `backingTracks`: `pause` or `mute` while tuning (default `pause`, so the song doesn't keep running silently).
- `reference`: A4 pitch (default 440 Hz).

Engine notes:
- Tune mode is a mute state on the output mixer, not a change to routing or presets, so exiting restores exactly what was there.
- Pitch detection (YIN or similar) runs on a background thread fed by a lock-free buffer copy of the tuner input; it never runs on the audio thread.
- The panic button overrides tune mode (mutes everything, including vocals).

### Actions
- Toggle block bypass (specific block in a specific chain)
- Toggle chain bypass
- Recall preset / next preset / previous preset
- Transport: play/stop, next song, previous song, restart
- ABY: toggle A/B, select A or B, toggle Y, mute a path
- Tap tempo (for delay blocks)
- Tune mode on/off (mutes all but vocals, opens tuner; see above)
- Switch footswitch page (more than 4 functions from 4 switches)

### MIDI learn
1. Click "Learn" on any action or block in the UI.
2. Choose **Tap** or **Hold**, then press the footswitch.
3. The mapping is saved. Mappings live per preset, with a project-wide layer for transport and paging.

### Suggested default layout
| Page | Switch A | Switch B | Switch C | Switch D |
|---|---|---|---|---|
| Stomp (tap) | Drive | Mod | Delay | Page → |
| Stomp (hold) | Tune mode | | ABY toggle A/B | |
| Show (tap) | Play/Stop | Next song | Prev song | Page → |
| Show (hold) | Tune mode | | Restart song | |

Tune mode is on a hold on both pages so it's always reachable. Switch D has no hold action so paging stays instant.

---

## 9. Presets and Storage

- A **preset** belongs to a project and is a full chain configuration: all chains, blocks, parameters, plugin states, chain output routing and preset-level footswitch mappings.
- Track routing belongs to the **project's track mix**, not presets, so changing tone never reroutes playback.
- Stored as JSON. Plugin state is a base64 blob. NAM and IR files are referenced by path relative to the library folder.
- Preset switching builds the new graph in the background and crossfades.
- **Switching projects** stops playback, builds the new rig in the background, then fades in. It's a between-sets action, not a mid-song one, and asks for confirmation if a song is playing.

```
~/Library/Application Support/Glitch/
├── settings.json                 // audio device, channel names, last project, UI prefs
├── projects/<projectId>/
│   ├── project.json              // rig, main output, mappings, tune mode, songPresets
│   ├── presets/*.json
│   ├── setlists/*.json           // project-owned setlists
│   └── trackmix.json             // per song, per track routing and levels
└── library/
    ├── songs/<songId>/song.json + audio files
    ├── setlists/*.json           // standalone setlists
    ├── nam/
    └── ir/
```

---

## 10. UI (Scamp / Preact)

Designed in Scamp, exported as TSX/CSS, running inside the JUCE WebView. Design for a laptop screen at arm's length on a dark stage: big targets, high contrast, minimal text.

### Screens
1. **Rig:** chains as horizontal strips. Each strip shows input chips, block chain, output chips, meters. ABY blocks fork the strip into two lanes. Tap a block to bypass, long-press or click to edit.
2. **Routing:** a matrix grid. Rows are sources (chains, backing tracks), columns are hardware outputs. Each cell is a level/mute control. This is the "where does everything go" view.
3. **Block editor:** parameters for the selected block. Hosted plugins can open their native editor window.
4. **Projects:** pick, create, duplicate and switch projects.
5. **Setlists and songs:** setlists (project and library) on the left, song detail on the right with its tracks and each track's output routing, level, pan and mute for this project.
6. **Performance view:** giant now-playing song, next song, transport state, footswitch labels for the current page, tuner. Built for glancing at from 6 feet away.
7. **Settings:** audio device, buffer size, sample rate, channel naming, MIDI device, library folders.

### Bridge API (sketch)
UI → Engine (commands)
```ts
type Command =
  | { type: "chain.create"; name: string }
  | { type: "chain.setInputs"; chainId: string; inputs: InputRef[] }
  | { type: "chain.setOutputs"; chainId: string; outputs: OutputRef[] }
  | { type: "block.add"; chainId: string; block: BlockSpec; index?: number }
  | { type: "block.setParam"; blockId: string; param: string; value: number }
  | { type: "block.toggle"; blockId: string }
  | { type: "chain.splitAt"; chainId: string; index: number; duplicate?: boolean }
  | { type: "aby.setMode"; blockId: string; mode: "Y" | "AB" }
  | { type: "aby.select"; blockId: string; path: "A" | "B" }
  | { type: "aby.moveBlock"; blockId: string; toPath: "A" | "B" | "main"; index: number }
  | { type: "project.create"; name: string; from?: string }      // optional project to duplicate
  | { type: "project.open"; projectId: string }
  | { type: "project.setMainOutput"; outputs: number[] }
  | { type: "setlist.create"; name: string; projectId?: string }  // omit projectId for library
  | { type: "setlist.addToProject"; setlistId: string; projectId: string }
  | { type: "setlist.import"; path: string; projectId?: string }
  | { type: "song.import"; files: string[]; title: string }
  | { type: "song.addTrack"; songId: string; file: string; name: string }
  | { type: "trackMix.set"; songId: string; trackId: string;
      outputs?: OutputRef[]; level?: number; pan?: number; mute?: boolean }
  | { type: "transport.play" } | { type: "transport.stop" } | { type: "transport.next" }
  | { type: "midi.learn"; action: ActionRef; gesture: "tap" | "hold" }
  | { type: "tune.toggle" } | { type: "tune.setInput"; hwChannel: number }
  | { type: "preset.load"; presetId: string };
```

Engine → UI (events)
```ts
type EngineEvent =
  | { type: "state"; state: RigState }              // full snapshot on change
  | { type: "meters"; levels: Record<string, number> } // ~30 Hz, compact
  | { type: "transport"; position: number; songId: string; playing: boolean }
  | { type: "tuner"; note: string; cents: number; hz: number } // ~30 Hz while tune mode is on
  | { type: "switch"; switchId: string; state: "down" | "held" | "up" } // for hold feedback
  | { type: "error"; message: string };
```

Keep a single Preact store fed by `state` events. Meters bypass the store and update DOM/canvas directly to avoid re-render churn.

---

## 11. Milestones

### M0: Skeleton (week 1)
- CMake + JUCE project builds on Linux and on the MacBook
- WebView loads a Scamp-exported Preact page
- Round-trip command/event bridge working
- M4 selected, audio passes through input 1 → output 1

### M1: One chain, real tone (done)
- Embedded NAM block + IR block
- Load `.nam` and IR files from the library
- Input/output meters
- Measure round-trip latency at 64 and 128 samples

Measured on the 2015 MacBook Pro with the M4 at 48 kHz (RTL Utility, cable loopback, 3 runs per size, all identical, 2026-10-26):

| Buffer | Round trip | Driver reports |
| --- | --- | --- |
| 64 | 371 samples (7.7 ms) | 429 samples |
| 128 | 499 samples (10.4 ms) | 557 samples |
| 256 | 755 samples (15.7 ms) | 813 samples |

The round trip is both buffers plus a fixed 243 samples (5.1 ms) for the M4's converters and USB. The driver over-reports by 58 samples (1.2 ms), so the latency Glitch shows (from the driver) is slightly high, which is the safe side. NAM and IR blocks add no latency; hosted plugins can.

### M2: Multiple chains + routing
- Create/delete chains, assign inputs and outputs
- Output mixer matrix and Routing screen
- Click-free bypass and crossfades
- ABY block: Y and AB modes, merge and split exits, latency alignment, "Split here" in the UI

### M3: Plugin hosting
- Scan VST3/AU, add as blocks
- Open native plugin editors
- Save/restore plugin state in presets
- Plugin blocklist after a crash on scan

### M4: Footswitch
- MIDI device selection, MIDI learn, pages
- Block bypass, preset next/prev from the Chocolate
- Tap/hold detection with per-switch hold time
- Tune mode: vocal-only output, tuner view, pitch detection on the tuner input

### M5: Projects and backing tracks
- Projects: create, duplicate, open, switch (with background rig build)
- Library songs and setlists, project setlists, add library setlist to project
- Song import as a collection of tracks
- Track mix per project: default to main stereo out, per-track outputs, level, pan, mute
- Sample-locked multitrack streaming
- Setlists, preload next song, transport footswitch actions
- Performance view

### M6: Stage hardening
- Run a 2-hour set test with no xruns
- Safe startup (last project, setlist and preset restored, audio comes up muted then fades in)
- Panic button (mute all outputs)
- Crash recovery: autosave state, relaunch to last known good preset

### Later
- Linux build (VST3/LV2, JACK/PipeWire)
- Nested ABY blocks
- Remote control from a phone over local Wi-Fi (same Preact UI over WebSocket)
- Snapshots (parameter changes within a preset, like Helix)
- Out-of-process plugin hosting

---

## 12. Performance Budget

- Target buffer: 128 samples at 48 kHz (~2.7 ms per buffer), 64 if the CPU allows.
- Rough per-block cost to verify on the 2015 MacBook Pro (Haswell i7 with AVX2): NAM standard models are the heaviest; NAM lite/feather models as fallback. Measure this in M1, before building more on top.
- Show a CPU meter in the UI and warn before adding a block that would exceed ~70% of the audio budget.
- macOS settings for shows: disable sleep, Wi-Fi/Bluetooth off if the Chocolate is wired, close other apps, plugged into power.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| A hosted plugin crashes the app | Scan in a separate process, blocklist offenders, autosave and fast relaunch |
| Dropouts with heavy NAM models | CPU meter, lite models, larger buffer for backing-track-only songs |
| ABY Y mode doubles CPU or clips at the merge | Per-path CPU shown in UI, -3 dB default per path, merge clip warning |
| Clicks on preset change | Background build + crossfade, never rebuild the live graph in place |
| Disk stalls during playback | Generous read-ahead buffers, preload next song, local SSD only |
| macOS Monterey no longer gets security updates | Keep the show machine offline at gigs; keep the engine portable (it already builds on Linux), with a Linux mini PC as the escape hatch |
| Builds break on the Mac's older Xcode | Build on the Mac at least once per milestone; macOS CI build on every push |
| Track mixes drift when songs change | Track mix entries keyed by stable track IDs; added tracks default to main out, removed tracks pruned |
| WebView UI lag | Meters drawn outside the store, state diffs kept small |

---

## 14. Open Questions

- Should a song be able to recall a full preset, or only toggle specific blocks?
- Library setlists added to a project are copied. Is there a need for a "linked" option that stays in sync with the library version?
- Should songs have a song-level mix (default track levels) that every project starts from, edited in the library? (Currently `defaultLevel` per track.)
- Can a project use a different audio device than another, or is the device always app-wide?
- Does the click need its own dedicated output that is never muted by the panic button's "soft" mode?
- Is phone control needed for v1, or only the laptop UI?

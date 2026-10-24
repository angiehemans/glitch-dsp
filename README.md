# Glitch

An amp modeler and backing track player: a C++ / JUCE audio engine with a Preact UI designed in Scamp, in one repo. The app loads the Scamp UI, so design changes in Scamp reach the app without touching C++.

- [docs/plan.md](docs/plan.md): features, architecture, data model, milestones
- [docs/ui-requirements.md](docs/ui-requirements.md): views, components and their states
- [glitch-monorepo-setup.md](glitch-monorepo-setup.md): how this repo was set up

## Layout

```
package.json          npm workspaces: ui, packages/*
CMakeLists.txt        root CMake: options + engine
CMakePresets.json     dev, dev-remote, release
docs/                 plan and UI requirements
packages/protocol/    @glitch/protocol: shared TypeScript types for the bridge
ui/                   @glitch/ui: Preact + Vite app the engine loads
  glitch/             the Scamp project. Scamp-owned: don't hand-edit
  src/app/            views, router, meters, fader law, placeholders
  src/bridge/         engine.ts (JUCE or mock), mockEngine.ts
  src/store/          signals store fed by engine events
engine/src/           C++ app: Main, MainComponent, bridge/ (WebUi, Protocol.h), audio/ (Engine, ChainStage), plugins/ (PluginLibrary, PluginWindow), project/ (ProjectStore)
scripts/              dev.sh (UI dev server), mac.sh (build on the Mac over SSH)
.github/workflows/    CI: UI, Linux engine, macOS app
```

## Commands

```sh
npm install                    # once, and after pulling dependency changes
npm run typecheck              # all workspaces
npm run build:ui               # ui/dist

npm run dev -w ui              # UI alone in a browser, against the mock engine
./scripts/dev.sh               # same, installing first if needed

cmake --preset dev && cmake --build --preset dev           # app that loads the UI from localhost:5290
cmake --preset release && cmake --build --preset release   # app with the UI bundled in
```

Builds land in `build/<preset>/engine/Glitch_artefacts/<RelWithDebInfo|Release>/`. The dev presets are RelWithDebInfo, optimised with debug info: an unoptimised build runs DSP like convolution several times slower, so its CPU meter would mislead.

## Two UI modes

| Preset | `GLITCH_UI_DEV_URL` | `GLITCH_BUILD_UI` | App loads UI from |
|---|---|---|---|
| `dev` | `http://localhost:5290` | OFF | Vite dev server on the same machine (hot reload) |
| `dev-remote` | `http://$GLITCH_DEV_HOST:5290` | OFF | Vite dev server on the Linux machine, over the LAN |
| `release` | empty | ON | `ui/dist`, copied into the app |

An empty `GLITCH_UI_DEV_URL` means "serve the bundled build". In release, CMake runs `npm run build -w ui` and copies `ui/dist` to `Glitch.app/Contents/Resources/ui` (macOS) or `ui/` next to the executable (Linux). In dev modes, if the dev server isn't running the app shows "Can't reach the UI dev server" and retries every 2 seconds.

The Vite dev server listens on the local network (`server.host: true`) so the Mac can reach it. **That exposes the dev server to your LAN while it runs.** Shows always use a `release` build.

## Scamp workflow rules

- `ui/glitch/` is the Scamp project. Open it in Scamp from there. Treat it as generated and never hand-edit it, including its config.
- Scamp components are presentational: props in, callbacks out. They never import from `app/`, `bridge/` or `store/`. If a component needs data, it needs a new prop, added in Scamp.
- Every state in `docs/ui-requirements.md` should be reachable through props (`muted`, `status`, …).
- Meters read a CSS variable: bind a string prop to `data-meter` on the meter element (ChainStrip has `inputMeter` and `outputMeter`), and style the fill from `var(--level, <sample>)`, where `--level` runs 0–1. `ui/src/app/meters.ts` writes `--level` (and a latched `data-clip`) into every `[data-meter]` element at ~30 Hz without re-rendering. Keys come from the `meters` event: `in:1`, `out:1`, `chain:<id>:in`, `chain:<id>:out`. CPU bars work the same way with a `data-cpu-meter` attribute, linear 0–1 (TopBar's CPU fill).
- Per-chain and per-track colors come in through an `accent` prop, applied as `--accent`.
- `ui/src/app/` imports Scamp components through the `@scamp` alias (`@scamp/components/TopBar/TopBar`). `@` also points at `ui/glitch`, because Scamp's own files import each other as `@/components/...`. Hand-written code uses `@scamp`.
- Hand-written CSS uses a `gl-` prefix. Note that Scamp's `design/theme.css` resets `button` and `input` with `all: unset`, so hand-written controls must style themselves.
- **Views keep to the bindings Scamp is documented to keep, and the app renders live content into slots.** Rig has a `content` variant (`sample` on the canvas, `live` in the app, which hides the sample song, chains and editor sheet), `showTopBar`/`showPlaylist` show bindings, `onAddChain`, and a `liveChains` slot the app fills with `ChainStrip`s. Home has `showTopBar`, `subtitle`, `onNewProject`, its sample cards behind `showSamples`, and a `projects` slot for the real `ProjectCard`s (wrappers use `display: contents` so cards stay in the grid). Components (ChainStrip, ProjectCard, TopBar, BlockTile) take the live props and events directly.
- **Why slots:** when Scamp re-saves a view it rewrites the props from what its model understands. A repeat whose rows held arrays, booleans or slot content, or events with two arguments, came back simplified, with chain plugins dropped and events removed. If Scamp shows "Diverged" after an outside edit, choose Discard canvas (reload from disk), or it can save an older copy of the view over the file.
- **Hiding a component instance needs a show binding** (`{showTopBar && (<TopBar … />)}`), not a CSS variant rule. Scamp keeps variant rules on plain elements but deletes rules that target instance classes.
- Missing components get a temporary placeholder in `ui/src/app/placeholders/`, deleted once the Scamp version exists.

### Placeholders to replace in Scamp

| Component | Why there's a placeholder | Props the app needs |
|---|---|---|
| `Fader` | Scamp's Fader is uncontrolled (`defaultValue`, no callbacks). Its `level` and `muted` props are typed `string` but default to a number and a boolean. | `name`, `position` (0–1), `readout`, `muted`, `accent`, `onPositionChange(position)`, `onMuteChange(muted)` |
| `Meter` | Doesn't exist yet. | `label`, `meterKey` (bound to `data-meter`; reads `--level` 0–1 and `[data-clip]`; clicking clears clip), `accent`, `muted` |

Also used from Scamp:
- `TopBar`: project name, device, CPU and MIDI status, and the panic button (`panic: "off" | "on"` variant, `onPanic` event). The app shell owns the live top bar, so it passes `showTopBar={false}` to the views; their canvas default still draws one. Its back arrow (`href="/"`) is the way from Rig to Projects.
- The `Home` view (route `/`) and the `Rig` view (route `/rig`, with the monitor strip under it).
- `ChainStrip`, inside Rig's live chains. Clicking the input or output chip steps to the next choice: inputs 1…n, then output pairs, then single outputs.

Scamp's own interaction attributes (`data-scamp-click`, `-outside`, `-escape`: the TopBar device menu, ChainStrip's plugin menu, BlockTile's modal) work in the app because `ui/src/main.tsx` installs Scamp's runtime handler from `scampjs/runtime` (pinned to the version the Scamp project uses).

The app routes in-page: `ui/src/app/router.ts` handles Scamp's plain `<a href="/...">` links without a page load. A project card links to `/rig?project=<id>`, which opens that project. The bundled app serves `index.html` for these paths.

A prop worth adding to `TopBar` later: `cpuRef` (the CPU fill via a CSS variable instead of re-rendering).

Vite serves `ui/glitch/public/` as the app's public folder, because Scamp references its images from the URL root (`/assets/*.webp`).

The UI typecheck covers every Scamp file the app imports. Scamp's `React.ReactNode` slot types are mapped to Preact in `ui/src/env.d.ts`.

## Projects and chains

- The app starts blank. **New project** creates a project and opens its empty rig. **+ Add chain** adds a chain (input 1 → outputs 1/2, 0 dB) up to the v1 limit of 8.
- A chain takes one hardware input, runs it through its blocks in order (NAM models, cab IRs and plugins), applies a smoothed level and mute, and sums into its outputs. Chains are stereo from the input stage on.
- The monitor fader is the master stage after all chains, with mute and PANIC on top. With no chains, the outputs are silent.
- Projects are saved as JSON in `~/.config/Glitch/projects/<id>/project.json` on Linux and `~/Library/Application Support/Glitch/` on macOS. Changes are written at most once a second, on switching projects and on quit, via a temp file so a crash can't corrupt them. `settings.json` remembers the last open project.
- **Renaming:** double-click a project's name (on its card, or in the Rig top bar) or a chain's name to edit it in place; Enter or clicking away saves, Escape cancels. A card's ⋯ menu has Rename too. New projects and chains start in rename mode, and Enter on a new project's name opens its rig. Scamp components opt in by binding `data-rename="project:<id>"` or `"chain:<id>"` on the text (`renameKey` props); `ui/src/app/rename.ts` does the editing with `contenteditable`, so text inside a `<button>` can't be renamed. Names are trimmed, one line, at most 60 characters.
- **Removing a chain:** its ⋯ menu has Rename and Remove chain…, which asks to confirm (an `options: closed | open | confirm` variant on ChainStrip) and then removes the chain with its plugins' saved states and snapshots. Not yet: deleting projects. Delete a project's folder by hand for now.

### Audio device

Click the audio device pill in the top bar for a list of devices (all types: ALSA/JACK on Linux, CoreAudio on macOS). Picking one switches both directions when the device has them; a device with only inputs or only outputs leaves the other side as it was. Picking the current device reopens it. The choice is saved in `settings.json` and restored at startup (falling back to the default device if it's gone).

- **Hotplug:** the list updates on its own when devices come and go. CoreAudio and JACK announce it; ALSA doesn't, so on Linux the app watches `/proc/asound/cards` every 2 seconds and rescans when it changes, telling alsa-lib to reload its config first (otherwise cards plugged in after startup never appear). It doesn't switch to a newly plugged device.
- **Linux list:** JUCE's ALSA type lists every PCM. The menu shows the default output, PipeWire, and one direct hardware entry per card ("M4, USB Audio"), and hides the mixing, snooping, surround and S/PDIF variants.
- **A device the desktop is using (Linux):** direct hardware access is exclusive, so if PipeWire has the device open, Glitch only gets the other direction and says so in an error. Hand the device to Glitch by switching its PipeWire profile off (`wpctl status` for its id, then `wpctl set-profile <id> 0`; `1` or Settings > Sound to give it back), then pick it again in the menu. Or choose PipeWire Sound Server to share it, with more latency. macOS shares devices, so this doesn't apply there.
- Chains' input and output chips are dropdowns of the channels the device actually opened (pairs first, then single outputs), labelled with the device's channel names.
- **Sample rate and buffer size:** chips under the device list (44.1 kHz and up; buffer sizes in powers of two). Picking one restarts the device at that format, re-prepares the audio graph and NAM models, and saves it with the device setup. The line under them shows the buffer's length in ms and the latency the driver reports, which can be shorter than the true round trip.

### NAM models and cab IRs

- **NAM block:** a `.nam` capture run by [NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore). Models are mono: the block runs the left channel and feeds both. Input and Output gain; the output is normalised to the model's recorded loudness when it has one, like the NAM plugin's Normalize. A model trained at another sample rate runs anyway, and its tile says so.
- **IR block:** a cabinet impulse response through `juce::dsp::Convolution` (loaded off the audio thread). Level, and Mix (dry/wet). A mono IR applies to both channels.
- **Library:** models and IRs live in `<app data>/Glitch/library/nam` and `library/ir` (Linux `~/.config/Glitch/`, macOS `~/Library/Application Support/Glitch/`). **Add file…** in a chain's + menu copies them in, so projects keep working if the originals move, and accepts plugins too. Files dropped into those folders appear after **Scan**. Blocks refer to them by their path inside the library, and paths outside it are refused.
- **Editing:** their parameters are real JUCE parameters, so clicking a tile opens the plugin window with JUCE's generic sliders under the Bypass/Remove header, and settings save like plugin state.
- **Build:** NAM's sources (v0.6.0) and Eigen (the commit NAM pins, checked by SHA-256) are fetched by CMake and compiled as an object library, always optimised and with AVX2/FMA on Intel. It's an object library because NAM registers its model types from static initialisers, which a static library drops ("No config parser registered"). `engine/src/blocks/NamModel` keeps Eigen out of Glitch's own code. Fast tanh is on, as in the NAM plugin: it cut a standard WaveNet model from 24% to 3.7% of a buffer here.
- **Measuring:** `cmake --build --preset release --target GlitchBench`, then `build/release/engine/GlitchBench_artefacts/Release/GlitchBench <model.nam | ir.wav> [rate]` prints the average and worst share of each buffer at 64, 128 and 256 samples. On a 2024 laptop (Core Ultra 7 258V): standard WaveNet ~3.7%, a 200 ms IR ~1.7%. The plan's number to get is the 2015 MacBook's.

### Plugins

- **Import:** open a chain's **+** menu. **Scan for plugins** searches the standard folders: `~/.vst3`, `/usr/lib/vst3` and `/usr/local/lib/vst3` on Linux, and `~/Library/Audio/Plug-Ins` and `/Library/Audio/Plug-Ins` on macOS. **Add plugin…** opens a file chooser for a plugin or a folder of plugins installed anywhere else. Formats: VST3, plus AU on macOS. The list is saved in `plugins.xml` next to the projects.
- **Use:** pick a plugin from the **+** menu to add it to the end of that chain. Click a plugin tile to open its window: the plugin's own editor (or JUCE's generic one when it has none) in a native window, under a Glitch header with **Bypass/Enable** and **Remove from chain**. A missing plugin opens the same window with a note, so it can still be removed.
- **Previews:** when a plugin window opens (after it first paints) and when it closes, Glitch snapshots the plugin's part of the window (`juce::createSnapshotOfNativeWindow`) to `projects/<id>/snapshots/<blockId>.png`, at up to 2x for Retina. The tile shows it at the window's on-screen size, via BlockTile's `art: "hug"` variant, scaled down past 400px tall. The resource provider serves these at `snapshots/<projectId>/<blockId>.png`, and the state's `snapshotBase` gives the prefix. Tiles never opened keep the generic image.
- **Saving:** each plugin's settings are captured every couple of seconds, on switching projects and on quit, and stored in the project (`pluginStates`, base64), outside the chains, so state events stay small.
- **Missing plugins:** a block whose plugin isn't installed shows Scamp's error state ("Not installed") and is skipped in the audio path, but stays in the project. It loads again once a scan finds the plugin.
- **How scans run:** on the main thread, one plugin per timer tick, as JUCE's own plugin list does. Audio Units (and some VST3s) must be loaded on the main thread, and scanning them on a background thread stalled on macOS. The menu shows "Scanning… 40% · <plugin>"; Add plugin… waits until a scan has finished, and says so. AUs are listed from the system's registered components, so an AU only counts once it's installed in `~/Library/Audio/Plug-Ins/Components` or `/Library/Audio/Plug-Ins/Components`.
- **Scanning risk:** scans run inside the app. A plugin that crashes during a scan takes Glitch down once, and a slow one pauses the UI while it loads; JUCE's crash marker (`plugin-scan-in-progress.txt`) makes the next scan skip it. Plugins are also created synchronously, which a few AUv3 plugins refuse. Both are marked `shortcut:` in `engine/src/plugins/PluginLibrary`.
- In the browser, the mock engine's scan finds two placeholder plugins, so the flow can be designed without the app. "Add plugin…" and plugin windows only work in the app.

## Bridge protocol

Two JUCE 8 native-integration WebView events, plain events in both directions:

- `glitch:command` (UI → engine): a `Command`, sent with `window.__JUCE__.backend.emitEvent`.
- `glitch:event` (engine → UI): an `EngineEvent` (`state`, `meters`, `transport`, `tuner`, `switch`, `error`).

On load the UI sends `app.ready`, and the engine replies with a full `state`. The engine is the source of truth: the UI renders state and never assumes a command worked. Without `window.__JUCE__` (a normal browser), `ui/src/bridge/engine.ts` uses the mock engine and the top bar shows a "Mock engine" badge.

### Adding a command

Do all four in the same commit:

1. Add the type to `packages/protocol/src/commands.ts`.
2. Add the string to `engine/src/bridge/Protocol.h`.
3. Handle it in `WebUi::handleCommand` (`engine/src/bridge/WebUi.cpp`).
4. Add a branch to `ui/src/bridge/mockEngine.ts`.

## Linux + Mac workflow

All coding, Scamp work and the UI dev server happen on Linux. The mid-2015 MacBook Pro (Monterey 12.7.6, Xcode 14.2) is for macOS builds, Core Audio / AU / WebKit testing, real latency and CPU, and show builds. Check on the Mac at least once per milestone, and whenever you touch platform-specific code.

### Linux setup

```sh
sudo apt install build-essential cmake pkg-config libasound2-dev libjack-jackd2-dev ladspa-sdk \
  libfreetype-dev libfontconfig1-dev libx11-dev libxcomposite-dev libxcursor-dev libxext-dev \
  libxinerama-dev libxrandr-dev libxrender-dev libglu1-mesa-dev mesa-common-dev \
  libgtk-3-dev libwebkit2gtk-4.1-dev
```

JACK and ALSA are both enabled. With no JACK server running, JUCE logs a few JACK errors and uses ALSA.

**Launching from VS Code's integrated terminal (snap install):** VS Code passes snap variables (`GTK_PATH`, `GIO_MODULE_DIR`, …) to child processes, and WebKit crashes on them (`undefined symbol: __libc_pthread_init`). Launch from a normal terminal, or clear them:

```sh
env -u GTK_PATH -u GTK_EXE_PREFIX -u GIO_MODULE_DIR -u GTK_IM_MODULE_FILE -u GSETTINGS_SCHEMA_DIR -u LOCPATH \
  XDG_DATA_DIRS="$XDG_DATA_DIRS_VSCODE_SNAP_ORIG" build/dev/engine/Glitch_artefacts/RelWithDebInfo/Glitch
```

### Mac setup (one time)

- Install Xcode 14.2 (or its command line tools), CMake 3.22+ and Node 20 from their official installers. Don't rely on Homebrew on Monterey.
- Update Safari to 17.6, so the WebView gets the newest engine Monterey allows.
- Turn on System Preferences > Sharing > Remote Login. Add an SSH key and a `glitch-mac` host alias in `~/.ssh/config` on Linux.
- The M4 plugs straight into a USB-A port. No hub.

### Building on the Mac from Linux

```sh
./scripts/mac.sh release --run                              # bundled UI
GLITCH_DEV_HOST=192.168.1.20 ./scripts/mac.sh dev-remote --run  # live UI from this machine
```

`mac.sh` rsyncs the working tree (uncommitted changes included, minus `node_modules/`, `build/`, `ui/dist/` and `.git/`) to `GLITCH_MAC_DIR` (default `~/code/glitch`) on `GLITCH_MAC_HOST` (default `glitch-mac`). It runs `npm ci` there if the lockfile changed, configures and builds the preset, and with `--run` quits any running Glitch and opens the new one (someone must be logged in on the Mac). It configures on every run, not just the first, so a changed `GLITCH_DEV_HOST` takes effect.

For live UI on the Mac: run `./scripts/dev.sh` on Linux, then build `dev-remote`. UI changes saved on Linux, in Scamp or in code, hot-reload in the app on the Mac.

### CI

`.github/workflows/build.yml` has three jobs: the UI (typecheck and build), Linux (release build) and macOS (universal release build, uploaded as `Glitch.dmg` in the run's **Glitch-macOS** artifact (GitHub zips artifacts, so unzip first). The app is unsigned: after dragging it to Applications, right-click it and choose Open the first time, or run `xattr -dr com.apple.quarantine /Applications/Glitch.app`). GitHub's macOS runners use a newer Xcode than 14.2, so a green CI run doesn't replace building on the Mac itself. The 12.0 deployment target keeps the artifact runnable on Monterey.

**Releases:** pushing a tag starting with `v` (e.g. `git tag v0.1.0-alpha.2 && git push origin v0.1.0-alpha.2`) also publishes that build as a GitHub pre-release with `Glitch.dmg` attached, using `.github/release-notes.md` as its notes.

## Pinned versions and deviations

| Thing | Version | Note |
|---|---|---|
| JUCE | **8.0.15** | Not 8.0.9: on Linux, 8.0.9 crashes (`std::bad_alloc`) serving any bundled file larger than the WebView IPC pipe buffer. Fixed in 8.0.11. All 8.0.x releases list Xcode 12.4 as the minimum. Still to confirm on the Mac with Xcode 14.2. |
| preact | **10.29.8** | Not 10.24.3: the Scamp project requires `^10.29.0`. Vite dedupes Preact, so `ui/glitch/node_modules` can't load a second copy. |
| @preact/signals | 1.3.0 | |
| NeuralAmpModelerCore | v0.6.0 | Sources only, compiled by `engine/CMakeLists.txt` |
| Eigen | `bc3b3987` | The commit NAM v0.6.0 pins, as a tarball checked by SHA-256 |
| scampjs | 0.3.4 | Only its `scampjs/runtime` interactions handler is used. It brings its own Vite 8 as a nested dependency, which the build doesn't use. Keep in step with `ui/glitch/package-lock.json`. |
| vite | 5.4.10 | build target `safari15` |
| @preact/preset-vite | 2.9.1 | |
| typescript | 5.6.3 | |
| Node | 20 | `.nvmrc` |
| Dev server port | **5290** | Not 5173: Vite's default port clashes with other local projects (including the Scamp repo). Set in `ui/vite.config.ts` and both dev presets. |
| CMake | 3.22+ | |
| C++ | C++20 | Only what Xcode 14.2 supports: no `std::format`, careful with ranges |
| macOS target | 12.0 | |

## Conventions

- C++20 in JUCE style, building on both Linux and macOS. Platform code goes behind `#if JUCE_MAC` / `#if JUCE_LINUX`.
- The audio thread never allocates, locks or logs. Parameters are atomics and get smoothed.
- TypeScript is strict. Nothing newer than Safari 15 without a fallback.
- App views live in `ui/src/app/views/<Name>View.tsx`.
- Don't commit `node_modules/`, `ui/dist/`, `build/`, `.DS_Store`, `library/` or `*.nam`.
- Keep commits small, one concern each. Work on a branch and don't push to `main` without being asked.

# Glitch Monorepo: Project Outline and Coding Agent Instructions

Instructions for setting up the **Glitch** repo: a C++ / JUCE audio app and its Scamp (Preact) UI in one GitHub repo. The app loads the Scamp UI, and design updates made in Scamp flow into the app without touching C++.

The existing Scamp project folder is called `glitch`. It moves into this repo unchanged at `ui/glitch/`.

Read `docs/plan.md` and `docs/ui-requirements.md` first. They are the source of truth for features, the data model and the UI.

---

## 1. Goals of this setup

1. **One repo** holds the C++ engine, the Scamp project, shared protocol types, docs and design prototypes.
2. **The app pulls the UI from the Scamp project.** No copying files by hand.
3. **Live design updates in development:** edit in Scamp, and the running app hot-reloads.
4. **Self-contained release builds:** the built UI is bundled inside the `.app`, with no server needed at a show.
5. **Design and code never fight:** Scamp owns its files. Hand-written code wires engine state into Scamp components without editing them.

---

## 2. Repo layout

```
glitch/                          repo root (GitHub repo: glitch)
├── README.md
├── package.json                 npm workspaces: ["ui", "packages/*"]
├── CMakeLists.txt               root: options + add_subdirectory(engine)
├── CMakePresets.json            "dev", "dev-remote" and "release" presets
├── .gitignore  .editorconfig  .nvmrc (20)
│
├── docs/
│   ├── plan.md                  (was rig-plan.md)
│   └── ui-requirements.md       (was rig-ui-requirements.md)
│
├── design/prototypes/           HTML/CSS explorations (fader.html, aby-pedal.html)
│
├── packages/
│   └── protocol/                @glitch/protocol: shared TypeScript types
│       └── src/ index.ts  model.ts  commands.ts  events.ts
│
├── ui/                          @glitch/ui: Preact + Vite app the engine loads
│   ├── package.json  vite.config.ts  tsconfig.json  index.html
│   ├── glitch/                  THE SCAMP PROJECT, moved in as-is. Scamp-owned: do not hand-edit.
│   │   └── ...                  its own layout: components, pages, theme, as Scamp writes them
│   └── src/                     hand-written code
│       ├── main.tsx
│       ├── env.d.ts             types for window.__JUCE__
│       ├── app/                 views, hooks, fader law, routing between views
│       ├── bridge/              engine.ts (JUCE or mock), mockEngine.ts
│       └── store/               signals store fed by engine events
│
├── engine/                      C++ app
│   ├── CMakeLists.txt
│   └── src/
│       ├── Main.cpp             JUCEApplication + main window
│       ├── MainComponent.h/.cpp owns Engine + WebUi, lays out the WebView
│       ├── bridge/
│       │   ├── Protocol.h       event names + command type strings (mirrors packages/protocol)
│       │   └── WebUi.h/.cpp     WebBrowserComponent, command dispatch, event emit, resource provider
│       └── audio/
│           └── Engine.h/.cpp    AudioDeviceManager, audio callback, meters
│
├── scripts/
│   ├── dev.sh                   npm install if needed, then run the Vite dev server
│   └── mac.sh                   sync to the Mac over SSH, build there, optionally launch
└── .github/workflows/build.yml  UI typecheck + build, engine build on Ubuntu, app build on macOS
```

---

## 3. Key decisions (follow these)

### 3.1 Scamp ownership
- The Scamp project lives at `ui/glitch/`: move the existing `glitch` Scamp folder there as-is and keep opening it in Scamp from that location. Treat it as generated: never hand-edit it.
- If the `glitch` folder is already its own git repo, ask Angie whether to keep its history. If yes, bring it in with `git subtree add --prefix=ui/glitch <path-or-remote> <branch>`. If not, copy it in without its `.git` folder. Never add it as a nested repo or submodule.
- Components in `ui/glitch/` are **presentational**: props in, callbacks out. No imports from `app/`, `bridge/` or `store/`.
- Every state in `docs/ui-requirements.md` must be reachable through props (e.g. `muted`, `status: "loading" | "error"`).
- High-rate visuals (meters, CPU, hold progress) read **CSS variables** from a root element exposed through a ref prop (e.g. `meterRef`). The app writes `--level` directly at ~30 Hz without re-rendering.
- Per-chain and per-track colors come in through an `accent` prop, applied as `--accent`.
- `ui/src/app/` imports Scamp components (through the `@scamp` alias) and passes them store data and command handlers.
- The `@scamp` alias in both `vite.config.ts` and `tsconfig.json` points at `ui/glitch/`. First inspect the `glitch` folder to see where Scamp puts components, pages and styles, and point imports at those paths. If the Scamp project has its own `package.json` or config, don't merge it into `ui/package.json`. Ask Angie before changing anything inside `ui/glitch/`, even config.
- If the Scamp output imports packages (e.g. `preact`), make sure `ui/package.json` provides them at compatible versions.
- If the `glitch` project doesn't have a component the M0 milestone needs yet (TopBar, Fader, Meter), build a temporary placeholder in `ui/src/app/placeholders/`, ported from `design/prototypes/`, with the props listed in section 7. Don't put placeholders inside `ui/glitch/`. Delete each one once the Scamp version exists, then list the props it used so Angie can match them in Scamp.
- Add `ui/glitch/SCAMP.md` only if Angie approves. Otherwise document these rules in the root README.

### 3.2 Two UI modes, chosen by CMake
| Preset | `GLITCH_UI_DEV_URL` | `GLITCH_BUILD_UI` | App loads UI from |
|---|---|---|---|
| `dev` | `http://localhost:5173` | OFF | Vite dev server on the same machine (hot reload) |
| `dev-remote` | `http://$env{GLITCH_DEV_HOST}:5173` | OFF | Vite dev server on the Linux machine, over the local network (Mac builds) |
| `release` | empty | ON | `ui/dist`, copied into the app bundle |

- `GLITCH_UI_DEV_URL` is passed to C++ as a compile definition. Empty means "serve the bundled build".
- When `GLITCH_BUILD_UI` is ON and no dev URL is set, CMake runs `npm run build -w ui` (via `find_program(npm)` and an `add_custom_target(... ALL)`) before building the app, then copies `ui/dist` into the bundle as a POST_BUILD step:
  - macOS: `$<TARGET_BUNDLE_CONTENT_DIR:Glitch>/Resources/ui`
  - Linux: `$<TARGET_FILE_DIR:Glitch>/ui`
- Copy the folder rather than using `juce_add_binary_data`. Vite's hashed filenames would force a re-configure on every UI build.

### 3.3 Bridge protocol
- Two WebView events, using JUCE 8's native integration:
  - `glitch:command` (UI → engine): a `Command` object. JS sends it with `window.__JUCE__.backend.emitEvent("glitch:command", cmd)`. C++ receives it through `WebBrowserComponent::Options::withEventListener("glitch:command", ...)`.
  - `glitch:event` (engine → UI): an `EngineEvent` object. C++ sends it with `emitEventIfBrowserIsVisible("glitch:event", var)`. JS listens with `window.__JUCE__.backend.addEventListener("glitch:event", fn)`.
- Use plain events both ways, not JUCE native functions. Requests that need a reply get it as a later event; the UI never waits on a synchronous result.
- Payloads are JSON-compatible objects (`juce::var` / `DynamicObject` on the C++ side).
- Types live in `packages/protocol`. `engine/src/bridge/Protocol.h` mirrors the event names and command type strings. Adding a command means updating both, plus the mock engine.
- On load, the UI sends `{ type: "app.ready" }`. The engine replies with a full `state` event.
- Event shapes:
  - `state`: full `GlitchState` snapshot, sent after any structural change
  - `meters`: about 30 Hz, `{ levels: { "in:1": dBFS, "out:1": dBFS, ... }, cpu }`
  - `transport`, `tuner`, `switch`, `error`: see the plan
- The engine is the source of truth. The UI renders state and never assumes a command succeeded.

### 3.4 Mock engine
- `ui/src/bridge/engine.ts` uses the JUCE backend when `window.__JUCE__` exists, otherwise `mockEngine.ts`.
- The mock engine handles the same commands with plausible state and moving meters, so every view can be designed in a normal browser. Grow it alongside the real engine.
- Show a "Mock engine" badge in the top bar when it's active.

### 3.5 Serving the bundled UI
- Use `WebBrowserComponent::Options::withResourceProvider(...)` and load `WebBrowserComponent::getResourceProviderRoot()`.
- The provider maps a URL path to a file under the bundled `ui/` folder:
  - Strip the query string. `/` maps to `index.html`.
  - Reject paths that resolve outside the UI root (`isAChildOf` check).
  - Set the MIME type from the extension: html, js, css, svg, png, json, woff2, wasm.
- Vite uses `base: "./"` so asset URLs are relative.

---

## 4. Pinned versions

| Thing | Version |
|---|---|
| JUCE | `8.0.9`, via CMake `FetchContent` (`GIT_SHALLOW TRUE`) |
| CMake | 3.22+ |
| C++ | C++20 |
| macOS deployment target | 12.0 (the show Mac is a mid-2015 MacBook Pro on Monterey 12.7.6) |
| Xcode on the Mac | 14.2 (newest that runs on Monterey) |
| Node | 20 |
| preact | 10.24.3 |
| @preact/signals | 1.3.0 |
| vite | 5.4.10 |
| @preact/preset-vite | 2.9.1 |
| typescript | 5.6.3 |
| Vite build target | `safari15` (Monterey's WebView is Safari 17.6 once Safari is updated; target lower for safety) |

Check each version exists before pinning. If one doesn't, use the nearest stable release and note it in the README.

**JUCE on Xcode 14.2:** confirm early (first task of M0) that JUCE 8.0.9 compiles on the Mac with Xcode 14.2. If it doesn't, step back to the newest JUCE 8 release that does, pin that, and note why in the README.

---

## 5. Development workflow (Linux + Mac)

Code is written on Angie's Linux machine. The MacBook is the test and show machine.

| Machine | Role |
|---|---|
| Linux workstation | All coding, Scamp design work, UI dev server, native Linux engine builds, quick audio tests |
| Mid-2015 MacBook Pro, Monterey 12.7.6 | macOS builds over SSH, Core Audio / AU / WebKit testing, latency and CPU testing with the M4, release builds for shows |

### 5.1 What runs where
- **UI work:** on Linux, in a browser against the mock engine (`npm run dev -w ui`), or in the Linux build of the app.
- **Engine logic:** on Linux, as a native JUCE build. The M4 is class compliant, so it works on Linux too (ALSA, or JACK if installed).
- **Mac-only checks:** Core Audio behavior, AU plugin hosting, the macOS WebView, microphone permission prompts, bundle packaging, real latency and CPU on the 2015 i7. Run these on the Mac at least once per milestone, and whenever touching platform-specific code.

### 5.2 Linux setup
- JUCE Linux dependencies (Debian/Ubuntu names; check JUCE's `docs/Linux Dependencies.md` for the exact list for the pinned version and the actual distro):
  `build-essential cmake pkg-config libasound2-dev libjack-jackd2-dev ladspa-sdk libfreetype-dev libfontconfig1-dev libx11-dev libxcomposite-dev libxcursor-dev libxext-dev libxinerama-dev libxrandr-dev libxrender-dev libglu1-mesa-dev mesa-common-dev libgtk-3-dev libwebkit2gtk-4.1-dev`
- Enable `JUCE_JACK=1` and `JUCE_ALSA=1`.
- The bundled UI on Linux is copied next to the executable (`<build>/engine/Glitch_artefacts/<config>/ui`), as in section 3.2.
- Linux is a first-class build target from M0, not a later port.

### 5.3 Mac setup (one time)
- Install Xcode 14.2 (or its command line tools), CMake 3.22+ and Node 20 from their official installers. Homebrew's support for Monterey is limited, so don't depend on it.
- Update Safari to 17.6, so the app's WebView has the newest engine Monterey allows.
- Turn on **System Preferences > Sharing > Remote Login** so the Linux machine can SSH in. Set up an SSH key and a host alias (e.g. `glitch-mac` in `~/.ssh/config`).
- Clone the repo once on the Mac (e.g. `~/code/glitch`) so the JUCE download and build cache persist between syncs.
- Hardware: the M4 plugs into a USB-A port with its included USB-C to USB-A cable. The Chocolate uses a USB-A cable or Bluetooth. No hub.

### 5.4 Building on the Mac from Linux: `scripts/mac.sh`
Usage: `./scripts/mac.sh <preset> [--run]`, configured by environment variables:
- `GLITCH_MAC_HOST`: SSH host alias, default `glitch-mac`
- `GLITCH_MAC_DIR`: repo path on the Mac, default `~/code/glitch`
- `GLITCH_DEV_HOST`: the Linux machine's LAN IP or hostname, used by the `dev-remote` preset

What it does:
1. `rsync` the working tree to the Mac, so uncommitted work can be tested without pushing. Exclude `node_modules/`, `build/`, `ui/dist/` and `.git/`.
2. Over SSH: `npm ci` if `package-lock.json` changed, then `cmake --preset <preset>` (first run only) and `cmake --build --preset <preset>`, passing `GLITCH_DEV_HOST` through.
3. With `--run`, quit any running instance and `open` the built `Glitch.app` on the Mac. This needs Angie logged in on the Mac.
4. Exit non-zero and show the compiler output if the build fails.

### 5.5 Live UI on the Mac from Linux
- Vite's dev server listens on the local network: `server.host: true` in `ui/vite.config.ts`, keeping `port: 5173` and `strictPort: true`. Note in the README that this exposes the dev server to the local network while it runs.
- Build the Mac app with the `dev-remote` preset. It loads `http://$GLITCH_DEV_HOST:5173`, so UI changes saved on Linux (in Scamp or code) hot-reload in the app on the Mac with no rebuild.
- If the dev server isn't reachable, the app shows a clear "Can't reach the UI dev server at <url>" page instead of a blank window.
- `dev-remote` is for development only. Shows always use a `release` build, which has the UI bundled in.

### 5.6 CI
- **ui job (Ubuntu):** `npm ci`, typecheck, build the UI.
- **linux job (Ubuntu):** install the JUCE Linux dependencies, then build the `release` preset.
- **macos job:** build the `release` preset and upload `Glitch.app` as an artifact. GitHub's macOS runners use a newer Xcode than the Mac's 14.2, so a green CI build doesn't replace building on the Mac itself. The 12.0 deployment target makes the CI artifact runnable on Monterey.

---

## 6. Engine CMake details

`engine/CMakeLists.txt`:
- `FetchContent_Declare(juce GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)`, then `FetchContent_MakeAvailable(juce)`.
- `juce_add_gui_app(Glitch PRODUCT_NAME "Glitch" ...)` with:
  - `MICROPHONE_PERMISSION_ENABLED TRUE` and a `MICROPHONE_PERMISSION_TEXT` (required for audio input on macOS)
  - a placeholder `BUNDLE_ID` (ask Angie for the real one)
- Compile definitions:
  - `JUCE_WEB_BROWSER=1`
  - `JUCE_USE_CURL=0`
  - `JUCE_APPLICATION_NAME_STRING` and `JUCE_APPLICATION_VERSION_STRING`
  - `GLITCH_UI_DEV_URL="${GLITCH_UI_DEV_URL}"`
- Link: `juce::juce_gui_extra`, `juce::juce_audio_utils`, `juce::juce_dsp`, plus the `juce_recommended_*_flags` targets.
- The UI build target and the dist copy are described in 3.2.
- Leave clearly marked TODO slots for NeuralAmpModelerCore (and its Eigen dependency) for M1. Don't add them yet.

---

## 7. First milestone to build (M0 from the plan)

Get the full loop working end to end with one feature: a monitor passthrough.

**Engine**
- `Engine` owns a `juce::AudioDeviceManager`, opens the default device (2 in, 2 out to start), and implements `AudioIODeviceCallback`.
- Passthrough: input 1 goes to outputs 1 and 2, with a smoothed gain (`juce::SmoothedValue`) and mute.
- Threading rules from the plan: no allocation, locks or logging on the audio thread. Gain and mute are atomics.
- Peak meters for input 1 and outputs 1/2, stored as atomics and read by a 30 Hz `juce::Timer` on the message thread that emits a `meters` event.

**Bridge (`WebUi`)**
- Builds the `WebBrowserComponent` with native integration, the `glitch:command` listener and the resource provider.
- In dev mode, loads `GLITCH_UI_DEV_URL`. Otherwise it loads the resource provider root.
- Handles these commands:
  - `app.ready`: send a full `state`
  - `monitor.setGain`: set the gain, then send `state`
  - `monitor.setMute`: set the mute, then send `state`
  - `panic.toggle`: mute all outputs, then send `state`
  - Unknown types: reply with an `error` event naming the command
- `state` includes `device` (name, sample rate, buffer size, latency, channel names), `monitor`, `panic`, and empty defaults for every other `GlitchState` field.

**UI**
- `store/glitch.ts`: a `glitch` signal for state and a `lastError` signal. `onMeters()` lets subscribers write to the DOM. `send()` sends a command. `startStore()` sends `app.ready`.
- `app/App.tsx` renders the Scamp `TopBar` (device, mock badge, panic) and a Monitor view with:
  - a Scamp `Fader` driving `monitor.setGain`
  - mute driving `monitor.setMute`
  - Scamp `Meter`s for input 1 and outputs 1/2
- `app/faderLaw.ts` converts fader position to dB and back. It's piecewise linear between the scale marks +10, +5, 0, -5, -10, -20, -30, -40 and -inf, evenly spaced, with 0 dB at position 0.75. It also formats the readout ("-3.0 dB", "-∞").
- `app/useMeter.ts` is a hook that returns a ref. It subscribes to `onMeters`, maps dBFS from -60 to +6 onto 0 to 1, writes `--level`, and sets `data-clip` when the level is at or above 0 dBFS. Clip stays latched until clicked.

**Acceptance criteria**
0. JUCE builds on the Mac with Xcode 14.2 (see section 4). Do this first.
1. `npm install && npm run typecheck && npm run build:ui` passes.
2. `npm run dev -w ui` runs in a browser with the mock engine: the fader moves, the readout updates, meters animate, mute and panic work.
3. On the Mac, `cmake --preset dev && cmake --build --preset dev` builds. With `./scripts/dev.sh` running, the app shows the UI, and saving a change in Scamp (`ui/glitch/`) updates the app without rebuilding C++.
4. On the Mac, guitar into the M4's input 1 comes out of outputs 1/2. The fader changes the level smoothly with no clicks, and meters respond.
5. On the Mac, `cmake --preset release && cmake --build --preset release` produces a `Glitch.app` that works with no dev server running, with `Contents/Resources/ui/index.html` present.
6. On Linux, `cmake --preset dev && cmake --build --preset dev` builds and runs the app with the live UI, with audio through the M4 or the default device.
7. From Linux, `./scripts/mac.sh dev-remote --run` syncs, builds and launches the app on the Mac, and saving a UI change on Linux updates the app on the Mac without rebuilding.
8. The CI workflow passes on push (UI, Linux engine and macOS app jobs).

---

## 8. Conventions

- **Language:** C++20 with JUCE style for engine code, limited to what Xcode 14.2's compiler supports (no `std::format`, be careful with ranges). TypeScript strict mode for the UI.
- **Portability:** every engine change must build on both Linux and macOS. Platform-specific code goes behind `#if JUCE_MAC` / `#if JUCE_LINUX` in clearly named files.
- **UI compatibility:** nothing newer than Safari 15 without a fallback.
- **Naming:** Follow whatever class naming Scamp generates. Hand-written CSS in `ui/src/app/` uses a `gl-` prefix so it never collides. App views live in `app/views/<Name>View.tsx`.
- **New commands:** add the type in `packages/protocol/src/commands.ts`, the string in `Protocol.h`, a handler in `WebUi.cpp` and a branch in `mockEngine.ts`, in the same commit.
- **No engine calls from Scamp components.** If a component needs data, it needs a new prop, which Angie adds in Scamp.
- **Don't commit:** `node_modules/`, `ui/dist/`, `build/`, `.DS_Store`, or audio and model libraries (`library/`, `*.nam`).
- **Commits:** small, one concern each. Don't push to `main` without being asked. Work on a branch.

---

## 9. README contents

The root README should cover:
- What the project is, with links to the two docs
- The repo layout (section 2)
- The two UI modes (section 3.2)
- The Scamp workflow rules (section 3.1)
- Commands to install, run the UI alone, run a dev build with live UI, and make a release build
- How to add a command (section 8)
- The Linux + Mac workflow (section 5)

---

## 10. Out of scope for this setup

NAM, IRs, plugin hosting, chains, ABY, projects, setlists, footswitch and tuner. Those follow milestones M1 to M6 in `docs/plan.md`. The protocol types for them can be stubbed now from the plan's data model, but don't implement them yet.

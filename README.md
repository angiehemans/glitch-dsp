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
  src/app/            views, hooks, fader law, placeholders
  src/bridge/         engine.ts (JUCE or mock), mockEngine.ts
  src/store/          signals store fed by engine events
engine/src/           C++ app: Main, MainComponent, bridge/ (WebUi, Protocol.h), audio/ (Engine)
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

Builds land in `build/<preset>/engine/Glitch_artefacts/<Debug|Release>/`.

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
- High-rate visuals (meters, CPU, hold progress) read CSS variables from a root element passed through a ref prop (`meterRef`). The app writes `--level` at ~30 Hz without re-rendering.
- Per-chain and per-track colors come in through an `accent` prop, applied as `--accent`.
- `ui/src/app/` imports Scamp components through the `@scamp` alias (`@scamp/components/TopBar/TopBar`). `@` also points at `ui/glitch`, because Scamp's own files import each other as `@/components/...`. Hand-written code uses `@scamp`.
- Hand-written CSS uses a `gl-` prefix. Note that Scamp's `design/theme.css` resets `button` and `input` with `all: unset`, so hand-written controls must style themselves.
- Missing components get a temporary placeholder in `ui/src/app/placeholders/`, deleted once the Scamp version exists.

### Placeholders to replace in Scamp

| Component | Why there's a placeholder | Props the app needs |
|---|---|---|
| `Fader` | Scamp's Fader is uncontrolled (`defaultValue`, no callbacks). Its `level` and `muted` props are typed `string` but default to a number and a boolean. | `name`, `position` (0–1), `readout`, `muted`, `accent`, `onPositionChange(position)`, `onMuteChange(muted)` |
| `Meter` | Doesn't exist yet. | `label`, `meterRef` (root reads `--level` 0–1 and `[data-clip]`; clicking clears clip), `accent`, `muted` |

Also used from Scamp: `TopBar` (device, CPU and MIDI status, plus the panic button through its `panic: "off" | "on"` variant and `onPanic` event) and the `Rig` view, shown as a static design on the Rig screen. The app shell owns the live top bar, so it renders `<Rig topbar="hidden" />`; the canvas default (`shown`) still draws Rig's own top bar. The mock badge and the Monitor/Rig switcher sit next to `TopBar`. A prop worth adding to `TopBar` later: `cpuRef` (CPU fill via a CSS variable instead of re-rendering).

Vite serves `ui/glitch/public/` as the app's public folder, because Scamp references its images from the URL root (`/assets/*.webp`).

The UI typecheck covers every Scamp file the app imports. Scamp's `React.ReactNode` slot types are mapped to Preact in `ui/src/env.d.ts`.

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
  XDG_DATA_DIRS="$XDG_DATA_DIRS_VSCODE_SNAP_ORIG" build/dev/engine/Glitch_artefacts/Debug/Glitch
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

`.github/workflows/build.yml` has three jobs: the UI (typecheck and build), Linux (release build) and macOS (universal release build, uploaded as `Glitch.app.tar.gz`). GitHub's macOS runners use a newer Xcode than 14.2, so a green CI run doesn't replace building on the Mac itself. The 12.0 deployment target keeps the artifact runnable on Monterey.

## Pinned versions and deviations

| Thing | Version | Note |
|---|---|---|
| JUCE | **8.0.15** | Not 8.0.9: on Linux, 8.0.9 crashes (`std::bad_alloc`) serving any bundled file larger than the WebView IPC pipe buffer. Fixed in 8.0.11. All 8.0.x releases list Xcode 12.4 as the minimum. Still to confirm on the Mac with Xcode 14.2. |
| preact | **10.29.8** | Not 10.24.3: the Scamp project requires `^10.29.0`. Vite dedupes Preact, so `ui/glitch/node_modules` can't load a second copy. |
| @preact/signals | 1.3.0 | |
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

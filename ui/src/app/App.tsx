import { signal } from "@preact/signals";
import TopBar from "@scamp/components/TopBar/TopBar";
import { isMock } from "../bridge/engine";
import { cpuPercent, glitch, lastError, send } from "../store/glitch";
import { MonitorView } from "./views/MonitorView";
import { RigView } from "./views/RigView";

const SCREENS = { monitor: "Monitor", rig: "Rig" } as const;
type Screen = keyof typeof SCREENS;

// The hash keeps the screen across reloads (and hot reloads of index.html).
const screen = signal<Screen>(location.hash === "#rig" ? "rig" : "monitor");
const showScreen = (s: Screen) => {
  screen.value = s;
  history.replaceState(null, "", `#${s}`);
};

export function App() {
  const state = glitch.value;
  const device = state?.device;

  return (
    <div class="gl-app">
      <div class="gl-topbar">
        <TopBar
          variant="rig"
          projectName="NO PROJECT"
          presetName="—"
          modified={false}
          songName="—"
          cpuLoad={`${cpuPercent.value}%`}
          audioDevice={device ? device.name : "NO AUDIO DEVICE"}
          midiDevice={state?.midi.device ?? "NO MIDI"}
          panic={state?.panic ? "on" : "off"}
          onPanic={() => send({ type: "panic.toggle" })}
        />
        <div class="gl-topbar-extras">
          <nav class="gl-screens" aria-label="Screens">
            {(Object.keys(SCREENS) as Screen[]).map((s) => (
              <button key={s} type="button" aria-current={screen.value === s ? "page" : undefined} onClick={() => showScreen(s)}>
                {SCREENS[s]}
              </button>
            ))}
          </nav>
          {isMock && <span class="gl-mock-badge">Mock engine</span>}
        </div>
      </div>

      {state?.panic && (
        <div class="gl-banner gl-banner-panic" role="alert">
          All outputs muted
          <button type="button" onClick={() => send({ type: "panic.toggle" })}>
            Unmute
          </button>
        </div>
      )}
      {lastError.value && (
        <div class="gl-banner gl-banner-error" role="alert">
          {lastError.value}
          <button type="button" onClick={() => (lastError.value = null)}>
            Dismiss
          </button>
        </div>
      )}

      {!state ? (
        <p class="gl-loading">Connecting to engine…</p>
      ) : screen.value === "rig" ? (
        <RigView />
      ) : (
        <MonitorView state={state} />
      )}
    </div>
  );
}

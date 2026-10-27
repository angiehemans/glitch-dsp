import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import TopBar from "@scamp/components/TopBar/TopBar";
import { isMock } from "../bridge/engine";
import { cpuPercent, glitch, lastError, send } from "../store/glitch";
import { route } from "./router";
import { HomeView } from "./views/HomeView";
import { RigView } from "./views/RigView";

// A signal rendered as text updates that text node in place: reading cpuPercent.value in App would
// re-render the whole app (every chain) on each meters event.
const cpuText = computed(() => `${cpuPercent.value}%`);

// Routes match the links Scamp's views use: "/" (projects) and "/rig". The top bar's back arrow goes home.
export function App() {
  const state = glitch.value;
  const device = state?.device;
  const [path, query = ""] = route.value.split("?");
  const projectParam = new URLSearchParams(query).get("project");

  // A project card links to /rig?project=<id>.
  useEffect(() => {
    if (projectParam) send({ type: "project.open", projectId: projectParam });
  }, [projectParam]);

  return (
    <div class="gl-app">
      <div class="gl-topbar">
        <TopBar
          variant={path === "/rig" ? "rig" : "home"}
          projectName={state?.project?.name ?? "NO PROJECT"}
          projectRenameKey={state?.project ? `project:${state.project.id}` : ""}
          presetName="—"
          modified={false}
          songName="—"
          cpuLoad={cpuText as unknown as string}
          audioDevice={device ? device.name : "NO AUDIO DEVICE"}
          devices={(state?.devices ?? []).map((d, i) => ({ id: String(i), name: d.label || d.name, kind: d.type, current: d.current }))}
          midiDevice={state?.midi.device ?? "NO MIDI"}
          rates={(device?.sampleRates ?? []).map((r) => ({
            id: String(r),
            label: `${Number((r / 1000).toFixed(1))}k`,
            current: r === device?.sampleRate,
          }))}
          buffers={(device?.bufferSizes ?? []).map((b) => ({ id: String(b), label: String(b), current: b === device?.bufferSize }))}
          latency={
            device
              ? `${device.bufferSize} samples is ${((1000 * device.bufferSize) / device.sampleRate).toFixed(1)} ms · reported latency ${device.latencyMs.toFixed(1)} ms`
              : ""
          }
          onSelectRate={(id) => send({ type: "device.setFormat", sampleRate: Number(id) })}
          onSelectBuffer={(id) => send({ type: "device.setFormat", bufferSize: Number(id) })}
          onAudioClick={() => send({ type: "device.scan" })}
          onSelectDevice={(id) => {
            const d = state?.devices[Number(id)];
            if (d) send({ type: "device.select", deviceType: d.type, name: d.name }); // picking the current one reopens it
          }}
          panic={state?.panic ? "on" : "off"}
          onPanic={() => send({ type: "panic.toggle" })}
        />
        {isMock && (
          <div class="gl-topbar-extras">
            <span class="gl-mock-badge">Mock engine</span>
          </div>
        )}
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
      ) : path === "/rig" ? (
        <RigView state={state} />
      ) : (
        <HomeView state={state} />
      )}
    </div>
  );
}

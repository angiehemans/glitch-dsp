import { computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import TopBar from "@scamp/components/TopBar/TopBar";
import ViewTabs from "@scamp/components/ViewTabs/ViewTabs";
import { isMock } from "../bridge/engine";
import { cpuPercent, glitch, lastError, send } from "../store/glitch";
import { renameByKey, renameWhenCreated } from "./rename";
import { route } from "./router";
import { HomeView } from "./views/HomeView";
import { RigView } from "./views/RigView";
import { RoutingView } from "./views/RoutingView";
import { SongsView } from "./views/SongsView";
import { TunerView } from "./views/TunerView";

// A signal rendered as text updates that text node in place: reading cpuPercent.value in App would
// re-render the whole app (every chain) on each meters event.
const cpuText = computed(() => `${cpuPercent.value}%`);

// Routes match the links Scamp's views use: "/" (projects), "/rig" and "/routing". The top bar's back
// arrow goes home; ViewTabs switches between a project's Rig and Routing.
export function App() {
  const state = glitch.value;
  const device = state?.device;
  const [path, query = ""] = route.value.split("?");
  const projectParam = new URLSearchParams(query).get("project");
  const preset = state?.presets.find((p) => p.id === state.currentPresetId);

  // A project card links to /rig?project=<id>.
  useEffect(() => {
    if (projectParam) send({ type: "project.open", projectId: projectParam });
  }, [projectParam]);

  return (
    <div class="gl-app">
      <div class="gl-topbar">
        <TopBar
          variant={["/rig", "/routing", "/songs"].includes(path) ? "rig" : "home"}
          projectName={state?.project?.name ?? "NO PROJECT"}
          projectRenameKey={state?.project ? `project:${state.project.id}` : ""}
          presetName={preset?.name ?? "—"}
          presetRenameKey={preset ? `preset:${preset.id}` : ""}
          modified={!!state?.presetModified}
          presets={(state?.presets ?? []).map((p) => ({ id: p.id, name: p.name, current: p.id === preset?.id }))}
          noPresets={!state?.presets.length}
          canSave={!!state?.project && (!preset || !!state.presetModified)}
          hasPreset={!!preset}
          deleteLabel={preset ? `Delete “${preset.name}”` : ""}
          onSelectPreset={(id) => send({ type: "preset.load", presetId: id })}
          onSavePreset={() => send({ type: "preset.save" })}
          onSaveAsPreset={() => {
            renameWhenCreated("preset"); // name it in place, in the top bar
            send({ type: "preset.saveAs" });
          }}
          onRenamePreset={() => preset && renameByKey(`preset:${preset.id}`)}
          onDeletePreset={() => preset && send({ type: "preset.delete", presetId: preset.id })}
          songName={state?.songs.find((s) => s.id === state.project?.songId)?.title ?? "—"}
          cpuLoad={cpuText as unknown as string}
          audioDevice={device ? device.name : "NO AUDIO DEVICE"}
          devices={(state?.devices ?? []).map((d, i) => ({ id: String(i), name: d.label || d.name, kind: d.type, current: d.current }))}
          midiDevice={!state?.midi.device ? "NO MIDI" : state.midi.connected ? state.midi.device : `${state.midi.device} (OFF)`}
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
          onTune={() => send({ type: "tune.toggle" })}
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

      {state?.tuneMode.active ? (
        <TunerView state={state} />
      ) : (
        <>
          {state?.project && ["/rig", "/routing", "/songs"].includes(path) && (
            <div class="gl-tabs">
              <ViewTabs active={path === "/routing" ? "routing" : path === "/songs" ? "songs" : "rig"} />
            </div>
          )}

          {!state ? (
            <p class="gl-loading">Connecting to engine…</p>
          ) : path === "/rig" ? (
            <RigView state={state} />
          ) : path === "/routing" ? (
            <RoutingView state={state} />
          ) : path === "/songs" ? (
            <SongsView state={state} />
          ) : (
            <HomeView state={state} />
          )}
        </>
      )}
    </div>
  );
}

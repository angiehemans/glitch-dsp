import { SILENCE_DB, type GlitchState } from "@glitch/protocol";
import { send } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { useMeter } from "../useMeter";
import { Fader } from "../placeholders/Fader";
import { Meter } from "../placeholders/Meter";

export function MonitorView({ state }: { state: GlitchState }) {
  const { gainDb, muted } = state.monitor;
  const silenced = muted || state.panic;
  const in1 = useMeter("in:1");
  const out1 = useMeter("out:1");
  const out2 = useMeter("out:2");

  return (
    <main class="gl-monitor">
      <Meter label="IN 1" meterRef={in1} />
      <Fader
        name="Monitor"
        position={dbToPosition(gainDb)}
        readout={formatDb(gainDb, SILENCE_DB)}
        muted={muted}
        onPositionChange={(p) => send({ type: "monitor.setGain", gainDb: Math.max(SILENCE_DB, positionToDb(p)) })}
        onMuteChange={(m) => send({ type: "monitor.setMute", muted: m })}
      />
      <Meter label="OUT 1" meterRef={out1} muted={silenced} />
      <Meter label="OUT 2" meterRef={out2} muted={silenced} />
    </main>
  );
}

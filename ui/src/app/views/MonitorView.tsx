import { SILENCE_DB, type GlitchState } from "@glitch/protocol";
import { send } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { Fader } from "../placeholders/Fader";
import { Meter } from "../placeholders/Meter";

/** Master stage: scales every output after the chains. */
export function MonitorView({ state }: { state: GlitchState }) {
  const { gainDb, muted } = state.monitor;
  const silenced = muted || state.panic;

  return (
    <section class="gl-monitor" aria-label="Monitor">
      <Meter label="IN 1" meterKey="in:1" />
      <Fader
        name="Monitor"
        position={dbToPosition(gainDb)}
        readout={formatDb(gainDb, SILENCE_DB)}
        muted={muted}
        onPositionChange={(p) => send({ type: "monitor.setGain", gainDb: Math.max(SILENCE_DB, positionToDb(p)) })}
        onMuteChange={(m) => send({ type: "monitor.setMute", muted: m })}
      />
      <Meter label="OUT 1" meterKey="out:1" muted={silenced} />
      <Meter label="OUT 2" meterKey="out:2" muted={silenced} />
    </section>
  );
}

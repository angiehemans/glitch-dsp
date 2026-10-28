import type { GlitchState } from "@glitch/protocol";
import Tuner from "@scamp/components/Tuner/Tuner";
import { send, tuner } from "../../store/glitch";

const IN_TUNE_CENTS = 3; // within this, the note shows green

/** Tune mode, over everything below the top bar (Panic stays reachable): the tuner and its settings. */
export function TunerView({ state }: { state: GlitchState }) {
  const { tuneMode } = state;
  const reading = tuner.value;
  const heard = !!reading?.note;
  const cents = heard ? reading!.cents : 0;
  const live = state.chains.find((c) => c.id === tuneMode.vocalChainId);
  const inputs = state.device?.inputs.length ? state.device.inputs : ["Input 1"];
  const reference = (hz: number) => send({ type: "tune.setReference", hz });

  return (
    <div class="gl-tuner" style={{ "--cents": Math.max(-50, Math.min(50, cents)).toFixed(1) }}>
      <Tuner
        tune={!heard ? "none" : Math.abs(cents) <= IN_TUNE_CENTS ? "in" : "out"}
        liveLabel={live ? `Everything muted except ${live.name}` : "All outputs muted"}
        note={heard ? reading!.note.replace("#", "♯") : "–"}
        octave={heard ? String(reading!.octave) : ""}
        centsLabel={!heard ? "Play a note" : Math.abs(cents) <= IN_TUNE_CENTS ? "In tune" : `${cents > 0 ? "+" : "−"}${Math.abs(cents).toFixed(0)} cents`}
        hzLabel={heard ? `${reading!.hz.toFixed(2)} Hz` : ""}
        inputs={inputs.map((name, i) => ({ id: String(i + 1), label: `In ${i + 1}`, current: tuneMode.tunerInput === i + 1 }))}
        referenceLabel={`A4 = ${tuneMode.reference} Hz`}
        chains={[
          { id: "none", name: "None", current: !live },
          ...state.chains.map((c) => ({ id: c.id, name: c.name, current: c.id === live?.id })),
        ]}
        onExit={() => send({ type: "tune.toggle" })}
        onSelectInput={(id) => send({ type: "tune.setInput", hwChannel: Number(id) })}
        onReferenceDown={() => reference(tuneMode.reference - 1)}
        onReferenceUp={() => reference(tuneMode.reference + 1)}
        onSelectLive={(id) => send({ type: "tune.setVocalChain", chainId: id === "none" ? null : id })}
      />
    </div>
  );
}

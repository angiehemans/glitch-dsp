import type { AbyBlock, Block, Chain, GlitchState } from "@glitch/protocol";
import Perform from "@scamp/views/Perform/Perform";
import { send, transport } from "../../store/glitch";
import { describe, listSwitches, useSwitchPress } from "./FootswitchView";
import { finishOf } from "./RigView";
import { clock } from "./SongsView";

/** A chain's pedals in signal order, as on the Rig: an ABY, then the blocks of the path (or both) it plays. */
function pedals(chain: Chain) {
  const pedal = (b: Block) => ({ id: b.id, on: b.enabled ? "on" : "off", finish: finishOf(b.id), name: b.name });
  return chain.blocks.flatMap((b) => {
    if (b.type !== "aby") return [pedal(b)];
    const aby = b as AbyBlock;
    const both = aby.mode === "Y";
    const paths = both ? [aby.pathA, aby.pathB] : [aby.active === "B" ? aby.pathB : aby.pathA];
    return [{ id: aby.id, on: "on", finish: "black", name: `ABY · ${both ? "A+B" : aby.active}` }, ...paths.flatMap((p) => p.blocks.map(pedal))];
  });
}

/** The song's outline as bars, drawn twice: grey, and the played part in the accent colour (clipped by --progress). */
function Waveform({ peaks }: { peaks: number[] }) {
  const bars = peaks.map((p, i) => <rect key={i} x={i + 0.2} y={(100 - Math.max(p, 2)) / 2} width={0.6} height={Math.max(p, 2)} rx={0.3} />);
  return (
    <div class="gl-wave">
      <svg viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none">{bars}</svg>
      <svg class="gl-wave-played" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none">{bars}</svg>
    </div>
  );
}

/** The stage screen: the song, what's next, the preset and the footswitch page, readable from a few metres. */
export function PerformView({ state }: { state: GlitchState }) {
  const project = state.project!;
  const song = state.songs.find((s) => s.id === project.songId);
  const setlist = state.setlists.find((l) => l.id === project.setlistId);
  // As the engine's next/prev: the setlist's songs still in the library; not in it yet, next is its first.
  const order = (setlist?.songs ?? []).filter((id) => state.songs.some((s) => s.id === id));
  const at = song ? order.indexOf(song.id) : -1;
  const next = state.songs.find((s) => s.id === order[at + 1]);
  const t = transport.value;
  const position = t.songId === song?.id ? t.position : 0;
  const playing = t.playing && t.songId === song?.id;
  const left = song ? Math.max(0, song.length - position) : 0;
  const preset = state.presets.find((p) => p.id === state.currentPresetId);
  const { ids, name, mappingOf, pages } = listSwitches(state);
  const pressing = useSwitchPress();

  return (
    <div
      class="gl-perform"
      style={{ "--progress": song?.length ? (position / song.length).toFixed(4) : "0" }}
      {...pressing}
    >
      <Perform
        panic={state.panic ? "on" : "off"}
        setlistLabel={setlist ? `${setlist.name}${at >= 0 ? ` · song ${at + 1} of ${order.length}` : ""}` : "No setlist"}
        stateKey={!song ? "none" : playing ? "playing" : position > 0 ? "stopped" : "ready"}
        stateLabel={!song ? "No song" : playing ? "Playing" : position > 0 ? "Stopped" : "Ready"}
        title={song?.title ?? "No song"}
        details={song ? `${clock(song.length)} · ${song.tracks.length} track${song.tracks.length === 1 ? "" : "s"}` : ""}
        elapsed={song ? clock(position) : ""}
        ending={playing && left <= 10 ? "on" : "off"}
        remaining={song ? `−${clock(left)}` : ""}
        playing={playing ? "on" : "off"}
        canPlay={!!song && !!state.device}
        playLabel={!state.device ? "NO AUDIO" : playing ? "STOP" : "PLAY"}
        nextDim={next ? "off" : "on"}
        nextTitle={
          next ? next.title : !setlist ? "Choose a setlist on the Songs tab" : order.length ? "End of the setlist" : "The setlist is empty"
        }
        waveform={
          // Until the engine has read the song's outline: a plain bar.
          song?.waveform?.length ? <Waveform peaks={song.waveform} /> : <div class="gl-wave gl-wave-bar" />
        }
        chains={state.chains
          .filter((c) => !c.muted)
          .map((c) => ({ id: c.id, color: c.color, name: c.name, pedals: pedals(c) }))}
        noChains={state.chains.length > 0 && state.chains.every((c) => c.muted)}
        presetName={preset?.name ?? "No preset"}
        modified={state.presetModified ? "on" : "off"}
        pageLabel={`Footswitch · page ${state.midi.page + 1} of ${pages}`}
        switches={ids.map((id) => {
          const m = mappingOf(id);
          const tap = describe(state, m?.tap ?? null);
          return {
            id,
            lit: tap.lit ? "on" : "off",
            name: name(id),
            tap: tap.label,
            hold: m?.hold ? `Hold · ${describe(state, m.hold).label}` : "",
          };
        })}
        noSwitches={ids.length === 0}
        onPrev={() => send({ type: "transport.prev" })}
        onPlay={() => send({ type: playing ? "transport.stop" : "transport.play" })}
        onNext={() => send({ type: "transport.next" })}
        onTune={() => send({ type: "tune.toggle" })}
        onPanic={() => send({ type: "panic.toggle" })}
      />
    </div>
  );
}

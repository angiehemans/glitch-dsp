import { SILENCE_DB, type AbyBlock, type GlitchState, type OutputRef } from "@glitch/protocol";
import Routing from "@scamp/views/Routing/Routing";
import { send } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";

/**
 * A matrix source: a chain, one path of a chain whose ABY splits to separate outputs, or a track of
 * the current song. Its id is the chain id (":A" or ":B" added for a path) or "track:<id>"; a cell's
 * id adds "~<output>". target is what route commands name it by.
 */
type Source = {
  id: string;
  name: string;
  tag: string; // shown after the name: a path's letter, a track's role
  color: string;
  muted: boolean;
  sends: OutputRef[];
  target: { chainId?: string; path?: "A" | "B"; trackId?: string };
  toggleMute: () => void;
};

function sources(state: GlitchState): Source[] {
  const chains = state.chains.flatMap((chain): Source[] => {
    const last = chain.blocks[chain.blocks.length - 1];
    const aby = last?.type === "aby" && (last as AbyBlock).exit === "split" ? (last as AbyBlock) : undefined;
    if (!aby?.splitOutputs)
      return [{
        id: chain.id, name: chain.name, tag: "", color: chain.color, muted: chain.muted, sends: chain.outputs, target: { chainId: chain.id },
        toggleMute: () => send({ type: "chain.setMute", chainId: chain.id, muted: !chain.muted }),
      }];
    return (["A", "B"] as const).map((path) => {
      const muted = (path === "B" ? aby.pathB : aby.pathA).mute;
      return {
        id: `${chain.id}:${path}`, name: chain.name, tag: path, color: chain.color, muted, sends: aby.splitOutputs![path], target: { chainId: chain.id, path },
        toggleMute: () => send({ type: "aby.setMute", blockId: aby.id, path, muted: !muted }),
      };
    });
  });

  // The current song's tracks; one not routed yet plays to the project's main output.
  const song = state.songs.find((s) => s.id === state.project?.songId);
  const tracks = (song?.tracks ?? []).map((track): Source => {
    const entry = state.project?.trackMix[song!.id]?.[track.id];
    const main = { hwChannels: state.project?.mainOutput ?? [1, 2], level: 0, pan: 0, mute: false };
    return {
      id: `track:${track.id}`, name: track.name, tag: track.role.toUpperCase(), color: "track", muted: !!entry?.mute,
      sends: entry?.outputs ?? [main], target: { trackId: track.id },
      toggleMute: () => send({ type: "trackMix.set", trackId: track.id, mute: !entry?.mute }),
    };
  });
  return [...chains, ...tracks];
}

/** The send a cell shows: the one that reaches that output (a pair covers two cells). */
const sendAt = (sends: OutputRef[], output: number) => sends.find((s) => s.hwChannels.includes(output));

function findCell(state: GlitchState, cellId: string) {
  const [sourceId, output] = cellId.split("~");
  const source = sources(state).find((s) => s.id === sourceId);
  return source && { source, output: Number(output), send: sendAt(source.sends, Number(output)) };
}

const routeSet = (source: Source, hwChannels: number[], change: { level?: number; mute?: boolean }) =>
  send({ type: "route.set", ...source.target, hwChannels, ...change });

/** The output matrix: every chain (or split path) and track of the current song, against every
 * hardware output the device opened. */
export function RoutingView({ state }: { state: GlitchState }) {
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const names = state.device?.outputs ?? [];
  const all = sources(state);

  return (
    <div class="gl-routing" onPointerDown={(e) => startLevelDrag(e, state)}>
      <Routing
        outputs={names.map((name, i) => ({ id: String(i + 1), label: `OUT ${i + 1}`, detail: name, meter: `out:${i + 1}` }))}
        rows={all.map((source) => {
          const name = source.target.path ? `${source.name} path ${source.tag}` : source.name;
          return {
            id: source.id,
            name: source.name,
            path: source.tag,
            color: source.color,
            muted: source.muted ? "on" : "off",
            muteLabel: `Mute ${name}`,
            cells: names.map((_, i) => {
              const output = i + 1;
              const s = sendAt(source.sends, output);
              return {
                id: `${source.id}~${output}`,
                state: !s ? "off" : s.mute ? "muted" : "on",
                level: s ? formatDb(s.level, SILENCE_DB) : "",
                side: !s ? "" : s.hwChannels.length === 2 ? (s.hwChannels[0] === output ? "L" : "R") : "MONO",
                mute: s?.mute ? "on" : "off",
                routed: !!s,
                label: s ? `${name} to Out ${output}, ${formatDb(s.level, SILENCE_DB)}` : `Send ${name} to Out ${output}`,
              };
            }),
          };
        })}
        empty={all.length === 0}
        onRowMute={(id) => all.find((s) => s.id === id)?.toggleMute()}
        onRoute={(id) => {
          const cell = findCell(state, id);
          if (cell && !cell.send) routeSet(cell.source, [cell.output], {}); // routed cells only drag
        }}
        onReset={(id) => {
          const cell = findCell(state, id);
          if (cell?.send) routeSet(cell.source, cell.send.hwChannels, { level: 0 });
        }}
        onMute={(id) => {
          const cell = findCell(state, id);
          if (cell?.send) routeSet(cell.source, cell.send.hwChannels, { mute: !cell.send.mute });
        }}
        onRemove={(id) => {
          const cell = findCell(state, id);
          if (cell?.send) send({ type: "route.remove", ...cell.source.target, hwChannels: cell.send.hwChannels });
        }}
      />
    </div>
  );
}

const DRAG_PX = 200; // pixels of vertical drag for the whole fader range

/** Dragging a routed cell up or down sets its send's level, on the same law as the chain faders. */
function startLevelDrag(down: PointerEvent, state: GlitchState) {
  const el = (down.target as Element).closest<HTMLElement>("[data-cell]");
  const cell = el && down.button === 0 ? findCell(state, el.dataset.cell!) : undefined;
  if (!cell?.send) return;
  const { source, send: target } = cell;
  const start = dbToPosition(target.level);
  let moved = false;

  const move = (e: PointerEvent) => {
    const dy = down.clientY - e.clientY;
    if (!moved && Math.abs(dy) < 3) return; // still a click
    moved = true;
    const position = Math.min(1, Math.max(0, start + dy / DRAG_PX));
    routeSet(source, target.hwChannels, { level: Math.max(SILENCE_DB, positionToDb(position)) });
  };
  const end = () => {
    removeEventListener("pointermove", move, true);
    removeEventListener("pointerup", end, true);
    // A drag isn't a click: stop the one the browser sends after it.
    if (!moved) return;
    const swallow = (e: MouseEvent) => e.stopPropagation();
    addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", swallow, true)); // in case no click follows
  };
  // Capture, so nothing on the page can stop the drag hearing the pointer.
  addEventListener("pointermove", move, true);
  addEventListener("pointerup", end, true);
}

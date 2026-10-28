import { SILENCE_DB, type AbyBlock, type Chain, type GlitchState, type OutputRef } from "@glitch/protocol";
import Routing from "@scamp/views/Routing/Routing";
import { send } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";

/**
 * A matrix source: a chain, or one path of a chain whose ABY splits to separate outputs. Its id is
 * the chain id, plus ":A" or ":B" for a path; a cell's id adds "~<output>".
 */
type Source = { id: string; chain: Chain; path?: "A" | "B"; aby?: AbyBlock; sends: OutputRef[] };

function sources(chains: Chain[]): Source[] {
  return chains.flatMap((chain): Source[] => {
    const last = chain.blocks[chain.blocks.length - 1];
    const aby = last?.type === "aby" && (last as AbyBlock).exit === "split" ? (last as AbyBlock) : undefined;
    if (!aby?.splitOutputs) return [{ id: chain.id, chain, sends: chain.outputs }];
    return (["A", "B"] as const).map((path) => ({ id: `${chain.id}:${path}`, chain, path, aby, sends: aby.splitOutputs![path] }));
  });
}

/** The send a cell shows: the one that reaches that output (a pair covers two cells). */
const sendAt = (sends: OutputRef[], output: number) => sends.find((s) => s.hwChannels.includes(output));

function findCell(state: GlitchState, cellId: string) {
  const [sourceId, output] = cellId.split("~");
  const source = sources(state.chains).find((s) => s.id === sourceId);
  return source && { source, output: Number(output), send: sendAt(source.sends, Number(output)) };
}

const routeSet = (source: Source, hwChannels: number[], change: { level?: number; mute?: boolean }) =>
  send({ type: "route.set", chainId: source.chain.id, path: source.path, hwChannels, ...change });

/** The output matrix: every chain (or split path) against every hardware output the device opened. */
export function RoutingView({ state }: { state: GlitchState }) {
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const names = state.device?.outputs ?? [];
  const all = sources(state.chains);

  return (
    <div class="gl-routing" onPointerDown={(e) => startLevelDrag(e, state)}>
      <Routing
        outputs={names.map((name, i) => ({ id: String(i + 1), label: `OUT ${i + 1}`, detail: name, meter: `out:${i + 1}` }))}
        rows={all.map((source) => {
          const muted = source.path ? (source.path === "B" ? source.aby!.pathB : source.aby!.pathA).mute : source.chain.muted;
          const name = source.path ? `${source.chain.name} path ${source.path}` : source.chain.name;
          return {
            id: source.id,
            name: source.chain.name,
            path: source.path ?? "",
            color: source.chain.color,
            muted: muted ? "on" : "off",
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
        onRowMute={(id) => {
          const source = all.find((s) => s.id === id);
          if (!source) return;
          if (source.path)
            send({ type: "aby.setMute", blockId: source.aby!.id, path: source.path, muted: !(source.path === "B" ? source.aby!.pathB : source.aby!.pathA).mute });
          else send({ type: "chain.setMute", chainId: source.chain.id, muted: !source.chain.muted });
        }}
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
          if (cell?.send) send({ type: "route.remove", chainId: cell.source.chain.id, path: cell.source.path, hwChannels: cell.send.hwChannels });
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

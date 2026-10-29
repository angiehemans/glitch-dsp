import { SILENCE_DB, type GlitchState, type OutputRef } from "@glitch/protocol";
import Songs from "@scamp/views/Songs/Songs";
import { useState } from "preact/hooks";
import { send, transport } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { outputChoices, outputLabel } from "./RigView";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const outputs = (sends: OutputRef[]) =>
  sends.length ? sends.map((s) => `Out ${s.hwChannels.join("/")}${s.mute ? " (muted)" : ""}`).join(", ") : "Not routed";

/** The song library, and the project's current song: its transport and its tracks in this project. */
export function SongsView({ state }: { state: GlitchState }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null); // the track whose output menu is open
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const song = state.songs.find((s) => s.id === state.project!.songId);
  const mix = song ? state.project.trackMix[song.id] ?? {} : {};
  const t = transport.value;
  const position = t.songId === song?.id ? t.position : 0;
  const playing = t.playing && t.songId === song?.id;

  return (
    <div
      class="gl-songs"
      style={{ "--progress": song?.length ? (position / song.length).toFixed(4) : "0" }}
      onKeyDown={(e) => e.key === "Escape" && setRouting(null)}
      onPointerDown={(e) => {
        if (!(e.target as Element).closest('[data-scamp-id="route_wrap_c6d8"]')) setRouting(null); // a click elsewhere closes it
      }}
      onInput={(e) => {
        // Track faders: Scamp keeps the input's binding, the app listens (same law as chain faders).
        const el = e.target as HTMLInputElement;
        if (el.dataset.track)
          send({ type: "trackMix.set", trackId: el.dataset.track, level: Math.max(SILENCE_DB, positionToDb(Number(el.value) / 100)) });
      }}
    >
      <Songs
        selected={song ? "song" : "none"}
        songs={state.songs.map((s) => ({
          id: s.id,
          title: s.title,
          detail: `${s.tracks.length} track${s.tracks.length === 1 ? "" : "s"} · ${clock(s.length)}`,
          current: s.id === song?.id,
        }))}
        noSongs={state.songs.length === 0}
        noSelection={!song && state.songs.length > 0}
        title={song?.title ?? ""}
        renameKey={song ? `song:${song.id}` : ""}
        deleteLabel={song && deleting === song.id ? `Delete “${song.title}” and its files?` : "Delete song"}
        deleteConfirm={song && deleting === song.id ? "on" : "off"}
        playLabel={playing ? "STOP" : "PLAY"}
        playing={playing ? "on" : "off"}
        timeLabel={song ? `${clock(position)} / ${clock(song.length)}` : ""}
        tracks={(song?.tracks ?? []).map((track) => {
          const entry = mix[track.id];
          const level = entry?.level ?? track.defaultLevel;
          const first = (entry ? entry.outputs[0]?.hwChannels : state.project!.mainOutput)?.join("-");
          const route = entry ? outputs(entry.outputs) : `Main · Out ${state.project!.mainOutput.join("/")}`;
          const names = state.device?.outputs ?? [];
          return {
            id: track.id,
            name: track.name,
            role: track.role.toUpperCase(),
            open: routing === track.id ? "on" : "off",
            route,
            routeLabel: `${track.name} output: ${route}`,
            choices: outputChoices(names.length).map((channels) => ({
              id: `${track.id}~${channels.join("-")}`,
              label: outputLabel(channels),
              detail: channels.map((ch) => names[ch - 1] ?? `Output ${ch}`).join(" / "),
              current: channels.join("-") === first,
            })),
            level: String(Math.round(dbToPosition(level) * 100)),
            db: formatDb(level, SILENCE_DB),
            mute: entry?.mute ? "on" : "off",
            label: `${track.name} level`,
            muteLabel: `Mute ${track.name}`,
          };
        })}
        onImport={() => send({ type: "song.import" })}
        onSelectSong={(id) => {
          setDeleting(null);
          send({ type: "song.select", songId: id });
        }}
        onDelete={() => {
          if (!song) return;
          if (deleting !== song.id) return setDeleting(song.id);
          setDeleting(null);
          send({ type: "song.delete", songId: song.id });
        }}
        onRestart={() => send({ type: "transport.restart" })}
        onPlay={() => send({ type: playing ? "transport.stop" : "transport.play" })}
        onOpenRoute={(id) => setRouting(routing === id ? null : id)}
        onPickOutput={(id) => {
          const [trackId, channels] = id.split("~");
          send({ type: "trackMix.set", trackId, outputs: [{ hwChannels: channels.split("-").map(Number) }] });
          setRouting(null);
        }}
        onMuteTrack={(id) => send({ type: "trackMix.set", trackId: id, mute: !mix[id]?.mute })}
      />
    </div>
  );
}

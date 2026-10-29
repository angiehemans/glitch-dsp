import { SILENCE_DB, type GlitchState, type OutputRef } from "@glitch/protocol";
import Songs from "@scamp/views/Songs/Songs";
import { useState } from "preact/hooks";
import { send, transport } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { renameWhenCreated } from "../rename";
import { outputChoices, outputLabel } from "./RigView";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const outputs = (sends: OutputRef[]) =>
  sends.length ? sends.map((s) => `Out ${s.hwChannels.join("/")}${s.mute ? " (muted)" : ""}`).join(", ") : "Not routed";

/** The song library, and the project's current song: its transport and its tracks in this project. */
export function SongsView({ state }: { state: GlitchState }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null); // the track whose output menu is open
  const [deletingList, setDeletingList] = useState<string | null>(null);
  const [picking, setPicking] = useState(false); // the song's preset menu is open
  if (!state.project) {
    return (
      <p class="gl-empty">
        No project open. <a href="/">Choose or create a project</a>
      </p>
    );
  }

  const song = state.songs.find((s) => s.id === state.project!.songId);
  const setlist = state.setlists.find((l) => l.id === state.project!.setlistId);
  // Its songs that are still in the library, by place (the setlist commands' index).
  const entries = (setlist?.songs ?? []).map((id, index) => ({ index, song: state.songs.find((s) => s.id === id) })).filter((e) => e.song);
  const move = (id: string, by: number) =>
    setlist && send({ type: "setlist.moveSong", setlistId: setlist.id, index: Number(id), to: Number(id) + by });
  const mix = song ? state.project.trackMix[song.id] ?? {} : {};
  const t = transport.value;
  const position = t.songId === song?.id ? t.position : 0;
  const playing = t.playing && t.songId === song?.id;
  const linked = song && state.presets.find((p) => p.id === state.project!.songPresets[song.id]);

  return (
    <div
      class="gl-songs"
      style={{ "--progress": song?.length ? (position / song.length).toFixed(4) : "0" }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        setRouting(null);
        setPicking(false);
      }}
      onPointerDown={(e) => {
        // A click elsewhere closes the open menu.
        if (!(e.target as Element).closest('[data-scamp-id="route_wrap_c6d8"]')) setRouting(null);
        if (!(e.target as Element).closest('[data-scamp-id="preset_wrap_9c3d"]')) setPicking(false);
      }}
      onInput={(e) => {
        // Track faders: Scamp keeps the input's binding, the app listens (same law as chain faders).
        const el = e.target as HTMLInputElement;
        if (el.dataset.track)
          send({ type: "trackMix.set", trackId: el.dataset.track, level: Math.max(SILENCE_DB, positionToDb(Number(el.value) / 100)) });
      }}
    >
      <Songs
        setlist={setlist ? "some" : "none"}
        selected={song ? "song" : "none"}
        setlists={state.setlists.map((l) => ({ id: l.id, name: l.name, current: l.id === setlist?.id ? "on" : "off", renameKey: `setlist:${l.id}` }))}
        autoLabel={`Auto-advance: ${setlist?.autoAdvance ? "on" : "off"}`}
        autoOn={setlist?.autoAdvance ? "on" : "off"}
        deleteSetlistLabel={setlist && deletingList === setlist.id ? `Delete “${setlist.name}”?` : "Delete setlist…"}
        deleteSetlistConfirm={setlist && deletingList === setlist.id ? "on" : "off"}
        entries={entries.map((e, n) => ({
          id: String(e.index),
          number: String(n + 1),
          title: e.song!.title,
          current: e.song!.id === song?.id ? "on" : "off",
          songLabel: `Cue ${e.song!.title}`,
        }))}
        setlistNote={
          !state.setlists.length ? "No setlists yet. Make one, then add songs from the library with +." : setlist && !entries.length ? "Empty. Add songs from the library below with +." : ""
        }
        onNewSetlist={() => {
          renameWhenCreated("setlist"); // name it in place
          send({ type: "setlist.create" });
        }}
        onSelectSetlist={(id) => {
          setDeletingList(null);
          send({ type: "setlist.select", setlistId: id === setlist?.id ? null : id });
        }}
        onToggleAuto={() => setlist && send({ type: "setlist.setAutoAdvance", setlistId: setlist.id, on: !setlist.autoAdvance })}
        onDeleteSetlist={() => {
          if (!setlist) return;
          if (deletingList !== setlist.id) return setDeletingList(setlist.id);
          setDeletingList(null);
          send({ type: "setlist.delete", setlistId: setlist.id });
        }}
        onPickEntry={(id) => {
          const songId = setlist?.songs[Number(id)];
          if (songId) send({ type: "song.select", songId });
        }}
        onEntryUp={(id) => move(id, -1)}
        onEntryDown={(id) => move(id, 1)}
        onEntryRemove={(id) => setlist && send({ type: "setlist.removeSong", setlistId: setlist.id, index: Number(id) })}
        onAddToSetlist={(id) => setlist && send({ type: "setlist.addSong", setlistId: setlist.id, songId: id })}
        onPrev={() => send({ type: "transport.prev" })}
        onNext={() => send({ type: "transport.next" })}
        songs={state.songs.map((s) => ({
          id: s.id,
          title: s.title,
          detail: `${s.tracks.length} track${s.tracks.length === 1 ? "" : "s"} · ${clock(s.length)}`,
          current: s.id === song?.id,
          addLabel: `Add ${s.title} to ${setlist?.name ?? "the setlist"}`,
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
        presetOpen={picking ? "on" : "off"}
        presetLabel={`Preset for this song: ${linked?.name ?? "none"}`}
        presetName={linked?.name ?? "None"}
        presets={[{ id: "", name: "None (keep the rig)" }, ...state.presets].map((p) => ({ id: p.id, name: p.name, current: p.id === (linked?.id ?? "") }))}
        presetHint={!state.presets.length ? "Save a preset to link it to this song" : linked ? "Loads when the song is selected" : ""}
        onOpenPreset={() => setPicking(!picking)}
        onPickPreset={(id) => {
          if (song) send({ type: "song.setPreset", songId: song.id, presetId: id || null });
          setPicking(false);
        }}
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

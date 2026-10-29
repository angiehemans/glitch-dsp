import { SILENCE_DB, type GlitchState, type OutputRef } from "@glitch/protocol";
import Songs from "@scamp/views/Songs/Songs";
import { useEffect, useState } from "preact/hooks";
import { send, transport } from "../../store/glitch";
import { dbToPosition, formatDb, positionToDb } from "../faderLaw";
import { navigate } from "../router";
import { outputChoices, outputLabel } from "./RigView";

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const outputs = (sends: OutputRef[]) =>
  sends.length ? sends.map((s) => `Out ${s.hwChannels.join("/")}${s.mute ? " (muted)" : ""}`).join(", ") : "Not routed";

/**
 * A set of songs: the open project's (its current setlist, played with this rig), or with libraryId a saved
 * one from the library, outside any project. The songs are on the left; the clicked song's tracks on the
 * right, with the project's transport, preset and routing for them in a project.
 */
export function SongsView({ state, libraryId }: { state: GlitchState; libraryId?: string }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null); // the track whose output menu is open
  const [deletingList, setDeletingList] = useState(false);
  const [picking, setPicking] = useState(false); // the song's preset menu is open
  const [menu, setMenu] = useState<"song" | "setlist" | null>(null); // the open Add menu
  const [viewing, setViewing] = useState<string | null>(null); // library: the song whose tracks are shown
  const [saved, setSaved] = useState(false);
  // A press anywhere outside the open menu closes it, the top bar included.
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const outside = (id: string) => !(e.target as Element).closest?.(`[data-scamp-id="${id}"]`);
      if (outside("route_wrap_c6d8")) setRouting(null);
      if (outside("preset_wrap_9c3d")) setPicking(false);
      if (outside("addsong_wrap_a04c") && outside("libadd_wrap_e1f2")) setMenu(null);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, []);
  const project = state.project;
  const library = libraryId !== undefined;
  // As the engine's projectList: the project's current setlist, else its first.
  const setlist = library
    ? state.librarySetlists.find((l) => l.id === libraryId)
    : state.setlists.find((l) => l.id === project?.setlistId) ?? state.setlists[0];
  if (library ? !setlist : !project) {
    return (
      <p class="gl-empty">
        {library ? "That setlist isn't in the library." : "No project open."} <a href="/">Back to projects</a>
      </p>
    );
  }

  const songsIn = (ids: string[]) => ids.map((id) => state.songs.find((s) => s.id === id)).filter((s) => s !== undefined);
  // Its songs that are still in the library, by place (the setlist commands' index).
  const entries = (setlist?.songs ?? []).map((id, index) => ({ index, song: state.songs.find((s) => s.id === id) })).filter((e) => e.song);
  const song = library ? state.songs.find((s) => s.id === (viewing ?? entries[0]?.song!.id)) : state.songs.find((s) => s.id === project!.songId);
  // Adding without a setlistId goes to the project's set, which the engine makes if there's none yet.
  const target = library ? { setlistId: libraryId } : setlist ? { setlistId: setlist.id } : {};
  const move = (id: string, by: number) =>
    setlist && send({ type: "setlist.moveSong", setlistId: setlist.id, index: Number(id), to: Number(id) + by });
  const mix = song && project && !library ? project.trackMix[song.id] ?? {} : {};
  const t = transport.value;
  const position = !library && t.songId === song?.id ? t.position : 0;
  const playing = !library && t.playing && t.songId === song?.id;
  const linked = song && project && state.presets.find((p) => p.id === project.songPresets[song.id]);
  const length = (list: { length: number }[]) => `${list.length} song${list.length === 1 ? "" : "s"} · ${clock(list.reduce((sum, s) => sum + s.length, 0))}`;

  return (
    <div
      class="gl-songs"
      style={{ "--progress": song?.length ? (position / song.length).toFixed(4) : "0" }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        setRouting(null);
        setPicking(false);
        setMenu(null);
      }}
      onInput={(e) => {
        // Track faders: Scamp keeps the input's binding, the app listens (same law as chain faders).
        const el = e.target as HTMLInputElement;
        if (el.dataset.track)
          send({ type: "trackMix.set", trackId: el.dataset.track, level: Math.max(SILENCE_DB, positionToDb(Number(el.value) / 100)) });
      }}
    >
      <Songs
        mode={library ? "library" : "project"}
        setlist={setlist ? "some" : "none"}
        selected={song ? "song" : "none"}
        songMenuOpen={menu === "song" ? "on" : "off"}
        songs={state.songs.map((s) => ({
          id: s.id,
          title: s.title,
          detail: `${s.tracks.length} track${s.tracks.length === 1 ? "" : "s"} · ${clock(s.length)}`,
          addLabel: `Add ${s.title}`,
        }))}
        noSongs={state.songs.length === 0}
        libraryOpen={menu === "setlist" ? "on" : "off"}
        librarySetlists={state.librarySetlists
          .filter((l) => l.id !== libraryId)
          .map((l) => ({ id: l.id, name: l.name, meta: length(songsIn(l.songs)) }))}
        noLibrary={state.librarySetlists.filter((l) => l.id !== libraryId).length === 0}
        autoLabel={`Auto-advance: ${setlist?.autoAdvance ? "on" : "off"}`}
        autoOn={setlist?.autoAdvance ? "on" : "off"}
        deleteSetlistLabel={deletingList && setlist ? `Delete “${setlist.name}”?` : "Delete setlist…"}
        deleteSetlistConfirm={deletingList ? "on" : "off"}
        setlistName={setlist?.name ?? project!.name}
        setlistRenameKey={setlist ? `setlist:${setlist.id}` : ""}
        setlistMeta={length(entries.map((e) => e.song!))}
        entries={entries.map((e, n) => ({
          id: String(e.index),
          number: String(n + 1),
          title: e.song!.title,
          current: e.song!.id === song?.id ? "on" : "off",
          songLabel: library ? `Show ${e.song!.title}` : `Cue ${e.song!.title}`,
          badge: e.song!.id === song?.id && playing ? "Playing" : "",
          dur: clock(e.song!.length),
        }))}
        setlistNote={entries.length ? "" : "No songs yet. Add a song, or a saved setlist's songs."}
        onOpenSongMenu={() => setMenu(menu === "song" ? null : "song")}
        onImport={() => {
          send({ type: "song.import", into: library ? libraryId : "project" }); // added to this list
          setMenu(null);
        }}
        onAddToSetlist={(id) => {
          send({ type: "setlist.addSong", ...target, songId: id });
          setSaved(false);
        }}
        onOpenLibrary={() => setMenu(menu === "setlist" ? null : "setlist")}
        onAddLibrary={(id) => {
          send({ type: "setlist.append", ...target, fromId: id });
          setMenu(null);
          setSaved(false);
        }}
        onSaveSetlist={() => {
          send({ type: "setlist.saveToLibrary" });
          setSaved(true);
        }}
        saveLabel={saved ? "Saved to the library" : "Save as setlist"}
        onToggleAuto={() => setlist && send({ type: "setlist.setAutoAdvance", setlistId: setlist.id, on: !setlist.autoAdvance })}
        onDeleteSetlist={() => {
          if (!setlist) return;
          if (!deletingList) return setDeletingList(true);
          send({ type: "setlist.delete", setlistId: setlist.id });
          navigate("/");
        }}
        onPickEntry={(id) => {
          const songId = setlist?.songs[Number(id)];
          if (!songId) return;
          setDeleting(null);
          if (library) setViewing(songId);
          else send({ type: "song.select", songId });
        }}
        onEntryUp={(id) => move(id, -1)}
        onEntryDown={(id) => move(id, 1)}
        onEntryRemove={(id) => setlist && send({ type: "setlist.removeSong", setlistId: setlist.id, index: Number(id) })}
        onPrev={() => send({ type: "transport.prev" })}
        onNext={() => send({ type: "transport.next" })}
        noSelection={!song && entries.length > 0}
        title={song?.title ?? ""}
        renameKey={song ? `song:${song.id}` : ""}
        details={song ? `${clock(song.length)} · ${song.tracks.length} track${song.tracks.length === 1 ? "" : "s"}` : ""}
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
          // A library setlist has no routing (that's each project's): its tracks at their own default level.
          const entry = mix[track.id];
          const level = entry?.level ?? track.defaultLevel;
          const mainOutput = project?.mainOutput ?? [1, 2];
          const first = (entry ? entry.outputs[0]?.hwChannels : mainOutput)?.join("-");
          const route = entry ? outputs(entry.outputs) : `Main · Out ${mainOutput.join("/")}`;
          const names = state.device?.outputs ?? [];
          return {
            id: track.id,
            name: track.name,
            role: track.role.toUpperCase(),
            file: track.file.split(/[\\/]/).pop() ?? track.file,
            main: !entry || (entry.outputs.length === 1 && first === mainOutput.join("-")) ? "on" : "off",
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
            db: entry?.mute ? "Muted" : formatDb(level, SILENCE_DB),
            mute: entry?.mute ? "on" : "off",
            label: `${track.name} level`,
            muteLabel: `Mute ${track.name}`,
          };
        })}
        onAddTrack={() => song && send({ type: "song.addTracks", songId: song.id })}
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

import styles from './Songs.module.css';

type SongsProps = {
  selected?: "song" | "none";
  songs?: Array<{ id: string; title: string; detail: string; current: boolean }>;
  noSongs?: boolean;
  noSelection?: boolean;
  title?: string;
  renameKey?: string;
  deleteLabel?: string;
  deleteConfirm?: string;
  playLabel?: string;
  playing?: string;
  timeLabel?: string;
  tracks?: Array<{
    id: string;
    name: string;
    role: string;
    open: string;
    route: string;
    routeLabel: string;
    choices: Array<{ id: string; label: string; detail: string; current: boolean }>;
    level: string;
    db: string;
    mute: string;
    label: string;
    muteLabel: string;
  }>;
  onImport?: () => void;
  onSelectSong?: (id: string) => void;
  onDelete?: () => void;
  onRestart?: () => void;
  onPlay?: () => void;
  onOpenRoute?: (id: string) => void;
  onPickOutput?: (id: string) => void;
  onMuteTrack?: (id: string) => void;
  className?: string;
};

export default function Songs({
  selected = "song",
  songs = [
    { id: "1", title: "Midnight City", detail: "3 tracks · 4:03", current: true },
    { id: "2", title: "Dancing in the Dark", detail: "5 tracks · 3:58", current: false },
  ],
  noSongs = false,
  noSelection = false,
  title = "Midnight City",
  renameKey = "",
  deleteLabel = "Delete song",
  deleteConfirm = "off",
  playLabel = "PLAY",
  playing = "off",
  timeLabel = "1:12 / 4:03",
  tracks = [
    {
      id: "1", name: "Backing", role: "BACKING", open: "off", route: "Main · Out 1/2", routeLabel: "Backing output: Out 1/2",
      choices: [
        { id: "1~1-2", label: "Out 1/2", detail: "Main L / Main R", current: true },
        { id: "1~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "1~4", label: "Out 4", detail: "Line 4", current: false },
      ],
      level: "75", db: "0.0 dB", mute: "off", label: "Backing level", muteLabel: "Mute Backing",
    },
    {
      id: "2", name: "Click", role: "CLICK", open: "on", route: "Out 4", routeLabel: "Click output: Out 4",
      choices: [
        { id: "2~1-2", label: "Out 1/2", detail: "Main L / Main R", current: false },
        { id: "2~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "2~4", label: "Out 4", detail: "Line 4", current: true },
      ],
      level: "75", db: "0.0 dB", mute: "off", label: "Click level", muteLabel: "Mute Click",
    },
    {
      id: "3", name: "Guitar 2", role: "STEM", open: "off", route: "Main · Out 1/2", routeLabel: "Guitar 2 output: Out 1/2",
      choices: [
        { id: "3~1-2", label: "Out 1/2", detail: "Main L / Main R", current: true },
        { id: "3~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "3~4", label: "Out 4", detail: "Line 4", current: false },
      ],
      level: "60", db: "−6.0 dB", mute: "on", label: "Guitar 2 level", muteLabel: "Mute Guitar 2",
    },
  ],
  onImport,
  onSelectSong,
  onDelete,
  onRestart,
  onPlay,
  onOpenRoute,
  onPickOutput,
  onMuteTrack,
  className,
}: SongsProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Songs" data-selected={selected}>
      <div data-scamp-id="library_1a0b" className={styles.library_1a0b}>
        <div data-scamp-id="library_head_2b1c" className={styles.library_head_2b1c}>
          <h2 data-scamp-id="library_title_3c2d" className={styles.library_title_3c2d}>SONGS</h2>
          <button data-scamp-id="import_4d3e" className={styles.import_4d3e} type="button" onClick={onImport}>Import song…</button>
        </div>
        <ul data-scamp-id="song_list_5e4f" className={styles.song_list_5e4f}>
          {songs.map((song) => (
            <li data-scamp-id="song_row_6f50" className={styles.song_row_6f50} key={song.id}>
              <button data-scamp-id="song_btn_7061" className={styles.song_btn_7061} type="button" aria-current={song.current} onClick={() => onSelectSong?.(song.id)}>
                <span data-scamp-id="song_name_8172" className={styles.song_name_8172}>{song.title}</span>
                <span data-scamp-id="song_detail_9283" className={styles.song_detail_9283}>{song.detail}</span>
              </button>
            </li>
          ))}
        </ul>
        {noSongs && (
          <p data-scamp-id="no_songs_a394" className={styles.no_songs_a394}>No songs yet. Import a song: choose its audio files (WAV or AIFF), one track each.</p>
        )}
      </div>
      <div data-scamp-id="song_b4a5" className={styles.song_b4a5}>
        <div data-scamp-id="song_head_c5b6" className={styles.song_head_c5b6}>
          <h1 data-scamp-id="title_d6c7" className={styles.title_d6c7} data-rename={renameKey}>{title}</h1>
          <button data-scamp-id="delete_e7d8" className={styles.delete_e7d8} type="button" data-confirm={deleteConfirm} onClick={onDelete}>{deleteLabel}</button>
        </div>
        <div data-scamp-id="transport_f8e9" className={styles.transport_f8e9}>
          <button data-scamp-id="restart_09fa" className={styles.restart_09fa} type="button" aria-label="Back to the start" onClick={onRestart}>⏮</button>
          <button data-scamp-id="play_1a0c" className={styles.play_1a0c} type="button" data-playing={playing} onClick={onPlay}>{playLabel}</button>
          <span data-scamp-id="time_2b1d" className={styles.time_2b1d}>{timeLabel}</span>
          <div data-scamp-id="progress_3c2e" className={styles.progress_3c2e} aria-hidden="true" />
        </div>
        <h2 data-scamp-id="tracks_title_4d3f" className={styles.tracks_title_4d3f}>TRACKS</h2>
        <ul data-scamp-id="track_list_5e40" className={styles.track_list_5e40}>
          {tracks.map((track) => (
            <li data-scamp-id="track_6f51" className={styles.track_6f51} key={track.id} data-open={track.open}>
              <span data-scamp-id="track_name_7062" className={styles.track_name_7062}>{track.name}</span>
              <span data-scamp-id="track_role_8173" className={styles.track_role_8173}>{track.role}</span>
              <div data-scamp-id="route_wrap_c6d8" className={styles.route_wrap_c6d8}>
                <button data-scamp-id="track_route_9284" className={styles.track_route_9284} type="button" aria-haspopup="menu" aria-label={track.routeLabel} onClick={() => onOpenRoute?.(track.id)}>
                  <span data-scamp-id="route_text_d7e9" className={styles.route_text_d7e9}>{track.route}</span>
                  <svg data-scamp-id="route_caret_e8fa" className={styles.route_caret_e8fa} viewBox="0 0 24 24"><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                <div data-scamp-id="route_menu_f90b" className={styles.route_menu_f90b} role="menu" aria-label={track.routeLabel}>
                  <p data-scamp-id="route_title_0a1c" className={styles.route_title_0a1c}>OUTPUT</p>
                  <ul data-scamp-id="choice_list_1b2d" className={styles.choice_list_1b2d}>
                    {track.choices.map((choice) => (
                      <li data-scamp-id="choice_row_2c3e" className={styles.choice_row_2c3e} key={choice.id}>
                        <button data-scamp-id="choice_btn_3d4f" className={styles.choice_btn_3d4f} type="button" role="menuitemradio" aria-checked={choice.current} onClick={() => onPickOutput?.(choice.id)}>
                          <span data-scamp-id="choice_label_4e50" className={styles.choice_label_4e50}>{choice.label}</span>
                          <span data-scamp-id="choice_detail_5f61" className={styles.choice_detail_5f61}>{choice.detail}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <input data-scamp-id="track_level_a395" className={styles.track_level_a395} type="range" min="0" max="100" value={track.level} data-track={track.id} aria-label={track.label} />
              <span data-scamp-id="track_db_b4a6" className={styles.track_db_b4a6}>{track.db}</span>
              <button data-scamp-id="track_mute_c5b7" className={styles.track_mute_c5b7} type="button" data-on={track.mute} aria-label={track.muteLabel} onClick={() => onMuteTrack?.(track.id)}>M</button>
            </li>
          ))}
        </ul>
      </div>
      {noSelection && (
        <p data-scamp-id="no_song_d6c8" className={styles.no_song_d6c8}>Choose a song to play it with this rig.</p>
      )}
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onImport', 'onSelectSong', 'onDelete', 'onRestart', 'onPlay', 'onOpenRoute', 'onPickOutput', 'onMuteTrack'] } as const;

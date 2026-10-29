import styles from './Songs.module.css';

type SongsProps = {
  mode?: "project" | "library";
  setlist?: "some" | "none";
  selected?: "song" | "none";
  songMenuOpen?: string;
  songs?: Array<{ id: string; title: string; detail: string; addLabel: string }>;
  noSongs?: boolean;
  libraryOpen?: string;
  librarySetlists?: Array<{ id: string; name: string; meta: string }>;
  noLibrary?: boolean;
  saveLabel?: string;
  autoLabel?: string;
  autoOn?: string;
  deleteSetlistLabel?: string;
  deleteSetlistConfirm?: string;
  setlistName?: string;
  setlistRenameKey?: string;
  setlistMeta?: string;
  entries?: Array<{ id: string; number: string; title: string; current: string; songLabel: string; badge: string; dur: string }>;
  setlistNote?: string;
  noSelection?: boolean;
  title?: string;
  renameKey?: string;
  details?: string;
  deleteLabel?: string;
  deleteConfirm?: string;
  playLabel?: string;
  playing?: string;
  timeLabel?: string;
  presetOpen?: string;
  presetLabel?: string;
  presetName?: string;
  presets?: Array<{ id: string; name: string; current: boolean }>;
  presetHint?: string;
  tracks?: Array<{
    id: string;
    name: string;
    role: string;
    file: string;
    main: string;
    mute: string;
    open: string;
    route: string;
    routeLabel: string;
    choices: Array<{ id: string; label: string; detail: string; current: boolean }>;
    level: string;
    db: string;
    label: string;
    muteLabel: string;
  }>;
  onOpenSongMenu?: () => void;
  onImport?: () => void;
  onAddToSetlist?: (id: string) => void;
  onOpenLibrary?: () => void;
  onAddLibrary?: (id: string) => void;
  onSaveSetlist?: () => void;
  onToggleAuto?: () => void;
  onDeleteSetlist?: () => void;
  onPickEntry?: (id: string) => void;
  onEntryUp?: (id: string) => void;
  onEntryDown?: (id: string) => void;
  onEntryRemove?: (id: string) => void;
  onAddTrack?: () => void;
  onDelete?: () => void;
  onPrev?: () => void;
  onRestart?: () => void;
  onPlay?: () => void;
  onNext?: () => void;
  onOpenPreset?: () => void;
  onPickPreset?: (id: string) => void;
  onOpenRoute?: (id: string) => void;
  onPickOutput?: (id: string) => void;
  onMuteTrack?: (id: string) => void;
  className?: string;
};

export default function Songs({
  mode = "project",
  setlist = "some",
  selected = "song",
  songMenuOpen = "off",
  songs = [
    { id: "1", title: "Midnight City", detail: "3 tracks · 4:03", addLabel: "Add Midnight City to the setlist" },
    { id: "2", title: "Dancing in the Dark", detail: "5 tracks · 3:58", addLabel: "Add Dancing in the Dark to the setlist" },
  ],
  noSongs = false,
  libraryOpen = "off",
  librarySetlists = [
    { id: "1", name: "Summer tour", meta: "12 songs · 48:20" },
    { id: "2", name: "Acoustic set", meta: "6 songs · 24:05" },
  ],
  noLibrary = false,
  saveLabel = "Save as setlist",
  autoLabel = "Auto-advance: on",
  autoOn = "on",
  deleteSetlistLabel = "Delete setlist…",
  deleteSetlistConfirm = "off",
  setlistName = "Friday at the Crown",
  setlistRenameKey = "",
  setlistMeta = "2 songs · 8:01",
  entries = [
    { id: "0", number: "1", title: "Midnight City", current: "on", songLabel: "Play Midnight City", badge: "Playing", dur: "4:03" },
    { id: "1", number: "2", title: "Dancing in the Dark", current: "off", songLabel: "Play Dancing in the Dark", badge: "", dur: "3:58" },
  ],
  setlistNote = "",
  noSelection = false,
  title = "Midnight City",
  renameKey = "",
  details = "4:03 · 3 tracks",
  deleteLabel = "Delete song",
  deleteConfirm = "off",
  playLabel = "STOP",
  playing = "on",
  timeLabel = "1:12 / 4:03",
  presetOpen = "off",
  presetLabel = "Preset for this song: Clean",
  presetName = "Clean",
  presets = [
    { id: "", name: "None (keep the rig)", current: false },
    { id: "1", name: "Clean", current: true },
    { id: "2", name: "Lead", current: false },
  ],
  presetHint = "Loads when the song is selected",
  tracks = [
    {
      id: "1", name: "Backing", role: "BACKING", file: "midnight-backing.wav", main: "on", mute: "off", open: "off", route: "Main · Out 1/2", routeLabel: "Backing output: Out 1/2",
      choices: [
        { id: "1~1-2", label: "Out 1/2", detail: "Main L / Main R", current: true },
        { id: "1~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "1~4", label: "Out 4", detail: "Line 4", current: false },
      ],
      level: "75", db: "0.0 dB", label: "Backing level", muteLabel: "Mute Backing",
    },
    {
      id: "2", name: "Click", role: "CLICK", file: "midnight-click.wav", main: "off", mute: "off", open: "off", route: "Out 4", routeLabel: "Click output: Out 4",
      choices: [
        { id: "2~1-2", label: "Out 1/2", detail: "Main L / Main R", current: false },
        { id: "2~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "2~4", label: "Out 4", detail: "Line 4", current: true },
      ],
      level: "70", db: "−2.0 dB", label: "Click level", muteLabel: "Mute Click",
    },
    {
      id: "3", name: "Guitar 2", role: "STEM", file: "midnight-gtr2.wav", main: "on", mute: "on", open: "off", route: "Main · Out 1/2", routeLabel: "Guitar 2 output: Out 1/2",
      choices: [
        { id: "3~1-2", label: "Out 1/2", detail: "Main L / Main R", current: true },
        { id: "3~3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
        { id: "3~4", label: "Out 4", detail: "Line 4", current: false },
      ],
      level: "60", db: "Muted", label: "Guitar 2 level", muteLabel: "Mute Guitar 2",
    },
  ],
  onOpenSongMenu,
  onImport,
  onAddToSetlist,
  onOpenLibrary,
  onAddLibrary,
  onSaveSetlist,
  onToggleAuto,
  onDeleteSetlist,
  onPickEntry,
  onEntryUp,
  onEntryDown,
  onEntryRemove,
  onAddTrack,
  onDelete,
  onPrev,
  onRestart,
  onPlay,
  onNext,
  onOpenPreset,
  onPickPreset,
  onOpenRoute,
  onPickOutput,
  onMuteTrack,
  className,
}: SongsProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Songs" data-mode={mode} data-setlist={setlist} data-selected={selected}>
      <div data-scamp-id="library_1a0b" className={styles.library_1a0b}>
        <a data-scamp-id="back_8e2a" className={styles.back_8e2a} href="/">← Projects</a>
        <div data-scamp-id="add_row_9f3b" className={styles.add_row_9f3b}>
          <div data-scamp-id="addsong_wrap_a04c" className={styles.addsong_wrap_a04c} data-open={songMenuOpen}>
            <button data-scamp-id="addsong_btn_b15d" className={styles.addsong_btn_b15d} type="button" aria-haspopup="menu" onClick={onOpenSongMenu}>Add song ▾</button>
            <div data-scamp-id="addsong_menu_c26e" className={styles.addsong_menu_c26e} role="menu" aria-label="Add a song">
              <button data-scamp-id="addsong_import_d37f" className={styles.addsong_import_d37f} type="button" role="menuitem" onClick={onImport}>Import a new song…</button>
              <ul data-scamp-id="addsong_list_e480" className={styles.addsong_list_e480}>
                {songs.map((song) => (
                  <li data-scamp-id="addsong_row_f591" className={styles.addsong_row_f591} key={song.id}>
                    <button data-scamp-id="addsong_item_06a2" className={styles.addsong_item_06a2} type="button" role="menuitem" aria-label={song.addLabel} onClick={() => onAddToSetlist?.(song.id)}>
                      <span data-scamp-id="addsong_name_17b3" className={styles.addsong_name_17b3}>{song.title}</span>
                      <span data-scamp-id="addsong_detail_28c4" className={styles.addsong_detail_28c4}>{song.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {noSongs && (
                <p data-scamp-id="no_songs_a394" className={styles.no_songs_a394}>No songs in the library yet. Import one: choose its audio files (WAV or AIFF), one track each.</p>
              )}
            </div>
          </div>
          <div data-scamp-id="libadd_wrap_e1f2" className={styles.libadd_wrap_e1f2} data-open={libraryOpen}>
            <button data-scamp-id="libadd_btn_f203" className={styles.libadd_btn_f203} type="button" aria-haspopup="menu" onClick={onOpenLibrary}>Add setlist ▾</button>
            <div data-scamp-id="libadd_menu_0314" className={styles.libadd_menu_0314} role="menu" aria-label="Library setlists">
              <p data-scamp-id="libadd_title_1425" className={styles.libadd_title_1425}>Add a saved setlist’s songs</p>
              <ul data-scamp-id="libadd_list_2536" className={styles.libadd_list_2536}>
                {librarySetlists.map((lib) => (
                  <li data-scamp-id="libadd_row_3647" className={styles.libadd_row_3647} key={lib.id}>
                    <button data-scamp-id="libadd_item_4758" className={styles.libadd_item_4758} type="button" role="menuitem" onClick={() => onAddLibrary?.(lib.id)}>
                      <span data-scamp-id="libadd_name_5869" className={styles.libadd_name_5869}>{lib.name}</span>
                      <span data-scamp-id="libadd_meta_697a" className={styles.libadd_meta_697a}>{lib.meta}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {noLibrary && (
                <p data-scamp-id="libadd_empty_7a8b" className={styles.libadd_empty_7a8b}>No saved setlists yet. Save one from a project, or make one on the projects page.</p>
              )}
            </div>
          </div>
        </div>
        <div data-scamp-id="setlist_1c0d" className={styles.setlist_1c0d}>
          <div data-scamp-id="setlist_head_2d1e" className={styles.setlist_head_2d1e}>
            <h2 data-scamp-id="setlist_title_3e2f" className={styles.setlist_title_3e2f} data-rename={setlistRenameKey}>{setlistName}</h2>
            <span data-scamp-id="setlist_meta_e41b" className={styles.setlist_meta_e41b}>{setlistMeta}</span>
          </div>
          <ol data-scamp-id="entries_b6a7" className={styles.entries_b6a7}>
            {entries.map((entry) => (
              <li data-scamp-id="entry_c7b8" className={styles.entry_c7b8} key={entry.id} data-current={entry.current}>
                <span data-scamp-id="entry_num_d8c9" className={styles.entry_num_d8c9}>{entry.number}</span>
                <button data-scamp-id="entry_title_e9da" className={styles.entry_title_e9da} type="button" aria-label={entry.songLabel} onClick={() => onPickEntry?.(entry.id)}>{entry.title}</button>
                <span data-scamp-id="entry_badge_5d92" className={styles.entry_badge_5d92}>{entry.badge}</span>
                <span data-scamp-id="entry_dur_a07f" className={styles.entry_dur_a07f}>{entry.dur}</span>
                <button data-scamp-id="entry_up_faeb" className={styles.entry_up_faeb} type="button" aria-label="Move up" onClick={() => onEntryUp?.(entry.id)}>↑</button>
                <button data-scamp-id="entry_down_0bfc" className={styles.entry_down_0bfc} type="button" aria-label="Move down" onClick={() => onEntryDown?.(entry.id)}>↓</button>
                <button data-scamp-id="entry_remove_1c0e" className={styles.entry_remove_1c0e} type="button" aria-label="Remove from the setlist" onClick={() => onEntryRemove?.(entry.id)}>✕</button>
              </li>
            ))}
          </ol>
          <p data-scamp-id="setlist_note_2d1f" className={styles.setlist_note_2d1f}>{setlistNote}</p>
          <div data-scamp-id="setlist_tools_8374" className={styles.setlist_tools_8374}>
            <button data-scamp-id="auto_9485" className={styles.auto_9485} type="button" data-on={autoOn} onClick={onToggleAuto}>{autoLabel}</button>
            <button data-scamp-id="save_39d5" className={styles.save_39d5} type="button" onClick={onSaveSetlist}>{saveLabel}</button>
            <button data-scamp-id="delete_setlist_a596" className={styles.delete_setlist_a596} type="button" data-confirm={deleteSetlistConfirm} onClick={onDeleteSetlist}>{deleteSetlistLabel}</button>
          </div>
        </div>
      </div>
      <div data-scamp-id="song_b4a5" className={styles.song_b4a5}>
        <div data-scamp-id="song_head_c5b6" className={styles.song_head_c5b6}>
          <div data-scamp-id="title_block_b25e" className={styles.title_block_b25e}>
            <h1 data-scamp-id="title_d6c7" className={styles.title_d6c7} data-rename={renameKey}>{title}</h1>
            <span data-scamp-id="details_9c41" className={styles.details_9c41}>{details}</span>
          </div>
          <div data-scamp-id="head_tools_17ea" className={styles.head_tools_17ea}>
            <div data-scamp-id="preset_row_7a1b" className={styles.preset_row_7a1b} data-open={presetOpen}>
              <div data-scamp-id="preset_wrap_9c3d" className={styles.preset_wrap_9c3d}>
                <button data-scamp-id="preset_btn_ad4e" className={styles.preset_btn_ad4e} type="button" aria-haspopup="menu" aria-label={presetLabel} onClick={onOpenPreset}>
                  <span data-scamp-id="preset_title_8b2c" className={styles.preset_title_8b2c}>Preset ·</span>
                  <span data-scamp-id="preset_text_be5f" className={styles.preset_text_be5f}>{presetName}</span>
                  <svg data-scamp-id="preset_caret_cf60" className={styles.preset_caret_cf60} viewBox="0 0 24 24"><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                <div data-scamp-id="preset_menu_d071" className={styles.preset_menu_d071} role="menu" aria-label={presetLabel}>
                  <ul data-scamp-id="preset_list_e182" className={styles.preset_list_e182}>
                    {presets.map((preset) => (
                      <li data-scamp-id="preset_choice_row_f293" className={styles.preset_choice_row_f293} key={preset.id}>
                        <button data-scamp-id="preset_choice_03a4" className={styles.preset_choice_03a4} type="button" role="menuitemradio" aria-checked={preset.current} onClick={() => onPickPreset?.(preset.id)}>{preset.name}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <span data-scamp-id="preset_hint_14b5" className={styles.preset_hint_14b5}>{presetHint}</span>
            </div>
            <button data-scamp-id="add_track_4b7e" className={styles.add_track_4b7e} type="button" onClick={onAddTrack}>Add track…</button>
            <button data-scamp-id="delete_e7d8" className={styles.delete_e7d8} type="button" data-confirm={deleteConfirm} onClick={onDelete}>{deleteLabel}</button>
          </div>
        </div>
        <div data-scamp-id="transport_f8e9" className={styles.transport_f8e9}>
          <button data-scamp-id="prev_4f31" className={styles.prev_4f31} type="button" aria-label="Previous song in the setlist" onClick={onPrev}>⏮</button>
          <button data-scamp-id="restart_09fa" className={styles.restart_09fa} type="button" aria-label="Back to the start" onClick={onRestart}>↺</button>
          <button data-scamp-id="play_1a0c" className={styles.play_1a0c} type="button" data-playing={playing} onClick={onPlay}>{playLabel}</button>
          <button data-scamp-id="next_5042" className={styles.next_5042} type="button" aria-label="Next song in the setlist" onClick={onNext}>⏭</button>
          <span data-scamp-id="time_2b1d" className={styles.time_2b1d}>{timeLabel}</span>
          <div data-scamp-id="progress_3c2e" className={styles.progress_3c2e} aria-hidden="true" />
        </div>
        <div data-scamp-id="tracks_panel_6e1d" className={styles.tracks_panel_6e1d}>
          <div data-scamp-id="tracks_head_d813" className={styles.tracks_head_d813}>
            <span data-scamp-id="tracks_title_4d3f" className={styles.tracks_title_4d3f}>Track</span>
            <span data-scamp-id="head_output_2a7c" className={styles.head_output_2a7c}>Output</span>
            <span data-scamp-id="head_level_8f05" className={styles.head_level_8f05}>Level</span>
            <span data-scamp-id="head_db_c3e9" className={styles.head_db_c3e9}>dB</span>
          </div>
        <ul data-scamp-id="track_list_5e40" className={styles.track_list_5e40}>
          {tracks.map((track) => (
            <li data-scamp-id="track_6f51" className={styles.track_6f51} key={track.id} data-main={track.main} data-mute={track.mute} data-open={track.open}>
              <div data-scamp-id="track_info_9e27" className={styles.track_info_9e27}>
                <span data-scamp-id="track_name_7062" className={styles.track_name_7062}>{track.name}</span>
                <div data-scamp-id="track_sub_4ad0" className={styles.track_sub_4ad0}>
                  <span data-scamp-id="track_file_06c5" className={styles.track_file_06c5}>{track.file}</span>
                  <span data-scamp-id="track_role_8173" className={styles.track_role_8173}>{track.role}</span>
                </div>
              </div>
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
      </div>
      {noSelection && (
        <p data-scamp-id="no_song_d6c8" className={styles.no_song_d6c8}>Choose a song to play it with this rig.</p>
      )}
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onOpenSongMenu', 'onImport', 'onAddToSetlist', 'onOpenLibrary', 'onAddLibrary', 'onSaveSetlist', 'onToggleAuto', 'onDeleteSetlist', 'onPickEntry', 'onEntryUp', 'onEntryDown', 'onEntryRemove', 'onAddTrack', 'onDelete', 'onPrev', 'onRestart', 'onPlay', 'onNext', 'onOpenPreset', 'onPickPreset', 'onOpenRoute', 'onPickOutput', 'onMuteTrack'] } as const;

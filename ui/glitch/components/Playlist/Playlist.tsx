import styles from './Playlist.module.css';

type PlaylistProps = {
  state?: "minimized" | "open" | "edit";
  nowTitle?: string;
  nowMeta?: string;
  elapsed?: string;
  duration?: string;
  nextLabel?: string;
  songs?: Array<{ id: string; status: string; num: string; title: string; meta: string; length: string }>;
  editTitle?: string;
  editMeta?: string;
  tracks?: Array<{ id: string; color: string; name: string; kind: string; output: string }>;
  className?: string;
};

export default function Playlist({
  state = "minimized",
  nowTitle = "Neon Static",
  nowMeta = "128 BPM · A min",
  elapsed = "1:24",
  duration = "3:42",
  nextLabel = "Next · Glass Hours",
  songs = [
    { id: "1", status: "playing", num: "01", title: "Neon Static", meta: "128 BPM · A min", length: "3:42" },
    { id: "2", status: "queued", num: "02", title: "Glass Hours", meta: "96 BPM · E min", length: "4:15" },
    { id: "3", status: "ready", num: "03", title: "Undertow", meta: "140 BPM · D min", length: "3:58" },
  ],
  editTitle = "Neon Static",
  editMeta = "4 tracks",
  tracks = [
    { id: "1", color: "violet", name: "Click", kind: "Mono · Metronome", output: "Out 5/6 · Drummer IEM" },
    { id: "2", color: "cyan", name: "Backing Synths", kind: "Stereo · Stems", output: "Out 1/2 · FOH" },
    { id: "3", color: "pink", name: "Backing Vox", kind: "Stereo · Stems", output: "Out 1/2 · FOH" },
    { id: "4", color: "lime", name: "Cues", kind: "Mono · Spoken", output: "Out 3/4 · Wedge" },
  ],
  className,
}: PlaylistProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-state={state}>
      <div data-scamp-id="bar_3a71" className={styles.bar_3a71}>
        <button data-scamp-id="play_btn_5c02" className={styles.play_btn_5c02} type="button" aria-label="Play"><svg data-scamp-id="play_icon_e3a7" className={styles.play_icon_e3a7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg></button>
        <div data-scamp-id="now_b418" className={styles.now_b418}>
          <h3 data-scamp-id="now_title_c7e9" className={styles.now_title_c7e9}>{nowTitle}</h3>
          <span data-scamp-id="now_meta_d25a" className={styles.now_meta_d25a}>{nowMeta}</span>
        </div>
        <div data-scamp-id="lcd_e06b" className={styles.lcd_e06b}>
          <span data-scamp-id="time_f13c" className={styles.time_f13c}>{elapsed}</span>
          <div data-scamp-id="progress_0a4d" className={styles.progress_0a4d}>
            <div data-scamp-id="progress_fill_1b5e" className={styles.progress_fill_1b5e} />
          </div>
          <span data-scamp-id="total_2c6f" className={styles.total_2c6f}>{duration}</span>
        </div>
        <span data-scamp-id="next_chip_3d80" className={styles.next_chip_3d80}>{nextLabel}</span>
        <button data-scamp-id="toggle_4e91" className={styles.toggle_4e91} type="button" aria-label="Toggle playlist" data-scamp-click="state:minimized=open,open=minimized,edit=minimized">
          <svg data-scamp-id="chevron_9a3d" className={styles.chevron_9a3d} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
        </button>
      </div>
      <ul data-scamp-id="list_5fa2" className={styles.list_5fa2}>
        {songs.map((song) => (
          <li data-scamp-id="row_6ab3" className={styles.row_6ab3} key={song.id} data-status={song.status}>
            <span data-scamp-id="row_num_7bc4" className={styles.row_num_7bc4}>{song.num}</span>
            <span data-scamp-id="row_title_8cd5" className={styles.row_title_8cd5}>{song.title}</span>
            <span data-scamp-id="row_meta_9de6" className={styles.row_meta_9de6}>{song.meta}</span>
            <span data-scamp-id="row_status_aef7" className={styles.row_status_aef7}>{song.status}</span>
            <span data-scamp-id="row_len_b008" className={styles.row_len_b008}>{song.length}</span>
            <button data-scamp-id="row_edit_c119" className={styles.row_edit_c119} type="button" data-scamp-click="state:open=edit">Tracks</button>
          </li>
        ))}
      </ul>
      <div data-scamp-id="edit_d22a" className={styles.edit_d22a}>
        <div data-scamp-id="edit_head_e33b" className={styles.edit_head_e33b}>
          <button data-scamp-id="back_f44c" className={styles.back_f44c} type="button" data-scamp-click="state:edit=open">‹ Setlist</button>
          <h4 data-scamp-id="edit_title_055d" className={styles.edit_title_055d}>{editTitle}</h4>
          <span data-scamp-id="edit_meta_166e" className={styles.edit_meta_166e}>{editMeta}</span>
        </div>
        <ul data-scamp-id="tracks_277f" className={styles.tracks_277f}>
          {tracks.map((track) => (
            <li data-scamp-id="track_3880" className={styles.track_3880} key={track.id} data-color={track.color}>
              <div data-scamp-id="swatch_4991" className={styles.swatch_4991} />
              <span data-scamp-id="track_name_5aa2" className={styles.track_name_5aa2}>{track.name}</span>
              <span data-scamp-id="track_kind_6bb3" className={styles.track_kind_6bb3}>{track.kind}</span>
              <div data-scamp-id="track_meter_7cc4" className={styles.track_meter_7cc4}>
                <div data-scamp-id="track_fill_8dd5" className={styles.track_fill_8dd5} />
              </div>
              <select data-scamp-id="route_9ee6" className={styles.route_9ee6} aria-label={track.name} defaultValue={track.output}>
                <option value="Out 1/2 · FOH">Out 1/2 · FOH</option>
                <option value="Out 3/4 · Wedge">Out 3/4 · Wedge</option>
                <option value="Out 5/6 · Drummer IEM">Out 5/6 · Drummer IEM</option>
                <option value="Out 7/8 · Band IEM">Out 7/8 · Band IEM</option>
                <option value="Off">Off</option>
              </select>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

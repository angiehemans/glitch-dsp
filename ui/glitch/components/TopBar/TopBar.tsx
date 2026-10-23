import styles from './TopBar.module.css';

type TopBarProps = {
  variant?: "rig" | "home";
  panic?: "off" | "on";
  projectName?: string;
  presetName?: string;
  modified?: boolean;
  songName?: string;
  cpuLoad?: string;
  audioDevice?: string;
  midiDevice?: string;
  onPanic?: () => void;
  className?: string;
};

export default function TopBar({ variant = "rig", panic = "off", projectName = "FULL BAND, IEMS", presetName = "CLEAN VERSE", modified = true, songName = "03. MIDNIGHT CITY", cpuLoad = "34%", audioDevice = "Scarlett 4i4", midiDevice = "FC-4", onPanic, className }: TopBarProps) {
  return (
    <header data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-variant={variant} data-panic={panic}>
      <a data-scamp-id="back_7e21" className={styles.back_7e21} href="/" aria-label="Back to projects">
        <svg data-scamp-id="back_icon_8f32" className={styles.back_icon_8f32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </a>
      <span data-scamp-id="brand_a3f1" className={styles.brand_a3f1}>GLITCH</span>
      <button data-scamp-id="lcd_c4e9" className={styles.lcd_c4e9} type="button">
        <div data-scamp-id="project_dot_d1a7" className={styles.project_dot_d1a7} />
        <span data-scamp-id="project_name_e2b8" className={styles.project_name_e2b8}>{projectName}</span>
        <span data-scamp-id="sep_f3c9" className={styles.sep_f3c9}>//</span>
        <span data-scamp-id="preset_label_04da" className={styles.preset_label_04da}>PRESET</span>
        <span data-scamp-id="preset_name_15eb" className={styles.preset_name_15eb}>{presetName}</span>
        {modified && (
          <span data-scamp-id="modified_dot_26fc" className={styles.modified_dot_26fc}>● MOD</span>
        )}
        <span data-scamp-id="sep_370d" className={styles.sep_370d}>//</span>
        <span data-scamp-id="song_label_481e" className={styles.song_label_481e}>SONG</span>
        <span data-scamp-id="song_name_592f" className={styles.song_name_592f}>{songName}</span>
      </button>
      <div data-scamp-id="cpu_6a30" className={styles.cpu_6a30}>
        <span data-scamp-id="cpu_label_7b41" className={styles.cpu_label_7b41}>CPU</span>
        <div data-scamp-id="cpu_track_8c52" className={styles.cpu_track_8c52}>
          <div data-scamp-id="cpu_fill_9d63" className={styles.cpu_fill_9d63} />
        </div>
        <span data-scamp-id="cpu_value_ae74" className={styles.cpu_value_ae74}>{cpuLoad}</span>
      </div>
      <div data-scamp-id="audio_status_bf85" className={styles.audio_status_bf85}>
        <div data-scamp-id="audio_led_c096" className={styles.audio_led_c096} />
        <span data-scamp-id="audio_name_d73a" className={styles.audio_name_d73a}>{audioDevice}</span>
      </div>
      <div data-scamp-id="midi_status_4f7a" className={styles.midi_status_4f7a}>
        <div data-scamp-id="midi_led_c7ba" className={styles.midi_led_c7ba} />
        <span data-scamp-id="midi_name_04db" className={styles.midi_name_04db}>{midiDevice}</span>
      </div>
      <button data-scamp-id="panic_3b9e" className={styles.panic_3b9e} type="button" aria-label="Panic: mute all outputs" aria-pressed={panic === "on"} onClick={onPanic}>
        <span data-scamp-id="panic_label_4caf" className={styles.panic_label_4caf}>PANIC</span>
      </button>
    </header>
  );
}

export const _scamp = { contract: 2, events: ['onPanic'] } as const;

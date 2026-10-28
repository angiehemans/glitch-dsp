import styles from './TopBar.module.css';

type TopBarProps = {
  variant?: "rig" | "home";
  panic?: "off" | "on";
  audiomenu?: "closed" | "open";
  presetmenu?: "closed" | "open" | "confirm";
  projectName?: string;
  projectRenameKey?: string;
  presetName?: string;
  presetRenameKey?: string;
  modified?: boolean;
  presets?: Array<{ id: string; name: string; current: boolean }>;
  noPresets?: boolean;
  canSave?: boolean;
  hasPreset?: boolean;
  deleteLabel?: string;
  songName?: string;
  cpuLoad?: string;
  audioDevice?: string;
  devices?: Array<{ id: string; name: string; kind: string; current: boolean }>;
  rates?: Array<{ id: string; label: string; current: boolean }>;
  buffers?: Array<{ id: string; label: string; current: boolean }>;
  latency?: string;
  midiDevice?: string;
  onAudioClick?: () => void;
  onSelectDevice?: (id: string) => void;
  onSelectRate?: (id: string) => void;
  onSelectBuffer?: (id: string) => void;
  onPanic?: () => void;
  onSelectPreset?: (id: string) => void;
  onSavePreset?: () => void;
  onSaveAsPreset?: () => void;
  onRenamePreset?: () => void;
  onDeletePreset?: () => void;
  className?: string;
};

export default function TopBar({
  variant = "rig",
  panic = "off",
  audiomenu = "closed",
  presetmenu = "closed",
  projectName = "FULL BAND, IEMS",
  projectRenameKey = "",
  presetName = "CLEAN VERSE",
  presetRenameKey = "",
  modified = true,
  presets = [
    { id: "1", name: "CLEAN VERSE", current: true },
    { id: "2", name: "CRUNCH CHORUS", current: false },
    { id: "3", name: "LEAD", current: false },
  ],
  noPresets = false,
  canSave = true,
  hasPreset = true,
  deleteLabel = "Delete “CLEAN VERSE”",
  songName = "03. MIDNIGHT CITY",
  cpuLoad = "34%",
  audioDevice = "Scarlett 4i4",
  devices = [
    { id: "1", name: "Scarlett 4i4", kind: "CoreAudio", current: true },
    { id: "2", name: "MacBook Pro Speakers", kind: "CoreAudio", current: false },
  ],
  rates = [
    { id: "44100", label: "44.1k", current: false },
    { id: "48000", label: "48k", current: true },
    { id: "96000", label: "96k", current: false },
  ],
  buffers = [
    { id: "64", label: "64", current: false },
    { id: "128", label: "128", current: true },
    { id: "256", label: "256", current: false },
    { id: "512", label: "512", current: false },
  ],
  latency = "Reported latency 5.8 ms (in + out)",
  midiDevice = "FC-4",
  onAudioClick,
  onSelectDevice,
  onSelectRate,
  onSelectBuffer,
  onPanic,
  onSelectPreset,
  onSavePreset,
  onSaveAsPreset,
  onRenamePreset,
  onDeletePreset,
  className,
}: TopBarProps) {
  return (
    <header data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-variant={variant} data-panic={panic} data-audiomenu={audiomenu} data-presetmenu={presetmenu} data-scamp-outside="audiomenu:open=closed presetmenu:open=closed,confirm=closed" data-scamp-escape="audiomenu:open=closed presetmenu:open=closed,confirm=closed">
      <a data-scamp-id="back_7e21" className={styles.back_7e21} href="/" aria-label="Back to projects">
        <svg data-scamp-id="back_icon_8f32" className={styles.back_icon_8f32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
      </a>
      <span data-scamp-id="brand_a3f1" className={styles.brand_a3f1}>GLITCH</span>
      <div data-scamp-id="lcd_c4e9" className={styles.lcd_c4e9}>
        <div data-scamp-id="project_dot_d1a7" className={styles.project_dot_d1a7} />
        <span data-scamp-id="project_name_e2b8" className={styles.project_name_e2b8} data-rename={projectRenameKey}>{projectName}</span>
        <span data-scamp-id="sep_f3c9" className={styles.sep_f3c9}>//</span>
        <span data-scamp-id="preset_label_04da" className={styles.preset_label_04da}>PRESET</span>
        <div data-scamp-id="preset_wrap_5d1e" className={styles.preset_wrap_5d1e}>
          <button data-scamp-id="preset_btn_6e2f" className={styles.preset_btn_6e2f} type="button" aria-haspopup="menu" aria-label="Presets" data-scamp-click="presetmenu:closed=open,open=closed,confirm=closed audiomenu:open=closed">
            <span data-scamp-id="preset_name_15eb" className={styles.preset_name_15eb} data-rename={presetRenameKey}>{presetName}</span>
            {modified && (
              <span data-scamp-id="modified_dot_26fc" className={styles.modified_dot_26fc}>● MOD</span>
            )}
            <svg data-scamp-id="preset_caret_7f30" className={styles.preset_caret_7f30} viewBox="0 0 24 24"><path d="M6 9l6 6l6 -6" /></svg>
          </button>
          <div data-scamp-id="preset_menu_8041" className={styles.preset_menu_8041} role="menu" aria-label="Presets">
            <p data-scamp-id="preset_title_3e8a" className={styles.preset_title_3e8a}>PRESETS</p>
            <ul data-scamp-id="preset_list_9152" className={styles.preset_list_9152}>
              {presets.map((preset) => (
                <li data-scamp-id="preset_row_a263" className={styles.preset_row_a263} key={preset.id}>
                  <button data-scamp-id="preset_item_b374" className={styles.preset_item_b374} type="button" role="menuitemradio" aria-checked={preset.current} data-scamp-click="presetmenu:open=closed" onClick={() => onSelectPreset?.(preset.id)}>{preset.name}</button>
                </li>
              ))}
            </ul>
            {noPresets && (
              <p data-scamp-id="preset_empty_c485" className={styles.preset_empty_c485}>No presets yet. Save the rig to make one.</p>
            )}
            <div data-scamp-id="preset_actions_d596" className={styles.preset_actions_d596}>
              <button data-scamp-id="preset_save_e6a7" className={styles.preset_save_e6a7} type="button" role="menuitem" disabled={!canSave} data-scamp-click="presetmenu:open=closed" onClick={onSavePreset}>Save</button>
              <button data-scamp-id="preset_saveas_f7b8" className={styles.preset_saveas_f7b8} type="button" role="menuitem" data-scamp-click="presetmenu:open=closed" onClick={onSaveAsPreset}>Save as new…</button>
              <button data-scamp-id="preset_rename_08c9" className={styles.preset_rename_08c9} type="button" role="menuitem" disabled={!hasPreset} data-scamp-click="presetmenu:open=closed" onClick={onRenamePreset}>Rename</button>
              <button data-scamp-id="preset_delete_19da" className={styles.preset_delete_19da} type="button" role="menuitem" disabled={!hasPreset} data-scamp-click="presetmenu:open=confirm">Delete…</button>
              <button data-scamp-id="preset_confirm_2aeb" className={styles.preset_confirm_2aeb} type="button" role="menuitem" data-scamp-click="presetmenu:confirm=closed" onClick={onDeletePreset}>{deleteLabel}</button>
            </div>
          </div>
        </div>
        <span data-scamp-id="sep_370d" className={styles.sep_370d}>//</span>
        <span data-scamp-id="song_label_481e" className={styles.song_label_481e}>SONG</span>
        <span data-scamp-id="song_name_592f" className={styles.song_name_592f}>{songName}</span>
      </div>
      <div data-scamp-id="cpu_6a30" className={styles.cpu_6a30}>
        <span data-scamp-id="cpu_label_7b41" className={styles.cpu_label_7b41}>CPU</span>
        <div data-scamp-id="cpu_track_8c52" className={styles.cpu_track_8c52} data-cpu-meter="">
          <div data-scamp-id="cpu_fill_9d63" className={styles.cpu_fill_9d63} />
        </div>
        <span data-scamp-id="cpu_value_ae74" className={styles.cpu_value_ae74}>{cpuLoad}</span>
      </div>
      <div data-scamp-id="audio_wrap_f125" className={styles.audio_wrap_f125}>
        <button data-scamp-id="audio_status_bf85" className={styles.audio_status_bf85} type="button" aria-haspopup="menu" title={audioDevice} data-scamp-click="audiomenu:closed=open,open=closed presetmenu:open=closed,confirm=closed" onClick={onAudioClick}>
          <div data-scamp-id="audio_led_c096" className={styles.audio_led_c096} />
          <span data-scamp-id="audio_name_d73a" className={styles.audio_name_d73a}>{audioDevice}</span>
        </button>
        <div data-scamp-id="audio_menu_0236" className={styles.audio_menu_0236} role="menu" aria-label="Audio devices">
          <p data-scamp-id="audio_menu_title_1347" className={styles.audio_menu_title_1347}>AUDIO DEVICE</p>
          <ul data-scamp-id="audio_list_2458" className={styles.audio_list_2458}>
            {devices.map((device) => (
              <li data-scamp-id="audio_row_3569" className={styles.audio_row_3569} key={device.id}>
                <button data-scamp-id="audio_item_467a" className={styles.audio_item_467a} type="button" role="menuitemradio" aria-checked={device.current} data-scamp-click="audiomenu:open=closed" onClick={() => onSelectDevice?.(device.id)}>
                  <span data-scamp-id="audio_item_name_578b" className={styles.audio_item_name_578b}>{device.name}</span>
                  <span data-scamp-id="audio_item_type_689c" className={styles.audio_item_type_689c}>{device.kind}</span>
                </button>
              </li>
            ))}
          </ul>
          <p data-scamp-id="rate_title_7a8b" className={styles.rate_title_7a8b}>SAMPLE RATE</p>
          <div data-scamp-id="rates_8b9c" className={styles.rates_8b9c} role="group" aria-label="Sample rate">
            {rates.map((rate) => (
              <button data-scamp-id="rate_9cad" className={styles.rate_9cad} type="button" role="menuitemradio" aria-checked={rate.current} key={rate.id} onClick={() => onSelectRate?.(rate.id)}>{rate.label}</button>
            ))}
          </div>
          <p data-scamp-id="buffer_title_adbe" className={styles.buffer_title_adbe}>BUFFER SIZE</p>
          <div data-scamp-id="buffers_becf" className={styles.buffers_becf} role="group" aria-label="Buffer size">
            {buffers.map((buffer) => (
              <button data-scamp-id="buffer_cfd0" className={styles.buffer_cfd0} type="button" role="menuitemradio" aria-checked={buffer.current} key={buffer.id} onClick={() => onSelectBuffer?.(buffer.id)}>{buffer.label}</button>
            ))}
          </div>
          <p data-scamp-id="latency_d0e1" className={styles.latency_d0e1}>{latency}</p>
        </div>
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

export const _scamp = { contract: 2, events: ['onAudioClick', 'onSelectDevice', 'onSelectRate', 'onSelectBuffer', 'onPanic', 'onSelectPreset', 'onSavePreset', 'onSaveAsPreset', 'onRenamePreset', 'onDeletePreset'] } as const;

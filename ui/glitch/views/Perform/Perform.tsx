import styles from './Perform.module.css';

type PerformProps = {
  panic?: "off" | "on";
  setlistLabel?: string;
  stateKey?: string;
  stateLabel?: string;
  title?: string;
  details?: string;
  elapsed?: string;
  ending?: string;
  remaining?: string;
  playing?: string;
  canPlay?: boolean;
  playLabel?: string;
  nextDim?: string;
  nextTitle?: string;
  presetName?: string;
  modified?: string;
  chains?: Array<{ id: string; color: string; name: string; pedals: Array<{ id: string; on: string; finish: string; name: string }> }>;
  noChains?: boolean;
  pageLabel?: string;
  switches?: Array<{ id: string; lit: string; name: string; tap: string; hold: string }>;
  noSwitches?: boolean;
  onPrev?: () => void;
  onPlay?: () => void;
  onNext?: () => void;
  onTune?: () => void;
  onPanic?: () => void;
  waveform?: React.ReactNode;
  className?: string;
};

export default function Perform({
  panic = "off",
  setlistLabel = "Friday at the Crown · song 2 of 5",
  stateKey = "playing",
  stateLabel = "Playing",
  title = "Midnight City",
  details = "4:03 · 3 tracks",
  elapsed = "1:12",
  ending = "off",
  remaining = "−2:51",
  playing = "on",
  canPlay = true,
  playLabel = "STOP",
  nextDim = "off",
  nextTitle = "Dancing in the Dark",
  presetName = "Clean",
  modified = "on",
  chains = [
    {
      id: "1", color: "orange", name: "Guitar",
      pedals: [
        { id: "a", on: "on", finish: "cream", name: "Compressor" },
        { id: "b", on: "on", finish: "purple", name: "Fuzz" },
        { id: "c", on: "on", finish: "black", name: "ABY · A" },
        { id: "d", on: "on", finish: "orange", name: "Vintage Amp" },
        { id: "e", on: "off", finish: "blue", name: "Chorus" },
      ],
    },
    {
      id: "2", color: "cyan", name: "Vocals",
      pedals: [
        { id: "f", on: "on", finish: "green", name: "Low Cut EQ" },
        { id: "g", on: "on", finish: "cream", name: "Compressor" },
        { id: "h", on: "on", finish: "blue", name: "Reverb" },
      ],
    },
  ],
  noChains = false,
  pageLabel = "Footswitch · page 1 of 2",
  switches = [
    { id: "1", lit: "on", name: "A", tap: "Drive", hold: "Hold · Next preset" },
    { id: "2", lit: "off", name: "B", tap: "Delay", hold: "" },
    { id: "3", lit: "off", name: "C", tap: "Next song", hold: "Hold · Tune mode" },
  ],
  noSwitches = false,
  onPrev,
  onPlay,
  onNext,
  onTune,
  onPanic,
  waveform,
  className,
}: PerformProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Perform" data-panic={panic}>
      <div data-scamp-id="panel_8b1e" className={styles.panel_8b1e}>
        <div data-scamp-id="status_1f2a" className={styles.status_1f2a}>
          <p data-scamp-id="state_3b4c" className={styles.state_3b4c} data-state={stateKey}>{stateLabel}</p>
          <p data-scamp-id="setlist_2a3b" className={styles.setlist_2a3b}>{setlistLabel}</p>
          <div data-scamp-id="preset_2a3c" className={styles.preset_2a3c}>
            <span data-scamp-id="preset_label_3b4d" className={styles.preset_label_3b4d}>Preset ·</span>
            <div data-scamp-id="preset_name_4c5e" className={styles.preset_name_4c5e}>
              <span data-scamp-id="preset_text_5d6f" className={styles.preset_text_5d6f}>{presetName}</span>
              <span data-scamp-id="modified_6e70" className={styles.modified_6e70} data-on={modified} aria-label="Modified" />
            </div>
          </div>
        </div>
        <div data-scamp-id="now_4c5d" className={styles.now_4c5d}>
          <h1 data-scamp-id="title_5d6e" className={styles.title_5d6e}>{title}</h1>
          <span data-scamp-id="details_c2f7" className={styles.details_c2f7}>{details}</span>
        </div>
        <div data-scamp-id="timeline_4e0a" className={styles.timeline_4e0a}>
          <div data-scamp-id="wave_3b6f" className={styles.wave_3b6f} aria-hidden="true">{waveform}</div>
          <div data-scamp-id="time_6e7f" className={styles.time_6e7f}>
            <span data-scamp-id="elapsed_7f80" className={styles.elapsed_7f80}>{elapsed}</span>
            <span data-scamp-id="remaining_91a2" className={styles.remaining_91a2} data-ending={ending}>{remaining}</span>
          </div>
        </div>
        <div data-scamp-id="controls_a2b3" className={styles.controls_a2b3}>
          <button data-scamp-id="prev_b3c4" className={styles.prev_b3c4} type="button" aria-label="Previous song in the setlist" onClick={onPrev}>⏮</button>
          <button data-scamp-id="play_c4d5" className={styles.play_c4d5} type="button" data-playing={playing} disabled={!canPlay} onClick={onPlay}>{playLabel}</button>
          <button data-scamp-id="next_btn_d5e6" className={styles.next_btn_d5e6} type="button" aria-label="Next song in the setlist" onClick={onNext}>⏭</button>
          <div data-scamp-id="up_next_e6f7" className={styles.up_next_e6f7}>
            <span data-scamp-id="up_next_label_f708" className={styles.up_next_label_f708}>Up next</span>
            <span data-scamp-id="up_next_title_0819" className={styles.up_next_title_0819} data-dim={nextDim}>{nextTitle}</span>
          </div>
        </div>
      </div>
      <div data-scamp-id="chains_6c7d" className={styles.chains_6c7d} aria-label="Chains playing">
        {chains.map((chain) => (
          <div data-scamp-id="chain_7d8e" className={styles.chain_7d8e} key={chain.id} data-color={chain.color}>
            <div data-scamp-id="chain_head_8e9f" className={styles.chain_head_8e9f}>
              <span data-scamp-id="chain_dot_9fa0" className={styles.chain_dot_9fa0} />
              <span data-scamp-id="chain_name_a0b1" className={styles.chain_name_a0b1}>{chain.name}</span>
            </div>
            <ul data-scamp-id="pedals_b1c2" className={styles.pedals_b1c2}>
              {chain.pedals.map((pedal) => (
                <li data-scamp-id="pedal_c2d3" className={styles.pedal_c2d3} key={pedal.id} data-on={pedal.on} data-finish={pedal.finish}>
                  <span data-scamp-id="pedal_led_d3e4" className={styles.pedal_led_d3e4} />
                  <span data-scamp-id="pedal_name_e4f5" className={styles.pedal_name_e4f5}>{pedal.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {noChains && (
          <p data-scamp-id="no_chains_f506" className={styles.no_chains_f506}>Every chain is muted.</p>
        )}
      </div>
      <div data-scamp-id="rig_192a" className={styles.rig_192a}>
        <div data-scamp-id="switches_7f81" className={styles.switches_7f81}>
          <span data-scamp-id="page_8092" className={styles.page_8092}>{pageLabel}</span>
          <div data-scamp-id="tile_row_5a3d" className={styles.tile_row_5a3d}>
            <ul data-scamp-id="tiles_91a3" className={styles.tiles_91a3}>
              {switches.map((sw) => (
                <li data-scamp-id="tile_a2b4" className={styles.tile_a2b4} key={sw.id} data-lit={sw.lit} data-switch={sw.id} role="button" tabIndex={0}>
                  <span data-scamp-id="tile_name_b3c5" className={styles.tile_name_b3c5}>{sw.name}</span>
                  <div data-scamp-id="tile_text_e92c" className={styles.tile_text_e92c}>
                    <span data-scamp-id="tile_tap_c4d6" className={styles.tile_tap_c4d6}>{sw.tap}</span>
                    <span data-scamp-id="tile_hold_d5e7" className={styles.tile_hold_d5e7}>{sw.hold}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button data-scamp-id="tune_7d14" className={styles.tune_7d14} type="button" onClick={onTune}>Tune</button>
            <button data-scamp-id="panic_b068" className={styles.panic_b068} type="button" onClick={onPanic}>Panic</button>
          </div>
          {noSwitches && (
            <p data-scamp-id="no_switches_e6f8" className={styles.no_switches_e6f8}>No footswitch yet. Set one up on the Rig tab.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onPrev', 'onPlay', 'onNext', 'onTune', 'onPanic'] } as const;

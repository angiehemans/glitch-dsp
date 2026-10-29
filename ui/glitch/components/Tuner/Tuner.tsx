import styles from './Tuner.module.css';

type TunerProps = {
  tune?: "out" | "in" | "none";
  liveLabel?: string;
  note?: string;
  octave?: string;
  centsLabel?: string;
  hzLabel?: string;
  inputs?: Array<{ id: string; label: string; current: boolean }>;
  referenceLabel?: string;
  chains?: Array<{ id: string; name: string; current: boolean }>;
  onExit?: () => void;
  onSelectInput?: (id: string) => void;
  onReferenceDown?: () => void;
  onReferenceUp?: () => void;
  onSelectLive?: (id: string) => void;
  className?: string;
};

export default function Tuner({
  tune = "out",
  liveLabel = "Everything muted except Vocals",
  note = "E",
  octave = "2",
  centsLabel = "−12 cents",
  hzLabel = "81.84 Hz",
  inputs = [
    { id: "1", label: "In 1", current: true },
    { id: "2", label: "In 2", current: false },
  ],
  referenceLabel = "A4 = 440 Hz",
  chains = [
    { id: "none", name: "None", current: false },
    { id: "vocals", name: "Vocals", current: true },
    { id: "guitar", name: "Guitar", current: false },
  ],
  onExit,
  onSelectInput,
  onReferenceDown,
  onReferenceUp,
  onSelectLive,
  className,
}: TunerProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Tuner" data-tune={tune}>
      <div data-scamp-id="top_1a2b" className={styles.top_1a2b}>
        <h2 data-scamp-id="title_2b3c" className={styles.title_2b3c}>Tune mode</h2>
        <p data-scamp-id="live_3c4d" className={styles.live_3c4d}>{liveLabel}</p>
        <button data-scamp-id="exit_4d5e" className={styles.exit_4d5e} type="button" onClick={onExit}>Exit</button>
      </div>
      <div data-scamp-id="reading_5e6f" className={styles.reading_5e6f} role="status" aria-live="off">
        <div data-scamp-id="note_row_6f70" className={styles.note_row_6f70}>
          <span data-scamp-id="note_7081" className={styles.note_7081}>{note}</span>
          <span data-scamp-id="octave_8192" className={styles.octave_8192}>{octave}</span>
        </div>
        <div data-scamp-id="scale_92a3" className={styles.scale_92a3} aria-hidden="true">
          <div data-scamp-id="needle_a3b4" className={styles.needle_a3b4} />
        </div>
        <span data-scamp-id="cents_b4c5" className={styles.cents_b4c5}>{centsLabel}</span>
        <span data-scamp-id="hz_c5d6" className={styles.hz_c5d6}>{hzLabel}</span>
      </div>
      <div data-scamp-id="settings_d6e7" className={styles.settings_d6e7}>
        <div data-scamp-id="group_input_e7f8" className={styles.group_input_e7f8} role="group" aria-label="Tuner input">
          <span data-scamp-id="input_label_f809" className={styles.input_label_f809}>Listen to</span>
          <ul data-scamp-id="inputs_091a" className={styles.inputs_091a}>
            {inputs.map((input) => (
              <li data-scamp-id="input_row_1a2c" className={styles.input_row_1a2c} key={input.id}>
                <button data-scamp-id="input_btn_2b3d" className={styles.input_btn_2b3d} type="button" role="radio" aria-checked={input.current} onClick={() => onSelectInput?.(input.id)}>{input.label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div data-scamp-id="group_ref_3c4e" className={styles.group_ref_3c4e} role="group" aria-label="Reference pitch">
          <button data-scamp-id="ref_down_4d5f" className={styles.ref_down_4d5f} type="button" aria-label="Lower the reference" onClick={onReferenceDown}>−</button>
          <span data-scamp-id="ref_label_5e60" className={styles.ref_label_5e60}>{referenceLabel}</span>
          <button data-scamp-id="ref_up_6f71" className={styles.ref_up_6f71} type="button" aria-label="Raise the reference" onClick={onReferenceUp}>+</button>
        </div>
        <div data-scamp-id="group_live_7082" className={styles.group_live_7082} role="group" aria-label="Chain that stays live">
          <span data-scamp-id="live_label_8193" className={styles.live_label_8193}>Stays live</span>
          <ul data-scamp-id="chains_92a4" className={styles.chains_92a4}>
            {chains.map((chain) => (
              <li data-scamp-id="chain_row_a3b5" className={styles.chain_row_a3b5} key={chain.id}>
                <button data-scamp-id="chain_btn_b4c6" className={styles.chain_btn_b4c6} type="button" role="radio" aria-checked={chain.current} onClick={() => onSelectLive?.(chain.id)}>{chain.name}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onExit', 'onSelectInput', 'onReferenceDown', 'onReferenceUp', 'onSelectLive'] } as const;

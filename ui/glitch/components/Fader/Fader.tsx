import styles from './Fader.module.css';

type FaderProps = {
  color?: "green" | "blue" | "amber" | "pink";
  name?: string;
  level?: string;
  muted?: boolean;
  className?: string;
};

export default function Fader({
  color = "green",
  name = "Backing",
  level = "75",
  muted = false,
  className,
}: FaderProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-color={color}>
      <span data-scamp-id="name_a3f1" className={styles.name_a3f1}>{name}</span>
      <div data-scamp-id="fader_b7c2" className={styles.fader_b7c2}>
        <div data-scamp-id="scale_c4d9" className={styles.scale_c4d9} aria-hidden="true">
          <span data-scamp-id="mark_d1a0" className={styles.mark_d1a0}>+10</span>
          <span data-scamp-id="mark_d1a1" className={styles.mark_d1a1}>+5</span>
          <span data-scamp-id="mark_d1a2" className={styles.mark_d1a2}>0</span>
          <span data-scamp-id="mark_d1a3" className={styles.mark_d1a3}>-5</span>
          <span data-scamp-id="mark_d1a4" className={styles.mark_d1a4}>-10</span>
          <span data-scamp-id="mark_d1a5" className={styles.mark_d1a5}>-20</span>
          <span data-scamp-id="mark_d1a6" className={styles.mark_d1a6}>-30</span>
          <span data-scamp-id="mark_d1a7" className={styles.mark_d1a7}>-40</span>
          <span data-scamp-id="mark_d1a8" className={styles.mark_d1a8}>-∞</span>
        </div>
        <div data-scamp-id="track_e5b3" className={styles.track_e5b3}>
          <div data-scamp-id="unity_tick_f2a6" className={styles.unity_tick_f2a6} />
          <input data-scamp-id="range_a8e4" className={styles.range_a8e4} type="range" min="0" max="100" defaultValue={level} aria-label={name} />
        </div>
      </div>
      <label data-scamp-id="mute_b9d5" className={styles.mute_b9d5}>
        <input data-scamp-id="mute_input_c6f7" className={styles.mute_input_c6f7} type="checkbox" defaultChecked={muted} />
        <span data-scamp-id="mute_text_d3c8" className={styles.mute_text_d3c8}>MUTE</span>
      </label>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

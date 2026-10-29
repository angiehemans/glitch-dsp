import styles from './AbyPedal.module.css';

type AbyPedalProps = {
  mode?: "a" | "b" | "y";
  onToggleAb?: () => void;
  onToggleY?: () => void;
  className?: string;
};

export default function AbyPedal({ mode = "a", onToggleAb, onToggleY, className }: AbyPedalProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} role="group" aria-label="ABY splitter pedal" data-mode={mode}>
      <div data-scamp-id="title_c3e0" className={styles.title_c3e0}>
        <h2 data-scamp-id="name_c3e1" className={styles.name_c3e1}>ABY</h2>
        <p data-scamp-id="sub_c3e2" className={styles.sub_c3e2}>Line Splitter</p>
      </div>
      <div data-scamp-id="rect_5b0a" className={styles.rect_5b0a}>
        <div data-scamp-id="switches_e5a0" className={styles.switches_e5a0}>
          <button data-scamp-id="ab_switch_e5a1" className={styles.ab_switch_e5a1} type="button" aria-label="Toggle output A or B" onClick={onToggleAb}>
            <div data-scamp-id="led_a_d4f1" className={styles.led_a_d4f1}>
              <div data-scamp-id="led_a_dot_d4f2" className={styles.led_a_dot_d4f2} />
              <span data-scamp-id="led_a_text_d4f3" className={styles.led_a_text_d4f3}>A</span>
            </div>
            <div data-scamp-id="ab_cap_e5a2" className={styles.ab_cap_e5a2}>
              <span data-scamp-id="ab_cap_in_6b1f" className={styles.ab_cap_in_6b1f} />
            </div>
            <span data-scamp-id="ab_name_e5a3" className={styles.ab_name_e5a3}>A / B</span>
            <span data-scamp-id="ab_hint_e5a4" className={styles.ab_hint_e5a4}>SELECT</span>
          </button>
          <button data-scamp-id="y_switch_e5a5" className={styles.y_switch_e5a5} type="button" aria-label="Toggle Y mode, both outputs" onClick={onToggleY}>
            <div data-scamp-id="led_b_d4f4" className={styles.led_b_d4f4}>
              <div data-scamp-id="led_b_dot_d4f5" className={styles.led_b_dot_d4f5} />
              <span data-scamp-id="led_b_text_d4f6" className={styles.led_b_text_d4f6}>B</span>
            </div>
            <div data-scamp-id="y_cap_e5a6" className={styles.y_cap_e5a6}>
              <span data-scamp-id="y_cap_in_7c2a" className={styles.y_cap_in_7c2a} />
            </div>
            <span data-scamp-id="y_name_e5a7" className={styles.y_name_e5a7}>Y</span>
            <span data-scamp-id="y_hint_e5a8" className={styles.y_hint_e5a8}>BOTH</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: ['onToggleAb', 'onToggleY'] } as const;

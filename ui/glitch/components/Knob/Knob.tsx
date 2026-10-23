import styles from './Knob.module.css';

type KnobProps = {
  position?: "mid" | "low" | "high";
  value?: string;
  label?: string;
  className?: string;
};

export default function Knob({
  position = "mid",
  value = "0.0 dB",
  label = "INPUT",
  className,
}: KnobProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-position={position}>
      <div data-scamp-id="dial_1b2c" className={styles.dial_1b2c}>
        <div data-scamp-id="pointer_2c3d" className={styles.pointer_2c3d} />
      </div>
      <span data-scamp-id="value_3d4e" className={styles.value_3d4e}>{value}</span>
      <span data-scamp-id="label_4e5f" className={styles.label_4e5f}>{label}</span>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

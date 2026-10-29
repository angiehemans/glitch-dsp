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
        <svg data-scamp-id="knob_svg_8a1f" className={styles.knob_svg_8a1f} viewBox="-20 -20 160 160" aria-hidden="true"><path d="M31.72,88.28 L27.47,92.53 M21.96,72.36 L16.25,74.21 M20.49,53.74 L14.57,52.80 M27.64,36.49 L22.79,32.96 M41.84,24.36 L39.12,19.01 M60.00,20.00 L60.00,14.00 M78.16,24.36 L80.88,19.01 M92.36,36.49 L97.21,32.96 M99.51,53.74 L105.43,52.80 M98.04,72.36 L103.75,74.21 M88.28,88.28 L92.53,92.53" stroke="#6f7076" strokeWidth="2.2" strokeLinecap="round" fill="none" /><path d="M68.02,30.06 A5,5 0 0 0 75.50,33.15 A31,31 0 0 1 81.92,38.08 A5,5 0 0 0 86.85,44.50 A31,31 0 0 1 89.94,51.98 A5,5 0 0 0 91.00,60.00 A31,31 0 0 1 89.94,68.02 A5,5 0 0 0 86.85,75.50 A31,31 0 0 1 81.92,81.92 A5,5 0 0 0 75.50,86.85 A31,31 0 0 1 68.02,89.94 A5,5 0 0 0 60.00,91.00 A31,31 0 0 1 51.98,89.94 A5,5 0 0 0 44.50,86.85 A31,31 0 0 1 38.08,81.92 A5,5 0 0 0 33.15,75.50 A31,31 0 0 1 30.06,68.02 A5,5 0 0 0 29.00,60.00 A31,31 0 0 1 30.06,51.98 A5,5 0 0 0 33.15,44.50 A31,31 0 0 1 38.08,38.08 A5,5 0 0 0 44.50,33.15 A31,31 0 0 1 51.98,30.06 A5,5 0 0 0 60.00,29.00 A31,31 0 0 1 68.02,30.06 Z" fill="#151516" stroke="#000000" strokeWidth="1" /><circle cx="60" cy="60" r="22" fill="#1f1f22" stroke="#000000" strokeOpacity="0.6" strokeWidth="1" /><circle cx="60" cy="60" r="21" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" /><ellipse cx="51" cy="45" rx="15" ry="8" fill="#ffffff" fillOpacity="0.07" /><path d="M33.41,64.69 A27,27 0 0 1 64.69,33.41" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" /></svg>
        <div data-scamp-id="pointer_2c3d" className={styles.pointer_2c3d} />
      </div>
      <span data-scamp-id="value_3d4e" className={styles.value_3d4e}>{value}</span>
      <span data-scamp-id="label_4e5f" className={styles.label_4e5f}>{label}</span>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

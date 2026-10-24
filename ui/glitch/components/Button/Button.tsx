import styles from './Button.module.css';

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dashed" | "icon";
  ariaLabel?: string;
  label?: string;
  onClick?: () => void;
  className?: string;
};

export default function Button({ variant = "primary", ariaLabel = "", label = "Button", onClick, className }: ButtonProps) {
  return (
    <button data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} type="button" data-variant={variant} aria-label={ariaLabel} onClick={onClick}>
      <span data-scamp-id="label_b7c2" className={styles.label_b7c2}>{label}</span>
    </button>
  );
}

export const _scamp = { contract: 2, events: ['onClick'] } as const;

import styles from './BlockTile.module.css';

type BlockTileProps = {
  state?: "active" | "bypassed" | "selected" | "loading" | "error";
  modal?: "closed" | "open";
  art?: "fixed" | "hug";
  size?: "regular" | "small";
  name?: string;
  bypassLabel?: string;
  onBypass?: () => void;
  onRemove?: () => void;
  onOpen?: () => void;
  children?: React.ReactNode;
  plugin?: React.ReactNode;
  className?: string;
};

export default function BlockTile({ state = "active", modal = "closed", art = "fixed", size = "regular", name = "Vintage Amp", bypassLabel = "Bypass", onOpen, onBypass, onRemove, children, plugin, className }: BlockTileProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-state={state} data-modal={modal} data-art={art} data-size={size} data-scamp-escape="modal:open=closed">
      <div data-scamp-id="head_3a7c" className={styles.head_3a7c}>
        <p data-scamp-id="name_d4f5" className={styles.name_d4f5}>{name}</p>
        <button data-scamp-id="bypass_4b8d" className={styles.bypass_4b8d} type="button" aria-label={bypassLabel} onClick={onBypass}>
          <svg data-scamp-id="power_svg_5c9e" className={styles.power_svg_5c9e} viewBox="0 0 24 24"><path d="M7 6a7.75 7.75 0 1 0 10 0" /><path d="M12 4l0 8" /></svg>
        </button>
        <button data-scamp-id="remove_6daf" className={styles.remove_6daf} type="button" aria-label="Remove" onClick={onRemove}>✕</button>
      </div>
      <button data-scamp-id="art_btn_d71e" className={styles.art_btn_d71e} type="button" aria-label="Open plugin" onClick={onOpen}>
        <div data-scamp-id="art_1f20" className={styles.art_1f20}>{children}</div>
      </button>
      <p data-scamp-id="loading_f617" className={styles.loading_f617}>LOADING…</p>
      <p data-scamp-id="error_0728" className={styles.error_0728}>⚠ Failed to load</p>
      <div data-scamp-id="backdrop_7a1b" className={styles.backdrop_7a1b} data-scamp-click="modal:open=closed" />
      <div data-scamp-id="modal_8b2c" className={styles.modal_8b2c} role="dialog" aria-modal="true" aria-label="Plugin">
        <div data-scamp-id="modal_head_9c3d" className={styles.modal_head_9c3d}>
          <p data-scamp-id="modal_title_ad4e" className={styles.modal_title_ad4e}>{name}</p>
          <button data-scamp-id="modal_close_be5f" className={styles.modal_close_be5f} type="button" aria-label="Close" data-scamp-click="modal:open=closed">✕</button>
        </div>
        <div data-scamp-id="plugin_cf60" className={styles.plugin_cf60}>{plugin}</div>
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: ['onBypass', 'onRemove', 'onOpen'] } as const;

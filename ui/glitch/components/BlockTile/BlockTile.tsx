import styles from './BlockTile.module.css';

type BlockTileProps = {
  state?: "active" | "bypassed" | "selected" | "loading" | "error";
  expanded?: "closed" | "open";
  modal?: "closed" | "open";
  art?: "fixed" | "hug";
  typeLabel?: string;
  name?: string;
  detail?: string;
  onOpen?: () => void;
  children?: React.ReactNode;
  plugin?: React.ReactNode;
  className?: string;
};

export default function BlockTile({ state = "active", expanded = "closed", modal = "closed", art = "fixed", typeLabel = "VST3", name = "Vintage Amp", detail = "Amp · 9% CPU", onOpen, children, plugin, className }: BlockTileProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-state={state} data-expanded={expanded} data-modal={modal} data-art={art} data-scamp-escape="modal:open=closed">
      <button data-scamp-id="art_btn_d71e" className={styles.art_btn_d71e} type="button" aria-label="Open plugin" onClick={onOpen}>
        <div data-scamp-id="art_1f20" className={styles.art_1f20}>{children}</div>
      </button>
      <button data-scamp-id="expand_5e8a" className={styles.expand_5e8a} type="button" aria-label="Show details" data-scamp-click="expanded:closed=open,open=closed">
        <svg data-scamp-id="chevron_svg_6f9b" className={styles.chevron_svg_6f9b} viewBox="0 0 24 24"><path d="M6 9l6 6l6 -6" /></svg>
      </button>
      <div data-scamp-id="rect_f979" className={styles.rect_f979}>
        <div data-scamp-id="top_a1c2" className={styles.top_a1c2}>
          <span data-scamp-id="type_tag_b2d3" className={styles.type_tag_b2d3}>{typeLabel}</span>
          <div data-scamp-id="led_c3e4" className={styles.led_c3e4} />
        </div>
        <p data-scamp-id="name_d4f5" className={styles.name_d4f5}>{name}</p>
        <p data-scamp-id="detail_e506" className={styles.detail_e506}>{detail}</p>
      </div>
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

export const _scamp = { contract: 2, events: ['onOpen'] } as const;

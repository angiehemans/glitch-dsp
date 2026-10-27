import styles from './AbyFork.module.css';

type AbyForkProps = {
  mode?: "a" | "b" | "y";
  exit?: "merge" | "split";
  menua?: "closed" | "open";
  menub?: "closed" | "open";
  options?: "closed" | "confirm";
  removeLabel?: string;
  pluginsB?: Array<{ id: string; name: string; kind: string; image: string }>;
  pluginsA?: Array<{ id: string; name: string; kind: string; image: string }>;
  onRemove?: () => void;
  onAddB?: (id: string) => void;
  onAddA?: (id: string) => void;
  pedal?: React.ReactNode;
  laneB?: React.ReactNode;
  laneA?: React.ReactNode;
  className?: string;
};

export default function AbyFork({
  mode = "a",
  exit = "merge",
  menua = "closed",
  menub = "closed",
  options = "closed",
  removeLabel = "Keep A, remove B",
  pluginsB = [
    { id: "modern-amp", name: "Modern Amp", kind: "Amp", image: "/assets/modern-amp.jpg" },
    { id: "chorus", name: "Chorus", kind: "Modulation", image: "/assets/chorus-pedal.webp" },
  ],
  pluginsA = [
    { id: "vintage-amp", name: "Vintage Amp", kind: "Amp", image: "/assets/vintage-amp.webp" },
    { id: "delay", name: "Delay", kind: "Time", image: "/assets/delay-pedal.webp" },
  ],
  onRemove,
  onAddB,
  onAddA,
  pedal,
  laneB,
  laneA,
  className,
}: AbyForkProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} role="group" aria-label="ABY split" data-mode={mode} data-exit={exit} data-menua={menua} data-menub={menub} data-options={options} data-scamp-outside="menua:open=closed menub:open=closed options:confirm=closed" data-scamp-escape="menua:open=closed menub:open=closed options:confirm=closed">
      <div data-scamp-id="pedal_col_a1f0" className={styles.pedal_col_a1f0}>
        <div data-scamp-id="head_7c1e" className={styles.head_7c1e}>
          <span data-scamp-id="grip_9f0a" className={styles.grip_9f0a} title="Drag to move" aria-hidden="true"><svg data-scamp-id="grip_svg_a0b1" className={styles.grip_svg_a0b1} viewBox="0 0 24 24"><path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M9 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M9 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></span>
          <p data-scamp-id="name_8d2f" className={styles.name_8d2f}>ABY</p>
          <button data-scamp-id="remove_c3d2" className={styles.remove_c3d2} type="button" aria-label="Remove split" data-scamp-click="options:closed=confirm,confirm=closed">✕</button>
        </div>
        <div data-scamp-id="pedal_slot_b2e1" className={styles.pedal_slot_b2e1}>{pedal}</div>
        <button data-scamp-id="confirm_d4c3" className={styles.confirm_d4c3} type="button" data-scamp-click="options:confirm=closed" onClick={onRemove}>{removeLabel}</button>
      </div>
      <div data-scamp-id="lanes_e5b4" className={styles.lanes_e5b4}>
        <div data-scamp-id="lane_b_f6a5" className={styles.lane_b_f6a5}>
          <span data-scamp-id="tag_b_07b6" className={styles.tag_b_07b6}>B</span>
          <div data-scamp-id="slot_b_5c0b" className={styles.slot_b_5c0b}>{laneB}</div>
          <button data-scamp-id="add_b_6d1c" className={styles.add_b_6d1c} type="button" aria-label="Add a block to path B" data-scamp-click="menub:closed=open,open=closed menua:open=closed options:confirm=closed">+</button>
          <div data-scamp-id="menu_b_7e2d" className={styles.menu_b_7e2d} role="menu" aria-label="Add to path B">
            <p data-scamp-id="menu_b_title_8f3e" className={styles.menu_b_title_8f3e}>ADD TO B</p>
            <ul data-scamp-id="menu_b_list_904f" className={styles.menu_b_list_904f}>
              {pluginsB.map((plugin) => (
                <li data-scamp-id="menu_b_row_a150" className={styles.menu_b_row_a150} key={plugin.id}>
                  <button data-scamp-id="menu_b_item_b261" className={styles.menu_b_item_b261} type="button" role="menuitem" data-scamp-click="menub:open=closed" onClick={() => onAddB?.(plugin.id)}>
                    <img data-scamp-id="menu_b_thumb_c372" className={styles.menu_b_thumb_c372} src={plugin.image} alt="" />
                    <div data-scamp-id="menu_b_text_d483" className={styles.menu_b_text_d483}>
                      <span data-scamp-id="menu_b_name_e594" className={styles.menu_b_name_e594}>{plugin.name}</span>
                      <span data-scamp-id="menu_b_kind_0c1e" className={styles.menu_b_kind_0c1e}>{plugin.kind}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div data-scamp-id="lane_a_2d3f" className={styles.lane_a_2d3f}>
          <span data-scamp-id="tag_a_4e50" className={styles.tag_a_4e50}>A</span>
          <div data-scamp-id="slot_a_93a5" className={styles.slot_a_93a5}>{laneA}</div>
          <button data-scamp-id="add_a_a4b6" className={styles.add_a_a4b6} type="button" aria-label="Add a block to path A" data-scamp-click="menua:closed=open,open=closed menub:open=closed options:confirm=closed">+</button>
          <div data-scamp-id="menu_a_b5c7" className={styles.menu_a_b5c7} role="menu" aria-label="Add to path A">
            <p data-scamp-id="menu_a_title_c6d8" className={styles.menu_a_title_c6d8}>ADD TO A</p>
            <ul data-scamp-id="menu_a_list_d7e9" className={styles.menu_a_list_d7e9}>
              {pluginsA.map((plugin) => (
                <li data-scamp-id="menu_a_row_e8fa" className={styles.menu_a_row_e8fa} key={plugin.id}>
                  <button data-scamp-id="menu_a_item_f90b" className={styles.menu_a_item_f90b} type="button" role="menuitem" data-scamp-click="menua:open=closed" onClick={() => onAddA?.(plugin.id)}>
                    <img data-scamp-id="menu_a_thumb_0a1c" className={styles.menu_a_thumb_0a1c} src={plugin.image} alt="" />
                    <div data-scamp-id="menu_a_text_1b2d" className={styles.menu_a_text_1b2d}>
                      <span data-scamp-id="menu_a_name_2c3e" className={styles.menu_a_name_2c3e}>{plugin.name}</span>
                      <span data-scamp-id="menu_a_kind_3d4f" className={styles.menu_a_kind_3d4f}>{plugin.kind}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <span data-scamp-id="merge_9a8b" className={styles.merge_9a8b}>M</span>
      <div data-scamp-id="exit_lines_c4d5" className={styles.exit_lines_c4d5} aria-hidden="true">
        <div data-scamp-id="exit_b_d5e6" className={styles.exit_b_d5e6} />
        <div data-scamp-id="exit_a_e6f7" className={styles.exit_a_e6f7} />
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: ['onRemove', 'onAddB', 'onAddA'] } as const;

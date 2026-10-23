import styles from './ChainStrip.module.css';
import Button from '@/components/Button/Button';

type ChainStripProps = {
  color?: "orange" | "cyan" | "pink" | "lime" | "violet";
  state?: "normal" | "selected" | "bypassed";
  menu?: "closed" | "open";
  name?: string;
  input?: string;
  output?: string;
  plugins?: Array<{ id: string; name: string; kind: string; image: string }>;
  onAddPlugin?: (id: string) => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function ChainStrip({
  color = "orange",
  state = "normal",
  menu = "closed",
  name = "Guitar",
  input = "Input 1",
  output = "Out 1/2 · FOH",
  plugins = [
    { id: "compressor", name: "Compressor", kind: "Dynamics", image: "/assets/compression-pedal.webp" },
    { id: "fuzz", name: "The Big Fuzz", kind: "Drive", image: "/assets/fuzz-pedal.webp" },
    { id: "punk-sans", name: "Punk Sans", kind: "Drive", image: "/assets/punk-sans-pedal.webp" },
    { id: "vintage-amp", name: "Vintage Amp", kind: "Amp", image: "/assets/vintage-amp.webp" },
    { id: "modern-amp", name: "Modern Amp", kind: "Amp", image: "/assets/modern-amp.jpg" },
    { id: "bass-amp", name: "Bass Amp", kind: "Amp", image: "/assets/vintage-bass-amp.webp" },
    { id: "chorus", name: "Chorus", kind: "Modulation", image: "/assets/chorus-pedal.webp" },
    { id: "delay", name: "Delay", kind: "Time", image: "/assets/delay-pedal.webp" },
    { id: "reverb", name: "Reverb", kind: "Space", image: "/assets/reverb-pedal.webp" },
  ],
  onAddPlugin,
  icon,
  children,
  className,
}: ChainStripProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-color={color} data-state={state} data-menu={menu} data-scamp-outside="menu:open=closed" data-scamp-escape="menu:open=closed">
      <div data-scamp-id="header_7a1b" className={styles.header_7a1b}>
        <div data-scamp-id="main_8252" className={styles.main_8252}>
          <div data-scamp-id="title_row_1c2d" className={styles.title_row_1c2d}>
            <div data-scamp-id="icon_9c3d" className={styles.icon_9c3d}>{icon}</div>
            <h3 data-scamp-id="name_023e" className={styles.name_023e}>{name}</h3>
            <div data-scamp-id="head_spacer_cf60" className={styles.head_spacer_cf60} />
            <Button data-scamp-instance-id="inst_d39a" className={styles.inst_d39a} variant="icon" ariaLabel="Chain options" label="⋯" />
          </div>
          <div data-scamp-id="rect_42f0" className={styles.rect_42f0}>
            <svg data-scamp-id="mono_svg_b592" className={styles.mono_svg_b592} viewBox="0 0 24 24">
	
	<path xmlns="http://www.w3.org/2000/svg" d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>
</svg>
            <p data-scamp-id="source_47e8" className={styles.source_47e8} type="button">{input}</p>
          </div>
          <div data-scamp-id="fader_row_3e4f" className={styles.fader_row_3e4f}>
            <div data-scamp-id="vfader_4f50" className={styles.vfader_4f50}>
              <div data-scamp-id="track_5061" className={styles.track_5061}>
                <input data-scamp-id="range_7283" className={styles.range_7283} type="range" min="0" max="100" defaultValue="75" aria-label={name} />
              </div>
              <label data-scamp-id="mute_8394" className={styles.mute_8394}>
                <input data-scamp-id="mute_input_94a5" className={styles.mute_input_94a5} type="checkbox" />
                <span data-scamp-id="mute_text_a5b6" className={styles.mute_text_a5b6}>M</span>
              </label>
              <label data-scamp-id="solo_fac9" className={styles.solo_fac9}>
                <input data-scamp-id="solo_input_63d7" className={styles.solo_input_63d7} type="checkbox" />
                <span data-scamp-id="solo_text_e74c" className={styles.solo_text_e74c}>S</span>
              </label>
            </div>
          </div>
        </div>
        <div data-scamp-id="meter_container_cd1c" className={styles.meter_container_cd1c}>
          <div data-scamp-id="meter_in_274e" className={styles.meter_in_274e}>
            <div data-scamp-id="meter_in_fill_8e60" className={styles.meter_in_fill_8e60} />
          </div>
        </div>
      </div>
      <div data-scamp-id="body_14b5" className={styles.body_14b5}>
        <div data-scamp-id="lane_58f9" className={styles.lane_58f9}>{children}</div>
        <button data-scamp-id="add_btn_690a" className={styles.add_btn_690a} type="button" aria-label="Add block" data-scamp-click="menu:closed=open,open=closed">+</button>
      </div>
      <div data-scamp-id="out_panel_b3e7" className={styles.out_panel_b3e7}>
        <button data-scamp-id="out_chip_7a1c" className={styles.out_chip_7a1c} type="button">{output}</button>
        <div data-scamp-id="meter_out_8b2d" className={styles.meter_out_8b2d}>
          <div data-scamp-id="meter_out_fill_9c3e" className={styles.meter_out_fill_9c3e} />
        </div>
        <div data-scamp-id="menu_5d1a" className={styles.menu_5d1a} role="menu" aria-label="Installed plugins">
          <p data-scamp-id="menu_title_6e2b" className={styles.menu_title_6e2b}>INSTALLED PLUGINS</p>
          <ul data-scamp-id="menu_list_7f3c" className={styles.menu_list_7f3c}>
            {plugins.map((plugin) => (
              <li data-scamp-id="menu_row_804d" className={styles.menu_row_804d} key={plugin.id}>
                <button data-scamp-id="menu_item_915e" className={styles.menu_item_915e} type="button" role="menuitem" data-scamp-click="menu:open=closed" onClick={() => onAddPlugin?.(plugin.id)}>
                  <img data-scamp-id="menu_thumb_a26f" className={styles.menu_thumb_a26f} src={plugin.image} alt="" />
                  <div data-scamp-id="menu_text_b370" className={styles.menu_text_b370}>
                    <span data-scamp-id="menu_name_c481" className={styles.menu_name_c481}>{plugin.name}</span>
                    <span data-scamp-id="menu_kind_d592" className={styles.menu_kind_d592}>{plugin.kind}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onAddPlugin'] } as const;

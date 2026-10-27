import styles from './ChainStripBackup.module.css';
import Button from '@/components/Button/Button';

type ChainStripBackupProps = {
  color?: "orange" | "cyan" | "pink" | "lime" | "violet";
  state?: "normal" | "selected" | "bypassed";
  menu?: "closed" | "open";
  inmenu?: "closed" | "open";
  outmenu?: "closed" | "open";
  options?: "closed" | "open" | "confirm";
  name?: string;
  renameKey?: string;
  removeLabel?: string;
  input?: string;
  inputs?: Array<{ id: string; label: string; detail: string; current: boolean }>;
  level?: string;
  muted?: boolean;
  inputMeter?: string;
  output?: string;
  outputs?: Array<{ id: string; label: string; detail: string; current: boolean }>;
  outputMeter?: string;
  plugins?: Array<{ id: string; name: string; kind: string; image: string }>;
  menuNote?: string;
  scanning?: boolean;
  onRename?: () => void;
  onRemove?: () => void;
  onSelectInput?: (id: string) => void;
  onLevelChange?: (value: string) => void;
  onMuteToggle?: () => void;
  onSelectOutput?: (id: string) => void;
  onAddPlugin?: (id: string) => void;
  onScanPlugins?: () => void;
  onImportPlugin?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function ChainStripBackup({
  color = "orange",
  state = "normal",
  menu = "closed",
  inmenu = "closed",
  outmenu = "closed",
  options = "closed",
  name = "Guitar",
  renameKey = "",
  removeLabel = "Remove “Guitar” and its plugins",
  input = "Input 1",
  inputs = [
    { id: "1", label: "In 1", detail: "Inst 1", current: true },
    { id: "2", label: "In 2", detail: "Inst 2", current: false },
  ],
  level = "75",
  muted = false,
  inputMeter = "",
  output = "Out 1/2 · FOH",
  outputs = [
    { id: "1-2", label: "Out 1/2", detail: "Main L / Main R", current: true },
    { id: "3-4", label: "Out 3/4", detail: "Line 3 / Line 4", current: false },
  ],
  outputMeter = "",
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
  menuNote = "9 plugins installed",
  scanning = false,
  onRename,
  onRemove,
  onSelectInput,
  onLevelChange,
  onMuteToggle,
  onSelectOutput,
  onAddPlugin,
  onScanPlugins,
  onImportPlugin,
  icon,
  children,
  className,
}: ChainStripBackupProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-color={color} data-state={state} data-menu={menu} data-inmenu={inmenu} data-outmenu={outmenu} data-options={options} data-scamp-outside="menu:open=closed inmenu:open=closed outmenu:open=closed options:open=closed,confirm=closed" data-scamp-escape="menu:open=closed inmenu:open=closed outmenu:open=closed options:open=closed,confirm=closed">
      <div data-scamp-id="header_7a1b" className={styles.header_7a1b}>
        <div data-scamp-id="main_8252" className={styles.main_8252}>
          <div data-scamp-id="title_row_1c2d" className={styles.title_row_1c2d}>
            <div data-scamp-id="icon_9c3d" className={styles.icon_9c3d}>{icon}</div>
            <h3 data-scamp-id="name_023e" className={styles.name_023e} data-rename={renameKey}>{name}</h3>
            <div data-scamp-id="head_spacer_cf60" className={styles.head_spacer_cf60} />
            <div data-scamp-id="chain_opts_f12a" className={styles.chain_opts_f12a} data-scamp-click="options:closed=open,open=closed,confirm=closed menu:open=closed inmenu:open=closed outmenu:open=closed">
              <Button data-scamp-instance-id="inst_d39a" className={styles.inst_d39a} variant="icon" ariaLabel="Chain options" label="⋯" />
              <div data-scamp-id="chain_menu_0b3c" className={styles.chain_menu_0b3c} role="menu" aria-label="Chain options">
                <button data-scamp-id="rename_1c4d" className={styles.rename_1c4d} type="button" role="menuitem" data-scamp-click="options:open=closed" onClick={onRename}>Rename</button>
                <button data-scamp-id="remove_2d5e" className={styles.remove_2d5e} type="button" role="menuitem" data-scamp-click="options:open=confirm">Remove chain…</button>
                <button data-scamp-id="confirm_3e6f" className={styles.confirm_3e6f} type="button" role="menuitem" data-scamp-click="options:confirm=closed" onClick={onRemove}>{removeLabel}</button>
              </div>
            </div>
          </div>
          <div data-scamp-id="rect_42f0" className={styles.rect_42f0}>
            <svg data-scamp-id="mono_svg_b592" className={styles.mono_svg_b592} viewBox="0 0 24 24">
	
	<path xmlns="http://www.w3.org/2000/svg" d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>
</svg>
            <button data-scamp-id="source_47e8" className={styles.source_47e8} type="button" aria-haspopup="menu" data-scamp-click="inmenu:closed=open,open=closed menu:open=closed outmenu:open=closed options:open=closed,confirm=closed">{input}</button>
            <div data-scamp-id="in_menu_1a9b" className={styles.in_menu_1a9b} role="menu" aria-label="Input">
              <p data-scamp-id="in_title_2bac" className={styles.in_title_2bac}>INPUT</p>
              <ul data-scamp-id="in_list_3cbd" className={styles.in_list_3cbd}>
                {inputs.map((option) => (
                  <li data-scamp-id="in_row_4dce" className={styles.in_row_4dce} key={option.id}>
                    <button data-scamp-id="in_item_5edf" className={styles.in_item_5edf} type="button" role="menuitemradio" aria-checked={option.current} data-scamp-click="inmenu:open=closed" onClick={() => onSelectInput?.(option.id)}>
                      <span data-scamp-id="in_label_6f01" className={styles.in_label_6f01}>{option.label}</span>
                      <span data-scamp-id="in_detail_7012" className={styles.in_detail_7012}>{option.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div data-scamp-id="fader_row_3e4f" className={styles.fader_row_3e4f}>
            <div data-scamp-id="vfader_4f50" className={styles.vfader_4f50}>
              <div data-scamp-id="track_5061" className={styles.track_5061}>
                <input data-scamp-id="range_7283" className={styles.range_7283} type="range" min="0" max="100" value={level} aria-label={name} onInput={(e) => onLevelChange?.(e.currentTarget.value)} />
              </div>
              <label data-scamp-id="mute_8394" className={styles.mute_8394}>
                <input data-scamp-id="mute_input_94a5" className={styles.mute_input_94a5} type="checkbox" checked={muted} onChange={onMuteToggle} />
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
          <div data-scamp-id="meter_in_274e" className={styles.meter_in_274e} data-meter={inputMeter}>
            <div data-scamp-id="meter_in_fill_8e60" className={styles.meter_in_fill_8e60} />
          </div>
        </div>
      </div>
      <div data-scamp-id="body_14b5" className={styles.body_14b5}>
        <div data-scamp-id="lane_58f9" className={styles.lane_58f9}>{children}</div>
        <button data-scamp-id="add_btn_690a" className={styles.add_btn_690a} type="button" aria-label="Add block" data-scamp-click="menu:closed=open,open=closed inmenu:open=closed outmenu:open=closed options:open=closed,confirm=closed">+</button>
      </div>
      <div data-scamp-id="out_panel_b3e7" className={styles.out_panel_b3e7}>
        <button data-scamp-id="out_chip_7a1c" className={styles.out_chip_7a1c} type="button" aria-haspopup="menu" data-scamp-click="outmenu:closed=open,open=closed menu:open=closed inmenu:open=closed options:open=closed,confirm=closed">{output}</button>
        <div data-scamp-id="out_menu_8123" className={styles.out_menu_8123} role="menu" aria-label="Output">
          <p data-scamp-id="out_title_9234" className={styles.out_title_9234}>OUTPUT</p>
          <ul data-scamp-id="out_list_a345" className={styles.out_list_a345}>
            {outputs.map((option) => (
              <li data-scamp-id="out_row_b456" className={styles.out_row_b456} key={option.id}>
                <button data-scamp-id="out_item_c567" className={styles.out_item_c567} type="button" role="menuitemradio" aria-checked={option.current} data-scamp-click="outmenu:open=closed" onClick={() => onSelectOutput?.(option.id)}>
                  <span data-scamp-id="out_label_d678" className={styles.out_label_d678}>{option.label}</span>
                  <span data-scamp-id="out_detail_e789" className={styles.out_detail_e789}>{option.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div data-scamp-id="meter_out_8b2d" className={styles.meter_out_8b2d} data-meter={outputMeter}>
          <div data-scamp-id="meter_out_fill_9c3e" className={styles.meter_out_fill_9c3e} />
        </div>
        <div data-scamp-id="menu_5d1a" className={styles.menu_5d1a} role="menu" aria-label="Add a block">
          <p data-scamp-id="menu_title_6e2b" className={styles.menu_title_6e2b}>ADD A BLOCK</p>
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
          <p data-scamp-id="menu_note_b7e1" className={styles.menu_note_b7e1}>{menuNote}</p>
          <div data-scamp-id="menu_actions_c8f2" className={styles.menu_actions_c8f2}>
            <button data-scamp-id="menu_scan_d903" className={styles.menu_scan_d903} type="button" disabled={scanning} onClick={onScanPlugins}>Scan for plugins</button>
            <button data-scamp-id="menu_import_e014" className={styles.menu_import_e014} type="button" disabled={scanning} data-scamp-click="menu:open=closed" onClick={onImportPlugin}>Add file…</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onRename', 'onRemove', 'onSelectInput', 'onLevelChange', 'onMuteToggle', 'onSelectOutput', 'onAddPlugin', 'onScanPlugins', 'onImportPlugin'] } as const;

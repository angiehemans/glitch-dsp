import styles from './FootswitchPanel.module.css';

type FootswitchPanelProps = {
  devicemenu?: "closed" | "open";
  editing?: "closed" | "open";
  connected?: string;
  deviceName?: string;
  devices?: Array<{ id: string; name: string; current: boolean }>;
  pageLabel?: string;
  switches?: Array<{ id: string; name: string; label: string; lit: string; editing: string; tap: string; hold: string }>;
  editTitle?: string;
  canClearTap?: boolean;
  canClearHold?: boolean;
  forgetLabel?: string;
  forgetConfirm?: string;
  actions?: Array<{ id: string; name: string; tap: string; hold: string }>;
  noSwitches?: boolean;
  onSelectDevice?: (id: string) => void;
  onNoDevice?: () => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onEditSwitch?: (id: string) => void;
  onClearTap?: () => void;
  onClearHold?: () => void;
  onForget?: () => void;
  onDone?: () => void;
  onSetTap?: (id: string) => void;
  onSetHold?: (id: string) => void;
  className?: string;
};

export default function FootswitchPanel({
  devicemenu = "closed",
  editing = "open",
  connected = "on",
  deviceName = "SINCO MIDI 1",
  devices = [
    { id: "0", name: "SINCO MIDI 1", current: true },
    { id: "1", name: "Midi Through Port-0", current: false },
  ],
  pageLabel = "PAGE 1 / 1",
  switches = [
    { id: "1:20", name: "A", label: "Switch A: tap Fuzz, hold Panic", lit: "on", editing: "on", tap: "Fuzz", hold: "Panic" },
    { id: "1:21", name: "B", label: "Switch B: tap Delay, hold nothing", lit: "off", editing: "off", tap: "Delay", hold: "—" },
    { id: "1:22", name: "C", label: "Switch C: tap Next preset, hold Previous preset", lit: "off", editing: "off", tap: "Next preset", hold: "Previous preset" },
    { id: "1:23", name: "D", label: "Switch D: tap Mute Vocals, hold nothing", lit: "off", editing: "off", tap: "Mute Vocals", hold: "—" },
  ],
  editTitle = "SWITCH A · PAGE 1",
  canClearTap = true,
  canClearHold = true,
  forgetLabel = "Forget switch",
  forgetConfirm = "off",
  actions = [
    { id: "0", name: "Preset: Clean verse", tap: "off", hold: "off" },
    { id: "1", name: "Next preset", tap: "off", hold: "off" },
    { id: "2", name: "Guitar · Fuzz", tap: "on", hold: "off" },
    { id: "3", name: "Mute Guitar", tap: "off", hold: "off" },
    { id: "4", name: "Panic", tap: "off", hold: "on" },
  ],
  noSwitches = false,
  onSelectDevice,
  onNoDevice,
  onPrevPage,
  onNextPage,
  onEditSwitch,
  onClearTap,
  onClearHold,
  onForget,
  onDone,
  onSetTap,
  onSetHold,
  className,
}: FootswitchPanelProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Footswitch" data-devicemenu={devicemenu} data-editing={editing} data-scamp-outside="devicemenu:open=closed" data-scamp-escape="devicemenu:open=closed">
      <div data-scamp-id="header_1c0a" className={styles.header_1c0a}>
        <h2 data-scamp-id="title_2d1b" className={styles.title_2d1b}>Footswitch</h2>
        <div data-scamp-id="device_wrap_3e2c" className={styles.device_wrap_3e2c}>
          <button data-scamp-id="device_btn_4f3d" className={styles.device_btn_4f3d} type="button" aria-haspopup="menu" data-scamp-click="devicemenu:closed=open,open=closed">
            <span data-scamp-id="device_led_504e" className={styles.device_led_504e} data-on={connected} />
            <span data-scamp-id="device_name_615f" className={styles.device_name_615f}>{deviceName}</span>
          </button>
          <div data-scamp-id="device_menu_7260" className={styles.device_menu_7260} role="menu" aria-label="MIDI input">
            <p data-scamp-id="device_title_8371" className={styles.device_title_8371}>MIDI INPUT</p>
            <ul data-scamp-id="device_list_9482" className={styles.device_list_9482}>
              {devices.map((device) => (
                <li data-scamp-id="device_row_a593" className={styles.device_row_a593} key={device.id}>
                  <button data-scamp-id="device_item_b6a4" className={styles.device_item_b6a4} type="button" role="menuitemradio" aria-checked={device.current} data-scamp-click="devicemenu:open=closed" onClick={() => onSelectDevice?.(device.id)}>{device.name}</button>
                </li>
              ))}
            </ul>
            <button data-scamp-id="device_none_c7b5" className={styles.device_none_c7b5} type="button" role="menuitem" data-scamp-click="devicemenu:open=closed" onClick={onNoDevice}>No MIDI input</button>
          </div>
        </div>
        <div data-scamp-id="spacer_d8c6" className={styles.spacer_d8c6} />
        <button data-scamp-id="page_prev_e9d7" className={styles.page_prev_e9d7} type="button" aria-label="Previous page" onClick={onPrevPage}>‹</button>
        <span data-scamp-id="page_label_fae8" className={styles.page_label_fae8}>{pageLabel}</span>
        <button data-scamp-id="page_next_0bf9" className={styles.page_next_0bf9} type="button" aria-label="Next page" onClick={onNextPage}>›</button>
      </div>
      <ul data-scamp-id="tiles_d9c6" className={styles.tiles_d9c6}>
        {switches.map((sw) => (
          <li data-scamp-id="tile_row_45c6" className={styles.tile_row_45c6} key={sw.id}>
            <button data-scamp-id="tile_ead7" className={styles.tile_ead7} type="button" data-lit={sw.lit} data-editing={sw.editing} aria-label={sw.label} onClick={() => onEditSwitch?.(sw.id)}>
              <span data-scamp-id="tile_name_fbe8" className={styles.tile_name_fbe8}>{sw.name}</span>
              <span data-scamp-id="tile_text_7d1e" className={styles.tile_text_7d1e}>
                <span data-scamp-id="tap_label_2f1b" className={styles.tap_label_2f1b}>{sw.tap}</span>
                <span data-scamp-id="hold_row_413d" className={styles.hold_row_413d}>
                  <span data-scamp-id="hold_tag_524e" className={styles.hold_tag_524e}>Hold ·</span>
                  <span data-scamp-id="hold_label_635f" className={styles.hold_label_635f}>{sw.hold}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {noSwitches && (
        <p data-scamp-id="empty_8571" className={styles.empty_8571}>Press each footswitch once so Glitch can find it. Then click a switch here to choose what its tap and hold do.</p>
      )}
      <div data-scamp-id="switch_menu_9a1b" className={styles.switch_menu_9a1b} role="group" aria-label={editTitle}>
        <div data-scamp-id="switch_head_ab2c" className={styles.switch_head_ab2c}>
          <p data-scamp-id="switch_title_bc3d" className={styles.switch_title_bc3d}>{editTitle}</p>
          <button data-scamp-id="clear_tap_cd4e" className={styles.clear_tap_cd4e} type="button" disabled={!canClearTap} onClick={onClearTap}>Clear tap</button>
          <button data-scamp-id="clear_hold_de5f" className={styles.clear_hold_de5f} type="button" disabled={!canClearHold} onClick={onClearHold}>Clear hold</button>
          <button data-scamp-id="forget_f182" className={styles.forget_f182} type="button" data-confirm={forgetConfirm} onClick={onForget}>{forgetLabel}</button>
          <button data-scamp-id="done_ef60" className={styles.done_ef60} type="button" onClick={onDone}>Done</button>
        </div>
        <ul data-scamp-id="action_list_f071" className={styles.action_list_f071}>
          {actions.map((action) => (
            <li data-scamp-id="action_row_0182" className={styles.action_row_0182} key={action.id}>
              <span data-scamp-id="action_name_1293" className={styles.action_name_1293}>{action.name}</span>
              <button data-scamp-id="action_tap_23a4" className={styles.action_tap_23a4} type="button" data-on={action.tap} onClick={() => onSetTap?.(action.id)}>Tap</button>
              <button data-scamp-id="action_hold_34b5" className={styles.action_hold_34b5} type="button" data-on={action.hold} onClick={() => onSetHold?.(action.id)}>Hold</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onSelectDevice', 'onNoDevice', 'onPrevPage', 'onNextPage', 'onEditSwitch', 'onClearTap', 'onClearHold', 'onForget', 'onDone', 'onSetTap', 'onSetHold'] } as const;

import styles from './Routing.module.css';

type RoutingProps = {
  note?: string;
  groups?: Array<{
    id: string;
    title: string;
    note: string;
    strips: Array<{
      id: string;
      name: string;
      path: string;
      color: string;
      route: string;
      selected: string;
      selectable: boolean;
      muted: string;
      level: string;
      levelLabel: string;
      fader: boolean;
      meter: string;
      metered: boolean;
      readout: string;
      muteLabel: string;
      mutable: boolean;
    }>;
  }>;
  marks?: Array<{ id: string; label: string }>;
  sendsShown?: boolean;
  sendsTitle?: string;
  sendsHint?: string;
  cells?: Array<{ id: string; output: string; detail: string; state: string; level: string; side: string; mute: string; routed: boolean; label: string }>;
  empty?: boolean;
  onSelect?: (id: string) => void;
  onRowMute?: (id: string) => void;
  onRoute?: (id: string) => void;
  onReset?: (id: string) => void;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
};

export default function Routing({
  note = "Click a strip to edit its sends",
  groups = [
    {
      id: "chains",
      title: "Chains",
      note: "2 chains",
      strips: [
        { id: "guitar", name: "Guitar", path: "", color: "orange", route: "Out 1/2", selected: "on", selectable: true, muted: "off", level: "72", levelLabel: "Guitar level", fader: true, meter: "chain:guitar:out", metered: true, readout: "-1.0", muteLabel: "Mute Guitar", mutable: true },
        { id: "bass:A", name: "Bass", path: "A", color: "pink", route: "Out 3", selected: "off", selectable: true, muted: "on", level: "75", levelLabel: "Bass path A level", fader: false, meter: "", metered: false, readout: "Muted", muteLabel: "Mute Bass path A", mutable: true },
      ],
    },
    {
      id: "outputs",
      title: "Outputs",
      note: "MOTU M4",
      strips: [
        { id: "out:1", name: "Main L", path: "", color: "output", route: "Out 1", selected: "off", selectable: false, muted: "off", level: "75", levelLabel: "", fader: false, meter: "out:1", metered: true, readout: "", muteLabel: "", mutable: false },
        { id: "out:2", name: "Main R", path: "", color: "output", route: "Out 2", selected: "off", selectable: false, muted: "off", level: "75", levelLabel: "", fader: false, meter: "out:2", metered: true, readout: "", muteLabel: "", mutable: false },
      ],
    },
  ],
  marks = [
    { id: "10", label: "+10" },
    { id: "0", label: "0" },
    { id: "-10", label: "-10" },
    { id: "-30", label: "-30" },
    { id: "-inf", label: "-∞" },
  ],
  sendsShown = true,
  sendsTitle = "Sends: Guitar",
  sendsHint = "Click an output to send there at 0 dB. Drag a send up or down to set its level; double-click resets it.",
  cells = [
    { id: "guitar~1", output: "Out 1", detail: "Main L", state: "on", level: "0.0", side: "L", mute: "off", routed: true, label: "Guitar to Out 1" },
    { id: "guitar~2", output: "Out 2", detail: "Main R", state: "on", level: "0.0", side: "R", mute: "off", routed: true, label: "Guitar to Out 2" },
    { id: "guitar~3", output: "Out 3", detail: "Line 3", state: "muted", level: "-6.0", side: "MONO", mute: "on", routed: true, label: "Guitar to Out 3" },
    { id: "guitar~4", output: "Out 4", detail: "Line 4", state: "off", level: "", side: "", mute: "off", routed: false, label: "Send Guitar to Out 4" },
  ],
  empty = false,
  onSelect,
  onRowMute,
  onRoute,
  onReset,
  onMute,
  onRemove,
  className,
}: RoutingProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Mixer">
      <header data-scamp-id="header_1f2e" className={styles.header_1f2e}>
        <h1 data-scamp-id="title_2a3b" className={styles.title_2a3b}>Mixer</h1>
        <p data-scamp-id="hint_3b4c" className={styles.hint_3b4c}>{note}</p>
      </header>
      <div data-scamp-id="groups_7c1e" className={styles.groups_7c1e}>
        {groups.map((group) => (
          <section data-scamp-id="group_8d2f" className={styles.group_8d2f} key={group.id}>
            <div data-scamp-id="group_head_9e30" className={styles.group_head_9e30}>
              <h2 data-scamp-id="group_title_af41" className={styles.group_title_af41}>{group.title}</h2>
              <span data-scamp-id="group_note_b052" className={styles.group_note_b052}>{group.note}</span>
            </div>
            <div data-scamp-id="strips_c163" className={styles.strips_c163}>
              {group.strips.map((strip) => (
                <div data-scamp-id="strip_d274" className={styles.strip_d274} key={strip.id} data-color={strip.color} data-selected={strip.selected} data-muted={strip.muted}>
                  <button data-scamp-id="strip_head_e385" className={styles.strip_head_e385} type="button" disabled={!strip.selectable} aria-pressed={strip.selected === "on"} onClick={() => onSelect?.(strip.id)}>
                    <span data-scamp-id="strip_name_f496" className={styles.strip_name_f496}>
                      <i data-scamp-id="dot_05a7" className={styles.dot_05a7} />
                      <span data-scamp-id="name_text_16b8" className={styles.name_text_16b8}>{strip.name}</span>
                      <span data-scamp-id="path_27c9" className={styles.path_27c9}>{strip.path}</span>
                    </span>
                    <span data-scamp-id="route_38da" className={styles.route_38da}>{strip.route}</span>
                  </button>
                  <div data-scamp-id="fader_49eb" className={styles.fader_49eb}>
                    <div data-scamp-id="scale_5afc" className={styles.scale_5afc} hidden={!strip.fader} aria-hidden="true">
                      {marks.map((mark) => (
                        <span data-scamp-id="mark_6b0d" className={styles.mark_6b0d} key={mark.id} data-at={mark.id}>{mark.label}</span>
                      ))}
                    </div>
                    <div data-scamp-id="track_d81a" className={styles.track_d81a} hidden={!strip.fader} />
                    <div data-scamp-id="unity_e92b" className={styles.unity_e92b} hidden={!strip.fader} />
                    <div data-scamp-id="fill_fa3c" className={styles.fill_fa3c} hidden={!strip.fader} />
                    <input data-scamp-id="range_0b4d" className={styles.range_0b4d} type="range" min="0" max="100" value={strip.level} hidden={!strip.fader} data-level={strip.id} aria-label={strip.levelLabel} />
                    <div data-scamp-id="meter_1c5e" className={styles.meter_1c5e} hidden={!strip.metered} data-meter={strip.meter}>
                      <div data-scamp-id="meter_fill_2d6f" className={styles.meter_fill_2d6f} />
                    </div>
                  </div>
                  <span data-scamp-id="readout_3e70" className={styles.readout_3e70} data-muted={strip.muted}>{strip.readout}</span>
                  <button data-scamp-id="mute_4f81" className={styles.mute_4f81} type="button" hidden={!strip.mutable} data-on={strip.muted} aria-label={strip.muteLabel} onClick={() => onRowMute?.(strip.id)}>M</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section data-scamp-id="sends_5092" className={styles.sends_5092} hidden={!sendsShown}>
        <div data-scamp-id="sends_head_61a3" className={styles.sends_head_61a3}>
          <h2 data-scamp-id="sends_title_72b4" className={styles.sends_title_72b4}>{sendsTitle}</h2>
          <p data-scamp-id="sends_hint_83c5" className={styles.sends_hint_83c5}>{sendsHint}</p>
        </div>
        <div data-scamp-id="cells_94d6" className={styles.cells_94d6}>
          {cells.map((cell) => (
            <div data-scamp-id="cell_5e6f" className={styles.cell_5e6f} key={cell.id}>
              <span data-scamp-id="out_label_a2b3" className={styles.out_label_a2b3}>{cell.output}</span>
              <span data-scamp-id="out_detail_b3c4" className={styles.out_detail_b3c4}>{cell.detail}</span>
              <div data-scamp-id="cell_box_a5e7" className={styles.cell_box_a5e7}>
                <button data-scamp-id="cell_btn_6f70" className={styles.cell_btn_6f70} type="button" data-cell={cell.id} data-state={cell.state} aria-label={cell.label} onClick={() => onRoute?.(cell.id)} onDblClick={() => onReset?.(cell.id)}>
                  <span data-scamp-id="cell_level_7081" className={styles.cell_level_7081}>{cell.level}</span>
                  <span data-scamp-id="cell_side_8192" className={styles.cell_side_8192}>{cell.side}</span>
                </button>
                <button data-scamp-id="cell_mute_92a3" className={styles.cell_mute_92a3} type="button" hidden={!cell.routed} data-on={cell.mute} aria-label="Mute this send" onClick={() => onMute?.(cell.id)}>M</button>
                <button data-scamp-id="cell_remove_a3b4" className={styles.cell_remove_a3b4} type="button" hidden={!cell.routed} aria-label="Remove this send" onClick={() => onRemove?.(cell.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {empty && (
        <p data-scamp-id="empty_b4c5" className={styles.empty_b4c5}>No chains yet. Add one on the Rig to mix it.</p>
      )}
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onSelect', 'onRowMute', 'onRoute', 'onReset', 'onMute', 'onRemove'] } as const;

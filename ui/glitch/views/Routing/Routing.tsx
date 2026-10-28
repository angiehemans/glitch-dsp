import styles from './Routing.module.css';

type RoutingProps = {
  outputs?: Array<{ id: string; label: string; detail: string; meter: string }>;
  rows?: Array<{
    id: string;
    name: string;
    path: string;
    color: string;
    muted: string;
    muteLabel: string;
    cells: Array<{ id: string; state: string; level: string; side: string; mute: string; routed: boolean; label: string }>;
  }>;
  empty?: boolean;
  onRowMute?: (id: string) => void;
  onRoute?: (id: string) => void;
  onReset?: (id: string) => void;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
};

export default function Routing({
  outputs = [
    { id: "1", label: "OUT 1", detail: "Main L", meter: "out:1" },
    { id: "2", label: "OUT 2", detail: "Main R", meter: "out:2" },
    { id: "3", label: "OUT 3", detail: "Line 3", meter: "out:3" },
    { id: "4", label: "OUT 4", detail: "Line 4", meter: "out:4" },
  ],
  rows = [
    {
      id: "guitar",
      name: "Guitar",
      path: "",
      color: "orange",
      muted: "off",
      muteLabel: "Mute Guitar",
      cells: [
        { id: "guitar~1", state: "on", level: "0.0", side: "L", mute: "off", routed: true, label: "Guitar to Out 1" },
        { id: "guitar~2", state: "on", level: "0.0", side: "R", mute: "off", routed: true, label: "Guitar to Out 2" },
        { id: "guitar~3", state: "muted", level: "-6.0", side: "MONO", mute: "on", routed: true, label: "Guitar to Out 3" },
        { id: "guitar~4", state: "off", level: "", side: "", mute: "off", routed: false, label: "Guitar to Out 4" },
      ],
    },
    {
      id: "bass:A",
      name: "Bass",
      path: "A",
      color: "lime",
      muted: "off",
      muteLabel: "Mute Bass path A",
      cells: [
        { id: "bass:A~1", state: "off", level: "", side: "", mute: "off", routed: false, label: "Bass A to Out 1" },
        { id: "bass:A~2", state: "off", level: "", side: "", mute: "off", routed: false, label: "Bass A to Out 2" },
        { id: "bass:A~3", state: "off", level: "", side: "", mute: "off", routed: false, label: "Bass A to Out 3" },
        { id: "bass:A~4", state: "on", level: "-3.0", side: "MONO", mute: "off", routed: true, label: "Bass A to Out 4" },
      ],
    },
  ],
  empty = false,
  onRowMute,
  onRoute,
  onReset,
  onMute,
  onRemove,
  className,
}: RoutingProps) {
  return (
    <section data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Routing">
      <header data-scamp-id="header_1f2e" className={styles.header_1f2e}>
        <h1 data-scamp-id="title_2a3b" className={styles.title_2a3b}>Routing</h1>
        <p data-scamp-id="hint_3b4c" className={styles.hint_3b4c}>Click a cell to send there at 0 dB. Drag up or down to set its level; double-click resets it.</p>
      </header>
      <table data-scamp-id="matrix_5d6e" className={styles.matrix_5d6e}>
        <thead data-scamp-id="head_6e7f" className={styles.head_6e7f}>
          <tr data-scamp-id="head_row_7f80" className={styles.head_row_7f80}>
            <th data-scamp-id="corner_8091" className={styles.corner_8091}>SOURCE</th>
            {outputs.map((output) => (
              <th data-scamp-id="out_91a2" className={styles.out_91a2} key={output.id}>
                <span data-scamp-id="out_label_a2b3" className={styles.out_label_a2b3}>{output.label}</span>
                <span data-scamp-id="out_detail_b3c4" className={styles.out_detail_b3c4}>{output.detail}</span>
                <span data-scamp-id="out_meter_c4d5" className={styles.out_meter_c4d5} data-meter={output.meter}>
                  <span data-scamp-id="out_fill_d5e6" className={styles.out_fill_d5e6} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody data-scamp-id="body_e6f7" className={styles.body_e6f7}>
          {rows.map((row) => (
            <tr data-scamp-id="row_f708" className={styles.row_f708} key={row.id} data-row={row.id}>
              <th data-scamp-id="source_0819" className={styles.source_0819}>
                <span data-scamp-id="swatch_1a2a" className={styles.swatch_1a2a} data-color={row.color} />
                <span data-scamp-id="source_name_2b3c" className={styles.source_name_2b3c}>{row.name}</span>
                <span data-scamp-id="source_path_3c4d" className={styles.source_path_3c4d}>{row.path}</span>
                <button data-scamp-id="source_mute_4d5e" className={styles.source_mute_4d5e} type="button" data-on={row.muted} aria-label={row.muteLabel} onClick={() => onRowMute?.(row.id)}>M</button>
              </th>
              {row.cells.map((cell) => (
                <td data-scamp-id="cell_5e6f" className={styles.cell_5e6f} key={cell.id}>
                  <button data-scamp-id="cell_btn_6f70" className={styles.cell_btn_6f70} type="button" data-cell={cell.id} data-state={cell.state} aria-label={cell.label} onClick={() => onRoute?.(cell.id)} onDblClick={() => onReset?.(cell.id)}>
                    <span data-scamp-id="cell_level_7081" className={styles.cell_level_7081}>{cell.level}</span>
                    <span data-scamp-id="cell_side_8192" className={styles.cell_side_8192}>{cell.side}</span>
                  </button>
                  <button data-scamp-id="cell_mute_92a3" className={styles.cell_mute_92a3} type="button" hidden={!cell.routed} data-on={cell.mute} aria-label="Mute this send" onClick={() => onMute?.(cell.id)}>M</button>
                  <button data-scamp-id="cell_remove_a3b4" className={styles.cell_remove_a3b4} type="button" hidden={!cell.routed} aria-label="Remove this send" onClick={() => onRemove?.(cell.id)}>✕</button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {empty && (
        <p data-scamp-id="empty_b4c5" className={styles.empty_b4c5}>No chains yet. Add one on the Rig to route it.</p>
      )}
    </section>
  );
}

export const _scamp = { contract: 2, events: ['onRowMute', 'onRoute', 'onReset', 'onMute', 'onRemove'] } as const;

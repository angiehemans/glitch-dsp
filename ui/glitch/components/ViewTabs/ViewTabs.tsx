import styles from './ViewTabs.module.css';

type ViewTabsProps = {
  active?: "rig" | "routing" | "songs" | "perform";
  className?: string;
};

export default function ViewTabs({ active = "rig", className }: ViewTabsProps) {
  return (
    <nav data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} aria-label="Views" data-active={active}>
      <a data-scamp-id="tab_rig_5a1c" className={styles.tab_rig_5a1c} href="/rig">Rig</a>
      <a data-scamp-id="tab_routing_6b2d" className={styles.tab_routing_6b2d} href="/routing">Mixer</a>
      <a data-scamp-id="tab_songs_7c3e" className={styles.tab_songs_7c3e} href="/songs">Setlists</a>
      <a data-scamp-id="tab_perform_8d4f" className={styles.tab_perform_8d4f} href="/perform">Perform</a>
    </nav>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

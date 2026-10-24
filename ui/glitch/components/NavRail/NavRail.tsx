import styles from './NavRail.module.css';

type NavRailProps = {
  active?: "projects" | "rig";
  className?: string;
};

export default function NavRail({ active = "projects", className }: NavRailProps) {
  return (
    <nav data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-active={active}>
      <a data-scamp-id="nav_projects_1a2b" className={styles.nav_projects_1a2b} href="/">
        <span data-scamp-id="icon_projects_2b3c" className={styles.icon_projects_2b3c}>▦</span>
        <span data-scamp-id="label_projects_3c4d" className={styles.label_projects_3c4d}>Projects</span>
      </a>
      <a data-scamp-id="nav_rig_4d5e" className={styles.nav_rig_4d5e} href="/rig">
        <span data-scamp-id="icon_rig_5e6f" className={styles.icon_rig_5e6f}>≋</span>
        <span data-scamp-id="label_rig_6f70" className={styles.label_rig_6f70}>Rig</span>
      </a>
      <a data-scamp-id="nav_routing_7081" className={styles.nav_routing_7081} href="#">
        <span data-scamp-id="icon_routing_8192" className={styles.icon_routing_8192}>⊞</span>
        <span data-scamp-id="label_routing_92a3" className={styles.label_routing_92a3}>Routing</span>
      </a>
      <a data-scamp-id="nav_setlists_a3b4" className={styles.nav_setlists_a3b4} href="#">
        <span data-scamp-id="icon_setlists_b4c5" className={styles.icon_setlists_b4c5}>☰</span>
        <span data-scamp-id="label_setlists_c5d6" className={styles.label_setlists_c5d6}>Setlists</span>
      </a>
      <a data-scamp-id="nav_perform_d6e7" className={styles.nav_perform_d6e7} href="#">
        <span data-scamp-id="icon_perform_e7f8" className={styles.icon_perform_e7f8}>◉</span>
        <span data-scamp-id="label_perform_f809" className={styles.label_perform_f809}>Perform</span>
      </a>
      <div data-scamp-id="spacer_091a" className={styles.spacer_091a} />
      <a data-scamp-id="nav_settings_1a2c" className={styles.nav_settings_1a2c} href="#">
        <span data-scamp-id="icon_settings_2b3d" className={styles.icon_settings_2b3d}>⚙</span>
        <span data-scamp-id="label_settings_3c4e" className={styles.label_settings_3c4e}>Settings</span>
      </a>
    </nav>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

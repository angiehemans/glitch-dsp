import styles from './ProjectCard.module.css';
import Button from '@/components/Button/Button';

type ProjectCardProps = {
  color?: "orange" | "cyan" | "pink" | "lime" | "violet";
  state?: "default" | "current" | "opening" | "warning";
  menu?: "closed" | "open";
  name?: string;
  renameKey?: string;
  href?: string;
  lastOpened?: string;
  chainCount?: string;
  presetCount?: string;
  setlistCount?: string;
  mainOutput?: string;
  onRename?: () => void;
  className?: string;
};

export default function ProjectCard({
  color = "orange",
  state = "default",
  menu = "closed",
  name = "Full Band, IEMs",
  renameKey = "",
  href = "/rig",
  lastOpened = "Opened 2 hours ago",
  chainCount = "3",
  presetCount = "12",
  setlistCount = "2",
  mainOutput = "Main · Out 1/2",
  onRename,
  className,
}: ProjectCardProps) {
  return (
    <article data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-color={color} data-state={state} data-menu={menu} data-scamp-outside="menu:open=closed" data-scamp-escape="menu:open=closed">
      <div data-scamp-id="body_2d4f" className={styles.body_2d4f}>
        <div data-scamp-id="head_3e5a" className={styles.head_3e5a}>
          <a data-scamp-id="name_4f6b" className={styles.name_4f6b} href={href} data-rename={renameKey}>{name}</a>
          <span data-scamp-id="badge_open_5a7c" className={styles.badge_open_5a7c}>OPEN</span>
          <div data-scamp-id="options_wrap_7a2b" className={styles.options_wrap_7a2b} data-scamp-click="menu:closed=open,open=closed">
            <Button data-scamp-instance-id="inst_7f0c" variant="icon" ariaLabel="Project options" label="⋯" />
            <div data-scamp-id="options_menu_8b3c" className={styles.options_menu_8b3c} role="menu" aria-label="Project options">
              <button data-scamp-id="rename_item_9c4d" className={styles.rename_item_9c4d} type="button" role="menuitem" data-scamp-click="menu:open=closed" onClick={onRename}>Rename</button>
            </div>
          </div>
        </div>
        <p data-scamp-id="opened_7c9e" className={styles.opened_7c9e}>{lastOpened}</p>
        <div data-scamp-id="stats_8daf" className={styles.stats_8daf}>
          <div data-scamp-id="stat_9eb0" className={styles.stat_9eb0}>
            <span data-scamp-id="stat_value_a0c1" className={styles.stat_value_a0c1}>{chainCount}</span>
            <span data-scamp-id="stat_label_b1d2" className={styles.stat_label_b1d2}>CHAINS</span>
          </div>
          <div data-scamp-id="stat_c2e3" className={styles.stat_c2e3}>
            <span data-scamp-id="stat_value_d3f4" className={styles.stat_value_d3f4}>{presetCount}</span>
            <span data-scamp-id="stat_label_e405" className={styles.stat_label_e405}>PRESETS</span>
          </div>
          <div data-scamp-id="stat_f516" className={styles.stat_f516}>
            <span data-scamp-id="stat_value_0627" className={styles.stat_value_0627}>{setlistCount}</span>
            <span data-scamp-id="stat_label_1738" className={styles.stat_label_1738}>SETLISTS</span>
          </div>
        </div>
        <div data-scamp-id="footer_2849" className={styles.footer_2849}>
          <span data-scamp-id="output_chip_395a" className={styles.output_chip_395a}>{mainOutput}</span>
          <span data-scamp-id="warn_badge_4a6b" className={styles.warn_badge_4a6b}>⚠ Missing files</span>
          <div data-scamp-id="progress_5b7c" className={styles.progress_5b7c}>
            <div data-scamp-id="progress_fill_6c8d" className={styles.progress_fill_6c8d} />
          </div>
        </div>
      </div>
    </article>
  );
}

export const _scamp = { contract: 2, events: ['onRename'] } as const;

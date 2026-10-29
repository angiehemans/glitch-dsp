import styles from './Home.module.css';
import Button from '@/components/Button/Button';
import ProjectCard from '@/components/ProjectCard/ProjectCard';
import TopBar from '@/components/TopBar/TopBar';

type HomeProps = {
  showTopBar?: boolean;
  subtitle?: string;
  showSamples?: boolean;
  onNewProject?: () => void;
  setlistsSub?: string;
  setlists?: Array<{ id: string; name: string; meta: string; href: string; renameKey: string }>;
  onNewSetlist?: () => void;
  projects?: React.ReactNode;
  className?: string;
};

export default function Home({
  showTopBar = true,
  subtitle = "5 projects · most recently opened first",
  showSamples = true,
  onNewProject,
  setlistsSub = "Not tied to a project · add one to any project from its Setlists tab",
  setlists = [
    { id: "1", name: "Friday at the Crown", meta: "8 songs · 32:48", href: "/songs?setlist=1", renameKey: "" },
    { id: "2", name: "Acoustic", meta: "5 songs · 21:10", href: "/songs?setlist=2", renameKey: "" },
  ],
  onNewSetlist,
  projects,
  className,
}: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      {showTopBar && (
        <TopBar data-scamp-instance-id="inst_a7b1" className={styles.inst_a7b1} variant="home" />
      )}
      <div data-scamp-id="shell_b2c3" className={styles.shell_b2c3}>
        <main data-scamp-id="main_d4e5" className={styles.main_d4e5}>
          <div data-scamp-id="head_e5f6" className={styles.head_e5f6}>
            <div data-scamp-id="titles_f607" className={styles.titles_f607}>
              <h1 data-scamp-id="title_0718" className={styles.title_0718}>Projects</h1>
              <p data-scamp-id="sub_1829" className={styles.sub_1829}>{subtitle}</p>
            </div>
            <div data-scamp-id="head_spacer_293a" className={styles.head_spacer_293a} />
            <input data-scamp-id="search_3a4b" className={styles.search_3a4b} type="text" placeholder="Search projects" />
            <Button data-scamp-instance-id="inst_8d2a" label="+ New project" onClick={onNewProject} />
          </div>
          <div data-scamp-id="grid_6d7e" className={styles.grid_6d7e}>
            <button data-scamp-id="new_card_7e8f" className={styles.new_card_7e8f} type="button" onClick={onNewProject}>
              <span data-scamp-id="new_plus_8f90" className={styles.new_plus_8f90}>+</span>
              <span data-scamp-id="new_title_90a1" className={styles.new_title_90a1}>New project</span>
              <span data-scamp-id="new_sub_a1b2" className={styles.new_sub_a1b2}>Empty, template, or duplicate</span>
            </button>
            {showSamples && (
              <div data-scamp-id="samples_4e5f" className={styles.samples_4e5f}>
                <ProjectCard data-scamp-instance-id="inst_b3c4" className={styles.inst_b3c4} color="orange" state="current" />
                <ProjectCard data-scamp-instance-id="inst_c4d5" className={styles.inst_c4d5} color="cyan" name="Acoustic Duo" lastOpened="Opened yesterday" chainCount="2" presetCount="6" setlistCount="1" />
                <ProjectCard data-scamp-instance-id="inst_d5e6" className={styles.inst_d5e6} color="violet" state="warning" name="Solo Looper" lastOpened="Opened 3 days ago" chainCount="4" presetCount="9" setlistCount="3" mainOutput="Main · Out 3/4" />
                <ProjectCard data-scamp-instance-id="inst_e6f7" className={styles.inst_e6f7} color="lime" state="opening" name="Bass Sub Gig" lastOpened="Opened last week" chainCount="1" presetCount="4" setlistCount="1" />
                <ProjectCard data-scamp-instance-id="inst_f708" className={styles.inst_f708} color="pink" name="Home Practice" lastOpened="Opened Sep 28" chainCount="2" presetCount="18" setlistCount="0" />
              </div>
            )}
            <div data-scamp-id="cards_5f60" className={styles.cards_5f60}>{projects}</div>
          </div>
          <section data-scamp-id="setlists_1b2c" className={styles.setlists_1b2c} aria-label="Setlists">
            <div data-scamp-id="sl_head_2c3d" className={styles.sl_head_2c3d}>
              <div data-scamp-id="sl_titles_3d4e" className={styles.sl_titles_3d4e}>
                <h2 data-scamp-id="sl_title_4e5f" className={styles.sl_title_4e5f}>Setlists</h2>
                <p data-scamp-id="sl_sub_5f60" className={styles.sl_sub_5f60}>{setlistsSub}</p>
              </div>
              <button data-scamp-id="sl_new_6071" className={styles.sl_new_6071} type="button" onClick={onNewSetlist}>+ New setlist</button>
            </div>
            <ul data-scamp-id="sl_list_7182" className={styles.sl_list_7182}>
              {setlists.map((list) => (
                <li data-scamp-id="sl_row_8293" className={styles.sl_row_8293} key={list.id}>
                  <a data-scamp-id="sl_link_93a4" className={styles.sl_link_93a4} href={list.href}>
                    <span data-scamp-id="sl_name_a4b5" className={styles.sl_name_a4b5} data-rename={list.renameKey}>{list.name}</span>
                    <span data-scamp-id="sl_meta_b5c6" className={styles.sl_meta_b5c6}>{list.meta}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: ['onNewProject', 'onNewSetlist'] } as const;

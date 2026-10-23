import styles from './Home.module.css';
import Button from '@/components/Button/Button';
import NavRail from '@/components/NavRail/NavRail';
import ProjectCard from '@/components/ProjectCard/ProjectCard';
import TopBar from '@/components/TopBar/TopBar';

type HomeProps = {
  className?: string;
};

export default function Home({ className }: HomeProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <TopBar data-scamp-instance-id="inst_a7b1" variant="home" />
      <div data-scamp-id="shell_b2c3" className={styles.shell_b2c3}>
        <NavRail data-scamp-instance-id="inst_c3d4" active="projects" />
        <main data-scamp-id="main_d4e5" className={styles.main_d4e5}>
          <div data-scamp-id="head_e5f6" className={styles.head_e5f6}>
            <div data-scamp-id="titles_f607" className={styles.titles_f607}>
              <h1 data-scamp-id="title_0718" className={styles.title_0718}>Projects</h1>
              <p data-scamp-id="sub_1829" className={styles.sub_1829}>5 projects · most recently opened first</p>
            </div>
            <div data-scamp-id="head_spacer_293a" className={styles.head_spacer_293a} />
            <input data-scamp-id="search_3a4b" className={styles.search_3a4b} type="text" placeholder="Search projects" />
            <Button data-scamp-instance-id="inst_8d2a" label="+ New project" />
          </div>
          <div data-scamp-id="grid_6d7e" className={styles.grid_6d7e}>
            <button data-scamp-id="new_card_7e8f" className={styles.new_card_7e8f} type="button">
              <span data-scamp-id="new_plus_8f90" className={styles.new_plus_8f90}>+</span>
              <span data-scamp-id="new_title_90a1" className={styles.new_title_90a1}>New project</span>
              <span data-scamp-id="new_sub_a1b2" className={styles.new_sub_a1b2}>Empty, template, or duplicate</span>
            </button>
            <ProjectCard data-scamp-instance-id="inst_b3c4" className={styles.inst_b3c4} color="orange" state="current" />
            <ProjectCard data-scamp-instance-id="inst_c4d5" className={styles.inst_c4d5} color="cyan" name="Acoustic Duo" lastOpened="Opened yesterday" chainCount="2" presetCount="6" setlistCount="1" />
            <ProjectCard data-scamp-instance-id="inst_d5e6" className={styles.inst_d5e6} color="violet" state="warning" name="Solo Looper" lastOpened="Opened 3 days ago" chainCount="4" presetCount="9" setlistCount="3" mainOutput="Main · Out 3/4" />
            <ProjectCard data-scamp-instance-id="inst_e6f7" className={styles.inst_e6f7} color="lime" state="opening" name="Bass Sub Gig" lastOpened="Opened last week" chainCount="1" presetCount="4" setlistCount="1" />
            <ProjectCard data-scamp-instance-id="inst_f708" className={styles.inst_f708} color="pink" name="Home Practice" lastOpened="Opened Sep 28" chainCount="2" presetCount="18" setlistCount="0" />
          </div>
        </main>
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

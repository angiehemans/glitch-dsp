import styles from './Rig.module.css';
import AbyFork from '@/components/AbyFork/AbyFork';
import AbyPedal from '@/components/AbyPedal/AbyPedal';
import BlockTile from '@/components/BlockTile/BlockTile';
import Button from '@/components/Button/Button';
import ChainStrip from '@/components/ChainStrip/ChainStrip';
import Fader from '@/components/Fader/Fader';
import Knob from '@/components/Knob/Knob';
import Playlist from '@/components/Playlist/Playlist';
import TopBar from '@/components/TopBar/TopBar';

type RigProps = {
  content?: "sample" | "live";
  showTopBar?: boolean;
  showPlaylist?: boolean;
  onAddChain?: () => void;
  liveChains?: React.ReactNode;
  className?: string;
};

export default function Rig({
  content = "sample",
  showTopBar = true,
  showPlaylist = true,
  onAddChain,
  liveChains,
  className,
}: RigProps) {
  return (
    <div data-scamp-id="root" className={`${styles.root} ${className ?? ''}`} data-content={content}>
      {showTopBar && (
        <TopBar data-scamp-instance-id="inst_1a0b" className={styles.inst_1a0b} />
      )}
      <div data-scamp-id="shell_2b1c" className={styles.shell_2b1c}>
        <main data-scamp-id="main_4d3e" className={styles.main_4d3e}>
          <div data-scamp-id="content_5e4f" className={styles.content_5e4f}>
            {showPlaylist && (
              <Playlist data-scamp-instance-id="inst_7d2c" />
            )}
            <div data-scamp-id="chains_b4a5" className={styles.chains_b4a5}>
              <ChainStrip data-scamp-instance-id="inst_c5b6" color="orange" name="Guitar">
                <BlockTile data-scamp-instance-id="inst_d6c7" finish="cream" name="Compressor" plugin={<img data-scamp-id="pedal_comp_91e3" className={styles.pedal_comp_91e3} src="/assets/compression-pedal.webp" alt="compression-pedal.webp" />}>
                  <img data-scamp-id="img_comp_b1e2" className={styles.img_comp_b1e2} src="/assets/compression-pedal.webp" alt="compression-pedal.webp" />
                </BlockTile>
                <BlockTile data-scamp-instance-id="inst_0c1d" finish="purple" name="Fuzz" plugin={<img data-scamp-id="pedal_fuzz_9899" className={styles.pedal_fuzz_9899} src="/assets/fuzz-pedal.webp" alt="Fuzz" />}>
                  <img data-scamp-id="img_fuzz_c2f3" className={styles.img_fuzz_c2f3} src="/assets/fuzz-pedal.webp" alt="Fuzz" />
                </BlockTile>
                <AbyFork data-scamp-instance-id="inst_e7d8" mode="y" pedal={<AbyPedal data-scamp-instance-id="inst_f8e9" mode="y" />} laneB={<>
                      <BlockTile data-scamp-instance-id="inst_7062" finish="red" size="small" name="Modern Amp" plugin={<img data-scamp-id="pedal_mamp_abc9" className={styles.pedal_mamp_abc9} src="/assets/modern-amp.jpg" alt="Modern Amp" />}>
                        <img data-scamp-id="img_mamp_e415" className={styles.img_mamp_e415} src="/assets/modern-amp.jpg" alt="Modern Amp" />
                      </BlockTile>
                      <BlockTile data-scamp-instance-id="inst_d3d4" finish="cream" size="small" name="Compressor" plugin={<img data-scamp-id="pedal_comp_691a" className={styles.pedal_comp_691a} src="/assets/compression-pedal.webp" alt="Compressor" />}>
                        <img data-scamp-id="img_comp_93b1" className={styles.img_comp_93b1} src="/assets/compression-pedal.webp" alt="Compressor" />
                      </BlockTile>
                    </>} laneA={<>
                      <BlockTile data-scamp-instance-id="inst_3c2e" finish="orange" size="small" state="selected" name="Vintage Amp" plugin={<img data-scamp-id="pedal_vamp_c05b" className={styles.pedal_vamp_c05b} src="/assets/vintage-amp.webp" alt="Vintage Amp" />}>
                        <img data-scamp-id="img_vamp_d304" className={styles.img_vamp_d304} src="/assets/vintage-amp.webp" alt="Vintage Amp" />
                      </BlockTile>
                      <BlockTile data-scamp-instance-id="inst_4d3f" size="small" name="Greenback 4x12" />
                    </>} />
                <BlockTile data-scamp-instance-id="inst_1d2e" finish="blue" name="Chorus" plugin={<img data-scamp-id="pedal_chorus_2757" className={styles.pedal_chorus_2757} src="/assets/chorus-pedal.webp" alt="Chorus" />}>
                  <img data-scamp-id="img_chorus_f526" className={styles.img_chorus_f526} src="/assets/chorus-pedal.webp" alt="Chorus" />
                </BlockTile>
                <BlockTile data-scamp-instance-id="inst_a395" finish="hammer" name="Reverb" plugin={<img data-scamp-id="pedal_reverb_c5bf" className={styles.pedal_reverb_c5bf} src="/assets/reverb-pedal.webp" alt="Reverb" />}>
                  <img data-scamp-id="img_reverb_0637" className={styles.img_reverb_0637} src="/assets/reverb-pedal.webp" alt="Reverb" />
                </BlockTile>
              </ChainStrip>
              <ChainStrip data-scamp-instance-id="inst_b4a6" color="cyan" name="Vocals" input="In 2 · Vocal mic">
                <BlockTile data-scamp-instance-id="inst_d6c8" finish="green" name="Low Cut EQ" />
                <BlockTile data-scamp-instance-id="inst_c5b7" finish="cream" name="Compressor" plugin={<img data-scamp-id="pedal_comp_c0d2" className={styles.pedal_comp_c0d2} src="/assets/compression-pedal.webp" alt="Compressor" />}>
                  <img data-scamp-id="img_comp_1748" className={styles.img_comp_1748} src="/assets/compression-pedal.webp" alt="Compressor" />
                </BlockTile>
                <BlockTile data-scamp-instance-id="inst_e7d9" finish="black" state="bypassed" name="Delay" plugin={<img data-scamp-id="pedal_delay_02d3" className={styles.pedal_delay_02d3} src="/assets/delay-pedal.webp" alt="Delay" />}>
                  <img data-scamp-id="img_delay_2859" className={styles.img_delay_2859} src="/assets/delay-pedal.webp" alt="Delay" />
                </BlockTile>
                <BlockTile data-scamp-instance-id="inst_f8ea" finish="blue" state="loading" name="Reverb" plugin={<img data-scamp-id="pedal_reverb_87a7" className={styles.pedal_reverb_87a7} src="/assets/reverb-pedal.webp" alt="Reverb" />}>
                  <img data-scamp-id="img_reverb_396a" className={styles.img_reverb_396a} src="/assets/reverb-pedal.webp" alt="Reverb" />
                </BlockTile>
              </ChainStrip>
              <ChainStrip data-scamp-instance-id="inst_09fb" color="lime" state="bypassed" name="Bass" input="In 3 · Bass" output="Out 3/4 · Wedge">
                <BlockTile data-scamp-instance-id="inst_1a0d" finish="red" name="Punk Sans" plugin={<img data-scamp-id="pedal_punk_5e6c" className={styles.pedal_punk_5e6c} src="/assets/punk-sans-pedal.webp" alt="Punk Sans" />}>
                  <img data-scamp-id="img_punk_4a7b" className={styles.img_punk_4a7b} src="/assets/punk-sans-pedal.webp" alt="Punk Sans" />
                </BlockTile>
                <BlockTile data-scamp-instance-id="inst_2b1e" finish="hammer" state="error" name="Bass Amp" plugin={<img data-scamp-id="pedal_bass_e9d6" className={styles.pedal_bass_e9d6} src="/assets/vintage-bass-amp.webp" alt="Bass Amp" />}>
                  <img data-scamp-id="img_bass_5b8c" className={styles.img_bass_5b8c} src="/assets/vintage-bass-amp.webp" alt="Bass Amp" />
                </BlockTile>
              </ChainStrip>
            </div>
            <div data-scamp-id="live_chains_6a2f" className={styles.live_chains_6a2f}>{liveChains}</div>
            <Button data-scamp-instance-id="inst_9c1e" className={styles.inst_9c1e} variant="dashed" label="+ Add chain" onClick={onAddChain} />
          </div>
          <aside data-scamp-id="sheet_4d40" className={styles.sheet_4d40}>
            <div data-scamp-id="sheet_head_5e51" className={styles.sheet_head_5e51}>
              <span data-scamp-id="sheet_tag_6f62" className={styles.sheet_tag_6f62}>VST3</span>
              <h2 data-scamp-id="sheet_title_7073" className={styles.sheet_title_7073}>Vintage Amp</h2>
              <span data-scamp-id="sheet_path_8184" className={styles.sheet_path_8184}>Guitar › Splitter › Lane A</span>
              <div data-scamp-id="sheet_spacer_9295" className={styles.sheet_spacer_9295} />
              <Button data-scamp-instance-id="inst_a5f3" variant="secondary" label="MIDI learn" />
              <button data-scamp-id="sheet_bypass_b4b7" className={styles.sheet_bypass_b4b7} type="button">
                <div data-scamp-id="sheet_led_c5c8" className={styles.sheet_led_c5c8} />
                <span data-scamp-id="sheet_bypass_txt_d6d9" className={styles.sheet_bypass_txt_d6d9}>BYPASS</span>
              </button>
              <Button data-scamp-instance-id="inst_1b6e" variant="icon" ariaLabel="Close editor" label="✕" />
            </div>
            <div data-scamp-id="sheet_body_f8fb" className={styles.sheet_body_f8fb}>
              <div data-scamp-id="model_0a0c" className={styles.model_0a0c}>
                <span data-scamp-id="model_label_1b1d" className={styles.model_label_1b1d}>PLUGIN</span>
                <img data-scamp-id="plugin_img_3e4f" className={styles.plugin_img_3e4f} src="/assets/vintage-amp.webp" alt="Vintage Amp plugin" />
                <button data-scamp-id="model_picker_2c2e" className={styles.model_picker_2c2e} type="button">Open plugin window ↗</button>
                <div data-scamp-id="model_info_3d3f" className={styles.model_info_3d3f}>
                  <span data-scamp-id="info_size_4e40" className={styles.info_size_4e40}>0 ms LATENCY</span>
                  <span data-scamp-id="info_file_5f51" className={styles.info_file_5f51}>VST3 · v1.2</span>
                  <span data-scamp-id="info_cpu_6062" className={styles.info_cpu_6062}>· CPU 9%</span>
                </div>
              </div>
              <div data-scamp-id="divider_7173" className={styles.divider_7173} />
              <div data-scamp-id="knobs_8284" className={styles.knobs_8284}>
                <Knob data-scamp-instance-id="inst_9395" value="6.5" label="GAIN" />
                <Knob data-scamp-instance-id="inst_a4a6" position="low" value="3.0" label="BASS" />
                <Knob data-scamp-instance-id="inst_b5b7" value="5.0" label="MIDDLE" />
                <Knob data-scamp-instance-id="inst_c6c8" position="high" value="7.5" label="TREBLE" />
                <Knob data-scamp-instance-id="inst_d7d9" position="low" value="−4.5 dB" label="MASTER" />
              </div>
              <div data-scamp-id="divider_e2a3" className={styles.divider_e2a3} />
              <div data-scamp-id="mixer_e2a0" className={styles.mixer_e2a0}>
                <span data-scamp-id="mixer_label_e2a1" className={styles.mixer_label_e2a1}>MIXER</span>
                <div data-scamp-id="mixer_bank_e2a2" className={styles.mixer_bank_e2a2}>
                  <Fader data-scamp-instance-id="inst_e2b4" color="amber" name="Guitar" level="70" />
                  <Fader data-scamp-instance-id="inst_e2b5" color="blue" name="Vocals" level="64" />
                  <Fader data-scamp-instance-id="inst_e2b6" color="pink" name="Bass" level="58" />
                  <Fader data-scamp-instance-id="inst_e2b7" name="Master" level="75" />
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export const _scamp = { contract: 2, events: ['onAddChain'] } as const;

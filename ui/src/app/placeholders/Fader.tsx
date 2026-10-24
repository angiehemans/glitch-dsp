// Placeholder until the Scamp Fader is controllable. Props to add in Scamp:
// name, position (0..1), readout, muted, accent, onPositionChange(position), onMuteChange(muted).
// Delete this file once ui/glitch/components/Fader has them.
type FaderProps = {
  name: string;
  position: number;
  readout: string;
  muted: boolean;
  accent?: string;
  onPositionChange: (position: number) => void;
  onMuteChange: (muted: boolean) => void;
};

const MARKS = ["+10", "+5", "0", "-5", "-10", "-20", "-30", "-40", "-∞"];

export function Fader({ name, position, readout, muted, accent, onPositionChange, onMuteChange }: FaderProps) {
  return (
    <div class="gl-fader" data-muted={muted || undefined} style={accent ? { "--accent": accent } : undefined}>
      <span class="gl-fader-name">{name}</span>
      <div class="gl-fader-body">
        <div class="gl-fader-scale" aria-hidden="true">
          {MARKS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <input
          class="gl-fader-range"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={position}
          aria-label={`${name} level`}
          aria-valuetext={readout}
          onInput={(e) => onPositionChange(Number(e.currentTarget.value))}
        />
      </div>
      <output class="gl-fader-readout">{readout}</output>
      <label class="gl-fader-mute">
        <input type="checkbox" checked={muted} onChange={(e) => onMuteChange(e.currentTarget.checked)} />
        <span>MUTE</span>
      </label>
    </div>
  );
}

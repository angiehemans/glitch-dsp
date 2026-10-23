import type { Ref } from "preact";

// Placeholder until Scamp has a Meter. Props to add in Scamp:
// label, meterRef (root element; reads --level 0..1 and [data-clip]), accent, muted.
// Delete this file once ui/glitch/components/Meter exists.
type MeterProps = {
  label: string;
  meterRef: Ref<HTMLElement>;
  accent?: string;
  muted?: boolean;
};

export function Meter({ label, meterRef, accent, muted }: MeterProps) {
  return (
    <div class="gl-meter" data-muted={muted || undefined} style={accent ? { "--accent": accent } : undefined}>
      <div
        class="gl-meter-track"
        ref={meterRef as Ref<HTMLDivElement>}
        role="meter"
        aria-label={`${label} level`}
        title="Click to clear clip"
      >
        <div class="gl-meter-fill" />
      </div>
      <span class="gl-meter-label">{label}</span>
    </div>
  );
}

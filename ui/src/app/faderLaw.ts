// Scale marks from top (position 1) to bottom (position 0), evenly spaced: 0 dB sits at 0.75.
const MARKS = [10, 5, 0, -5, -10, -20, -30, -40, -Infinity];
const STEP = 1 / (MARKS.length - 1);
const LAST = MARKS.length - 2; // index of -40, the lowest finite mark
const LAST_GAIN = 10 ** (MARKS[LAST] / 20);

/** Fader position (0..1) to dB. The bottom segment is linear in gain, so it reaches -inf at 0. */
export function positionToDb(pos: number): number {
  const p = Math.min(1, Math.max(0, pos));
  const fromTop = (1 - p) / STEP;
  const i = Math.floor(fromTop);
  if (i >= LAST) {
    const g = (p / STEP) * LAST_GAIN;
    return g > 0 ? 20 * Math.log10(g) : -Infinity;
  }
  const f = fromTop - i;
  return MARKS[i] + (MARKS[i + 1] - MARKS[i]) * f;
}

/** dB to fader position (0..1). */
export function dbToPosition(db: number): number {
  if (db >= MARKS[0]) return 1;
  if (db <= MARKS[LAST]) return Math.max(0, (10 ** (db / 20) / LAST_GAIN) * STEP);
  const i = MARKS.findIndex((m, k) => db <= m && db >= MARKS[k + 1]);
  const f = (MARKS[i] - db) / (MARKS[i] - MARKS[i + 1]);
  return 1 - (i + f) * STEP;
}

/** "-3.0 dB", "+5.0 dB", "-∞". */
export function formatDb(db: number, silenceDb = -100): string {
  if (!Number.isFinite(db) || db <= silenceDb) return "-∞";
  const v = Math.abs(db) < 0.05 ? 0 : db;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
}

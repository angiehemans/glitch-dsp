// Self-check: `node --experimental-strip-types ui/src/app/faderLaw.test.ts` (Node 22.6+), or import it anywhere.
import { dbToPosition, formatDb, positionToDb } from "./faderLaw.ts";

const eq = (a: number, b: number, msg: string) => {
  if (Math.abs(a - b) > 1e-9) throw new Error(`${msg}: ${a} != ${b}`);
};

eq(positionToDb(0.75), 0, "0 dB at 0.75");
eq(positionToDb(1), 10, "top is +10");
eq(positionToDb(0.125), -40, "-40 mark");
eq(positionToDb(0.8125), 2.5, "halfway 0..+5");
if (positionToDb(0) !== -Infinity) throw new Error("bottom is -inf");
for (let p = 0.01; p <= 1; p += 0.01) eq(dbToPosition(positionToDb(p)), p, `round trip ${p}`);
eq(dbToPosition(-100), 1e-5 * 0.125 / 0.01, "deep silence near bottom");
if (formatDb(-3) !== "-3.0 dB" || formatDb(5) !== "+5.0 dB" || formatDb(-Infinity) !== "-∞" || formatDb(0) !== "0.0 dB")
  throw new Error("formatDb");
console.log("faderLaw ok");

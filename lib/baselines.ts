import type { Baselines, DailyPhysiology } from "./types";

/**
 * Averages ignore days where the metric is missing. A window with no values at
 * all returns null rather than 0, so a gap never reads as a real measurement.
 */
const avg = (xs: (number | null)[]) => {
  const present = xs.filter((x): x is number => x !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
};

const tail = (xs: DailyPhysiology[], n: number, f: (d: DailyPhysiology) => number | null) =>
  avg(xs.slice(-n).map(f));

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
const pctDelta = (a: number | null, b: number | null) =>
  a === null || b === null || b === 0 ? null : ((a - b) / b) * 100;

/** Personal baselines + trends. History is oldest-first, last entry is today. */
export function computeBaselines(history: DailyPhysiology[]): Baselines {
  const today = history[history.length - 1];
  const prior = history.slice(0, -1);

  const sleep7 = tail(prior, 7, (d) => d.sleepDuration);
  const sleep28 = tail(prior, 28, (d) => d.sleepDuration);
  const hrv7 = tail(prior, 7, (d) => d.hrv);
  const hrv28 = tail(prior, 28, (d) => d.hrv);
  const rhr7 = tail(prior, 7, (d) => d.restingHeartRate);
  const rhr28 = tail(prior, 28, (d) => d.restingHeartRate);
  const stress28 = tail(prior, 28, (d) => d.stress);

  const hrv3 = tail(history, 3, (d) => d.hrv);
  const hrvLast7 = tail(history, 7, (d) => d.hrv);
  const stress3 = tail(history, 3, (d) => d.stress);

  // Consecutive days (most recent first) where recovery is below personal
  // baseline. A decline has to be corroborated: at least two measured signals
  // pointing down, and HRV never contradicting them. One signal on its own —
  // resting HR drifting a beat above its own mean, say — is not a decline, so a
  // day with fewer than two measured signals ends the streak instead of
  // inflating it.
  let decliningDays = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const d = history[i];
    const hrvBelow = compare(d.hrv, hrv28, "below");
    const signals = [
      hrvBelow,
      compare(d.restingHeartRate, rhr28, "above"),
      compare(d.sleepDuration, sleep28, "below"),
    ];

    const measured = signals.filter((s): s is boolean => s !== null);
    const down = measured.filter(Boolean).length;
    if (measured.length < 2 || down < 2 || hrvBelow === false) break;
    decliningDays++;
  }

  const trainingLoad7 = history
    .slice(-7)
    .reduce((sum, d) => sum + d.activities.reduce((s, a) => s + a.load, 0), 0);

  return {
    sleep7,
    sleep28,
    hrv7,
    hrv28,
    rhr7,
    rhr28,
    stress28,
    sleepDelta: delta(today?.sleepDuration ?? null, sleep28),
    hrvDeltaPct: pctDelta(today?.hrv ?? null, hrv28),
    rhrDelta: delta(today?.restingHeartRate ?? null, rhr28),
    hrvTrend3: pctDelta(hrv3, hrv28),
    hrvTrend7: pctDelta(hrvLast7, hrv28),
    stressTrend3: delta(stress3, stress28),
    decliningDays,
    trainingLoad7,
  };
}

function compare(value: number | null, baseline: number | null, dir: "above" | "below") {
  if (value === null || baseline === null) return null;
  return dir === "above" ? value > baseline : value < baseline;
}

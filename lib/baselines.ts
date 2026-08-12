import type { Baselines, DailyPhysiology } from "./types";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const tail = (xs: DailyPhysiology[], n: number, f: (d: DailyPhysiology) => number) =>
  avg(xs.slice(-n).map(f));

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

  // Consecutive days (most recent first) where recovery is below personal baseline.
  let decliningDays = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const d = history[i];
    const below = d.hrv < hrv28 && (d.restingHeartRate > rhr28 || d.sleepDuration < sleep28);
    if (below) decliningDays++;
    else break;
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
    sleepDelta: today.sleepDuration - sleep28,
    hrvDeltaPct: ((today.hrv - hrv28) / hrv28) * 100,
    rhrDelta: today.restingHeartRate - rhr28,
    hrvTrend3: ((hrv3 - hrv28) / hrv28) * 100,
    hrvTrend7: ((hrvLast7 - hrv28) / hrv28) * 100,
    stressTrend3: stress3 - stress28,
    decliningDays,
    trainingLoad7,
  };
}

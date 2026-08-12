import type { Baselines, CheckIn, DailyPhysiology, ScoreResult, Status } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Drivers computed from Garmin physiology; the rest come from the check-in. */
const PHYSIOLOGY_DRIVERS = 7;

/**
 * Provisional Capacity Score (0-100). Not clinically validated.
 * Longitudinal trends are weighted more heavily than single-day abnormalities:
 * the 3-day HRV trend and consecutive-decline streak carry the largest penalties,
 * while any single acute reading is capped low.
 */
export function computeScore(
  today: DailyPhysiology,
  b: Baselines,
  checkIn: CheckIn
): ScoreResult {
  const parts: { label: string; effect: number; note: string }[] = [];
  const dataGaps: string[] = [];

  const add = (label: string, effect: number, note: string) => {
    if (effect >= 0.5) parts.push({ label, effect: -Math.round(effect * 10) / 10, note });
  };

  /**
   * A driver whose inputs are missing is recorded as a gap, not scored as zero:
   * the score reflects only what was actually measured, and `dataGaps` says what
   * it could not see.
   */
  const addIf = (
    label: string,
    inputs: (number | null)[],
    compute: (values: number[]) => { effect: number; note: string }
  ) => {
    const values = inputs.filter((v): v is number => v !== null);
    if (values.length < inputs.length) {
      dataGaps.push(label);
      return;
    }
    const { effect, note } = compute(values);
    add(label, effect, note);
  };

  addIf("Sleep vs baseline", [b.sleepDelta], ([sleepDelta]) => ({
    effect: clamp(-sleepDelta / 26, 0, 6),
    note: `${fmtMin(Math.abs(sleepDelta))} ${sleepDelta < 0 ? "below" : "above"} your 28-day baseline`,
  }));

  addIf("HRV today", [b.hrvDeltaPct, today.hrv, b.hrv28], ([deltaPct, hrv, hrv28]) => ({
    effect: clamp(-deltaPct / 4, 0, 6),
    note: `${hrv} ms vs a ${Math.round(hrv28)} ms baseline`,
  }));

  addIf("HRV 3-day trend", [b.hrvTrend3], ([trend]) => ({
    effect: clamp(-trend / 1.9, 0, 12),
    note: `3-day average ${Math.abs(Math.round(trend))}% ${trend < 0 ? "below" : "above"} baseline`,
  }));

  addIf("HRV 7-day trend", [b.hrvTrend7], ([trend]) => ({
    effect: clamp(-trend / 2.5, 0, 6),
    note: `7-day average ${Math.abs(Math.round(trend))}% ${trend < 0 ? "below" : "above"} baseline`,
  }));

  addIf("Resting heart rate", [b.rhrDelta, today.restingHeartRate], ([rhrDelta, rhr]) => ({
    effect: clamp(rhrDelta * 1.0, 0, 6),
    note: `${rhr} bpm, ${Math.abs(Math.round(rhrDelta))} bpm ${rhrDelta > 0 ? "above" : "below"} baseline`,
  }));

  addIf("Stress load", [today.stress, b.stress28], ([stress, stress28]) => ({
    effect: clamp((stress - stress28) * 0.22, 0, 5),
    note: `all-day stress ${stress} vs ${Math.round(stress28)} typical`,
  }));

  addIf("Body Battery", [today.bodyBattery], ([battery]) => ({
    effect: clamp((70 - battery) / 6, 0, 5),
    note: `started the day at ${battery}`,
  }));

  add("Consecutive decline", clamp((b.decliningDays - 1) * 2.5, 0, 8),
    `${b.decliningDays} straight days of recovery below baseline`);

  add("Recent training load", clamp((b.trainingLoad7 - 250) / 60, 0, 4),
    `7-day training load is elevated`);

  add("Subjective energy", clamp((3 - checkIn.energy) * 2.5, 0, 5), `you reported energy ${checkIn.energy}/5`);
  add("Subjective stress", clamp((checkIn.stress - 3) * 2, 0, 4), `you reported stress ${checkIn.stress}/5`);
  add("Soreness", clamp((checkIn.soreness - 2) * 1.0, 0, 4), `you reported soreness ${checkIn.soreness}/5`);

  const penalty = parts.reduce((s, p) => s + Math.abs(p.effect), 0);
  const score = Math.round(clamp(100 - penalty, 0, 100));
  const status = toStatus(score);

  // The score only penalizes what was measured, so a thin day can score high.
  // The headline says so rather than letting the number imply full confidence,
  // and a day with no physiology at all does not get to claim a status.
  const noPhysiology = dataGaps.length === PHYSIOLOGY_DRIVERS;
  const coverageNote = dataGaps.length > 0 ? " Some markers were not measured today." : "";

  const headline =
    noPhysiology
      ? "Garmin recorded no physiology for today — this reflects your check-in only."
      : status === "DEPLETED"
      ? "Your body is under meaningful strain today."
      : status === "CONSTRAINED"
      ? "Your body is carrying more load than usual today."
      : status === "BALANCED"
      ? "You are close to your normal operating range."
      : "You have real capacity available today.";

  parts.sort((a, b2) => a.effect - b2.effect);
  return {
    score,
    status,
    headline: noPhysiology ? headline : headline + coverageNote,
    drivers: parts.slice(0, 4),
    dataGaps,
  };
}

export function toStatus(score: number): Status {
  if (score >= 80) return "PRIMED";
  if (score >= 65) return "BALANCED";
  if (score >= 50) return "CONSTRAINED";
  return "DEPLETED";
}

export function fmtMin(min: number) {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

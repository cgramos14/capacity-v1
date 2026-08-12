import type { Baselines, CheckIn, DailyPhysiology, ScoreResult, Status } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
  const add = (label: string, effect: number, note: string) => {
    if (effect >= 0.5) parts.push({ label, effect: -Math.round(effect * 10) / 10, note });
  };

  add("Sleep vs baseline", clamp(-b.sleepDelta / 26, 0, 6),
    `${fmtMin(Math.abs(b.sleepDelta))} ${b.sleepDelta < 0 ? "below" : "above"} your 28-day baseline`);

  add("HRV today", clamp(-b.hrvDeltaPct / 4, 0, 6),
    `${today.hrv} ms vs a ${Math.round(b.hrv28)} ms baseline`);

  add("HRV 3-day trend", clamp(-b.hrvTrend3 / 1.9, 0, 12),
    `3-day average ${Math.abs(Math.round(b.hrvTrend3))}% ${b.hrvTrend3 < 0 ? "below" : "above"} baseline`);

  add("HRV 7-day trend", clamp(-b.hrvTrend7 / 2.5, 0, 6),
    `7-day average ${Math.abs(Math.round(b.hrvTrend7))}% ${b.hrvTrend7 < 0 ? "below" : "above"} baseline`);

  add("Resting heart rate", clamp(b.rhrDelta * 1.0, 0, 6),
    `${today.restingHeartRate} bpm, ${Math.abs(Math.round(b.rhrDelta))} bpm ${b.rhrDelta > 0 ? "above" : "below"} baseline`);

  add("Stress load", clamp((today.stress - b.stress28) * 0.22, 0, 5),
    `all-day stress ${today.stress} vs ${Math.round(b.stress28)} typical`);

  add("Body Battery", clamp((70 - today.bodyBattery) / 6, 0, 5),
    `started the day at ${today.bodyBattery}`);

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

  const headline =
    status === "DEPLETED"
      ? "Your body is under meaningful strain today."
      : status === "CONSTRAINED"
      ? "Your body is carrying more load than usual today."
      : status === "BALANCED"
      ? "You are close to your normal operating range."
      : "You have real capacity available today.";

  parts.sort((a, b2) => a.effect - b2.effect);
  return { score, status, headline, drivers: parts.slice(0, 4) };
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

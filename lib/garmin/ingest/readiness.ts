/**
 * Training Readiness export — `TrainingReadinessDTO_<start>_<end>_<userId>.json`.
 *
 * Readiness is context, not a core Capacity metric: it lands in `extras` so the
 * Capacity Score keeps computing from raw physiology. `hrvWeeklyAverage` is a
 * 7-day aggregate, so it is never used as a day's HRV.
 */
import { asArray, bool, calendarDate, positive, put, str } from "./raw";
import { emptyDay, type GarminDay } from "./types";

export function parseTrainingReadiness(
  raw: unknown,
  into: Map<string, GarminDay>,
  warnings: string[]
) {
  const records = asArray(raw);
  let parsed = 0;
  let scored = 0;

  for (const r of records) {
    const date = calendarDate(r.calendarDate);
    if (!date) continue;
    parsed++;

    const day = into.get(date) ?? emptyDay(date);
    const x = day.extras;

    const score = positive(r.score);
    if (score !== null) {
      x.readinessScore = Math.round(score);
      scored++;
    }

    const level = str(r.level);
    if (level && level !== "NONE") x.readinessLevel = level;

    const feedback = str(r.feedbackShort);
    if (feedback && feedback !== "UNKNOWN") x.readinessFeedback = feedback;

    put(x, "recoveryTimeMinutes", positive(r.recoveryTime));
    put(x, "hrvWeeklyAverage", positive(r.hrvWeeklyAverage));
    put(x, "validSleep", bool(r.validSleep));

    into.set(date, day);
  }

  if (parsed > 0 && scored === 0) {
    warnings.push(
      `Training Readiness export has ${parsed} record(s) but no readiness score (level "NONE") — Garmin had no valid sleep or HRV to score these days.`
    );
  }
  return parsed;
}

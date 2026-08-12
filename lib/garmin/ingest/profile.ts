/**
 * Biometric profile exports — `<userId>_userBioMetricProfileData.json` and
 * `<userId>_bioMetrics_latest.json`. Athlete-level facts, not daily metrics.
 * Garmin stores height in cm and weight in grams.
 */
import { asArray, positive } from "./raw";
import type { GarminProfileFacts } from "./types";

export function parseProfile(
  bioMetricProfile: unknown,
  bioMetrics: unknown
): GarminProfileFacts {
  const facts: GarminProfileFacts = { heightCm: null, weightKg: null, vo2Max: null };

  for (const r of [...asArray(bioMetricProfile), ...asArray(bioMetrics)]) {
    const height = positive(r.height);
    if (height !== null) facts.heightCm = round(height, 1);

    const weightGrams = positive(r.weight);
    if (weightGrams !== null) facts.weightKg = round(weightGrams / 1000, 1);

    const vo2 = positive(r.vo2Max ?? r.vo2MaxRunning ?? r.vo2MaxCycling);
    if (vo2 !== null) facts.vo2Max = round(vo2, 1);
  }

  return facts;
}

function round(v: number, places: number) {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

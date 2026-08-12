/**
 * UDS (User Daily Summary) export — `UDSFile_<start>_<end>.json`.
 * One record per calendar day: steps, resting HR, all-day stress, Body Battery,
 * respiration, calories and intensity minutes.
 */
import { asArray, calendarDate, num, positive, put, rec } from "./raw";
import { emptyDay, type GarminDay, type MetricSource } from "./types";

const SRC = (field: string): MetricSource => ({ file: "uds", field });

export function parseUds(raw: unknown, into: Map<string, GarminDay>, warnings: string[]) {
  const records = asArray(raw);
  let parsed = 0;

  for (const r of records) {
    const date = calendarDate(r.calendarDate);
    if (!date) continue;
    parsed++;

    const day = into.get(date) ?? emptyDay(date);
    const x = day.extras;

    // Steps
    const steps = positive(r.totalSteps);
    if (steps !== null) {
      day.steps = Math.round(steps);
      day.sources.steps = SRC("totalSteps");
    }

    // Resting heart rate — `restingHeartRate` is the value Garmin Connect displays;
    // `currentDayRestingHeartRate` is kept as context, not substituted for it.
    const rhr = positive(r.restingHeartRate);
    if (rhr !== null) {
      day.restingHeartRate = Math.round(rhr);
      day.sources.restingHeartRate = SRC("restingHeartRate");
    }
    put(x, "currentDayRestingHeartRate", positive(r.currentDayRestingHeartRate));
    put(x, "minHeartRate", positive(r.minHeartRate));
    put(x, "maxHeartRate", positive(r.maxHeartRate));

    // Energy / movement context
    put(x, "totalKilocalories", num(r.totalKilocalories));
    put(x, "activeKilocalories", num(r.activeKilocalories));
    put(x, "bmrKilocalories", num(r.bmrKilocalories));
    put(x, "distanceMeters", positive(r.totalDistanceMeters ?? r.wellnessDistanceMeters));
    put(x, "moderateIntensityMinutes", positive(r.moderateIntensityMinutes));
    put(x, "vigorousIntensityMinutes", positive(r.vigorousIntensityMinutes));
    put(x, "floorsAscendedMeters", positive(r.floorsAscendedInMeters));
    put(x, "activeSeconds", positive(r.activeSeconds));
    put(x, "highlyActiveSeconds", positive(r.highlyActiveSeconds));
    put(x, "dailyStepGoal", positive(r.dailyStepGoal));

    applyStress(r.allDayStress, day, warnings);
    applyBodyBattery(r.bodyBattery, day);
    applyRespiration(r.respiration, day);

    into.set(date, day);
  }

  if (records.length > 0 && parsed === 0) warnings.push("UDS file contained no dated records.");
  return parsed;
}

function applyStress(raw: unknown, day: GarminDay, warnings: string[]) {
  const block = rec(raw);
  if (!block) return;
  const list = Array.isArray(block.aggregatorList) ? block.aggregatorList : [];
  const total = list.map(rec).find((a) => a && a.type === "TOTAL");
  if (!total) return;

  // Garmin reports -1/-2 when there is no usable stress measurement for the window.
  const avg = positive(total.averageStressLevel);
  if (avg !== null) {
    day.stress = Math.round(avg);
    day.sources.stress = SRC("allDayStress.aggregatorList[TOTAL].averageStressLevel");
  }

  const x = day.extras;
  put(x, "maxStressLevel", positive(total.maxStressLevel));
  put(x, "stressDurationSeconds", positive(total.stressDuration));
  put(x, "restDurationSeconds", positive(total.restDuration));
  put(x, "stressOffWristCount", positive(total.stressOffWristCount));
  put(x, "totalStressCount", positive(total.totalStressCount));

  const off = positive(total.stressOffWristCount);
  const all = positive(total.totalStressCount);
  if (off !== null && all !== null && all > 0 && off / all > 0.5) {
    x.lowWearCoverage = true;
    warnings.push(
      `${day.date}: watch was off-wrist for ${Math.round((off / all) * 100)}% of stress samples — stress and Body Battery are partial.`
    );
  }
}

function applyBodyBattery(raw: unknown, day: GarminDay) {
  const block = rec(raw);
  if (!block) return;
  const list = Array.isArray(block.bodyBatteryStatList) ? block.bodyBatteryStatList : [];
  const stat = (type: string) => {
    const hit = list.map(rec).find((s) => s && s.bodyBatteryStatType === type);
    return hit ? positive(hit.statsValue) : null;
  };

  // Capacity's `bodyBattery` is the morning value: Garmin's STARTOFDAY stat.
  // If Garmin did not record one, the day stays null rather than borrowing HIGHEST.
  const start = stat("STARTOFDAY");
  if (start !== null) {
    day.bodyBattery = Math.round(start);
    day.sources.bodyBattery = SRC("bodyBattery.bodyBatteryStatList[STARTOFDAY]");
  }

  const x = day.extras;
  put(x, "bodyBatteryHigh", stat("HIGHEST"));
  put(x, "bodyBatteryLow", stat("LOWEST"));
  put(x, "bodyBatteryMostRecent", stat("MOSTRECENT"));
  put(x, "bodyBatteryCharged", positive(block.chargedValue));
  put(x, "bodyBatteryDrained", positive(block.drainedValue));
}

function applyRespiration(raw: unknown, day: GarminDay) {
  const block = rec(raw);
  if (!block) return;
  const x = day.extras;
  put(x, "avgWakingRespiration", positive(block.avgWakingRespirationValue));
  put(x, "highestRespiration", positive(block.highestRespirationValue));
  put(x, "lowestRespiration", positive(block.lowestRespirationValue));
}

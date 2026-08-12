/**
 * Sleep export — `<start>_<end>_<userId>_sleepData.json`.
 *
 * Records vary a lot: a night with a synced device carries a `dailySleepDTO`
 * (duration, stages, sleep score, overnight HRV); a night without one can be as
 * thin as `{"retro": false}`, and nap-only days carry just a `napList`. Thin
 * records contribute nothing — they never become a zero-minute night.
 */
import { asArray, calendarDate, num, positive, put, rec, secondsToMinutes, str } from "./raw";
import type { Rec } from "./raw";
import { emptyDay, type GarminDay, type MetricSource } from "./types";

const SRC = (field: string): MetricSource => ({ file: "sleep", field });

export function parseSleep(raw: unknown, into: Map<string, GarminDay>, warnings: string[]) {
  const records = asArray(raw);
  let nights = 0;
  let naps = 0;

  for (const r of records) {
    const dto = rec(r.dailySleepDTO) ?? (r.sleepTimeSeconds !== undefined ? r : null);
    if (dto) {
      const date = calendarDate(dto.calendarDate ?? r.calendarDate);
      if (date && applyNight(dto, into, date)) nights++;
    }

    for (const nap of Array.isArray(r.napList) ? r.napList : []) {
      const n = rec(nap);
      if (!n) continue;
      const date = calendarDate(n.calendarDate ?? n.napStartTimestampGMT);
      const minutes = secondsToMinutes(n.napTimeSec);
      if (!date || minutes === null) continue;
      const day = into.get(date) ?? emptyDay(date);
      day.extras.napMinutes = (day.extras.napMinutes ?? 0) + minutes;
      into.set(date, day);
      naps++;
    }
  }

  if (records.length > 0 && nights === 0) {
    warnings.push(
      `Sleep export has ${records.length} record(s) but no scored nights (no dailySleepDTO) — sleep duration, sleep score and overnight HRV are unavailable.`
    );
  }
  return nights + naps;
}

function applyNight(dto: Rec, into: Map<string, GarminDay>, date: string): boolean {
  const duration = secondsToMinutes(dto.sleepTimeSeconds);
  const day = into.get(date) ?? emptyDay(date);
  let used = false;

  if (duration !== null) {
    day.sleepDuration = duration;
    day.sources.sleepDuration = SRC("dailySleepDTO.sleepTimeSeconds");
    used = true;
  }

  const score = sleepScore(dto);
  if (score !== null) {
    day.sleepScore = Math.round(score);
    day.sources.sleepScore = SRC("dailySleepDTO.sleepScores.overall.value");
    used = true;
  }

  // Overnight HRV is the only daily HRV Garmin puts in the file exports.
  const hrv = positive(dto.avgOvernightHrv);
  if (hrv !== null) {
    day.hrv = Math.round(hrv);
    day.sources.hrv = SRC("dailySleepDTO.avgOvernightHrv");
    used = true;
  }

  const x = day.extras;
  put(x, "deepSleepMinutes", secondsToMinutes(dto.deepSleepSeconds));
  put(x, "lightSleepMinutes", secondsToMinutes(dto.lightSleepSeconds));
  put(x, "remSleepMinutes", secondsToMinutes(dto.remSleepSeconds));
  put(x, "awakeMinutes", secondsToMinutes(dto.awakeSleepSeconds));
  put(x, "awakeCount", positive(dto.awakeCount));
  put(x, "restlessMomentsCount", positive(dto.restlessMomentsCount));
  put(x, "averageSpo2", positive(dto.averageSpO2Value ?? dto.averageSpo2Value));
  put(x, "sleepStartLocal", str(dto.sleepStartTimestampLocal));
  put(x, "sleepEndLocal", str(dto.sleepEndTimestampLocal));

  // Some exports carry the night's resting HR here; only use it if UDS had none.
  const restingHr = positive(dto.restingHeartRate);
  if (restingHr !== null && day.restingHeartRate === null) {
    day.restingHeartRate = Math.round(restingHr);
    day.sources.restingHeartRate = SRC("dailySleepDTO.restingHeartRate");
    used = true;
  }

  into.set(date, day);
  return used;
}

function sleepScore(dto: Rec): number | null {
  const scores = rec(dto.sleepScores);
  const overall = scores ? rec(scores.overall) : null;
  return positive(overall ? overall.value : null) ?? positive(dto.sleepScore) ?? num(dto.overallSleepScore);
}

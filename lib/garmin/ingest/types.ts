/**
 * Garmin export ingestion — types.
 *
 * This layer is deliberately isolated from the rest of Capacity. It turns raw
 * Garmin Connect *export files* into a normalized, nullable day record. When
 * Garmin Developer API access is approved, only the parsers in this folder are
 * replaced: `GarminDay` and `toDailyPhysiology()` stay the contract with the app.
 *
 * Rule: a metric that is not present in the export stays `null`. Nothing is
 * estimated, interpolated, or carried forward.
 */

/** Metrics of Capacity's DailyPhysiology that Garmin can supply. */
export type MetricKey =
  | "sleepDuration"
  | "sleepScore"
  | "hrv"
  | "restingHeartRate"
  | "stress"
  | "bodyBattery"
  | "steps";

export const CORE_METRICS: MetricKey[] = [
  "sleepDuration",
  "sleepScore",
  "hrv",
  "restingHeartRate",
  "stress",
  "bodyBattery",
  "steps",
];

/** Which export file and field a value came from. */
export interface MetricSource {
  file: GarminFileKind;
  field: string;
}

export type GarminFileKind =
  | "uds"
  | "sleep"
  | "trainingReadiness"
  | "bioMetricProfile"
  | "bioMetrics"
  | "unknown";

/** Non-core Garmin context preserved verbatim. Every field is optional. */
export interface GarminDayExtras {
  // UDS activity / energy
  totalKilocalories?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  distanceMeters?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  floorsAscendedMeters?: number;
  activeSeconds?: number;
  highlyActiveSeconds?: number;
  dailyStepGoal?: number;

  // UDS heart rate
  minHeartRate?: number;
  maxHeartRate?: number;
  currentDayRestingHeartRate?: number;

  // UDS stress
  maxStressLevel?: number;
  stressDurationSeconds?: number;
  restDurationSeconds?: number;
  stressOffWristCount?: number;
  totalStressCount?: number;

  // UDS Body Battery
  bodyBatteryHigh?: number;
  bodyBatteryLow?: number;
  bodyBatteryMostRecent?: number;
  bodyBatteryCharged?: number;
  bodyBatteryDrained?: number;

  // UDS respiration
  avgWakingRespiration?: number;
  highestRespiration?: number;
  lowestRespiration?: number;

  // Sleep
  deepSleepMinutes?: number;
  lightSleepMinutes?: number;
  remSleepMinutes?: number;
  awakeMinutes?: number;
  awakeCount?: number;
  restlessMomentsCount?: number;
  sleepStartLocal?: string;
  sleepEndLocal?: string;
  averageSpo2?: number;
  napMinutes?: number;

  // Training readiness
  readinessScore?: number;
  readinessLevel?: string;
  readinessFeedback?: string;
  recoveryTimeMinutes?: number;
  /** Garmin's 7-day HRV average from the readiness DTO. Not a daily HRV value. */
  hrvWeeklyAverage?: number;
  validSleep?: boolean;

  /** True when the day carried wellness data but the wearable was largely off-wrist. */
  lowWearCoverage?: boolean;
}

/** One normalized Garmin day. `null` means "not in the export", never "zero". */
export interface GarminDay {
  date: string; // YYYY-MM-DD
  sleepDuration: number | null; // minutes
  sleepScore: number | null; // 0-100
  hrv: number | null; // ms (overnight average)
  restingHeartRate: number | null; // bpm
  stress: number | null; // 0-100 all-day average
  bodyBattery: number | null; // 0-100 start-of-day value
  steps: number | null;
  extras: GarminDayExtras;
  sources: Partial<Record<MetricKey, MetricSource>>;
}

/** Athlete-level facts from the biometric profile export. */
export interface GarminProfileFacts {
  heightCm: number | null;
  weightKg: number | null;
  vo2Max: number | null;
}

export interface MetricCoverage {
  metric: MetricKey;
  daysWithValue: number;
  firstDate: string | null;
  lastDate: string | null;
  source: MetricSource | null;
}

export interface IngestResult {
  /** Oldest first. */
  days: GarminDay[];
  profile: GarminProfileFacts;
  coverage: MetricCoverage[];
  /** Metrics absent from every day in the export. */
  missingMetrics: MetricKey[];
  filesParsed: { kind: GarminFileKind; records: number; name?: string }[];
  warnings: string[];
}

/** Raw export payloads, keyed by file kind. Each is unvalidated JSON. */
export interface GarminExportBundle {
  uds?: unknown;
  sleep?: unknown;
  trainingReadiness?: unknown;
  bioMetricProfile?: unknown;
  bioMetrics?: unknown;
}

export function emptyDay(date: string): GarminDay {
  return {
    date,
    sleepDuration: null,
    sleepScore: null,
    hrv: null,
    restingHeartRate: null,
    stress: null,
    bodyBattery: null,
    steps: null,
    extras: {},
    sources: {},
  };
}

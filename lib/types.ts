export type ActivityType = "rest" | "zone2" | "moderate_lift" | "heavy_lift" | "intervals";

export interface Activity {
  type: ActivityType;
  label: string;
  durationMin: number;
  load: number; // relative training load 0-100
}

/**
 * Normalized internal schema. Demo + live Garmin both map into this.
 * `null` means the source had no value for that day — it is never a zero,
 * an estimate, or a value carried over from another day.
 */
export interface DailyPhysiology {
  date: string; // YYYY-MM-DD
  sleepDuration: number | null; // minutes
  sleepScore: number | null; // 0-100
  hrv: number | null; // ms
  restingHeartRate: number | null; // bpm
  stress: number | null; // 0-100 (Garmin all-day stress avg)
  bodyBattery: number | null; // 0-100 (morning value)
  steps: number | null;
  activities: Activity[];
}

export interface CheckIn {
  energy: number; // 1-5
  stress: number; // 1-5
  soreness: number; // 1-5
  workout: ActivityType;
}

/** `null` on any field means the history had no data to compute it from. */
export interface Baselines {
  sleep7: number | null;
  sleep28: number | null;
  hrv7: number | null;
  hrv28: number | null;
  rhr7: number | null;
  rhr28: number | null;
  stress28: number | null;
  sleepDelta: number | null; // today vs 28d, minutes
  hrvDeltaPct: number | null;
  rhrDelta: number | null;
  hrvTrend3: number | null; // pct change of 3d avg vs 28d
  hrvTrend7: number | null;
  stressTrend3: number | null;
  decliningDays: number; // consecutive days of declining recovery
  trainingLoad7: number;
}

export type Status = "PRIMED" | "BALANCED" | "CONSTRAINED" | "DEPLETED";

export interface ScoreResult {
  score: number;
  status: Status;
  headline: string;
  drivers: { label: string; effect: number; note: string }[];
  /** Drivers that could not be evaluated because the data was not available. */
  dataGaps: string[];
}

export interface Decision {
  id: string;
  title: string;
  targetLabel: string;
  target: string;
  body: string;
  why: string;
  cta: string;
}

export interface Brief {
  date: string;
  score: ScoreResult;
  narrative: string[];
  decisions: Decision[];
  metrics: { label: string; value: string; delta: string; direction: "up" | "down" | "flat" }[];
}

export type Outcome = "helped" | "neutral" | "hurt";

export interface DayRecord {
  date: string;
  physiology: DailyPhysiology;
  checkIn: CheckIn;
  score: number;
  status: Status;
  primaryRecommendation: string;
  workoutDecision?: "approved" | "modified" | "rejected";
  feedback?: Outcome;
  note?: string;
}

export interface Profile {
  goal: string;
  trainingDays: number;
  bedtime: string;
  waketime: string;
  workIntensity: string;
  travel: string;
  nutritionPreferences: string;
  commonFoods: string;
}

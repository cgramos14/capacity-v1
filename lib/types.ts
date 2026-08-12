export type ActivityType = "rest" | "zone2" | "moderate_lift" | "heavy_lift" | "intervals";

export interface Activity {
  type: ActivityType;
  label: string;
  durationMin: number;
  load: number; // relative training load 0-100
}

/** Normalized internal schema. Demo + live Garmin both map into this. */
export interface DailyPhysiology {
  date: string; // YYYY-MM-DD
  sleepDuration: number; // minutes
  sleepScore: number; // 0-100
  hrv: number; // ms
  restingHeartRate: number; // bpm
  stress: number; // 0-100 (Garmin all-day stress avg)
  bodyBattery: number; // 0-100 (morning value)
  steps: number;
  activities: Activity[];
}

export interface CheckIn {
  energy: number; // 1-5
  stress: number; // 1-5
  soreness: number; // 1-5
  workout: ActivityType;
}

export interface Baselines {
  sleep7: number;
  sleep28: number;
  hrv7: number;
  hrv28: number;
  rhr7: number;
  rhr28: number;
  stress28: number;
  sleepDelta: number; // today vs 28d, minutes
  hrvDeltaPct: number;
  rhrDelta: number;
  hrvTrend3: number; // pct change of 3d avg vs 28d
  hrvTrend7: number;
  stressTrend3: number;
  decliningDays: number; // consecutive days of declining recovery
  trainingLoad7: number;
}

export type Status = "PRIMED" | "BALANCED" | "CONSTRAINED" | "DEPLETED";

export interface ScoreResult {
  score: number;
  status: Status;
  headline: string;
  drivers: { label: string; effect: number; note: string }[];
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

/* ---------------------------------------------------------------------------
 * Calendar context. Contextual workload only — not a medical or clinical model.
 * ------------------------------------------------------------------------- */

export type EventCategory =
  | "Deep Work"
  | "Internal Meeting"
  | "Client Meeting"
  | "Presentation"
  | "Interview"
  | "Dinner"
  | "Travel"
  | "Personal"
  | "Workout";

export type EventIntensity = "Low" | "Moderate" | "High";

export type LocationType = "Remote" | "Office" | "Offsite" | "Airport" | "Restaurant" | "Other";

/** Normalized calendar event. Demo + future Google/Microsoft providers map into this. */
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // YYYY-MM-DDTHH:MM (local, no timezone conversion)
  endTime: string;
  category: EventCategory;
  intensity: EventIntensity;
  locationType: LocationType;
  travelRelated: boolean;
}

export type LoadStatus = "Low" | "Moderate" | "High" | "Extreme";

export interface CalendarLoad {
  date: string;
  score: number; // 0-100 contextual demand
  status: LoadStatus;
  meetingCount: number;
  scheduledMinutes: number;
  scheduledHours: number;
  highIntensityEvents: number;
  longestMeetingBlock: number; // minutes
  earlyStart?: string; // HH:MM of first commitment
  lateFinish?: string; // HH:MM of last commitment
  travelToday: boolean;
  travelWithin24h: boolean;
  nextTravel?: { title: string; time: string; tomorrow: boolean; early: boolean };
  recoveryWindows: number; // gaps of 90+ minutes between commitments
  openAfternoon: boolean; // nothing scheduled after 1 PM
  hardestBlockStart?: string; // HH:MM start of the first high-intensity commitment
  eveningEvent?: { title: string; endTime: string };
  drivers: { label: string; effect: number }[];
}

export type CalendarScenarioId = "high_stress" | "light" | "travel";

export interface CalendarScenario {
  id: CalendarScenarioId;
  label: string;
  blurb: string;
}

export interface Brief {
  date: string;
  score: ScoreResult;
  narrative: string[];
  decisions: Decision[];
  metrics: { label: string; value: string; delta: string; direction: "up" | "down" | "flat" }[];
  calendar?: CalendarLoad;
  contextLine?: string;
  demandSummary?: string;
  inferences: string[];
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
  /** Contextual demand saved alongside physiology so patterns can be mined later. */
  calendar?: {
    scenario: CalendarScenarioId;
    loadScore: number;
    loadStatus: LoadStatus;
    meetingCount: number;
    scheduledHours: number;
    travelWithin24h: boolean;
  };
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

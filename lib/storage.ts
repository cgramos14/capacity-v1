import type { CalendarScenarioId, DayRecord, Profile } from "./types";

/** Thin key/value store. Swap this module for Supabase later; the API stays the same. */
const KEYS = {
  records: "capacity.records",
  profile: "capacity.profile",
  scenario: "capacity.calendarScenario",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const DEFAULT_PROFILE: Profile = {
  goal: "Physical performance",
  trainingDays: 4,
  bedtime: "22:45",
  waketime: "06:15",
  workIntensity: "High",
  travel: "Monthly",
  nutritionPreferences: "",
  commonFoods: "",
};

export const store = {
  getProfile: () => read<Profile>(KEYS.profile, DEFAULT_PROFILE),
  saveProfile: (p: Profile) => write(KEYS.profile, p),

  /** Which demo calendar scenario is active. Demo Mode only. */
  getScenario: () => read<CalendarScenarioId>(KEYS.scenario, "high_stress"),
  saveScenario: (s: CalendarScenarioId) => write(KEYS.scenario, s),

  getRecords: () => read<DayRecord[]>(KEYS.records, []),
  getRecord: (date: string) => store.getRecords().find((r) => r.date === date),
  upsertRecord: (rec: DayRecord) => {
    const all = store.getRecords().filter((r) => r.date !== rec.date);
    all.push(rec);
    all.sort((a, b) => a.date.localeCompare(b.date));
    write(KEYS.records, all);
    return all;
  },
  patchRecord: (date: string, patch: Partial<DayRecord>) => {
    const all = store.getRecords().map((r) => (r.date === date ? { ...r, ...patch } : r));
    write(KEYS.records, all);
    return all;
  },
};

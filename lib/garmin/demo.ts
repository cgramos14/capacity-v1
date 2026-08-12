import type { Activity, DailyPhysiology } from "@/lib/types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const LIFT: Activity = { type: "heavy_lift", label: "Heavy lower body", durationMin: 65, load: 78 };
const MOD: Activity = { type: "moderate_lift", label: "Upper body", durationMin: 55, load: 52 };
const Z2: Activity = { type: "zone2", label: "Zone 2 ride", durationMin: 45, load: 34 };

/** 30 days of realistic synthetic Garmin-style history ending in the demo scenario. */
export function generateDemoHistory(today = new Date()): DailyPhysiology[] {
  const rand = rng(20240811);
  const days: DailyPhysiology[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const n = () => rand() - 0.5;

    // Baseline-ish healthy days: ~7h18m sleep, HRV ~56, RHR ~56, stress ~34
    let sleep = 438 + n() * 60;
    let hrv = 56 + n() * 8;
    let rhr = 56 + n() * 4;
    let stress = 34 + n() * 12;
    let battery = 74 + n() * 16;
    let steps = 8600 + n() * 4000;

    const activities: Activity[] = [];
    if (dow === 1 || dow === 4) activities.push(LIFT);
    else if (dow === 2 || dow === 5) activities.push(MOD);
    else if (dow === 6) activities.push(Z2);

    // Cumulative decline over the final three days.
    if (i === 3) {
      sleep = 448; hrv = 58; rhr = 55; stress = 32; battery = 79;
    } else if (i === 2) {
      sleep = 402; hrv = 52; rhr = 58; stress = 41; battery = 62; steps = 9100;
    } else if (i === 1) {
      sleep = 388; hrv = 49; rhr = 60; stress = 45; battery = 55; steps = 7400;
    } else if (i === 0) {
      sleep = 372; hrv = 47; rhr = 61; stress = 48; battery = 49; steps = 0;
      activities.length = 0;
    }

    days.push({
      date: isoDate(d),
      sleepDuration: Math.round(sleep),
      sleepScore: Math.max(35, Math.min(95, Math.round(sleep / 6 + (hrv - 50) * 0.6))),
      hrv: Math.round(hrv),
      restingHeartRate: Math.round(rhr),
      stress: Math.round(stress),
      bodyBattery: Math.round(battery),
      steps: Math.round(steps),
      activities,
    });
  }
  return days;
}

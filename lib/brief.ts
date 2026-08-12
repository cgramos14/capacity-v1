import { computeBaselines } from "./baselines";
import { computeScore, fmtMin } from "./score";
import type { Brief, CheckIn, DailyPhysiology, Decision, Profile } from "./types";

const WORKOUT_LABEL: Record<string, string> = {
  rest: "Rest",
  zone2: "Zone 2",
  moderate_lift: "Moderate lift",
  heavy_lift: "Heavy lift",
  intervals: "Intervals",
};

export function buildBrief(
  history: DailyPhysiology[],
  checkIn: CheckIn,
  profile?: Profile
): Brief {
  const today = history[history.length - 1];
  const b = computeBaselines(history);
  const score = computeScore(today, b, checkIn);

  const heavy = checkIn.workout === "heavy_lift" || checkIn.workout === "intervals";
  const strained = score.status === "CONSTRAINED" || score.status === "DEPLETED";

  const narrative: string[] = [
    `You slept ${fmtMin(today.sleepDuration)} last night and your HRV is ${Math.abs(
      Math.round(b.hrvDeltaPct)
    )}% ${b.hrvDeltaPct < 0 ? "below" : "above"} your 28-day baseline. Resting heart rate is ${
      b.rhrDelta > 0 ? `elevated at ${today.restingHeartRate} bpm` : `${today.restingHeartRate} bpm, in range`
    }.`,
    b.decliningDays >= 2
      ? `One poor night alone would not be particularly meaningful, but this is your ${ordinal(
          b.decliningDays
        )} consecutive day of declining recovery.`
      : `This looks like a single off night rather than a pattern — your 7-day trend is still ${
          b.hrvTrend7 < -3 ? "drifting down" : "holding"
        }.`,
    strained && heavy
      ? `You can still perform today, but adding a ${WORKOUT_LABEL[
          checkIn.workout
        ].toLowerCase()} session at full volume would increase an already elevated physiological load.`
      : strained
      ? `You can still perform today. Protecting recovery now is what keeps the rest of the week intact.`
      : `Your planned ${WORKOUT_LABEL[checkIn.workout].toLowerCase()} session is well matched to where your body is today.`,
  ];

  const bedtime = targetBedtime(profile?.waketime ?? "06:15", strained);

  const decisions: Decision[] = [
    {
      id: "training",
      title: strained && heavy ? "Reduce training load" : heavy ? "Train as planned" : "Keep today light",
      targetLabel: "Adjustment",
      target:
        strained && heavy
          ? "Heavy lower body → moderate lower body"
          : heavy
          ? "Planned session, full volume"
          : `${WORKOUT_LABEL[checkIn.workout]} as planned`,
      body:
        strained && heavy
          ? "Reduce today's planned volume by approximately 25%."
          : "Hold your planned volume and keep intensity honest.",
      why:
        strained
          ? `HRV is below baseline, resting heart rate is ${b.rhrDelta > 0 ? "elevated" : "near normal"}, and recovery has declined for ${b.decliningDays} day${b.decliningDays === 1 ? "" : "s"}.`
          : `Recovery markers are close to your personal baseline and 7-day trends are stable.`,
      cta: "Adjust workout",
    },
    {
      id: "fuel",
      title: "Fuel earlier",
      targetLabel: "Target",
      target: "Increase carbohydrate intake earlier in the day.",
      body:
        "Capacity does not know your exact intake, so treat this as a direction rather than a prescription: shift more of your carbohydrate toward breakfast and the pre-training meal, and avoid training fasted today.",
      why: `Short sleep and elevated stress typically reduce tolerance for under-fueling, and you are training ${
        checkIn.workout === "rest" ? "later this week" : "today"
      }.`,
      cta: "Build nutrition plan",
    },
    {
      id: "sleep",
      title: "Protect tonight",
      targetLabel: "Target bedtime",
      target: bedtime,
      body:
        "Set a hard stop on work, dim lights and screens 45 minutes before bed, and keep caffeine before 12pm tomorrow.",
      why:
        "Sleep is the highest-leverage intervention available today. Extending sleep is the fastest way to move HRV and resting heart rate back toward baseline and stop a multi-day decline from compounding.",
      cta: "Protect evening",
    },
  ];

  const metrics: Brief["metrics"] = [
    {
      label: "Sleep",
      value: fmtMin(today.sleepDuration),
      delta: `${b.sleepDelta < 0 ? "↓" : "↑"} ${fmtMin(b.sleepDelta)} vs baseline`,
      direction: b.sleepDelta < 0 ? "down" : "up",
    },
    {
      label: "HRV",
      value: `${today.hrv} ms`,
      delta: `${b.hrvDeltaPct < 0 ? "↓" : "↑"} ${Math.abs(Math.round(b.hrvDeltaPct))}%`,
      direction: b.hrvDeltaPct < 0 ? "down" : "up",
    },
    {
      label: "Resting HR",
      value: `${today.restingHeartRate} bpm`,
      delta: `${b.rhrDelta > 0 ? "↑" : "↓"} ${Math.abs(Math.round(b.rhrDelta))} bpm`,
      direction: b.rhrDelta > 0 ? "up" : "down",
    },
    {
      label: "Stress",
      value: today.stress > b.stress28 + 8 ? "Elevated" : "Typical",
      delta: `3-day trend ${b.stressTrend3 > 0 ? "↑" : "↓"}`,
      direction: b.stressTrend3 > 0 ? "up" : "down",
    },
  ];

  return { date: today.date, score, narrative, decisions, metrics };
}

function ordinal(n: number) {
  return ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"][n - 1] ?? `${n}th`;
}

function targetBedtime(wake: string, strained: boolean) {
  const [h, m] = wake.split(":").map(Number);
  const need = strained ? 8.75 : 8;
  let mins = h * 60 + m - need * 60;
  if (mins < 0) mins += 1440;
  const hh = Math.floor(mins / 60) % 24;
  const mm = Math.round(mins % 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

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

  // Each clause is written only from metrics that exist for today; whatever
  // Garmin did not record is simply left unsaid.
  const clauses = [
    today.sleepDuration !== null ? `You slept ${fmtMin(today.sleepDuration)} last night` : null,
    b.hrvDeltaPct !== null
      ? `your HRV is ${Math.abs(Math.round(b.hrvDeltaPct))}% ${
          b.hrvDeltaPct < 0 ? "below" : "above"
        } your 28-day baseline`
      : null,
    today.restingHeartRate !== null
      ? `resting heart rate is ${
          b.rhrDelta !== null && b.rhrDelta > 0
            ? `elevated at ${today.restingHeartRate} bpm`
            : `${today.restingHeartRate} bpm`
        }`
      : null,
    today.bodyBattery !== null ? `Body Battery started the day at ${today.bodyBattery}` : null,
  ].filter((c): c is string => c !== null);

  const narrative: string[] = [
    clauses.length > 0
      ? `${capitalize(clauses.join(", "))}.`
      : `Garmin has not recorded any physiology for today yet.`,
    b.decliningDays >= 2
      ? `One poor night alone would not be particularly meaningful, but this is your ${ordinal(
          b.decliningDays
        )} consecutive day of declining recovery.`
      : b.hrvTrend7 !== null
      ? `This looks like a single off night rather than a pattern — your 7-day trend is still ${
          b.hrvTrend7 < -3 ? "drifting down" : "holding"
        }.`
      : `There is not enough history yet to call this a trend.`,
    strained && heavy
      ? `You can still perform today, but adding a ${WORKOUT_LABEL[
          checkIn.workout
        ].toLowerCase()} session at full volume would increase an already elevated physiological load.`
      : strained
      ? `You can still perform today. Protecting recovery now is what keeps the rest of the week intact.`
      : `Your planned ${WORKOUT_LABEL[checkIn.workout].toLowerCase()} session is well matched to where your body is today.`,
  ];

  // Say plainly when the score was computed without part of the picture, so a
  // high score on thin data is not mistaken for a confident one.
  const unmeasured = [
    today.sleepDuration === null && "sleep",
    today.hrv === null && "HRV",
    today.restingHeartRate === null && "resting heart rate",
    today.stress === null && "stress",
    today.bodyBattery === null && "Body Battery",
  ].filter((m): m is string => typeof m === "string");

  if (unmeasured.length > 0) {
    narrative.push(
      `This reflects only what Garmin recorded — ${list(unmeasured)} ${
        unmeasured.length === 1 ? "was" : "were"
      } not measured today, so ${unmeasured.length === 1 ? "it is" : "they are"} not part of the score.`
    );
  }

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
      why: strained
        ? `${strainReasons(b).join(", ")}.`
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

  // A metric with no reading for today is dropped from the tiles rather than
  // shown as a zero or a dash with an invented delta.
  const metrics: Brief["metrics"] = [
    today.sleepDuration !== null && {
      label: "Sleep",
      value: fmtMin(today.sleepDuration),
      delta:
        b.sleepDelta !== null
          ? `${b.sleepDelta < 0 ? "↓" : "↑"} ${fmtMin(b.sleepDelta)} vs baseline`
          : "no baseline yet",
      direction: direction(b.sleepDelta),
    },
    today.hrv !== null && {
      label: "HRV",
      value: `${today.hrv} ms`,
      delta:
        b.hrvDeltaPct !== null
          ? `${b.hrvDeltaPct < 0 ? "↓" : "↑"} ${Math.abs(Math.round(b.hrvDeltaPct))}%`
          : "no baseline yet",
      direction: direction(b.hrvDeltaPct),
    },
    today.restingHeartRate !== null && {
      label: "Resting HR",
      value: `${today.restingHeartRate} bpm`,
      delta:
        b.rhrDelta !== null
          ? `${b.rhrDelta > 0 ? "↑" : "↓"} ${Math.abs(Math.round(b.rhrDelta))} bpm`
          : "no baseline yet",
      direction: direction(b.rhrDelta),
    },
    today.stress !== null && {
      label: "Stress",
      value: b.stress28 !== null && today.stress > b.stress28 + 8 ? "Elevated" : "Typical",
      delta:
        b.stressTrend3 !== null
          ? `3-day trend ${b.stressTrend3 > 0 ? "↑" : "↓"}`
          : "no baseline yet",
      direction: direction(b.stressTrend3),
    },
    today.bodyBattery !== null && {
      label: "Body Battery",
      value: `${today.bodyBattery}`,
      delta: "morning value",
      direction: "flat" as const,
    },
  ].filter((m): m is Brief["metrics"][number] => m !== false);

  return { date: today.date, score, narrative, decisions, metrics };
}

/** Reasons drawn only from markers that were actually measured. */
function strainReasons(b: ReturnType<typeof computeBaselines>): string[] {
  const reasons = [
    b.hrvDeltaPct !== null && b.hrvDeltaPct < 0 ? "HRV is below baseline" : null,
    b.rhrDelta !== null
      ? `resting heart rate is ${b.rhrDelta > 0 ? "elevated" : "near normal"}`
      : null,
    b.sleepDelta !== null && b.sleepDelta < 0 ? "sleep is short of baseline" : null,
    b.decliningDays > 0
      ? `recovery has declined for ${b.decliningDays} day${b.decliningDays === 1 ? "" : "s"}`
      : null,
  ].filter((r): r is string => r !== null);

  return reasons.length > 0
    ? [capitalize(reasons[0]), ...reasons.slice(1)]
    : ["Your subjective check-in is carrying the score today"];
}

/** Arrow direction for a delta; "flat" when there is nothing to compare against. */
function direction(delta: number | null): "up" | "down" | "flat" {
  if (delta === null) return "flat";
  return delta < 0 ? "down" : "up";
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

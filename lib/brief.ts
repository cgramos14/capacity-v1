import { computeBaselines } from "./baselines";
import { demandClauses, fmtHours, fmtTime, joinClauses, travelNoun } from "./calendar/load";
import { buildDemandContext } from "./calendar/story";
import { computeScore, fmtMin } from "./score";
import type { Brief, CalendarLoad, CheckIn, DailyPhysiology, Decision, Profile } from "./types";

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
  profile?: Profile,
  calendarLoad?: CalendarLoad
): Brief {
  const today = history[history.length - 1];
  const b = computeBaselines(history);
  const score = computeScore(today, b, checkIn);

  const heavy = checkIn.workout === "heavy_lift" || checkIn.workout === "intervals";
  const physStrained = score.status === "CONSTRAINED" || score.status === "DEPLETED";

  // Calendar does not create a second score. It changes how the physiological
  // score is interpreted: capacity available vs demand about to be placed on it.
  const ctx = calendarLoad ? buildDemandContext(calendarLoad, score, checkIn) : undefined;
  const load = ctx?.load;
  const conservative = ctx ? ctx.posture === "protect" : physStrained;
  const strained = physStrained;

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
  ];

  if (ctx && load) {
    const clauses = joinClauses(demandClauses(load));
    const scale =
      load.status === "Extreme"
        ? "an unusually high"
        : load.status === "High"
        ? "unusually high"
        : load.status === "Moderate"
        ? "a moderate amount of"
        : "very little";
    narrative.push(
      ctx.highDemand
        ? `${
            strained ? "Recovery is already below baseline, and t" : "T"
          }oday's schedule adds ${scale} cognitive demand. You have ${clauses}.`
        : ctx.lowDemand
        ? `Today's schedule is unusually open — ${clauses || "almost nothing on the calendar"}. That leaves meaningful recovery margin, and it is the part of the picture that changes what you should do with it.`
        : `Today's schedule adds ${scale} demand: ${clauses}.`
    );
  }

  narrative.push(
    conservative && heavy
      ? ctx
        ? `The issue is not that you cannot perform today. It is that your planned ${WORKOUT_LABEL[
            checkIn.workout
          ].toLowerCase()} session would become an additional stressor on a day that already has very little recovery margin.`
        : `You can still perform today, but adding a ${WORKOUT_LABEL[
            checkIn.workout
          ].toLowerCase()} session at full volume would increase an already elevated physiological load.`
      : strained && heavy && ctx?.lowDemand
      ? `Your recovery is below baseline, but the day itself asks very little of you. That is a meaningful difference: the same physiology on a packed day would call for a larger cut than it does today.`
      : conservative
      ? `You can still perform today. Protecting recovery now is what keeps the rest of the week intact.`
      : `Your planned ${WORKOUT_LABEL[checkIn.workout].toLowerCase()} session is well matched to where your body is today.`
  );

  const bedtime = targetBedtime(profile?.waketime ?? "06:15", conservative || strained);

  const physWhy = `HRV is below baseline, resting heart rate is ${
    b.rhrDelta > 0 ? "elevated" : "near normal"
  }, and recovery has declined for ${b.decliningDays} day${b.decliningDays === 1 ? "" : "s"}.`;
  const scheduleWhy = load
    ? ` Today's calendar adds roughly ${fmtHours(load.scheduledMinutes)} of scheduled work${
        load.highIntensityEvents > 0
          ? ` with ${load.highIntensityEvents} high-intensity meeting${load.highIntensityEvents === 1 ? "" : "s"}`
          : ""
      }.`
    : "";

  const decisions: Decision[] = [
    trainingDecision(),
    fuelDecision(),
    eveningDecision(),
  ];

  function trainingDecision(): Decision {
    if (conservative && heavy) {
      return {
        id: "training",
        title: "Reduce training load",
        targetLabel: "Adjustment",
        target: "Heavy lower body → moderate lower body",
        body: load?.travelToday
          ? "Reduce today's planned volume by approximately 40% and move the session to whichever window is actually open — a short quality session beats a missed one on a travel day."
          : "Reduce today's planned volume by approximately 25%.",
        why: ctx
          ? `${physWhy}${scheduleWhy} Demand is already high before training is added, so the session is the most adjustable piece of today's load.`
          : physWhy,
        cta: "Adjust workout",
      };
    }
    if (strained && heavy && ctx && !ctx.highDemand) {
      return {
        id: "training",
        title: "Train, but cap the top end",
        targetLabel: "Adjustment",
        target: "Heavy lower body → keep the session, cut top sets",
        body:
          "Hold your planned exercises and volume, but stop two reps short of failure on the heaviest work and skip optional conditioning.",
        why: `${physWhy} Today's schedule is light — ${
          load ? `${load.meetingCount} commitment${load.meetingCount === 1 ? "" : "s"} and ${fmtHours(load.scheduledMinutes)} scheduled` : "little on the calendar"
        } — so the day leaves more room to absorb training stress than a packed one would.`,
        cta: "Adjust workout",
      };
    }
    if (!strained && ctx?.lowDemand && heavy) {
      return {
        id: "training",
        title: "Train as planned",
        targetLabel: "Adjustment",
        target: "Planned session, full volume",
        body: "Hold your planned volume and keep intensity honest. If anything, this is the day to add the optional set.",
        why: `Recovery markers are close to your personal baseline and today's demand is low${
          load && load.recoveryWindows >= 2 ? `, with ${load.recoveryWindows} open windows of 90 minutes or more` : ""
        }. High capacity plus low demand is the best combination you get for demanding work.`,
        cta: "Adjust workout",
      };
    }
    return {
      id: "training",
      title: heavy ? "Train as planned" : "Keep today light",
      targetLabel: "Adjustment",
      target: heavy ? "Planned session, full volume" : `${WORKOUT_LABEL[checkIn.workout]} as planned`,
      body: "Hold your planned volume and keep intensity honest.",
      why: strained
        ? `${physWhy}${scheduleWhy}`
        : `Recovery markers are close to your personal baseline and 7-day trends are stable.${scheduleWhy}`,
      cta: "Adjust workout",
    };
  }

  function fuelDecision(): Decision {
    if (load?.travelToday) {
      return {
        id: "fuel",
        title: "Fuel and hydrate around travel",
        targetLabel: "Target",
        target: `Eat before ${load.earlyStart ? fmtTime(load.earlyStart) : "you leave"}, and carry water.`,
        body:
          "Travel days push eating later and drinking less. Eat a complete meal before you leave rather than relying on what is available in transit, and aim to drink steadily through the flight instead of catching up at the hotel.",
        why: "Short sleep and elevated stress reduce your tolerance for under-fueling, and travel reliably makes both hydration and meal timing worse.",
        cta: "Build nutrition plan",
      };
    }
    if (load?.hardestBlockStart) {
      return {
        id: "fuel",
        title: "Fuel before your hardest block",
        targetLabel: "Target",
        target: `Complete breakfast before ${fmtTime(load.hardestBlockStart)}.`,
        body: `Your highest-demand block starts at ${fmtTime(
          load.hardestBlockStart
        )}. Eat a complete breakfast and prioritize carbohydrate before that block rather than trying to catch up later in the day.`,
        why: `Short sleep and elevated stress typically reduce tolerance for under-fueling, and ${
          load.recoveryWindows === 0
            ? "today has no long gap in which to recover a missed meal"
            : "the back half of your day is where the schedule gets least forgiving"
        }.`,
        cta: "Build nutrition plan",
      };
    }
    return {
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
    };
  }

  function eveningDecision(): Decision {
    if (load?.eveningEvent || load?.nextTravel?.tomorrow) {
      const evening = load.eveningEvent;
      const travel = load.nextTravel?.tomorrow ? load.nextTravel : undefined;
      return {
        id: "sleep",
        title: "Protect the evening",
        targetLabel: evening ? "Hard stop" : "Target bedtime",
        target: evening ? `No optional work after ${evening.endTime}` : bedtime,
        body: [
          evening ? `${evening.title} runs until about ${evening.endTime}.` : null,
          travel ? `You have a ${travel.time} ${travelNoun(travel.title)} tomorrow.` : null,
          travel && evening
            ? `Pack and prepare for tomorrow before ${
                load.travelToday ? "you get to the hotel" : "you leave for the evening"
              }, and add nothing optional after it.`
            : travel
            ? "Prepare tonight rather than in the morning, and set the alarm for the latest time that still works."
            : "Add nothing optional after it — the wind-down is the only part of tonight you still control.",
          "Keep alcohol minimal and stop caffeine after midday.",
        ]
          .filter(Boolean)
          .join(" "),
        why: `Sleep is the highest-leverage intervention available today, and tonight's window is already compressed${
          travel?.early ? " at both ends" : ""
        }. Extending it is the fastest way to move HRV and resting heart rate back toward baseline.`,
        cta: "Protect evening",
      };
    }
    return {
      id: "sleep",
      title: "Protect tonight",
      targetLabel: "Target bedtime",
      target: bedtime,
      body: ctx?.lowDemand
        ? "Your evening is open, which makes tonight the easiest sleep to actually win this week. Dim lights and screens 45 minutes before bed and keep caffeine before 12pm tomorrow."
        : "Set a hard stop on work, dim lights and screens 45 minutes before bed, and keep caffeine before 12pm tomorrow.",
      why:
        "Sleep is the highest-leverage intervention available today. Extending sleep is the fastest way to move HRV and resting heart rate back toward baseline and stop a multi-day decline from compounding.",
      cta: "Protect evening",
    };
  }

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

  return {
    date: today.date,
    score,
    narrative,
    decisions,
    metrics,
    calendar: load,
    contextLine: ctx?.contextLine,
    demandSummary: ctx?.demandSummary,
    inferences: ctx?.inferences ?? [],
  };
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

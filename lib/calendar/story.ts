import type { CalendarLoad, CheckIn, ScoreResult } from "@/lib/types";
import { fmtHours, fmtTime, spell } from "./load";

/** How Capacity should posture today given physiology *and* demand. */
export type Posture = "protect" | "temper" | "proceed" | "opportunity";

export interface DemandContext {
  load: CalendarLoad;
  contextLine: string;
  demandSummary: string;
  posture: Posture;
  inferences: string[];
  strained: boolean;
  highDemand: boolean;
  lowDemand: boolean;
}

export function buildDemandContext(
  load: CalendarLoad,
  score: ScoreResult,
  checkIn: CheckIn
): DemandContext {
  const strained = score.status === "CONSTRAINED" || score.status === "DEPLETED";
  const highDemand = load.status === "High" || load.status === "Extreme";
  const lowDemand = load.status === "Low";
  const heavy = checkIn.workout === "heavy_lift" || checkIn.workout === "intervals";

  const posture: Posture = strained && highDemand
    ? "protect"
    : strained || highDemand
    ? "temper"
    : lowDemand
    ? "opportunity"
    : "proceed";

  const demandSummary =
    posture === "protect" || load.score > score.score + 15
      ? "Demand exceeds available capacity"
      : score.score > load.score + 15
      ? "Capacity exceeds today's demand"
      : "Demand and capacity are roughly matched";

  const bits: string[] = [];
  if (load.meetingCount > 0) bits.push(`${load.meetingCount} meeting${load.meetingCount === 1 ? "" : "s"}`);
  if (load.scheduledMinutes > 0) bits.push(`${fmtHours(load.scheduledMinutes)} scheduled`);
  if (load.travelToday) bits.push("travel today");
  else if (load.nextTravel?.tomorrow)
    bits.push(load.nextTravel.early ? "early flight tomorrow" : "travel tomorrow");
  if (load.openAfternoon) bits.push("open afternoon");
  else if (load.recoveryWindows >= 2) bits.push(`${load.recoveryWindows} open windows`);
  const contextLine = bits.join(" · ");

  const inferences: string[] = [];
  const push = (s: string) => inferences.push(s);

  if (highDemand && strained)
    push("High meeting density on a day when recovery is already below baseline reduces your recovery margin.");
  if (load.highIntensityEvents >= 2)
    push(
      `${cap(spell(load.highIntensityEvents))} high-intensity conversations add cognitive demand that is independent of physical training.`
    );
  if (load.longestMeetingBlock >= 180)
    push(
      `You have an unbroken ${fmtHours(load.longestMeetingBlock)} block of commitments, which leaves little room to reset mid-day.`
    );
  if (load.eveningEvent)
    push(
      `${cap(load.eveningEvent.title)} ends around ${load.eveningEvent.endTime}, which compresses your wind-down and may make tonight's sleep harder.`
    );
  if (load.earlyStart && load.earlyStart < "07:45")
    push(
      `A ${fmtTime(load.earlyStart)} start reduces your sleep opportunity at the front of the day.`
    );
  if (load.nextTravel?.tomorrow)
    push(
      load.nextTravel.early
        ? `A ${load.nextTravel.time} departure tomorrow shortens tonight's sleep window and adds travel load to the next 24 hours.`
        : `Travel tomorrow adds load to the next 24 hours, so tonight's sleep is doing double duty.`
    );
  if (load.travelToday)
    push("Travel days typically make hydration, movement and sleep consistency harder to hold.");
  if (heavy && highDemand)
    push("A heavy session on a high calendar-load day adds to total daily load rather than replacing it.");
  if (load.recoveryWindows >= 2)
    push(
      `You have ${spell(load.recoveryWindows)} gaps of 90 minutes or more today — real recovery opportunities if you use them.`
    );
  if (load.openAfternoon)
    push(
      strained
        ? "Nothing is scheduled after 1 PM, which leaves an unusually large recovery window in the middle of the day."
        : "Nothing is scheduled after 1 PM — a rare open block for demanding training or deep work."
    );
  if (!strained && lowDemand)
    push("Physiology is near baseline and today's demand is low, which makes this a good day for demanding training or deep work.");
  if (strained && lowDemand)
    push("Recovery is below baseline, but demand is low, so today leaves more room to absorb training stress than a packed day would.");

  return { load, contextLine, demandSummary, posture, inferences, strained, highDemand, lowDemand };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

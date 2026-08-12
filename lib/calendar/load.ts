import type { CalendarEvent, CalendarLoad, EventCategory, LoadStatus } from "@/lib/types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Commitments that count as "meetings" for density purposes. A client dinner counts. */
const MEETING_CATEGORIES: EventCategory[] = [
  "Internal Meeting",
  "Client Meeting",
  "Presentation",
  "Interview",
  "Dinner",
];
/** Excluded from scheduled load — these are personal time, not demand on the workday. */
const UNSCHEDULED_CATEGORIES: EventCategory[] = ["Personal", "Workout"];

export const dayOf = (iso: string) => iso.slice(0, 10);
export const hhmm = (iso: string) => iso.slice(11, 16);
export const minsOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

export function fmtTime(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function eventsOn(events: CalendarEvent[], date: string) {
  return events
    .filter((e) => dayOf(e.startTime) === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Deterministic daily calendar load. This is contextual workload only — it is not
 * a physiological or medically validated measure. Weights are intentionally flat
 * and readable so they are easy to tune later.
 */
export function computeCalendarLoad(
  events: CalendarEvent[],
  date: string,
  tomorrow: string
): CalendarLoad {
  const today = eventsOn(events, date);
  const scheduled = today.filter((e) => !UNSCHEDULED_CATEGORIES.includes(e.category));

  const meetingCount = today.filter((e) => MEETING_CATEGORIES.includes(e.category)).length;
  const scheduledMinutes = scheduled.reduce((s, e) => s + (minsOf(e.endTime) - minsOf(e.startTime)), 0);
  const highIntensityEvents = scheduled.filter((e) => e.intensity === "High").length;

  // Merge commitments separated by 30 minutes or less into a single block.
  const blocks: { start: number; end: number; hasHigh: boolean }[] = [];
  for (const e of scheduled) {
    const start = minsOf(e.startTime);
    const end = minsOf(e.endTime);
    const last = blocks[blocks.length - 1];
    if (last && start - last.end <= 30) {
      last.end = Math.max(last.end, end);
      last.hasHigh = last.hasHigh || e.intensity === "High";
    } else {
      blocks.push({ start, end, hasHigh: e.intensity === "High" });
    }
  }

  const longestMeetingBlock = blocks.reduce((m, b) => Math.max(m, b.end - b.start), 0);
  const recoveryWindows = blocks
    .slice(1)
    .filter((b, i) => b.start - blocks[i].end >= 90).length;

  const first = scheduled[0];
  const last = scheduled[scheduled.length - 1];
  const earlyStart = first ? hhmm(first.startTime) : undefined;
  const lateFinish = last ? hhmm(last.endTime) : undefined;

  const travelToday = today.some((e) => e.travelRelated);
  const travelTomorrowEvent = eventsOn(events, tomorrow).find((e) => e.travelRelated);
  const travelWithin24h = travelToday || !!travelTomorrowEvent;
  const travelTodayEvent = today.find((e) => e.travelRelated);
  const nextTravelEvent = travelTomorrowEvent ?? travelTodayEvent;
  const nextTravel = nextTravelEvent
    ? {
        title: nextTravelEvent.title,
        time: fmtTime(hhmm(nextTravelEvent.startTime)),
        tomorrow: !!travelTomorrowEvent,
        early: isEarly(hhmm(nextTravelEvent.startTime)),
      }
    : undefined;

  const firstHigh = scheduled.find((e) => e.intensity === "High");
  const hardestBlockStart = firstHigh ? hhmm(firstHigh.startTime) : undefined;
  const openAfternoon = scheduled.every((e) => minsOf(e.startTime) < 13 * 60);

  const eveningEventRaw = [...scheduled].reverse().find((e) => minsOf(e.endTime) >= 20 * 60);
  const eveningEvent = eveningEventRaw
    ? { title: eveningEventRaw.title, endTime: fmtTime(hhmm(eveningEventRaw.endTime)) }
    : undefined;

  const drivers: { label: string; effect: number }[] = [];
  const add = (label: string, effect: number) => {
    if (effect >= 0.5) drivers.push({ label, effect: Math.round(effect) });
    return effect;
  };

  let score = 0;
  score += add("Meeting density", clamp(meetingCount * 3, 0, 18));
  score += add("Scheduled hours", clamp(scheduledMinutes / 25, 0, 16));
  score += add("High-intensity events", clamp(highIntensityEvents * 5, 0, 15));
  score += add(
    "Longest unbroken block",
    longestMeetingBlock >= 240 ? 10 : longestMeetingBlock >= 180 ? 8 : longestMeetingBlock >= 120 ? 5 : 0
  );
  score += add("Early start", first && minsOf(first.startTime) < 7 * 60 + 45 ? 5 : 0);
  score += add("Late finish", last && minsOf(last.endTime) >= 20 * 60 + 30 ? 6 : 0);
  score += add("Travel today", travelToday ? 8 : 0);
  score += add("Travel within 24h", travelTomorrowEvent ? 8 : 0);
  // Only penalize missing recovery windows on a day that is actually full.
  score += add(
    "Few recovery windows",
    scheduledMinutes < 240 ? 0 : recoveryWindows === 0 ? 6 : recoveryWindows === 1 ? 3 : 0
  );

  const rounded = Math.round(clamp(score, 0, 100));
  drivers.sort((a, b) => b.effect - a.effect);

  return {
    date,
    score: rounded,
    status: toLoadStatus(rounded),
    meetingCount,
    scheduledMinutes,
    scheduledHours: Math.round((scheduledMinutes / 60) * 10) / 10,
    highIntensityEvents,
    longestMeetingBlock,
    earlyStart,
    lateFinish,
    travelToday,
    travelWithin24h,
    nextTravel,
    recoveryWindows,
    openAfternoon,
    hardestBlockStart,
    eveningEvent,
    drivers: drivers.slice(0, 4),
  };
}

export function toLoadStatus(score: number): LoadStatus {
  if (score < 25) return "Low";
  if (score < 50) return "Moderate";
  if (score < 85) return "High";
  return "Extreme";
}

function toHHMM(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Short factual clauses used to build the schedule sentence in the narrative. */
export function demandClauses(load: CalendarLoad): string[] {
  const out: string[] = [];
  if (load.meetingCount > 0)
    out.push(`${spell(load.meetingCount)} meeting${load.meetingCount === 1 ? "" : "s"}`);
  if (load.highIntensityEvents > 0)
    out.push(
      `${spell(load.highIntensityEvents)} high-intensity ${load.travelToday ? "block" : "conversation"}${
        load.highIntensityEvents === 1 ? "" : "s"
      }`
    );
  if (load.travelToday) out.push("travel blocks across the day");
  if (load.eveningEvent) out.push(`${load.eveningEvent.title.toLowerCase()} ending around ${load.eveningEvent.endTime}`);
  if (load.nextTravel?.tomorrow)
    out.push(`a ${load.nextTravel.time} ${travelNoun(load.nextTravel.title)} tomorrow`);
  return out;
}

export function travelNoun(title: string) {
  return /flight|fly/i.test(title) ? "flight" : "departure";
}

/** An early departure is the case that actually costs sleep. */
export function isEarly(hm?: string) {
  return !!hm && hm < "09:00";
}

export function spell(n: number) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}

export function joinClauses(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

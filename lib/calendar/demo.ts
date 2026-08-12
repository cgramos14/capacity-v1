import { isoDate } from "@/lib/garmin/demo";
import type {
  CalendarEvent,
  CalendarScenario,
  CalendarScenarioId,
  EventCategory,
  EventIntensity,
  LocationType,
} from "@/lib/types";

export const SCENARIOS: CalendarScenario[] = [
  {
    id: "high_stress",
    label: "High-Stress Workday",
    blurb: "8 commitments, 3 high-intensity, late client dinner, early flight tomorrow",
  },
  { id: "light", label: "Light Workday", blurb: "2 meetings, open afternoon, no travel" },
  { id: "travel", label: "Travel Day", blurb: "Early flight, airport blocks, client meeting, late arrival" },
];

/** [startHHMM, endHHMM, title, category, intensity, locationType] */
type Tmpl = [string, string, string, EventCategory, EventIntensity, LocationType];

const TRAVEL_CATEGORIES: EventCategory[] = ["Travel"];

const HIGH_STRESS_TODAY: Tmpl[] = [
  ["07:30", "08:00", "Team check-in", "Internal Meeting", "Moderate", "Remote"],
  ["08:30", "09:30", "Pipeline review", "Internal Meeting", "Moderate", "Office"],
  ["10:00", "11:00", "Customer presentation", "Presentation", "High", "Office"],
  ["11:30", "12:00", "Executive follow-up", "Client Meeting", "High", "Office"],
  ["13:00", "14:00", "Product meeting", "Internal Meeting", "Moderate", "Office"],
  ["14:30", "15:30", "Negotiation call", "Client Meeting", "High", "Remote"],
  ["16:00", "17:00", "Forecast review", "Internal Meeting", "Moderate", "Office"],
  ["19:30", "21:00", "Client dinner", "Dinner", "Moderate", "Restaurant"],
];

const HIGH_STRESS_TOMORROW: Tmpl[] = [
  ["06:30", "09:15", "Flight departure — SFO", "Travel", "High", "Airport"],
  ["11:00", "12:00", "Regional team sync", "Internal Meeting", "Moderate", "Offsite"],
];

const LIGHT_TODAY: Tmpl[] = [
  ["09:30", "10:00", "Team check-in", "Internal Meeting", "Moderate", "Remote"],
  ["11:00", "12:00", "Pipeline review", "Internal Meeting", "Moderate", "Remote"],
];

const LIGHT_TOMORROW: Tmpl[] = [
  ["10:00", "11:00", "Roadmap review", "Internal Meeting", "Moderate", "Remote"],
];

const TRAVEL_TODAY: Tmpl[] = [
  ["05:15", "06:00", "Drive to airport", "Travel", "Moderate", "Other"],
  ["06:00", "07:10", "Airport and boarding", "Travel", "Moderate", "Airport"],
  ["07:10", "10:30", "Flight — ORD", "Travel", "High", "Airport"],
  ["12:30", "14:00", "Client meeting — downtown", "Client Meeting", "High", "Offsite"],
  ["18:30", "20:00", "Team dinner", "Dinner", "Moderate", "Restaurant"],
  ["20:00", "21:45", "Transfer and hotel check-in", "Travel", "Low", "Other"],
];

const TRAVEL_TOMORROW: Tmpl[] = [
  ["09:00", "10:30", "Client workshop", "Client Meeting", "High", "Offsite"],
  ["16:00", "19:00", "Return flight", "Travel", "Moderate", "Airport"],
];

const WEEKDAY_FILLER: Tmpl[] = [
  ["09:00", "09:30", "Team stand-up", "Internal Meeting", "Moderate", "Remote"],
  ["10:30", "12:00", "Deep work block", "Deep Work", "Moderate", "Remote"],
  ["14:00", "15:00", "Partner sync", "Internal Meeting", "Moderate", "Office"],
  ["17:30", "18:30", "Training", "Workout", "Moderate", "Other"],
];

const BUSY_FILLER: Tmpl[] = [
  ["08:30", "09:00", "Team stand-up", "Internal Meeting", "Moderate", "Remote"],
  ["09:30", "10:30", "Account review", "Client Meeting", "High", "Office"],
  ["11:00", "12:00", "Design review", "Internal Meeting", "Moderate", "Office"],
  ["13:30", "14:30", "Hiring interview", "Interview", "Moderate", "Office"],
  ["15:00", "16:00", "Roadmap sync", "Internal Meeting", "Moderate", "Office"],
];

const WEEKEND_FILLER: Tmpl[] = [
  ["09:00", "10:30", "Long run", "Workout", "Moderate", "Other"],
  ["12:00", "13:30", "Family lunch", "Personal", "Low", "Other"],
];

function build(date: string, tmpls: Tmpl[], prefix: string): CalendarEvent[] {
  return tmpls.map(([start, end, title, category, intensity, locationType], i) => ({
    id: `${prefix}-${date}-${i}`,
    title,
    startTime: `${date}T${start}`,
    endTime: `${date}T${end}`,
    category,
    intensity,
    locationType,
    travelRelated: TRAVEL_CATEGORIES.includes(category) || locationType === "Airport",
  }));
}

/**
 * ~14 days of synthetic calendar data (6 days back, today, 7 days forward).
 * Today and tomorrow come from the selected demo scenario; surrounding days are
 * plausible filler so history and look-ahead never read as empty.
 */
export function generateDemoCalendar(
  scenario: CalendarScenarioId = "high_stress",
  today = new Date()
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (let offset = -6; offset <= 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const date = isoDate(d);
    const dow = d.getDay();

    if (offset === 0) {
      events.push(...build(date, todayTemplate(scenario), scenario));
      continue;
    }
    if (offset === 1) {
      events.push(...build(date, tomorrowTemplate(scenario), scenario));
      continue;
    }
    if (dow === 0 || dow === 6) {
      events.push(...build(date, WEEKEND_FILLER, "fill"));
    } else {
      events.push(...build(date, offset % 3 === 0 ? BUSY_FILLER : WEEKDAY_FILLER, "fill"));
    }
  }

  return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function todayTemplate(s: CalendarScenarioId): Tmpl[] {
  return s === "light" ? LIGHT_TODAY : s === "travel" ? TRAVEL_TODAY : HIGH_STRESS_TODAY;
}

function tomorrowTemplate(s: CalendarScenarioId): Tmpl[] {
  return s === "light" ? LIGHT_TOMORROW : s === "travel" ? TRAVEL_TOMORROW : HIGH_STRESS_TOMORROW;
}

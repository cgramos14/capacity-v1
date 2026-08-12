import type { CalendarEvent, CalendarScenarioId } from "@/lib/types";
import { generateDemoCalendar } from "./demo";

export type CalendarProviderMode = "demo" | "google" | "microsoft";

/**
 * Minimal calendar abstraction. Everything downstream consumes normalized
 * CalendarEvent objects, so GoogleCalendarProvider / MicrosoftCalendarProvider
 * can be added later without touching the load engine or the brief.
 */
export interface CalendarProvider {
  mode: CalendarProviderMode;
  isConnected(): boolean;
  /** Returns normalized events across a ~14-day window, oldest first. */
  getEvents(scenario?: CalendarScenarioId): Promise<CalendarEvent[]>;
}

export const demoCalendarProvider: CalendarProvider = {
  mode: "demo",
  isConnected: () => true,
  async getEvents(scenario = "high_stress") {
    return generateDemoCalendar(scenario);
  },
};

export function getCalendarProvider(mode: CalendarProviderMode = "demo"): CalendarProvider {
  if (mode !== "demo") throw new Error(`${mode} calendar provider not configured`);
  return demoCalendarProvider;
}

import type { DailyPhysiology } from "@/lib/types";
import { generateDemoHistory } from "./demo";

export type ProviderMode = "demo" | "live";

export interface GarminProvider {
  mode: ProviderMode;
  isConnected(): boolean;
  /** Returns normalized DailyPhysiology, oldest first. */
  getDailyPhysiology(days: number): Promise<DailyPhysiology[]>;
}

export const demoProvider: GarminProvider = {
  mode: "demo",
  isConnected: () => true,
  async getDailyPhysiology(days) {
    return generateDemoHistory().slice(-days);
  },
};

/**
 * Live Garmin provider — Garmin Connect Developer Program (Health API / Activity API).
 * Requires approved developer credentials; OAuth + endpoints are configured server-side
 * from GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET / GARMIN_REDIRECT_URI once available.
 * No unofficial endpoints, no credential capture, no scraping.
 */
export const liveProvider: GarminProvider = {
  mode: "live",
  isConnected: () => false,
  async getDailyPhysiology() {
    throw new Error("Garmin live mode not configured");
  },
};

export function getProvider(mode: ProviderMode = "demo"): GarminProvider {
  return mode === "live" ? liveProvider : demoProvider;
}

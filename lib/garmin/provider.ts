import type { DailyPhysiology } from "@/lib/types";
import { generateDemoHistory } from "./demo";
import {
  ingestGarminExport,
  toDailyPhysiologyHistory,
  type GarminExportBundle,
  type IngestResult,
} from "./ingest";

export type ProviderMode = "demo" | "file" | "live";

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

export interface FileProvider extends GarminProvider {
  mode: "file";
  /** Coverage, warnings and per-metric provenance for the ingested export. */
  ingest: IngestResult;
}

/**
 * File provider — reads a Garmin Connect data export (UDS, sleep, training
 * readiness, biometric profile) through `lib/garmin/ingest`.
 *
 * Only days where every core metric is present are returned; `ingest.coverage`
 * and `ingest.warnings` explain what the export did not contain. This provider
 * is the temporary stand-in for the official API — swap in `liveProvider` once
 * Garmin developer access is approved and nothing downstream changes.
 */
export function createFileProvider(bundle: GarminExportBundle): FileProvider {
  const ingest = ingestGarminExport(bundle);
  const history = toDailyPhysiologyHistory(ingest.days);
  return {
    mode: "file",
    ingest,
    isConnected: () => history.length > 0,
    async getDailyPhysiology(days) {
      return history.slice(-days);
    },
  };
}

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

/** File mode needs an export bundle — use `createFileProvider()` for it. */
export function getProvider(mode: ProviderMode = "demo"): GarminProvider {
  return mode === "live" ? liveProvider : demoProvider;
}

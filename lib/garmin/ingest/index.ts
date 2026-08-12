/**
 * Garmin export ingestion — entry point.
 *
 * `ingestGarminExport()` takes raw export JSON and returns normalized days plus
 * an honest coverage report. `toDailyPhysiology()` is the only bridge into
 * Capacity's model, and it refuses to emit a day that is missing a core metric —
 * no zero-filling, no carrying values forward.
 *
 * Swapping to the official Garmin Health API means replacing the parsers here
 * with API responses; everything downstream keeps consuming `GarminDay`.
 */
import type { DailyPhysiology } from "@/lib/types";
import { parseProfile } from "./profile";
import { parseSleep } from "./sleep";
import { parseTrainingReadiness } from "./readiness";
import { parseUds } from "./uds";
import { isRec } from "./raw";
import {
  CORE_METRICS,
  type GarminDay,
  type GarminExportBundle,
  type GarminFileKind,
  type IngestResult,
  type MetricCoverage,
  type MetricKey,
} from "./types";

export * from "./types";

export function ingestGarminExport(bundle: GarminExportBundle): IngestResult {
  const byDate = new Map<string, GarminDay>();
  const warnings: string[] = [];
  const filesParsed: IngestResult["filesParsed"] = [];

  if (bundle.uds !== undefined)
    filesParsed.push({ kind: "uds", records: parseUds(bundle.uds, byDate, warnings) });
  if (bundle.sleep !== undefined)
    filesParsed.push({ kind: "sleep", records: parseSleep(bundle.sleep, byDate, warnings) });
  if (bundle.trainingReadiness !== undefined)
    filesParsed.push({
      kind: "trainingReadiness",
      records: parseTrainingReadiness(bundle.trainingReadiness, byDate, warnings),
    });

  const profile = parseProfile(bundle.bioMetricProfile, bundle.bioMetrics);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const coverage = CORE_METRICS.map((metric) => coverageFor(days, metric));
  const missingMetrics = coverage.filter((c) => c.daysWithValue === 0).map((c) => c.metric);

  if (days.length === 0) warnings.push("No dated records found in the supplied export files.");
  if (missingMetrics.length > 0)
    warnings.push(
      `Not present in this export: ${missingMetrics.join(", ")}. These stay null — Capacity does not estimate them.`
    );

  return { days, profile, coverage, missingMetrics, filesParsed, warnings };
}

function coverageFor(days: GarminDay[], metric: MetricKey): MetricCoverage {
  const withValue = days.filter((d) => d[metric] !== null);
  return {
    metric,
    daysWithValue: withValue.length,
    firstDate: withValue[0]?.date ?? null,
    lastDate: withValue[withValue.length - 1]?.date ?? null,
    source: withValue[0]?.sources[metric] ?? null,
  };
}

/** Core metrics this day is missing. Empty means it maps cleanly into Capacity. */
export function missingMetrics(day: GarminDay): MetricKey[] {
  return CORE_METRICS.filter((m) => day[m] === null);
}

/**
 * Bridge into Capacity's model. Returns null when any core metric is absent,
 * so partially covered days are skipped rather than silently invented.
 *
 * `activities` is empty: the daily-summary exports carry no per-workout records.
 * Activity ingestion is a separate export/endpoint and is not synthesized here.
 */
export function toDailyPhysiology(day: GarminDay): DailyPhysiology | null {
  if (missingMetrics(day).length > 0) return null;
  return {
    date: day.date,
    sleepDuration: day.sleepDuration as number,
    sleepScore: day.sleepScore as number,
    hrv: day.hrv as number,
    restingHeartRate: day.restingHeartRate as number,
    stress: day.stress as number,
    bodyBattery: day.bodyBattery as number,
    steps: day.steps as number,
    activities: [],
  };
}

/**
 * Everything Garmin actually supplied for a day, with absent metrics simply
 * omitted. Use this to display real partial data; use `toDailyPhysiology()`
 * when the full model is required.
 */
export function toPartialPhysiology(day: GarminDay): Partial<DailyPhysiology> & { date: string } {
  const out: Partial<DailyPhysiology> & { date: string } = { date: day.date };
  for (const metric of CORE_METRICS) {
    const value = day[metric];
    if (value !== null) out[metric] = value;
  }
  return out;
}

/** All fully covered days, oldest first. */
export function toDailyPhysiologyHistory(days: GarminDay[]): DailyPhysiology[] {
  return days
    .map(toDailyPhysiology)
    .filter((d): d is DailyPhysiology => d !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Route an export file to its parser slot. Garmin's export ZIP uses stable
 * filename prefixes; shape sniffing is the fallback for renamed files.
 */
export function classifyExportFile(name: string, payload?: unknown): GarminFileKind {
  const n = name.toLowerCase();
  if (n.includes("udsfile")) return "uds";
  if (n.includes("sleepdata")) return "sleep";
  if (n.includes("trainingreadiness")) return "trainingReadiness";
  if (n.includes("userbiometricprofile")) return "bioMetricProfile";
  if (n.includes("biometrics")) return "bioMetrics";
  return sniff(payload);
}

function sniff(payload: unknown): GarminFileKind {
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!isRec(first)) return "unknown";
  if ("bodyBattery" in first || "allDayStress" in first || "totalSteps" in first) return "uds";
  if ("dailySleepDTO" in first || "napList" in first || "retro" in first) return "sleep";
  if ("sleepScoreFactorPercent" in first || "recoveryTimeFactorPercent" in first)
    return "trainingReadiness";
  if ("height" in first || "weight" in first) return "bioMetricProfile";
  return "unknown";
}

/** Build a bundle from an arbitrary set of named export files. */
export function bundleFromFiles(files: { name: string; payload: unknown }[]): {
  bundle: GarminExportBundle;
  unrecognized: string[];
} {
  const bundle: GarminExportBundle = {};
  const unrecognized: string[] = [];

  for (const { name, payload } of files) {
    const kind = classifyExportFile(name, payload);
    if (kind === "unknown") {
      unrecognized.push(name);
      continue;
    }
    const existing = bundle[kind];
    // Garmin splits long ranges across several files of the same kind.
    bundle[kind] =
      Array.isArray(existing) && Array.isArray(payload) ? [...existing, ...payload] : payload;
  }

  return { bundle, unrecognized };
}

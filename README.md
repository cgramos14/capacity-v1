# Capacity

Physiological intelligence and decision layer. Next.js + TypeScript + Tailwind.

```bash
npm install
npm run dev
```

Demo Garmin data is synthetic and generated locally. Live Garmin requires official
Garmin Connect Developer Program credentials (`.env.local`, see `.env.example`).

## Garmin data sources

Everything Garmin flows through one interface, `GarminProvider` in
`lib/garmin/provider.ts`, and lands in `DailyPhysiology`:

| Mode | Provider | Source |
| --- | --- | --- |
| `demo` | `demoProvider` | synthetic history from `lib/garmin/demo.ts` |
| `file` | `createFileProvider(bundle)` | a Garmin Connect data export, parsed by `lib/garmin/ingest` |
| `live` | `liveProvider` | Garmin Health API — pending approved developer credentials |

### File ingestion (`lib/garmin/ingest`)

Self-contained so it can be dropped in favor of the official API without touching
anything downstream. It reads the export files as they ship:

| File | Metrics taken |
| --- | --- |
| `UDSFile_*.json` | `steps` ← `totalSteps`, `restingHeartRate`, `stress` ← `allDayStress.aggregatorList[TOTAL].averageStressLevel`, `bodyBattery` ← `bodyBatteryStatList[STARTOFDAY]`; calories, distance, intensity minutes, min/max HR, respiration and Body Battery high/low/charged/drained kept as `extras` |
| `*_sleepData.json` | `sleepDuration` ← `dailySleepDTO.sleepTimeSeconds`, `sleepScore` ← `sleepScores.overall.value`, `hrv` ← `avgOvernightHrv`; stages, restless moments, SpO2 and naps as `extras` |
| `TrainingReadinessDTO_*.json` | readiness score/level, `recoveryTime`, `hrvWeeklyAverage`, `validSleep` — all `extras`, so the Capacity Score still runs off raw physiology |
| `*_userBioMetricProfileData.json`, `*_bioMetrics_latest.json` | height (cm), weight (grams → kg), VO2 max |

Rules this layer holds to:

- **Nothing is invented.** A metric absent from the export stays `null`; it is never
  zero-filled, interpolated, or carried forward. `toDailyPhysiology()` returns `null`
  for a day missing any core metric, and `toPartialPhysiology()` exposes only what
  Garmin actually recorded.
- **Provenance is kept.** Every value records the file and field it came from
  (`day.sources`), and `IngestResult.coverage` reports per-metric day counts.
- **Gaps are reported, not hidden.** `IngestResult.warnings` flags off-wrist days,
  unscored nights, and readiness records with no score. Garmin's `hrvWeeklyAverage`
  is a 7-day aggregate and is never used as a day's HRV.
- Daily-summary exports carry no per-workout records, so `activities` is empty until
  activity ingestion exists.

Ingest an export via `POST /api/garmin/import` — multipart `files`, or
`{ "files": [{ "name": "UDSFile_....json", "payload": <parsed JSON> }] }`. It returns
the normalized days, coverage, warnings and the days complete enough to enter the
model. Files are parsed in memory and never written to disk.

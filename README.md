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

- **Nothing is invented.** A metric absent from the export stays `null` all the way
  through `DailyPhysiology`; it is never zero-filled, interpolated, or carried forward.
  Partial days are used for what they do contain — only a day with no measured metric
  at all is dropped.
- **Provenance is kept.** Every value records the file and field it came from
  (`day.sources`), and `IngestResult.coverage` reports per-metric day counts.
- **Gaps are reported, not hidden.** `IngestResult.warnings` flags off-wrist days,
  unscored nights, and readiness records with no score. Garmin's `hrvWeeklyAverage`
  is a 7-day aggregate and is never used as a day's HRV.
- Daily-summary exports carry no per-workout records, so `activities` is empty until
  activity ingestion exists.

### How gaps flow through the app

`DailyPhysiology` and `Baselines` fields are `number | null`, and every consumer
treats `null` as "not measured" rather than zero:

- **Baselines** average only the days that carry the metric; a window with no values
  is `null`, and deltas against a null baseline are `null`.
- **The decline streak** needs corroboration — two measured signals pointing down,
  with HRV never contradicting them. One signal alone (resting HR a beat above its
  own mean) does not make a declining day.
- **The score** skips drivers whose inputs are missing and lists them in
  `ScoreResult.dataGaps`; the headline notes that some markers were not measured, and
  a day with no physiology at all does not claim a status.
- **The brief** writes narrative and metric tiles only from metrics that exist, and
  says outright which ones were not measured.

Ingest an export via `POST /api/garmin/import` — multipart `files`, or
`{ "files": [{ "name": "UDSFile_....json", "payload": <parsed JSON> }] }`. It returns
the normalized days, coverage, warnings and the days complete enough to enter the
model. Files are parsed in memory and never written to disk.

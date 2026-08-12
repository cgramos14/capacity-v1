import { NextResponse } from "next/server";
import {
  bundleFromFiles,
  ingestGarminExport,
  missingMetrics,
  toDailyPhysiologyHistory,
} from "@/lib/garmin/ingest";

/**
 * Ingest a Garmin Connect data export.
 *
 * POST multipart/form-data with the export's JSON files (`files` field), or
 * POST JSON `{ "files": [{ "name": "UDSFile_...json", "payload": <parsed JSON> }] }`.
 *
 * Files are parsed in memory and never written to disk. This route exists so
 * file ingestion is swappable: once Garmin Developer API access is approved the
 * live provider feeds the same `lib/garmin/ingest` normalizer.
 */
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let files: { name: string; payload: unknown }[];
  try {
    files = await readFiles(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No export files supplied." }, { status: 400 });
  }

  const { bundle, unrecognized } = bundleFromFiles(files);
  const result = ingestGarminExport(bundle);
  const history = toDailyPhysiologyHistory(result.days);

  return NextResponse.json({
    profile: result.profile,
    coverage: result.coverage,
    missingMetrics: result.missingMetrics,
    filesParsed: result.filesParsed,
    unrecognizedFiles: unrecognized,
    warnings: result.warnings,
    dateRange: result.days.length
      ? { from: result.days[0].date, to: result.days[result.days.length - 1].date }
      : null,
    daysIngested: result.days.length,
    /** Days complete enough to enter Capacity's model as-is. */
    usableDays: history.length,
    incompleteDays: result.days
      .filter((d) => missingMetrics(d).length > 0)
      .map((d) => ({ date: d.date, missing: missingMetrics(d) })),
    days: result.days,
    physiology: history,
  });
}

async function readFiles(request: Request): Promise<{ name: string; payload: unknown }[]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const entries = [...form.getAll("files"), ...form.getAll("file")];
    const out: { name: string; payload: unknown }[] = [];
    for (const entry of entries) {
      if (typeof entry === "string") continue;
      if (entry.size > MAX_BYTES) throw new Error(`${entry.name} exceeds the 25 MB limit.`);
      out.push({ name: entry.name, payload: parse(await entry.text(), entry.name) });
    }
    return out;
  }

  const body = (await request.json()) as unknown;
  const list = (body as { files?: unknown })?.files;
  if (!Array.isArray(list)) throw new Error('Expected JSON body { files: [{ name, payload }] }.');
  return list.map((f) => {
    const item = f as { name?: unknown; payload?: unknown };
    if (typeof item?.name !== "string") throw new Error("Each file needs a `name`.");
    return { name: item.name, payload: item.payload };
  });
}

function parse(text: string, name: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} is not valid JSON.`);
  }
}

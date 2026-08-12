import { NextResponse } from "next/server";

/**
 * Placeholder for the Garmin Connect Developer Program OAuth handoff.
 * Secrets stay server-side; the browser never sees them. The authorization URL and
 * scopes come from Garmin's official developer documentation once credentials are approved.
 */
export async function GET() {
  const configured =
    !!process.env.GARMIN_CLIENT_ID &&
    !!process.env.GARMIN_CLIENT_SECRET &&
    !!process.env.GARMIN_REDIRECT_URI;

  if (!configured) {
    return NextResponse.json(
      { error: "Garmin credentials not configured. Set GARMIN_* environment variables." },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { status: "ready", message: "Garmin OAuth handoff not implemented in V1." },
    { status: 501 }
  );
}

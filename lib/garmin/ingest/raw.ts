/** Defensive readers for unvalidated Garmin export JSON. */

export type Rec = Record<string, unknown>;

export function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Garmin exports are always top-level arrays; tolerate a single object too. */
export function asArray(v: unknown): Rec[] {
  if (Array.isArray(v)) return v.filter(isRec);
  if (isRec(v)) return [v];
  return [];
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Garmin uses negative sentinels (-1, -2) for "no measurement". */
export function positive(v: unknown): number | null {
  const n = num(v);
  return n !== null && n >= 0 ? n : null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function rec(v: unknown): Rec | null {
  return isRec(v) ? v : null;
}

export function secondsToMinutes(v: unknown): number | null {
  const n = positive(v);
  return n === null ? null : Math.round(n / 60);
}

/** Accepts "2026-07-07" or "2026-07-07T05:12:30.0"; returns the calendar date. */
export function calendarDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/** Assign only when the value is present, so extras never gain null keys. */
export function put<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | null) {
  if (value !== null && value !== undefined) target[key] = value;
}

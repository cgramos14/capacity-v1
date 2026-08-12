"use client";

import { useEffect, useMemo, useState } from "react";
import { SCENARIOS } from "@/lib/calendar/demo";
import { computeCalendarLoad, eventsOn, fmtHours, fmtTime, hhmm } from "@/lib/calendar/load";
import { demoCalendarProvider } from "@/lib/calendar/provider";
import { store } from "@/lib/storage";
import type { CalendarEvent, CalendarScenarioId } from "@/lib/types";

function isoLocal(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Minimal calendar status. Demo Mode only — no OAuth, no external calls. */
export default function CalendarStatus() {
  const [scenario, setScenario] = useState<CalendarScenarioId>("high_stress");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const s = store.getScenario();
    setScenario(s);
  }, []);

  useEffect(() => {
    demoCalendarProvider.getEvents(scenario).then(setEvents);
  }, [scenario]);

  const { load, today } = useMemo(() => {
    const now = new Date();
    const date = isoLocal(now);
    const tomorrow = isoLocal(new Date(now.getTime() + 86400000));
    return {
      load: events.length ? computeCalendarLoad(events, date, tomorrow) : null,
      today: eventsOn(events, date),
    };
  }, [events]);

  function choose(s: CalendarScenarioId) {
    setScenario(s);
    store.saveScenario(s);
    setOpen(false);
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-accent">Calendar · Demo Mode</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/80 max-w-md">
            Synthetic calendar data in the same normalized schema a real provider would return.
            Capacity uses it as contextual demand, not as a health measurement.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-line px-4 py-2 text-[13px] hover:border-ink transition-colors"
        >
          Change demo scenario
        </button>
      </div>

      {open && (
        <div className="mt-5 flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => choose(s.id)}
              className={`px-4 py-2 rounded-full border text-[13px] transition-colors ${
                scenario === s.id
                  ? "bg-ink text-canvas border-ink"
                  : "border-line bg-canvas hover:border-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {load && (
        <>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 border-t border-line pt-6">
            {[
              ["Today's events", String(today.length)],
              ["Scheduled", fmtHours(load.scheduledMinutes)],
              ["Demand", load.status],
              ["Load score", `${load.score} / 100`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] tracking-[0.14em] uppercase text-muted">{label}</p>
                <p className="mt-1.5 text-[17px]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-muted">
            {load.meetingCount} meeting{load.meetingCount === 1 ? "" : "s"} ·{" "}
            {load.highIntensityEvents} high-intensity ·{" "}
            {load.earlyStart ? `first ${fmtTime(load.earlyStart)}` : "no commitments"}
            {load.lateFinish ? ` · last ends ${fmtTime(load.lateFinish)}` : ""} ·{" "}
            {load.recoveryWindows} recovery window{load.recoveryWindows === 1 ? "" : "s"}
            {load.travelWithin24h ? " · travel within 24h" : ""}
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] text-muted hover:text-ink list-none">
              Today&apos;s events →
            </summary>
            <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
              {today.map((e) => (
                <li key={e.id}>
                  <span className="text-ink">
                    {fmtTime(hhmm(e.startTime))}–{fmtTime(hhmm(e.endTime))}
                  </span>{" "}
                  {e.title} — {e.category} · {e.intensity} · {e.locationType}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      <p className="mt-6 text-[12px] text-muted">Google Calendar integration coming next.</p>
    </div>
  );
}

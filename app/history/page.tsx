"use client";

import { useEffect, useState } from "react";
import { buildBrief } from "@/lib/brief";
import { demoProvider } from "@/lib/garmin/provider";
import { store } from "@/lib/storage";
import type { Brief, CheckIn, DailyPhysiology } from "@/lib/types";

const NEUTRAL: CheckIn = { energy: 3, stress: 3, soreness: 2, workout: "moderate_lift" };

interface Row {
  date: string;
  brief: Brief;
  outcome?: string;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    demoProvider.getDailyPhysiology(30).then((history: DailyPhysiology[]) => {
      const saved = store.getRecords();
      const built: Row[] = history.map((_, i) => {
        const slice = history.slice(0, i + 1);
        const date = slice[slice.length - 1].date;
        const rec = saved.find((r) => r.date === date);
        return {
          date,
          brief: buildBrief(slice, rec?.checkIn ?? NEUTRAL, store.getProfile()),
          outcome: rec?.feedback,
        };
      });
      setRows(built.reverse());
    });
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[34px] leading-tight">History</h1>
        <p className="mt-3 text-[16px] text-muted">Thirty days of state, decision and outcome.</p>
      </div>

      {rows.length > 0 && <Trend scores={[...rows].reverse().map((r) => r.brief.score.score)} />}

      <div>
        {rows.map((r) => (
          <div key={r.date} className="border-t border-line">
            <button
              onClick={() => setOpen(open === r.date ? null : r.date)}
              className="w-full text-left py-5 flex items-baseline gap-4 sm:gap-8 hover:opacity-70 transition-opacity"
            >
              <span className="w-16 shrink-0 text-[11px] tracking-[0.14em] uppercase text-muted">
                {fmtDate(r.date)}
              </span>
              <span className="w-32 shrink-0 text-[15px]">
                {r.brief.score.score} —{" "}
                <span className="capitalize text-muted">
                  {r.brief.score.status.toLowerCase()}
                </span>
              </span>
              <span className="flex-1 text-[15px] truncate">{r.brief.decisions[0].title}</span>
              <span className="text-[13px] text-muted capitalize">{r.outcome ?? "—"}</span>
            </button>
            {open === r.date && (
              <div className="pb-8 pl-0 sm:pl-24 max-w-xl space-y-3 text-[15px] leading-relaxed text-ink/80">
                {r.brief.narrative.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <p className="text-[13px] text-muted pt-1">
                  {r.brief.metrics.map((m) => `${m.label} ${m.value}`).join(" · ")}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Trend({ scores }: { scores: number[] }) {
  const w = 640;
  const h = 90;
  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const pts = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * w;
      const y = h - ((s - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
    </svg>
  );
}

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

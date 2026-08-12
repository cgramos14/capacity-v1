"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBrief } from "@/lib/brief";
import { demoProvider } from "@/lib/garmin/provider";
import { store } from "@/lib/storage";
import type { ActivityType, Brief, CheckIn, DailyPhysiology, Outcome } from "@/lib/types";

const WORKOUTS: { value: ActivityType; label: string }[] = [
  { value: "rest", label: "Rest" },
  { value: "zone2", label: "Zone 2" },
  { value: "moderate_lift", label: "Moderate Lift" },
  { value: "heavy_lift", label: "Heavy Lift" },
  { value: "intervals", label: "Intervals" },
];

export default function TodayPage() {
  const [history, setHistory] = useState<DailyPhysiology[] | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn>({
    energy: 2,
    stress: 4,
    soreness: 3,
    workout: "heavy_lift",
  });
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<Outcome | undefined>();
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"approved" | "modified" | "rejected" | undefined>();

  useEffect(() => {
    demoProvider.getDailyPhysiology(30).then(setHistory);
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  function generate() {
    if (!history) return;
    setGenerating(true);
    const b = buildBrief(history, checkIn, store.getProfile());
    const today = history[history.length - 1];
    setTimeout(() => {
      setBrief(b);
      setGenerating(false);
      store.upsertRecord({
        date: b.date,
        physiology: today,
        checkIn,
        score: b.score.score,
        status: b.score.status,
        primaryRecommendation: b.decisions[0].title,
      });
    }, 450);
  }

  function recordDecision(d: "approved" | "modified" | "rejected") {
    setDecision(d);
    if (brief) store.patchRecord(brief.date, { workoutDecision: d });
  }

  function recordFeedback(f: Outcome) {
    setFeedback(f);
    if (brief) store.patchRecord(brief.date, { feedback: f, note });
  }

  if (!brief) {
    return (
      <CheckInForm
        greeting={greeting}
        checkIn={checkIn}
        setCheckIn={setCheckIn}
        onGenerate={generate}
        loading={generating || !history}
      />
    );
  }

  return (
    <div className="space-y-16">
      <section className="rise">
        <p className="text-muted text-[15px]">{greeting}</p>
        <p className="mt-8 text-[11px] tracking-[0.28em] uppercase text-muted">Capacity</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-[76px] sm:text-[92px] leading-none tracking-tight">
            {brief.score.score}
          </span>
          <span className="text-muted text-lg">/ 100</span>
        </div>
        <p className="mt-3 text-[12px] tracking-[0.24em] uppercase text-accent">
          {brief.score.status}
        </p>
        <p className="mt-6 font-display text-[24px] sm:text-[28px] leading-snug max-w-xl">
          {brief.score.headline}
        </p>
      </section>

      <section className="rise">
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted">
          What your body is telling you
        </h2>
        <div className="mt-5 space-y-4 text-[17px] leading-[1.7] max-w-xl">
          {brief.narrative.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 border-t border-line pt-6">
          {brief.metrics.map((m) => (
            <div key={m.label}>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted">{m.label}</p>
              <p className="mt-1.5 text-[17px]">{m.value}</p>
              <p className="mt-0.5 text-[12px] text-muted">{m.delta}</p>
            </div>
          ))}
        </div>
        <details className="mt-6 group">
          <summary className="cursor-pointer text-[12px] text-muted hover:text-ink list-none">
            Why the score is {brief.score.score} →
          </summary>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
            {brief.score.drivers.map((d) => (
              <li key={d.label}>
                <span className="text-ink">{d.label}</span> {d.effect} — {d.note}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rise">
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted">Today&apos;s decisions</h2>
        <div className="mt-5 space-y-4">
          {brief.decisions.map((d, i) => (
            <DecisionCard
              key={d.id}
              index={i + 1}
              decision={d}
              isWorkout={d.id === "training"}
              chosen={decision}
              onDecide={recordDecision}
            />
          ))}
        </div>
      </section>

      <section className="rise border-t border-line pt-8">
        <h2 className="font-display text-[22px]">Did today&apos;s plan help?</h2>
        <div className="mt-4 flex gap-2">
          {(["helped", "neutral", "hurt"] as Outcome[]).map((f) => (
            <button
              key={f}
              onClick={() => recordFeedback(f)}
              className={`px-4 py-2 rounded-full text-[14px] capitalize border transition-colors ${
                feedback === f
                  ? "bg-ink text-canvas border-ink"
                  : "border-line hover:border-ink bg-surface"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => brief && store.patchRecord(brief.date, { note })}
          placeholder="Optional note"
          rows={2}
          className="mt-4 w-full rounded-2xl border border-line bg-surface p-4 text-[15px] outline-none focus:border-ink/40 resize-none"
        />
        {feedback && (
          <p className="mt-3 text-[13px] text-muted">
            Saved. Capacity will weigh this against today&apos;s data and decisions.
          </p>
        )}
      </section>
    </div>
  );
}

function DecisionCard({
  index,
  decision,
  isWorkout,
  chosen,
  onDecide,
}: {
  index: number;
  decision: Brief["decisions"][number];
  isWorkout: boolean;
  chosen?: "approved" | "modified" | "rejected";
  onDecide: (d: "approved" | "modified" | "rejected") => void;
}) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);

  return (
    <article className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex gap-4">
        <span className="font-display text-[15px] text-muted pt-1">{index}</span>
        <div className="flex-1">
          <h3 className="font-display text-[22px] leading-snug">{decision.title}</h3>
          <p className="mt-3 text-[11px] tracking-[0.14em] uppercase text-muted">
            {decision.targetLabel}
          </p>
          <p className="mt-1 text-[17px]">{decision.target}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{decision.body}</p>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            <span className="text-ink/70">Why: </span>
            {decision.why}
          </p>

          <button
            onClick={() => (isWorkout ? setOpen((v) => !v) : setAck(true))}
            className="mt-6 rounded-full bg-ink text-canvas px-5 py-2.5 text-[14px] hover:bg-accent transition-colors"
          >
            {decision.cta}
          </button>
          {ack && !isWorkout && (
            <p className="mt-3 text-[13px] text-muted">Added to today&apos;s plan.</p>
          )}

          {isWorkout && open && (
            <div className="mt-6 rounded-2xl bg-canvas border border-line p-5">
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted">Original</p>
              <p className="mt-1 text-[16px]">Heavy lower-body workout</p>
              <p className="mt-4 text-[11px] tracking-[0.14em] uppercase text-muted">
                Capacity adjustment
              </p>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed">
                <li>Reduce total working sets approximately 25%.</li>
                <li>Keep primary compound lifts.</li>
                <li>Remove optional conditioning.</li>
                <li>Avoid adding extra accessory volume.</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {(["approved", "modified", "rejected"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => onDecide(a)}
                    className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
                      chosen === a
                        ? "bg-ink text-canvas border-ink"
                        : "border-line bg-surface hover:border-ink"
                    }`}
                  >
                    {a === "approved" ? "Approve" : a === "modified" ? "Modify" : "Reject"}
                  </button>
                ))}
              </div>
              {chosen && (
                <p className="mt-3 text-[13px] text-muted">
                  Recorded as {chosen}. Capacity will learn from how this day turns out.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CheckInForm({
  greeting,
  checkIn,
  setCheckIn,
  onGenerate,
  loading,
}: {
  greeting: string;
  checkIn: CheckIn;
  setCheckIn: (c: CheckIn) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <div className="rise max-w-xl">
      <p className="text-muted text-[15px]">{greeting}</p>
      <h1 className="mt-3 font-display text-[34px] sm:text-[40px] leading-tight">
        Three quick questions.
      </h1>
      <p className="mt-3 text-[16px] text-muted leading-relaxed">
        Capacity combines this with your Garmin data and personal baselines to build today&apos;s
        brief.
      </p>

      <div className="mt-10 space-y-8">
        {(["energy", "stress", "soreness"] as const).map((k) => (
          <div key={k}>
            <p className="text-[11px] tracking-[0.18em] uppercase text-muted capitalize">{k}</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCheckIn({ ...checkIn, [k]: n })}
                  className={`h-11 w-11 rounded-full border text-[15px] transition-colors ${
                    checkIn[k] === n
                      ? "bg-ink text-canvas border-ink"
                      : "border-line bg-surface hover:border-ink"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted">Workout</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WORKOUTS.map((w) => (
              <button
                key={w.value}
                onClick={() => setCheckIn({ ...checkIn, workout: w.value })}
                className={`px-4 py-2.5 rounded-full border text-[14px] transition-colors ${
                  checkIn.workout === w.value
                    ? "bg-ink text-canvas border-ink"
                    : "border-line bg-surface hover:border-ink"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        className="mt-10 rounded-full bg-ink text-canvas px-6 py-3 text-[15px] hover:bg-accent transition-colors disabled:opacity-50"
      >
        {loading ? "Reading your data…" : "Generate Today's Brief"}
      </button>
      <p className="mt-4 text-[12px] text-muted">Using Demo Garmin Data · synthetic 30-day history</p>
    </div>
  );
}

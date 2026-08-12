"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, store } from "@/lib/storage";
import type { Profile } from "@/lib/types";

const GOALS = [
  "Energy",
  "Sleep",
  "Recovery",
  "Physical performance",
  "Cognitive performance",
  "Body composition",
];
const WORK = ["Low", "Moderate", "High", "Extreme"];
const TRAVEL = ["Rare", "Monthly", "Weekly"];

export default function ProfilePage() {
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => setP(store.getProfile()), []);

  function save() {
    store.saveProfile(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="font-display text-[34px] leading-tight">Profile</h1>
        <p className="mt-3 text-[16px] text-muted">
          Only what changes the recommendations. Saved locally on this device.
        </p>
      </div>

      <Field label="Primary goal">
        <Chips options={GOALS} value={p.goal} onChange={(v) => set({ goal: v })} />
      </Field>

      <Field label="Training days per week">
        <Chips
          options={["2", "3", "4", "5", "6"]}
          value={String(p.trainingDays)}
          onChange={(v) => set({ trainingDays: Number(v) })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-6">
        <Field label="Typical bedtime">
          <input
            type="time"
            value={p.bedtime}
            onChange={(e) => set({ bedtime: e.target.value })}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-ink/40"
          />
        </Field>
        <Field label="Typical wake time">
          <input
            type="time"
            value={p.waketime}
            onChange={(e) => set({ waketime: e.target.value })}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-ink/40"
          />
        </Field>
      </div>

      <Field label="Work intensity">
        <Chips options={WORK} value={p.workIntensity} onChange={(v) => set({ workIntensity: v })} />
      </Field>

      <Field label="Travel">
        <Chips options={TRAVEL} value={p.travel} onChange={(v) => set({ travel: v })} />
      </Field>

      <Field label="Nutrition preferences">
        <textarea
          rows={2}
          value={p.nutritionPreferences}
          onChange={(e) => set({ nutritionPreferences: e.target.value })}
          placeholder="Dairy-free, high protein, no seed oils…"
          className="w-full rounded-2xl border border-line bg-surface p-4 text-[15px] outline-none focus:border-ink/40 resize-none"
        />
      </Field>

      <Field label="Common foods">
        <textarea
          rows={2}
          value={p.commonFoods}
          onChange={(e) => set({ commonFoods: e.target.value })}
          placeholder="Greek yogurt, eggs, rice, salmon…"
          className="w-full rounded-2xl border border-line bg-surface p-4 text-[15px] outline-none focus:border-ink/40 resize-none"
        />
      </Field>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          className="rounded-full bg-ink text-canvas px-6 py-3 text-[15px] hover:bg-accent transition-colors"
        >
          Save profile
        </button>
        {saved && <span className="text-[13px] text-muted">Saved.</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.18em] uppercase text-muted">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-4 py-2.5 rounded-full border text-[14px] transition-colors ${
            value === o ? "bg-ink text-canvas border-ink" : "border-line bg-surface hover:border-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

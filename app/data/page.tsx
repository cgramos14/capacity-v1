import { demoProvider } from "@/lib/garmin/provider";
import { computeBaselines } from "@/lib/baselines";
import { fmtMin } from "@/lib/score";

/** Renders a missing reading as a dash — never as a zero. */
const val = (v: number | null, unit = "") => (v === null ? "—" : `${Math.round(v)}${unit}`);
const mins = (v: number | null) => (v === null ? "—" : fmtMin(v));
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v)}%`);

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const configured =
    !!process.env.GARMIN_CLIENT_ID &&
    !!process.env.GARMIN_CLIENT_SECRET &&
    !!process.env.GARMIN_REDIRECT_URI;

  const history = await demoProvider.getDailyPhysiology(30);
  const b = computeBaselines(history);
  const recent = [...history].reverse().slice(0, 14);

  return (
    <div className="space-y-14">
      <section>
        <h1 className="font-display text-[34px] leading-tight">Data</h1>
        <p className="mt-3 text-[16px] text-muted leading-relaxed max-w-xl">
          Capacity is built on Garmin&apos;s official Garmin Connect Developer Program APIs (Health
          and Activity). Connect once and your data syncs automatically — nothing is ever exported
          by hand.
        </p>

        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase text-accent">
                Demo Garmin Data
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/80 max-w-md">
                You are viewing 30 days of synthetic, locally generated data in the same normalized
                schema as live Garmin. This did not come from Garmin.
              </p>
            </div>
            {configured ? (
              <a
                href="/api/garmin/connect"
                className="rounded-full bg-ink text-canvas px-5 py-2.5 text-[14px] hover:bg-accent transition-colors"
              >
                Connect Garmin
              </a>
            ) : (
              <span className="text-[13px] text-muted max-w-[15rem]">
                Live mode appears here once Garmin developer credentials are set.
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted">Personal baselines</h2>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6">
          {[
            ["Sleep 7d", mins(b.sleep7)],
            ["Sleep 28d", mins(b.sleep28)],
            ["HRV 7d", val(b.hrv7, " ms")],
            ["HRV 28d", val(b.hrv28, " ms")],
            ["Resting HR 7d", val(b.rhr7, " bpm")],
            ["Resting HR 28d", val(b.rhr28, " bpm")],
            ["HRV 3-day trend", pct(b.hrvTrend3)],
            ["HRV 7-day trend", pct(b.hrvTrend7)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted">{label}</p>
              <p className="mt-1.5 text-[17px]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted">Last 14 days</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[14px] border-collapse">
            <thead>
              <tr className="text-muted text-[11px] tracking-[0.12em] uppercase">
                {["Date", "Sleep", "Score", "HRV", "RHR", "Stress", "Battery", "Steps"].map((h) => (
                  <th key={h} className="text-left font-normal pb-3 pr-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-3 pr-4 whitespace-nowrap">{d.date.slice(5)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{mins(d.sleepDuration)}</td>
                  <td className="py-3 pr-4">{val(d.sleepScore)}</td>
                  <td className="py-3 pr-4">{val(d.hrv)}</td>
                  <td className="py-3 pr-4">{val(d.restingHeartRate)}</td>
                  <td className="py-3 pr-4">{val(d.stress)}</td>
                  <td className="py-3 pr-4">{val(d.bodyBattery)}</td>
                  <td className="py-3 pr-4">{d.steps === null ? "—" : d.steps.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* M7.1 — Training load from the strap's heart-rate zones (Edwards TRIMP). Automatic: nothing is logged by hand. */
import React from "react";
import { tone } from "../theme.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { HeartPulse } from "lucide-react";
import { Card, CardHeader } from "./ui.jsx";
import { HR, zoneBounds } from "../engine.js";

const shortDay = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function HrLoadCard({ load, maxHr }) {
  const data = load.days.map((d) => ({ ...d, value: d.load ?? 0, label: d.date.slice(8) }));
  const weekStart = data.length - 7;
  const bounds = zoneBounds(maxHr?.bpm);
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Training load · heart rate" title="Last 4 weeks"
        sub={`${load.sessions} session${load.sessions === 1 ? "" : "s"} picked up this week · load = minutes in each zone × zone number (TRIMP)`}
        right={load.ratio != null && (
          <div className="text-right">
            <p className={`font-display text-3xl font-bold tabular-nums ${load.spike ? "text-amber-300" : "text-slate-100"}`}>{load.ratio.toFixed(1)}×</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">vs 4-week avg</p>
          </div>
        )} />

      {load.hasData ? (
        <>
          <div className="mt-3 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: tone("#64748b"), fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: tone("#64748b"), fontSize: 10 }} axisLine={false} tickLine={false} />
                <ReferenceLine y={HR.sessionMin} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} contentStyle={{ background: tone("#0f172a"), border: `1px solid ${tone("rgba(255,255,255,0.1)")}`, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: tone("#94a3b8") }} formatter={(v, _, p) => [p.payload.load == null ? "no HR data" : v, "Load"]}
                  labelFormatter={(_, p) => (p?.[0] ? shortDay(p[0].payload.date) : "")} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {data.map((d, i) => <Cell key={d.date} fill={i >= weekStart ? tone("#f472b6") : `${tone("#f472b6")}59`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            {load.ready
              ? <p>{load.spike ? "Load spike this week: keep the plan, don't add sessions." : "This week's load is in line with your last 4 weeks."} Advisory only: it never changes today's decision.</p>
              : <p>The 4-week comparison starts once the 4 weeks before this one have {load.needed} days with heart-rate data ({load.priorDays} so far).</p>}
            <p>Days above the dotted line ({HR.sessionMin}) count as a session, typed from your weekly plan.</p>
          </div>
        </>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
          <HeartPulse size={16} className="mt-0.5 shrink-0" />
          Add yesterday's heart-rate zones to the morning Shortcut (section 2c of the Shortcut guide) and your training load appears here, with no logging.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Max HR {maxHr?.bpm ? `${maxHr.bpm} bpm · ${maxHr.source === "set" ? "set by you" : `learned from ${maxHr.days} days`}` : "not known yet"}
        </p>
        {bounds.length ? (
          <ul className="mt-2 grid grid-cols-5 gap-1 text-center font-mono text-[11px]">
            {bounds.map((b) => (
              <li key={b.zone} className="rounded-md bg-white/[0.04] px-1 py-1.5">
                <span className="block text-slate-500">Z{b.zone}</span>
                <span className="text-slate-200">{b.from}–{b.to}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Learned from your daily highest heart rate (`hrmax` in the Shortcut) after {HR.maxMinDays} days ({maxHr?.days ?? 0} so far). Until then, use 220 − age for the zone limits in the Shortcut.
          </p>
        )}
        {bounds.length > 0 && <p className="mt-2 text-xs text-slate-500">Use these limits in the Shortcut's zone counts.</p>}
      </div>
    </Card>
  );
}

/* M3 — Training load: 4 weeks of session-RPE, this week vs the 4 before, monotony, freshness, template spacing. */
import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardHeader } from "./ui.jsx";

const AREA = { upper: "Upper", lower: "Lower", ankle: "Ankle chain" };

export default function LoadCard({ load, freshness, conflicts }) {
  const data = load.days.map((d) => ({ ...d, label: d.date.slice(8) }));
  const weekStart = data.length - 7;
  const hasData = data.some((d) => d.load > 0);
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Training load" title="Last 4 weeks"
        sub={`${load.sessions} session${load.sessions === 1 ? "" : "s"} this week · load = RPE × minutes`}
        right={load.ratio != null && (
          <div className="text-right">
            <p className={`font-display text-3xl font-bold tabular-nums ${load.spike ? "text-amber-300" : "text-slate-100"}`}>{load.ratio}×</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">vs 4-week avg</p>
          </div>
        )} />
      <div className="mt-3 h-32">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }} formatter={(v) => [v, "Load"]} labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""} />
              <Bar dataKey="load" radius={[3, 3, 0, 0]}>
                {data.map((d, i) => <Cell key={d.date} fill={i >= weekStart ? "#22d3ee" : "rgba(34,211,238,0.35)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3 text-sm text-slate-400">Log sessions with "Log session" to see your load.</p>
        )}
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-400">
        {load.ratio == null
          ? <p>The 4-week comparison starts after {4} logged sessions in the previous 4 weeks.</p>
          : <p>{load.spike ? "Load spike: keep the plan, don't add sessions." : "Load is in line with your recent weeks."} Advisory only: load ratios predict injury poorly on their own.</p>}
        {load.monotony != null && <p>Monotony {load.monotony}{load.monotonyHigh ? ": too many similar days, vary hard and easy." : "."}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(freshness).map(([k, f]) => (
          <span key={k} className={`rounded-md px-2 py-1 font-mono text-[11px] ${f.state === "fresh" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-300/10 text-amber-200"}`}>
            {AREA[k]}: {f.state}{f.hoursSince != null && f.state === "recovering" ? ` (${f.hoursSince}/${f.needH} h)` : ""}
          </span>
        ))}
      </div>
      {conflicts.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-200">{conflicts.map((c) => <li key={`${c.from}-${c.to}-${c.rule}`}>⚠ {c.text}</li>)}</ul>
      )}
    </Card>
  );
}

import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Moon, HeartPulse, Activity, Sun, Dumbbell, Brain, Wind, ShoppingCart,
  BedDouble, Footprints, ClipboardCheck, X, Zap, Check, BookOpen, Utensils,
  Target, AlertOctagon, SlidersHorizontal, CheckCircle2, RefreshCw,
} from "lucide-react";
import { planDay, parseSyncHash, upsertDay, dateKey } from "./engine.js";

/* =========================================================================
   Storage (on this device only — wrapped so private mode never crashes)
   ========================================================================= */
const KEYS = { history: "chinh-history", checkin: "chinh-checkin", done: (d) => `chinh-done-${d}`, sync: "chinh-last-sync" };
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/* Example values shown until your first check-in */
const DEFAULT_CHECKIN = {
  sleepHours: 7.2, sleepQuality: 7, hrv: 62, hrvBaseline: 66, rhr: 55, rhrBaseline: 54,
  upper: 2, lower: 3, ankleHip: 3, energy: 4,
};
const EXAMPLE_TREND = [74, 83, 46, 58, 81, 69];

/* =========================================================================
   UI building blocks
   ========================================================================= */
const TYPE_META = {
  sun: { icon: Sun, color: "#fbbf24" },
  mobility: { icon: Footprints, color: "#22d3ee" },
  focus: { icon: Brain, color: "#a78bfa" },
  work: { icon: ClipboardCheck, color: "#94a3b8" },
  breath: { icon: Wind, color: "#5eead4" },
  training: { icon: Dumbbell, color: "#22e58b" },
  errands: { icon: ShoppingCart, color: "#f97316" },
  fuel: { icon: Utensils, color: "#fda4af" },
  study: { icon: BookOpen, color: "#a78bfa" },
  wind: { icon: BedDouble, color: "#818cf8" },
};
const PART_ICON = { sleep: Moon, autonomic: HeartPulse, soreness: Activity, mental: Brain };
const LEVEL_META = {
  stop: { icon: AlertOctagon, color: "#fb5a6e", label: "Stop" },
  adjust: { icon: SlidersHorizontal, color: "#facc15", label: "Adjust" },
  go: { icon: CheckCircle2, color: "#22e58b", label: "Go" },
};

const Card = ({ className = "", children }) => (
  <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-xl ${className}`}>{children}</section>
);
const Eyebrow = ({ children }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">{children}</p>
);

function ScoreRing({ score, color, size = 220 }) {
  const stroke = 14, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 400ms", filter: `drop-shadow(0 0 10px ${color}66)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-7xl font-bold leading-none tabular-nums" style={{ color }}>{score}</span>
        <span className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-slate-400">% recovered</span>
      </div>
    </div>
  );
}

function MiniRing({ pct, color }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 500ms" }} />
    </svg>
  );
}

function Checkbox({ checked, onChange, color = "#22e58b", label }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{ borderColor: checked ? color : "rgba(148,163,184,0.4)", background: checked ? color : "transparent" }}>
      {checked && <Check size={15} strokeWidth={3.5} color="#0b1220" />}
    </button>
  );
}

/* =========================================================================
   Panels
   ========================================================================= */
function RecoveryCard({ result, archetype, baselines, dateLabel }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Recovery score</Eyebrow>
        <span className="font-mono text-[11px] text-slate-500">{dateLabel}</span>
      </div>
      <div className="mt-4 flex flex-col items-center gap-5">
        <ScoreRing score={result.score} color={archetype.color} />
        <div className="rounded-full border px-4 py-1.5 font-display text-lg font-semibold tracking-[0.08em]"
          style={{ color: archetype.color, borderColor: `${archetype.color}55`, background: archetype.tint }}>
          {archetype.label}
        </div>
        <p className="max-w-xs text-center text-sm text-slate-300">{archetype.summary}</p>
      </div>
      <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
        {result.parts.map((p) => {
          const Icon = PART_ICON[p.key];
          return (
            <div key={p.key} className="grid grid-cols-[18px_1fr_auto] items-center gap-3">
              <Icon size={16} className="text-slate-400" />
              <div className="min-w-0">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{p.label}</span>
                  <span className="font-mono text-slate-500">{p.weight}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700/50">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.value * 100}%`, background: archetype.color }} />
                </div>
              </div>
              <span className="w-12 text-right font-mono text-sm tabular-nums text-slate-200">{p.points.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-[11px] text-slate-500">
        {baselines.source === "rolling"
          ? `Baseline: your last ${baselines.days} days (30-day rolling)`
          : `Baseline: manual · ${baselines.daysNeeded} more check-in${baselines.daysNeeded === 1 ? "" : "s"} until it learns yours`}
      </p>
    </Card>
  );
}

function DirectionsCard({ directives }) {
  const counts = directives.reduce((a, d) => ({ ...a, [d.level]: (a[d.level] || 0) + 1 }), {});
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Today's directions</Eyebrow>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">What your data says to do</h2>
        </div>
        <div className="flex gap-1.5">
          {["stop", "adjust", "go"].filter((l) => counts[l]).map((l) => (
            <span key={l} className="rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider"
              style={{ color: LEVEL_META[l].color, background: `${LEVEL_META[l].color}1a` }}>
              {counts[l]} {LEVEL_META[l].label}
            </span>
          ))}
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {directives.map((d) => {
          const m = LEVEL_META[d.level];
          const Icon = m.icon;
          return (
            <li key={d.id} className="grid grid-cols-[28px_1fr] gap-3 rounded-xl border-l-2 bg-slate-900/40 p-3" style={{ borderColor: m.color }}>
              <Icon size={20} color={m.color} className="mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-slate-100">{d.title}</p>
                <p className="mt-0.5 text-sm text-slate-300">{d.action}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{d.why}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TrendCard({ data, isExample }) {
  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Eyebrow>7-day recovery</Eyebrow>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-slate-100">
            {avg}<span className="text-lg text-slate-500">% avg</span>
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-500">{isExample ? "Example history" : `${data.length} days logged`}</span>
      </div>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={80} stroke="#22e58b" strokeOpacity={0.35} strokeDasharray="4 4" />
            <ReferenceLine y={50} stroke="#fb5a6e" strokeOpacity={0.35} strokeDasharray="4 4" />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#22d3ee" }} formatter={(v) => [`${v}%`, "Recovery"]} />
            <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2.5} fill="url(#trendFill)"
              dot={{ r: 3, fill: "#0f172a", stroke: "#22d3ee", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#22d3ee" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function VitalsStrip({ c, result, baselines, sleepDebt }) {
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  const tiles = [
    { label: "Sleep", value: c.sleepHours.toFixed(1), unit: "h", sub: sleepDebt > 0 ? `${sleepDebt} h debt (3 nights)` : "No sleep debt", icon: Moon },
    { label: "HRV", value: c.hrv, unit: "ms", sub: `${sign(result.hrvZ)} SD vs ${Math.round(baselines.hrv.mean)} ms normal`, icon: HeartPulse },
    { label: "Resting HR", value: c.rhr, unit: "bpm", sub: `${sign(result.rhrDelta)} vs ${Math.round(baselines.rhr.mean)} bpm normal`, icon: Activity },
    { label: "Ankle / hips", value: c.ankleHip, unit: "/5", sub: c.ankleHip >= 4 ? "Stiff — prioritise" : "Manageable", icon: Footprints },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Card key={t.label} className="p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Icon size={14} /><span className="font-mono text-[11px] uppercase tracking-[0.14em]">{t.label}</span>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-slate-100">
              {t.value}<span className="ml-0.5 text-base text-slate-500">{t.unit}</span>
            </p>
            <p className="text-xs text-slate-400">{t.sub}</p>
          </Card>
        );
      })}
    </div>
  );
}

function ScheduleTimeline({ items, done, toggle, accent }) {
  const completed = items.filter((i) => done[i.id]).length;
  const totalMin = items.reduce((s, i) => s + i.dur, 0);
  const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Today's action plan</Eyebrow>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">Hour-by-hour schedule</h2>
          <p className="text-xs text-slate-400">{items.length} blocks · {fmtDur(totalMin)} planned</p>
        </div>
        <div className="flex items-center gap-3">
          <MiniRing pct={items.length ? completed / items.length : 0} color={accent} />
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums text-slate-100">{completed}/{items.length}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">done</p>
          </div>
        </div>
      </div>
      <ol className="relative mt-6">
        <span className="absolute bottom-3 left-[67px] top-3 w-px bg-white/[0.08]" aria-hidden="true" />
        {items.map((item) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          const isDone = !!done[item.id];
          return (
            <li key={item.id} className="relative grid grid-cols-[52px_32px_1fr] items-start gap-2 py-2.5">
              <span className={`pt-1 font-mono text-sm tabular-nums ${isDone ? "text-slate-600" : "text-slate-300"}`}>{item.time}</span>
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: `${meta.color}55`, background: "#0f172a" }}>
                <Icon size={15} color={meta.color} />
              </span>
              <div className={`flex min-w-0 items-start gap-3 rounded-xl px-3 py-2 transition ${isDone ? "" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-100"}`}>{item.title}</p>
                    <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: meta.color, background: `${meta.color}1a` }}>{fmtDur(item.dur)}</span>
                  </div>
                  <p className={`mt-0.5 text-sm ${isDone ? "text-slate-600" : "text-slate-400"}`}>{item.detail}</p>
                </div>
                <Checkbox checked={isDone} onChange={() => toggle(item.id)} color={accent} label={`Mark ${item.title} done`} />
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function MobilityPanel({ drills, done, toggle }) {
  const completed = drills.filter((d) => done[d.id]).length;
  const prColor = { High: "#fb5a6e", Medium: "#facc15", Maintain: "#22d3ee" };
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Mobility & movement</Eyebrow>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">Ankle–hip chain</h2>
          <p className="text-xs text-slate-400">Ranked by today's stiffness ratings</p>
        </div>
        <span className="font-display text-2xl font-semibold tabular-nums text-cyan-300">{completed}/{drills.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700/50">
        <div className="h-full rounded-full bg-cyan-300 transition-all duration-500" style={{ width: `${(completed / drills.length) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {drills.map((d) => {
          const isDone = !!done[d.id];
          return (
            <li key={d.id} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-slate-900/40 p-3">
              <Checkbox checked={isDone} onChange={() => toggle(d.id)} color="#22d3ee" label={`Mark ${d.name} done`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={`text-sm font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-100"}`}>{d.name}</p>
                  <span className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: prColor[d.priority], background: `${prColor[d.priority]}1a` }}>{d.priority}</span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-cyan-200/80">{d.dose}</p>
                <p className="text-xs text-slate-400">{d.cue}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* =========================================================================
   Check-in modal
   ========================================================================= */
function Slider({ id, label, value, min, max, step = 1, unit = "", onChange, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-slate-300">{label}</label>
        <span className="font-mono text-sm tabular-nums text-cyan-300">{value}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="chinh-range mt-2 w-full" />
      {hint && <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{hint}</p>}
    </div>
  );
}

function NumberField({ id, label, value, unit, onChange, synced }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-slate-400">
        {label}{synced && <span className="rounded bg-emerald-400/15 px-1 font-mono text-[9px] uppercase text-emerald-300">Health</span>}
      </label>
      <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-950/60 px-3 focus-within:border-cyan-400/60">
        <input id={id} type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-full bg-transparent py-2 font-mono text-slate-100 outline-none" />
        <span className="font-mono text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function CheckInModal({ initial, synced, history, today, onClose, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const preview = planDay({ checkin: f, history, today });
  const arch = preview.archetype;
  const isSynced = (k) => synced?.fields?.includes(k);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 sm:rounded-3xl sm:p-7"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Morning check-in</Eyebrow>
            <h2 id="checkin-title" className="mt-1 font-display text-3xl font-semibold text-slate-100">
              {synced ? "Health data in. Rate how you feel." : "How did you wake up?"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close check-in" className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Activity size={15} /> Soreness & stiffness</legend>
            <div className="space-y-4">
              <Slider id="upper" label="Upper body" value={f.upper} min={1} max={5} unit="/5" onChange={set("upper")} hint="1 none · 5 severe" />
              <Slider id="lower" label="Lower body" value={f.lower} min={1} max={5} unit="/5" onChange={set("lower")} />
              <Slider id="ankleHip" label="Ankle / hips" value={f.ankleHip} min={1} max={5} unit="/5" onChange={set("ankleHip")} hint="Counts double during sprain rehab" />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Brain size={15} /> Mind</legend>
            <Slider id="energy" label="Mental energy" value={f.energy} min={1} max={5} unit="/5" onChange={set("energy")} hint="1 drained · 5 sharp" />
          </fieldset>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Moon size={15} /> Sleep</legend>
            <div className="space-y-4">
              <NumberField id="sleepHours" label="Duration" value={f.sleepHours} unit="h" onChange={set("sleepHours")} synced={isSynced("sleepHours")} />
              <Slider id="sleepQuality" label="Quality (how rested you feel)" value={f.sleepQuality} min={1} max={10} unit="/10" onChange={set("sleepQuality")} />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><HeartPulse size={15} /> Heart</legend>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="hrv" label="HRV" value={f.hrv} unit="ms" onChange={set("hrv")} synced={isSynced("hrv")} />
              <NumberField id="rhr" label="Resting HR" value={f.rhr} unit="bpm" onChange={set("rhr")} synced={isSynced("rhr")} />
              {preview.baselines.source === "manual" && (
                <>
                  <NumberField id="hrvBaseline" label="HRV baseline (temporary)" value={f.hrvBaseline} unit="ms" onChange={set("hrvBaseline")} />
                  <NumberField id="rhrBaseline" label="RHR baseline (temporary)" value={f.rhrBaseline} unit="bpm" onChange={set("rhrBaseline")} />
                </>
              )}
            </div>
            {preview.baselines.source === "manual" && (
              <p className="mt-2 text-xs text-slate-500">Baselines are replaced by your own 30-day averages after {preview.baselines.daysNeeded} more check-ins.</p>
            )}
          </fieldset>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">Live preview</p>
            <p className="font-display text-lg font-semibold tracking-wide" style={{ color: arch.color }}>{arch.label}</p>
          </div>
          <span className="font-display text-4xl font-bold tabular-nums" style={{ color: arch.color }}>{preview.result.score}%</span>
        </div>
        <button onClick={() => onSubmit(f)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 py-3.5 font-semibold text-slate-950 shadow-[0_0_30px_-6px_rgba(34,211,238,0.6)] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white">
          <Zap size={18} /> Calculate & Generate Today's Plan
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   Main dashboard
   ========================================================================= */
export default function CHINHDashboard() {
  const today = dateKey();
  const [history, setHistory] = useState(() => load(KEYS.history, []));
  const [checkin, setCheckin] = useState(() => ({ ...DEFAULT_CHECKIN, ...load(KEYS.checkin, {}) }));
  const [done, setDone] = useState(() => load(KEYS.done(today), {}));
  const [lastSync, setLastSync] = useState(() => load(KEYS.sync, null));
  const [modalOpen, setModalOpen] = useState(false);

  const day = useMemo(() => planDay({ checkin, history, today }), [checkin, history, today]);
  const { result, archetype, baselines, directives, schedule, drills } = day;

  // Apple Health sync: the Shortcut opens this page with #hrv=…&rhr=…&sleep=…
  useEffect(() => {
    const synced = parseSyncHash(window.location.hash);
    if (!synced) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search); // clear numbers from the address bar
    const sync = { date: today, at: new Date().toISOString(), fields: Object.keys(synced) };
    setCheckin((c) => ({ ...c, ...synced }));
    setLastSync(sync);
    save(KEYS.sync, sync);
    setModalOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => save(KEYS.checkin, checkin), [checkin]);
  useEffect(() => save(KEYS.done(today), done), [done, today]);
  useEffect(() => save(KEYS.history, history), [history]);

  const toggle = (id) => setDone((d) => ({ ...d, [id]: !d[id] }));

  const handleSubmit = (next) => {
    const nextDay = planDay({ checkin: next, history, today });
    setCheckin(next);
    setHistory((h) => upsertDay(h, {
      date: today, hrv: next.hrv, rhr: next.rhr, sleepHours: next.sleepHours, sleepQuality: next.sleepQuality,
      upper: next.upper, lower: next.lower, ankleHip: next.ankleHip, energy: next.energy, score: nextDay.result.score,
    }));
    setModalOpen(false);
  };

  const realDays = history.filter((h) => Number.isFinite(h.score) && h.date < today).slice(-6);
  const isExample = realDays.length < 2;
  const weekday = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
  const trend = isExample
    ? [...EXAMPLE_TREND.map((score, i) => ({ day: `-${6 - i}d`, score })), { day: "Today", score: result.score }]
    : [...realDays.map((h) => ({ day: weekday(h.date), score: h.score })), { day: "Today", score: result.score }];

  const now = new Date();
  const longDate = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDate = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const syncedToday = lastSync?.date === today;
  const checkedInToday = history.some((h) => h.date === today);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full opacity-25 blur-[120px]" style={{ background: archetype.color }} />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500 opacity-10 blur-[120px]" />
      </div>

      <div className="chinh-gutter relative mx-auto max-w-6xl py-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400">
              <Target size={22} color="#0b1220" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-[0.12em]">CHINH</h1>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{longDate}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ${syncedToday ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-400"}`}>
              <RefreshCw size={12} />
              {syncedToday
                ? `Apple Health · ${new Date(lastSync.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                : "Not synced today"}
            </span>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300">
              <ClipboardCheck size={17} /> {checkedInToday ? "Update check-in" : "Morning check-in"}
            </button>
          </div>
        </header>

        {!checkedInToday && (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-sm text-amber-200">
            {history.length ? "You haven't checked in today. The plan below uses your last check-in." : "Showing example data. Run your Apple Health Shortcut or open the check-in to start."}
          </p>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <RecoveryCard result={result} archetype={archetype} baselines={baselines} dateLabel={shortDate} />
          <div className="flex min-w-0 flex-col gap-4">
            <DirectionsCard directives={directives} />
            <TrendCard data={trend} isExample={isExample} />
          </div>
        </div>

        <div className="mt-4">
          <VitalsStrip c={checkin} result={result} baselines={baselines} sleepDebt={day.sleepDebt} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <ScheduleTimeline items={schedule} done={done} toggle={toggle} accent={archetype.color} />
          <MobilityPanel drills={drills} done={done} toggle={toggle} />
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-slate-500">
          Your data stays in this browser on this device. Nothing is uploaded.
        </p>
      </div>

      {modalOpen && (
        <CheckInModal initial={checkin} synced={syncedToday ? lastSync : null} history={history} today={today}
          onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

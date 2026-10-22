import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Moon, HeartPulse, Activity, Sun, Dumbbell, Brain, Wind, ShoppingCart,
  BedDouble, Footprints, ClipboardCheck, X, Zap, BookOpen, Utensils,
  Target, AlertOctagon, SlidersHorizontal, CheckCircle2, RefreshCw, CalendarRange, Cloud, CloudOff, LogOut, Mail, Settings,
} from "lucide-react";
import {
  planDay, parseSyncHash, parseBackfillHash, mergeBackfill, upsertDay, dateKey, weeklyReview,
  getArchetype, MOBILITY_DAY_MIN_DRILLS, mergeHistories, changedDays, latestRatings,
  learnProfile, applyYesterday,
} from "./engine.js";
import { supabase, pullDays, pushDays, pullProfile, pushProfile } from "./supabase.js";
import { Card, Eyebrow, MiniRing, Checkbox, Chips } from "./components/ui.jsx";
import BriefCard, { BriefSetupCard } from "./components/BriefCard.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import InsightsCard from "./components/InsightsCard.jsx";
import HrLoadCard from "./components/HrLoadCard.jsx";
import TrainingCard from "./components/TrainingCard.jsx";

/* =========================================================================
   Storage (on this device only — wrapped so private mode never crashes)
   ========================================================================= */
const KEYS = {
  history: "chinh-history", checkin: "chinh-checkin", done: (d) => `chinh-done-${d}`, sync: "chinh-last-sync",
  profile: "chinh-profile",
};
/* Overnight strap readings (M7.3/7.4) live on today's record, never in the carried-over check-in */
const OVERNIGHT_KEYS = ["spo2", "spo2Min", "stages"];
const overnightOf = (day) => Object.fromEntries(OVERNIGHT_KEYS.filter((k) => day?.[k] != null).map((k) => [k, day[k]]));
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

const shortDay = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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

/* =========================================================================
   Panels
   ========================================================================= */
const CONFIDENCE_TONE = { high: "#22e58b", medium: "#facc15", low: "#fb5a6e" };

function ConfidenceBadge({ confidence }) {
  const color = CONFIDENCE_TONE[confidence.level];
  return (
    <span className="group relative inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400" tabIndex={0}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {confidence.level} confidence
      <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-64 rounded-lg border border-white/10 bg-slate-950 p-2 text-[11px] normal-case text-slate-300 shadow-xl group-hover:block group-focus:block">
        {[...confidence.reasons, ...(confidence.notes || [])].join(" · ")}
      </span>
    </span>
  );
}

const STAGE_COLOR = { deep: "#6366f1", core: "#38bdf8", rem: "#a78bfa" };
const hm = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} m`;

/* M7.4 — display only: consumer sleep staging isn't accurate enough to score or act on */
function SleepStages({ stages }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">Sleep stages</span>
        <span className="font-mono text-[11px] text-slate-500">{hm(stages.total)} · not scored</span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-700/50" role="img"
        aria-label={stages.parts.map((p) => `${p.label} ${p.min} min`).join(", ")}>
        {stages.parts.map((p) => <span key={p.key} style={{ width: `${p.pct}%`, background: STAGE_COLOR[p.key] }} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-slate-400">
        {stages.parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLOR[p.key] }} />{p.label} {hm(p.min)}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecoveryCard({ result, archetype, baselines, dateLabel, confidence, baselineNights, stages }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Recovery score</Eyebrow>
        <div className="flex items-center gap-3">
          {confidence && <ConfidenceBadge confidence={confidence} />}
          <span className="font-mono text-[11px] text-slate-500">{dateLabel}</span>
        </div>
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
      {stages && <SleepStages stages={stages} />}
      {result.sleepQualityStale && (
        <p className="mt-4 font-mono text-[11px] text-amber-200/80">Sleep scored on duration only: quality not rated today.</p>
      )}
      {confidence?.notes?.map((n) => <p key={n} className="mt-2 font-mono text-[11px] text-amber-200/80">{n}</p>)}
      <p className="mt-4 font-mono text-[11px] text-slate-500">
        {baselines.source === "rolling"
          ? `Baseline: your last ${baselines.days} days (30-day rolling, ln HRV)`
          : `Baseline: manual · ${baselines.daysNeeded} more check-in${baselines.daysNeeded === 1 ? "" : "s"} until it learns yours`}
      </p>
      {baselineNights && !baselineNights.ready && (
        <div className="mt-2">
          <p className="font-mono text-[11px] text-slate-500">Learning your baseline: {baselineNights.nights}/{baselineNights.needed} nights</p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/50">
            <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${(baselineNights.nights / baselineNights.needed) * 100}%` }} />
          </div>
        </div>
      )}
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
        {directives.map((d) => <DirectiveItem key={d.id} d={d} />)}
      </ul>
    </Card>
  );
}

function DirectiveItem({ d }) {
  const m = LEVEL_META[d.level];
  const Icon = m.icon;
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3 rounded-xl border-l-2 bg-slate-900/40 p-3" style={{ borderColor: m.color }}>
      <Icon size={20} color={m.color} className="mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium text-slate-100">{d.title}</p>
        <p className="mt-0.5 text-sm text-slate-300">{d.action}</p>
        <p className="mt-1 font-mono text-[11px] text-slate-500">{d.why}</p>
      </div>
    </li>
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

const VITALS_GRID = { 5: "sm:grid-cols-3 lg:grid-cols-5", 6: "sm:grid-cols-3 lg:grid-cols-6", 7: "sm:grid-cols-4 lg:grid-cols-7" };

function VitalsStrip({ c, result, baselines, sleepDebt, activity, spo2 }) {
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  const vsMedian = (v, m, unit) => (m == null ? "Median after 7 days of data" : `${v >= m ? "+" : "−"}${Math.abs(Math.round(((v - m) / m) * 100))} % vs ${Math.round(m).toLocaleString("en-GB")}${unit} median`);
  const extra = [
    activity?.steps != null && { label: "Steps · yesterday", value: activity.steps.toLocaleString("en-GB"), unit: "", sub: vsMedian(activity.steps, activity.stepsMedian, ""), icon: Footprints },
    activity?.activeKcal != null && { label: "Active energy · yesterday", value: activity.activeKcal.toLocaleString("en-GB"), unit: "kcal",
      sub: activity.bigDay ? `Big day: ${vsMedian(activity.activeKcal, activity.kcalMedian, " kcal")}` : vsMedian(activity.activeKcal, activity.kcalMedian, " kcal"), icon: Zap },
    spo2?.value != null && { label: "Oxygen · overnight", value: spo2.value, unit: "%",
      sub: spo2.artefact ? `Min ${spo2.min} %: likely a loose strap` : spo2.baseline != null ? `${sign(Math.round((spo2.value - spo2.baseline) * 10) / 10)} vs ${spo2.baseline} % normal${spo2.min != null ? ` · min ${spo2.min} %` : ""}` : "Normal after 5 nights", icon: Wind },
  ].filter(Boolean);
  const tiles = [
    { label: "Sleep", value: c.sleepHours.toFixed(1), unit: "h", sub: sleepDebt > 0 ? `${sleepDebt} h debt (3 nights)` : "No sleep debt", icon: Moon },
    { label: "HRV", value: c.hrv, unit: "ms", sub: `${sign(result.hrvZ)} SD vs ${Math.round(baselines.hrv.mean)} ms normal`, icon: HeartPulse },
    { label: "Resting HR", value: c.rhr, unit: "bpm", sub: `${sign(result.rhrDelta)} vs ${Math.round(baselines.rhr.mean)} bpm normal`, icon: Activity },
    { label: "Ankle / hips", value: c.ankleHip, unit: "/5", sub: c.ankleHip >= 4 ? "Stiff — prioritise" : "Manageable", icon: Footprints },
    ...extra,
  ];
  return (
    <div className={`grid grid-cols-2 gap-3 ${VITALS_GRID[tiles.length] ?? "lg:grid-cols-4"}`}>
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

function WeeklyReviewCard({ review }) {
  const fmt = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  const { score, days, hrv, rhr, sleep, ankle, adherence, fired } = review;
  const mix = [
    { id: "high", label: "High", n: days.high },
    { id: "balanced", label: "Balanced", n: days.balanced },
    { id: "restore", label: "Restore", n: days.restore },
  ].map((m) => ({ ...m, color: getArchetype(m.id === "high" ? 80 : m.id === "balanced" ? 50 : 0).color }));
  const tiles = [
    { label: "HRV", value: hrv.avg ?? "–", unit: "ms", sub: hrv.pct != null ? `${hrv.pct}% of your ${hrv.baseline} ms normal` : "No baseline yet", icon: HeartPulse },
    { label: "Resting HR", value: rhr.avg ?? "–", unit: "bpm", sub: rhr.delta != null ? `${sign(rhr.delta)} vs ${rhr.baseline} bpm normal` : "No baseline yet", icon: Activity },
    { label: "Sleep", value: sleep.avg ?? "–", unit: "h", sub: sleep.nights ? `${sleep.under7}/${sleep.nights} nights under 7 h` : "No nights logged", icon: Moon },
    { label: "Ankle / hips", value: ankle.avg ?? "–", unit: "/5", sub: ankle.delta != null ? `${sign(ankle.delta)} vs last week` : "First week logged", icon: Footprints },
  ];
  const maxFired = Math.max(1, ...fired.map((f) => f.count));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Weekly review</Eyebrow>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">Last 7 days</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarRange size={13} /> {fmt(review.from)} – {fmt(review.to)} · {review.checkins} check-in{review.checkins === 1 ? "" : "s"}
          </p>
        </div>
        {score.avg != null && (
          <div className="sm:text-right">
            <p className="font-display text-4xl font-bold tabular-nums text-slate-100">{score.avg}<span className="text-lg text-slate-500">% avg</span></p>
            {score.delta != null && (
              <p className={`font-mono text-xs ${score.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{sign(score.delta)} vs previous 7 days</p>
            )}
          </div>
        )}
      </div>

      {review.needed > 0 ? (
        <p className="mt-5 rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          Log {review.needed} more check-in{review.needed === 1 ? "" : "s"} this week for a full review.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-700/50" role="img"
                aria-label={mix.map((m) => `${m.n} ${m.label}`).join(", ")}>
                {mix.filter((m) => m.n).map((m) => (
                  <div key={m.id} style={{ width: `${(m.n / review.checkins) * 100}%`, background: m.color }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
                {mix.map((m) => (
                  <span key={m.id} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />{m.n} {m.label}
                  </span>
                ))}
                {score.best && score.worst && (
                  <span>Best {score.best.score}% ({fmt(score.best.date)}) · Lowest {score.worst.score}% ({fmt(score.worst.date)})</span>
                )}
              </div>
            </div>
            {adherence.days > 0 && (
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <MiniRing pct={(adherence.planPct ?? 0) / 100} color="#22e58b" />
                  <div>
                    <p className="font-display text-xl font-semibold tabular-nums text-slate-100">{adherence.planPct}%</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">plan done</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MiniRing pct={adherence.mobilityDays / adherence.days} color="#22d3ee" />
                  <div>
                    <p className="font-display text-xl font-semibold tabular-nums text-slate-100">{adherence.mobilityDays}/{adherence.days}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400" title={`${MOBILITY_DAY_MIN_DRILLS}+ drills ticked`}>mobility days</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="rounded-xl border border-white/[0.05] bg-slate-900/40 p-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Icon size={13} /><span className="font-mono text-[10px] uppercase tracking-[0.14em]">{t.label} · avg</span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-slate-100">
                    {t.value}<span className="ml-0.5 text-sm text-slate-500">{t.unit}</span>
                  </p>
                  <p className="text-xs text-slate-400">{t.sub}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-200">Focus for next week</p>
              <ul className="space-y-2.5">{review.focus.map((d) => <DirectiveItem key={d.id} d={d} />)}</ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Directions fired</p>
              <p className="mb-2 text-xs text-slate-500">Something firing every day is a threshold to tune.</p>
              {fired.length ? (
                <ul className="space-y-1.5">
                  {fired.map((f) => (
                    <li key={f.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
                      <span className="truncate text-slate-300">{f.name}</span>
                      <span className="font-mono tabular-nums text-slate-400">{f.count}×</span>
                      <div className="col-span-2 mt-0.5 h-1 overflow-hidden rounded-full bg-slate-700/50">
                        <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${(f.count / maxFired) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Logged from your next check-in onwards.</p>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/* =========================================================================
   Cloud sync
   ========================================================================= */
function SyncChip({ cloud, signedIn, onClick }) {
  if (cloud.state === "off") return null;
  const label = !signedIn ? "Sync across devices"
    : cloud.state === "syncing" ? "Syncing…"
    : cloud.state === "error" ? "Sync error"
    : cloud.at ? `Cloud · ${new Date(cloud.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Cloud";
  const tone = cloud.state === "error" ? "bg-rose-400/10 text-rose-300"
    : signedIn ? "bg-cyan-400/10 text-cyan-200" : "bg-white/5 text-slate-400 hover:text-slate-200";
  const Icon = cloud.state === "error" ? CloudOff : Cloud;
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition focus-visible:ring-2 focus-visible:ring-cyan-300 ${tone}`}>
      <Icon size={12} /> {label}
    </button>
  );
}

function SyncModal({ session, cloud, onClose, onSyncNow, onSignOut }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (err) setError(err.message); else setSent(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sync-title">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-3xl"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Cloud sync</Eyebrow>
            <h2 id="sync-title" className="mt-1 font-display text-2xl font-semibold text-slate-100">
              {session ? "Synced across your devices" : "Keep your history everywhere"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100"><X size={20} /></button>
        </div>

        {session ? (
          <div className="mt-5 space-y-4 text-sm text-slate-300">
            <p>Signed in as <span className="font-mono text-slate-100">{session.user.email}</span>. Check-ins, ratings and plan progress save to your private database and appear on any device you sign in on.</p>
            {cloud.state === "error" && <p className="rounded-lg bg-rose-400/10 px-3 py-2 font-mono text-xs text-rose-300">{cloud.message}</p>}
            <div className="flex gap-2">
              <button onClick={onSyncNow} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 py-2.5 font-semibold text-cyan-200 hover:bg-cyan-400/20">
                <RefreshCw size={15} /> Sync now
              </button>
              <button onClick={onSignOut} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-slate-300 hover:bg-white/5">
                <LogOut size={15} /> Sign out
              </button>
            </div>
            <p className="font-mono text-[11px] text-slate-500">Signing out keeps the copy on this device.</p>
          </div>
        ) : sent ? (
          <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-200">
            Link sent to {email}. Open it on this device: it signs you in here, then uploads this device's history.
          </p>
        ) : (
          <form onSubmit={send} className="mt-5 space-y-3">
            <p className="text-sm text-slate-300">Sign in with an email link. Your history uploads to your private database, so your phone and desktop show the same data. No password.</p>
            <label htmlFor="sync-email" className="sr-only">Email</label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 focus-within:border-cyan-400/60">
              <Mail size={15} className="text-slate-500" />
              <input id="sync-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="w-full bg-transparent py-2.5 text-slate-100 outline-none" />
            </div>
            {error && <p className="font-mono text-xs text-rose-300">{error}</p>}
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 py-3 font-semibold text-slate-950 hover:brightness-110">
              Email me a sign-in link
            </button>
          </form>
        )}
      </div>
    </div>
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

function CheckInModal({ initial, synced, history, today, profile, onClose, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const preview = planDay({ checkin: { ...f, ratedOn: today, sleepQualityRatedOn: today }, history, today, profile });
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
              {synced ? "Anything changed since last time?" : "How did you wake up?"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close check-in" className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><AlertOctagon size={15} /> Today</legend>
            <Chips label="How are you today?" value={f.override ?? null} onChange={set("override")}
              options={[{ value: null, label: "Normal day" }, { value: "ill", label: "Feeling ill" }, { value: "stress", label: "High stress" }]} />
            <p className="mt-2 text-xs text-slate-500">Ill or high stress makes today a recovery day and leaves it out of your baselines, so a cold can't distort your normal.</p>
          </fieldset>
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
  // Per-day fields (override) live on the day record, never in the carried-over check-in
  const [checkin, setCheckin] = useState(() => {
    const { busy, fixtures, override, ...c } = { ...DEFAULT_CHECKIN, ...load(KEYS.checkin, {}) };
    return c;
  });
  const [done, setDone] = useState(() => load(KEYS.done(today), {}));
  const [lastSync, setLastSync] = useState(() => load(KEYS.sync, null));
  const [profile, setProfileState] = useState(() => load(KEYS.profile, null));
  const [modalOpen, setModalOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restedPrompt, setRestedPrompt] = useState(false);
  const [session, setSession] = useState(null);
  const [cloud, setCloud] = useState({ state: supabase ? "idle" : "off" });
  const syncedRef = useRef(null); // date → JSON of each day as the cloud last confirmed it
  const profileSyncedRef = useRef(null); // JSON of the profile as the cloud last confirmed it

  const todayDay = useMemo(() => history.find((h) => h.date === today) || null, [history, today]);
  const learned = useMemo(() => learnProfile(history, today), [history, today]);
  const fullProfile = useMemo(() => (profile ? { ...profile, learned } : null), [profile, learned]);
  const dayCheckin = useMemo(() => ({ ...checkin, ...overnightOf(todayDay), override: todayDay?.override ?? null }), [checkin, todayDay]);

  const day = useMemo(() => planDay({ checkin: dayCheckin, history, today, profile: fullProfile }),
    [dayCheckin, history, today, fullProfile]);
  const { result, archetype, baselines, directives, schedule, drills } = day;

  const [notice, setNotice] = useState(null);

  const setProfile = (p) => {
    const next = { ...p, updatedAt: Date.now() };
    delete next.learned; // computed from history every time, never stored
    // Fields from features removed in the strap-only scope
    for (const k of ["weightKg", "weightLog", "sweatRateLph", "injuredSide", "footballKeyword", "experiment", "location"]) delete next[k];
    setProfileState(next);
  };
  useEffect(() => { if (profile) save(KEYS.profile, profile); }, [profile]);

  /* Save today's check-in. `extra` holds per-day fields (override) that must not carry over. */
  const commitCheckin = (next, extra = {}) => {
    const override = "override" in extra ? extra.override : todayDay?.override ?? null;
    const nextDay = planDay({ checkin: { ...next, ...overnightOf(todayDay), ...overnightOf(extra), override }, history, today, profile: fullProfile });
    setCheckin(next);
    const fields = {
      date: today, hrv: next.hrv, rhr: next.rhr, sleepHours: next.sleepHours, sleepQuality: next.sleepQuality,
      upper: next.upper, lower: next.lower, ankleHip: next.ankleHip, energy: next.energy, score: nextDay.result.score,
      hrvCount: next.hrvCount, hrvWindow: next.hrvWindow, bedTime: next.bedTime, wakeTime: next.wakeTime,
      ratedOn: next.ratedOn, sleepQualityRatedOn: next.sleepQualityRatedOn,
      confidence: nextDay.confidence.level, directives: nextDay.directives.map((d) => d.id), updatedAt: Date.now(), ...extra,
    };
    setHistory((h) => upsertDay(h, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))));
  };

  // Apple Health links from the Shortcuts:
  //   backfill → #history=date,hrv,rhr,sleep[,hrvn[,bed,wake]];…   morning sync → #hrv=…&rhr=…&sleep=…&hrvn=…&bed=…&wake=…
  useEffect(() => {
    const hash = window.location.hash;
    const clearHash = () => window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const backfill = parseBackfillHash(hash);
    if (backfill) {
      clearHash();
      const past = backfill.filter((d) => d.date < today);
      setHistory((h) => mergeBackfill(h, past));
      const withHrv = past.filter((d) => Number.isFinite(d.hrv)).length;
      setNotice(`Imported ${past.length} days from Apple Health (${withHrv} with HRV). Your baselines now use your own history.`);
      return;
    }

    const synced = parseSyncHash(hash);
    if (!synced) return;
    clearHash(); // keep numbers out of the address bar and browser history
    const { yesterday, overnight, ...measures } = synced;
    const sync = { date: today, at: new Date().toISOString(), fields: [...Object.keys(measures), ...Object.keys(yesterday || {}), ...Object.keys(overnight || {})] };
    setLastSync(sync);
    save(KEYS.sync, sync);
    // Yesterday's heart-rate zones, steps and active energy go on yesterday's record (M7.1/7.2)
    if (yesterday) setHistory((h) => applyYesterday(h, today, yesterday, profile));
    // No form: check in straight away and carry over the last soreness and energy ratings.
    const next = { ...checkin, ...measures };
    commitCheckin(next, overnight || {});
    const parts = [
      measures.hrv != null && `HRV ${measures.hrv} ms${measures.hrvCount != null ? ` (${measures.hrvCount} readings)` : ""}`,
      measures.rhr != null && `RHR ${measures.rhr} bpm`,
      measures.sleepHours != null && `sleep ${measures.sleepHours} h${measures.bedTime ? ` (${measures.bedTime}–${measures.wakeTime ?? "?"})` : ""}`,
      overnight?.spo2 != null && `oxygen ${overnight.spo2} %`,
      yesterday?.steps != null && `${yesterday.steps.toLocaleString("en-GB")} steps yesterday`,
      yesterday?.hrZones && "yesterday's heart-rate zones",
    ].filter(Boolean).join(" · ");
    setNotice(`Synced from Apple Health: ${parts}. Soreness, ankle and energy carried over from ${next.ratedOn ? shortDay(next.ratedOn) : "your last check-in"}.`);
    if ((next.sleepQualityRatedOn ?? next.ratedOn) !== today) setRestedPrompt(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => save(KEYS.checkin, checkin), [checkin]);
  useEffect(() => save(KEYS.done(today), done), [done, today]);
  useEffect(() => save(KEYS.history, history), [history]);

  const rateRested = (q) => {
    commitCheckin({ ...checkin, sleepQuality: q, sleepQualityRatedOn: today });
    setRestedPrompt(false);
  };

  // Ticking a block also records today's plan completion for the weekly review. Written here, on the tap,
  // rather than in an effect, so another device with no ticks can never overwrite these counts with zeros.
  const toggle = (id) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    if (!history.some((h) => h.date === today && Number.isFinite(h.score))) return;
    setHistory((h) => upsertDay(h, {
      date: today, blocksDone: schedule.filter((i) => next[i.id]).length, blocksTotal: schedule.length,
      drillsDone: drills.filter((d) => next[d.id]).length, updatedAt: Date.now(),
    }));
  };

  // ---- Cloud sync: pull on sign-in and whenever the app comes back to the foreground, push what changed
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const pull = useCallback(async () => {
    if (!supabase || !session) return;
    setCloud((c) => ({ ...c, state: "syncing" }));
    try {
      const remote = await pullDays();
      syncedRef.current = new Map(remote.map((d) => [d.date, JSON.stringify(d)]));
      setHistory((h) => mergeHistories(h, remote));
      setCloud({ state: "synced", at: Date.now() });
    } catch (e) {
      setCloud({ state: "error", message: e.message });
    }
    try {
      const remoteProfile = await pullProfile();
      profileSyncedRef.current = remoteProfile ? JSON.stringify(remoteProfile) : "";
      if (remoteProfile) setProfileState((p) => (!p || (remoteProfile.updatedAt ?? 0) > (p.updatedAt ?? 0) ? remoteProfile : p));
    } catch {
      profileSyncedRef.current = null; // no profile table yet (see docs/SUPABASE_SETUP.md); days still sync
    }
  }, [session]);

  useEffect(() => {
    if (!session) { syncedRef.current = null; return; }
    pull();
    const onVisible = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [session, pull]);

  useEffect(() => {
    if (!session || !syncedRef.current) return;
    const changed = changedDays(history, syncedRef.current);
    if (!changed.length) return;
    const t = setTimeout(async () => {
      setCloud((c) => ({ ...c, state: "syncing" }));
      try {
        await pushDays(session.user.id, changed);
        changed.forEach((d) => syncedRef.current?.set(d.date, JSON.stringify(d)));
        setCloud({ state: "synced", at: Date.now() });
      } catch (e) {
        setCloud({ state: "error", message: e.message });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [history, session]);

  useEffect(() => {
    if (!session || !profile || profileSyncedRef.current == null) return;
    const json = JSON.stringify(profile);
    if (json === profileSyncedRef.current) return;
    const t = setTimeout(() => {
      pushProfile(session.user.id, profile).then(() => { profileSyncedRef.current = json; }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [profile, session]);

  // Live: another device's save arrives here within a second, while this tab is open
  useEffect(() => {
    if (!supabase || !session) return;
    const channel = supabase
      .channel(`days-${session.user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "days", filter: `user_id=eq.${session.user.id}` },
        ({ new: row }) => {
          if (!row?.data?.date) return; // deletes carry no data
          syncedRef.current?.set(row.data.date, JSON.stringify(row.data));
          setHistory((h) => mergeHistories(h, [row.data]));
          setCloud({ state: "synced", at: Date.now() });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // The dashboard always shows the newest check-in in history, wherever it was made.
  useEffect(() => {
    const latest = latestRatings(history);
    if (!latest) return;
    setCheckin((c) => (Object.entries(latest).every(([k, v]) => c[k] === v) ? c : { ...c, ...latest }));
  }, [history]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCloud({ state: "idle" });
    setSyncOpen(false);
  };

  // The form is for changing how you feel, so it stamps the ratings (and sleep quality) with today's date
  const handleSubmit = (next) => {
    const { override, ...rest } = next;
    commitCheckin({ ...rest, ratedOn: today, sleepQualityRatedOn: today }, { override: override ?? null });
    setModalOpen(false);
    setNotice(null);
    setRestedPrompt(false);
  };

  const realDays = history.filter((h) => Number.isFinite(h.score) && h.date < today).slice(-6);
  const isExample = realDays.length < 2;
  const weekdayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
  const trend = isExample
    ? [...EXAMPLE_TREND.map((score, i) => ({ day: `-${6 - i}d`, score })), { day: "Today", score: result.score }]
    : [...realDays.map((h) => ({ day: weekdayLabel(h.date), score: h.score })), { day: "Today", score: result.score }];

  const now = new Date();
  const longDate = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDate = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const syncedToday = lastSync?.date === today;
  const checkedInToday = history.some((h) => h.date === today && Number.isFinite(h.score));
  const hasCheckins = history.some((h) => Number.isFinite(h.score));

  const review = useMemo(() => weeklyReview(history, today), [history, today]);

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
            <SyncChip cloud={cloud} signedIn={!!session} onClick={() => setSyncOpen(true)} />
            <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ${syncedToday ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-slate-400"}`}>
              <RefreshCw size={12} />
              {syncedToday
                ? `Apple Health · ${new Date(lastSync.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                : "Not synced today"}
            </span>
            <button onClick={() => setSettingsOpen(true)} aria-label="Settings"
              className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300">
              <Settings size={17} />
            </button>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300">
              <ClipboardCheck size={17} /> {checkedInToday ? "Update check-in" : "Check in"}
            </button>
          </div>
        </header>

        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-2.5 text-sm text-emerald-200" role="status">
            <div className="flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button onClick={() => { setNotice(null); setRestedPrompt(false); }} aria-label="Dismiss" className="text-emerald-300/70 hover:text-emerald-200"><X size={16} /></button>
            </div>
            {restedPrompt && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-slate-200">How rested do you feel?</span>
                {[["Poor", 3], ["OK", 6], ["Great", 9]].map(([label, q]) => (
                  <button key={label} onClick={() => rateRested(q)}
                    className="rounded-lg border border-emerald-300/30 px-3 py-1 text-emerald-100 hover:bg-emerald-300/10">{label}</button>
                ))}
                <span className="text-xs text-emerald-200/60">Until you answer, sleep is scored on duration only.</span>
              </div>
            )}
          </div>
        )}

        {!checkedInToday && (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-sm text-amber-200">
            {hasCheckins ? "No sync yet today. The plan below uses your last check-in. Run your Health Sync Shortcut to update it." : "No data yet. Run your Health Sync Shortcut, or tap Check in to enter numbers by hand."}
          </p>
        )}

        <div className="mt-6">
          {day.brief
            ? <BriefCard brief={day.brief} archetype={archetype} result={result} onOpenSettings={() => setSettingsOpen(true)} />
            : <BriefSetupCard onOpenSettings={() => setSettingsOpen(true)} />}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <RecoveryCard result={result} archetype={archetype} baselines={baselines} dateLabel={shortDate}
            confidence={day.confidence} baselineNights={day.baselineNights} stages={day.stages} />
          <div className="flex min-w-0 flex-col gap-4">
            <DirectionsCard directives={directives} />
            <TrendCard data={trend} isExample={isExample} />
          </div>
        </div>

        <div className="mt-4">
          <VitalsStrip c={checkin} result={result} baselines={baselines} sleepDebt={day.sleepDebt} activity={day.activity} spo2={day.spo2} />
        </div>

        {day.session && (
          <div className="mt-4">
            <TrainingCard session={day.session} onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <ScheduleTimeline items={schedule} done={done} toggle={toggle} accent={archetype.color} />
          <MobilityPanel drills={drills} done={done} toggle={toggle} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <HrLoadCard load={day.load} maxHr={day.maxHr} />
          <InsightsCard history={history} today={today} />
        </div>

        <div className="mt-4">
          <WeeklyReviewCard review={review} />
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-slate-500">
          {session
            ? "Synced to your private database. Only you can read it."
            : "Your data stays in this browser on this device. Nothing is uploaded unless you turn on sync."}
        </p>
      </div>

      {syncOpen && supabase && (
        <SyncModal session={session} cloud={cloud} onClose={() => setSyncOpen(false)} onSyncNow={pull} onSignOut={signOut} />
      )}
      {modalOpen && (
        <CheckInModal initial={dayCheckin} synced={syncedToday ? lastSync : null} history={history} today={today} profile={fullProfile}
          onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />
      )}
      {settingsOpen && (
        <SettingsModal profile={profile} footballRecoveryH={learned.footballRecoveryH} onClose={() => setSettingsOpen(false)}
          onSave={(p) => { setProfile({ ...(profile || {}), ...p }); setSettingsOpen(false); }} />
      )}
    </div>
  );
}

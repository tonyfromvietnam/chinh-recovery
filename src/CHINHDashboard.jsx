import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Moon, HeartPulse, Activity, Sun, Dumbbell, Brain, Wind, ShoppingCart,
  BedDouble, Footprints, ClipboardCheck, X, Zap, Check, BookOpen, Utensils,
  Info, Target,
} from "lucide-react";

/* =========================================================================
   1. RECOVERY ENGINE  (weights from Recovery_Algorithm_and_Schedule_Logic.md)
   Sleep 35% · HRV & RHR 35% · Soreness/Stiffness 20% · Mental Energy 10%
   ========================================================================= */
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function calculateRecovery(c) {
  // Sleep: half duration (vs 8h target), half subjective quality
  const sleep = clamp01(c.sleepHours / 8) * 0.5 + (c.sleepQuality / 10) * 0.5;

  // Autonomic: HRV vs personal baseline (60%) + RHR vs baseline (40%)
  const hrvRatio = c.hrv / c.hrvBaseline;
  const hrvScore = clamp01((hrvRatio - 0.7) / 0.45); // 70% of baseline → 0, 115% → 1
  const rhrScore = clamp01((c.rhrBaseline + 7 - c.rhr) / 12); // +7 bpm over baseline → 0
  const autonomic = hrvScore * 0.6 + rhrScore * 0.4;

  // Soreness: 1 = none, 5 = severe (ankle/hips weighted higher during sprain rehab)
  const sorenessAvg = (c.upper + c.lower + c.ankleHip * 2) / 4;
  const soreness = clamp01((5 - sorenessAvg) / 4);

  // Mental energy: 1 = drained, 5 = sharp
  const mental = clamp01((c.energy - 1) / 4);

  const parts = [
    { key: "sleep", label: "Sleep", weight: 35, value: sleep, icon: Moon },
    { key: "autonomic", label: "HRV & RHR", weight: 35, value: autonomic, icon: HeartPulse },
    { key: "soreness", label: "Soreness", weight: 20, value: soreness, icon: Activity },
    { key: "mental", label: "Mental energy", weight: 10, value: mental, icon: Brain },
  ].map((p) => ({ ...p, points: p.value * p.weight }));

  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  return { score, parts, hrvRatio };
}

export function getArchetype(score) {
  if (score >= 80)
    return { id: "high", label: "HIGH OUTPUT DAY", color: "#22e58b", tint: "rgba(34,229,139,0.12)",
      summary: "Green light. Load heavy, go deep on focus work, chase intensity." };
  if (score >= 50)
    return { id: "balanced", label: "BALANCED FLOW DAY", color: "#facc15", tint: "rgba(250,204,21,0.12)",
      summary: "Train with intent, not ego. Technique-first volume and structured work." };
  return { id: "restore", label: "ACTIVE RESTORATION DAY", color: "#fb5a6e", tint: "rgba(251,90,110,0.12)",
    summary: "Your system is asking for parasympathetic time. Recover hard today." };
}

/* =========================================================================
   2. SCHEDULE GENERATOR
   ========================================================================= */
const TYPE_META = {
  sun: { icon: Sun, color: "#fbbf24", label: "Morning" },
  mobility: { icon: Footprints, color: "#22d3ee", label: "Mobility" },
  focus: { icon: Brain, color: "#a78bfa", label: "Deep work" },
  work: { icon: ClipboardCheck, color: "#94a3b8", label: "Work" },
  breath: { icon: Wind, color: "#5eead4", label: "Breathwork" },
  training: { icon: Dumbbell, color: "#22e58b", label: "Training" },
  errands: { icon: ShoppingCart, color: "#f97316", label: "Errands" },
  fuel: { icon: Utensils, color: "#fda4af", label: "Fuel" },
  study: { icon: BookOpen, color: "#a78bfa", label: "Study" },
  wind: { icon: BedDouble, color: "#818cf8", label: "Wind-down" },
};

export function generateSchedule(archetypeId, c) {
  const ankleFlag = c.ankleHip >= 4;
  const lowerFlag = c.lower >= 4;

  const plans = {
    high: [
      ["07:00", 15, "sun", "Morning sun & 500 ml water", "10 min outside before screens. Add electrolytes."],
      ["07:30", 10, "mobility", "Dynamic warm-up + ankle primer", "Knee-to-Wall Pulses, Ankle CARs, World's Greatest Stretch."],
      ["09:00", 120, "focus", "Deep focus engineering block", "Phone in another room. One problem, two hours."],
      ["11:15", 60, "work", "CRM analysis & reporting", "Batch Slack and email at the end of the block."],
      ["12:30", 40, "fuel", "Lunch + 10-min walk", "40 g protein. Walk to bank daylight."],
      ["14:00", 10, "breath", "Box breathing 4-4-4-4", "Reset before the afternoon push."],
      ["14:15", 120, "work", "Structured work & meetings", "Hardest stakeholder tasks first."],
      ["17:00", 75, "training",
        ankleFlag ? "Heavy lift (football on hold)" : "Heavy lift or football session",
        ankleFlag
          ? "Ankle/hip stiffness is 4+. Lift today; skip cutting and sprint work."
          : "Top sets at RPE 8–9. Full ankle warm-up before any football."],
      ["19:00", 45, "fuel", "Recovery dinner", "Carbs + protein within 2 h of training."],
      ["21:30", 45, "wind", "Wind-down & screens off", "Dim lights, 10-min reading, 18 °C bedroom."],
    ],
    balanced: [
      ["07:00", 15, "sun", "Morning sun & hydration", "Light exposure anchors tonight's sleep."],
      ["07:30", 15, "mobility", "Ankle & hip mobility drills", "Full drill list in the mobility panel."],
      ["09:00", 180, "work", "Structured work & meetings", "CRM pipeline review, then meetings."],
      ["12:30", 30, "fuel", "Lunch + short walk", "Easy pace. Keep steps flowing."],
      ["14:00", 15, "breath", "Breathwork & meditation", "Physiological sighs, then 10 min guided."],
      ["14:30", 90, "study", "Deep study block", "One 90-min sprint. Stop while it's going well."],
      ["17:30", 60, "training",
        lowerFlag ? "Upper hypertrophy (technique focus)" : "Hypertrophy session (technique focus)",
        lowerFlag
          ? "Lower body is sore. Shift to upper; keep 2 reps in reserve."
          : "Moderate load, 2–3 reps in reserve, controlled tempo."],
      ["19:00", 45, "fuel", "Dinner & meal prep for tomorrow", "Prep tomorrow's lunch now."],
      ["21:30", 45, "wind", "Wind-down routine", "No screens after 22:00. Lights out 22:30."],
    ],
    restore: [
      ["08:00", 20, "sun", "Gentle walk & hydration", "Nasal breathing only. Zone 1 pace."],
      ["09:00", 20, "breath", "Deep meditation & breathwork", "NSDR or 4-7-8 breathing. Lie down."],
      ["10:30", 90, "study", "Passive study / reading", "Lectures, docs, or a book. No hard problem solving."],
      ["12:30", 40, "fuel", "Nutrient-dense lunch", "Extra protein and colourful veg for repair."],
      ["14:00", 90, "errands", "Grocery shopping & meal prep", "Light movement that counts. Prep 3 meals."],
      ["16:30", 30, "mobility", "Full mobility & foam rolling", "Calves, quads, adductors, T-spine. Slow tempo."],
      ["18:30", 45, "fuel", "Early dinner", "Finish eating 3 h before bed."],
      ["21:00", 60, "wind", "Extended wind-down", "Warm shower, journal, lights out by 22:00."],
    ],
  };

  return plans[archetypeId].map(([time, dur, type, title, detail], i) => ({
    id: `${archetypeId}-${i}`, time, dur, type, title, detail,
  }));
}

/* =========================================================================
   3. MOBILITY ENGINE  (Mobility_and_Movement_Guide.md)
   ========================================================================= */
const DRILLS = [
  { id: "k2w", name: "Knee-to-Wall Dynamic Pulses", area: "ankle", required: true,
    dose: "10–12 reps / side", cue: "Foot 5–8 cm from wall. Heel stays down." },
  { id: "cars", name: "Ankle CARs", area: "ankle",
    dose: "5 reps each direction", cue: "Slow 360° circles at your end range." },
  { id: "9090", name: "90/90 Hip Switches", area: "hip", required: true,
    dose: "8–10 reps / side", cue: "Switch knees without using your hands." },
  { id: "cossack", name: "Cossack Squats", area: "hip", required: true,
    dose: "6–8 reps / side", cue: "Sit deep into one side, opposite leg long." },
  { id: "wgs", name: "World's Greatest Stretch", area: "hip", required: true,
    dose: "5 reps / side", cue: "Lunge, elbow to ankle, rotate to ceiling." },
  { id: "drop", name: "Drop Squats", area: "chain", minDay: "balanced",
    dose: "3 × 8", cue: "Drop fast through the hips. Stick the landing." },
  { id: "slrdl", name: "Single-Leg RDL", area: "chain", minDay: "balanced",
    dose: "3 × 8–10 / side", cue: "Hips level. Ankle grips the floor." },
  { id: "carry", name: "Suitcase Carry", area: "chain", minDay: "high",
    dose: "3 × 20–30 m / side", cue: "Heavy bell. Torso stays vertical." },
];

const DAY_RANK = { restore: 0, balanced: 1, high: 2 };

export function buildMobility(c, archetypeId) {
  const areaLoad = { ankle: c.ankleHip, hip: Math.max(c.ankleHip, c.lower), chain: c.lower };
  return DRILLS
    .filter((d) => d.required || d.area !== "chain" || DAY_RANK[archetypeId] >= DAY_RANK[d.minDay])
    .map((d) => {
      const load = areaLoad[d.area];
      const priority = load >= 4 ? "High" : load >= 3 ? "Medium" : "Maintain";
      return { ...d, priority, load };
    })
    .sort((a, b) => b.load - a.load || Number(!!b.required) - Number(!!a.required));
}

/* =========================================================================
   4. DEMO DATA  (example values, replace with real check-ins)
   ========================================================================= */
const DEFAULT_CHECKIN = {
  sleepHours: 7.2, sleepQuality: 7, hrv: 62, hrvBaseline: 66, rhr: 55, rhrBaseline: 54,
  upper: 2, lower: 3, ankleHip: 3, energy: 4,
};
const DEMO_HISTORY = [
  { day: "Fri", score: 74 }, { day: "Sat", score: 83 }, { day: "Sun", score: 46 },
  { day: "Mon", score: 58 }, { day: "Tue", score: 81 }, { day: "Wed", score: 69 },
];

/* =========================================================================
   5. UI COMPONENTS
   ========================================================================= */
const Card = ({ className = "", children }) => (
  <section className={`rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-xl ${className}`}>
    {children}
  </section>
);

const Eyebrow = ({ children }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">{children}</p>
);

function ScoreRing({ score, color, size = 220 }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 400ms", filter: `drop-shadow(0 0 10px ${color}66)` }}
        />
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
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{ borderColor: checked ? color : "rgba(148,163,184,0.4)", background: checked ? color : "transparent" }}
    >
      {checked && <Check size={15} strokeWidth={3.5} color="#0b1220" />}
    </button>
  );
}

function RecoveryCard({ result, archetype }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Recovery score</Eyebrow>
        <span className="font-mono text-[11px] text-slate-500">Thu 15 Oct</span>
      </div>
      <div className="mt-4 flex flex-col items-center gap-5">
        <ScoreRing score={result.score} color={archetype.color} />
        <div
          className="rounded-full border px-4 py-1.5 font-display text-lg font-semibold tracking-[0.08em]"
          style={{ color: archetype.color, borderColor: `${archetype.color}55`, background: archetype.tint }}
        >
          {archetype.label}
        </div>
        <p className="max-w-xs text-center text-sm text-slate-300">{archetype.summary}</p>
      </div>
      <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
        {result.parts.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.key} className="grid grid-cols-[18px_1fr_auto] items-center gap-3">
              <Icon size={16} className="text-slate-400" />
              <div className="min-w-0">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{p.label}</span>
                  <span className="font-mono text-slate-500">{p.weight}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700/50">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p.value * 100}%`, background: archetype.color }} />
                </div>
              </div>
              <span className="w-12 text-right font-mono text-sm tabular-nums text-slate-200">
                {p.points.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TrendCard({ history, today }) {
  const data = [...history, { day: "Today", score: today }];
  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Eyebrow>7-day recovery</Eyebrow>
          <p className="mt-1 font-display text-3xl font-semibold text-slate-100 tabular-nums">
            {avg}<span className="text-lg text-slate-500">% avg</span>
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-500">Example history</span>
      </div>
      <div className="mt-3 h-40">
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
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#22d3ee" }}
              formatter={(v) => [`${v}%`, "Recovery"]}
            />
            <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2.5} fill="url(#trendFill)"
              dot={{ r: 3, fill: "#0f172a", stroke: "#22d3ee", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#22d3ee" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function VitalsStrip({ c, hrvRatio }) {
  const tiles = [
    { label: "Sleep", value: `${c.sleepHours.toFixed(1)}h`, sub: `Quality ${c.sleepQuality}/10`, icon: Moon },
    { label: "HRV", value: `${c.hrv}`, unit: "ms", sub: `${Math.round(hrvRatio * 100)}% of baseline`, icon: HeartPulse },
    { label: "Resting HR", value: `${c.rhr}`, unit: "bpm", sub: `Baseline ${c.rhrBaseline}`, icon: Activity },
    { label: "Ankle / hips", value: `${c.ankleHip}`, unit: "/5", sub: c.ankleHip >= 4 ? "Stiff — prioritise" : "Manageable", icon: Footprints },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Card key={t.label} className="p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Icon size={14} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{t.label}</span>
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
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border"
                style={{ borderColor: `${meta.color}55`, background: "#0f172a" }}>
                <Icon size={15} color={meta.color} />
              </span>
              <div className={`flex min-w-0 items-start gap-3 rounded-xl px-3 py-2 transition ${isDone ? "bg-transparent" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-100"}`}>{item.title}</p>
                    <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: meta.color, background: `${meta.color}1a` }}>{fmtDur(item.dur)}</span>
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
                  <span className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: prColor[d.priority], background: `${prColor[d.priority]}1a` }}>{d.priority}</span>
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

function NumberField({ id, label, value, unit, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-400">{label}</label>
      <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-950/60 px-3 focus-within:border-cyan-400/60">
        <input id={id} type="number" inputMode="numeric" value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent py-2 font-mono text-slate-100 outline-none" />
        <span className="font-mono text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function CheckInModal({ initial, onClose, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const preview = calculateRecovery(f);
  const arch = getArchetype(preview.score);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 sm:rounded-3xl sm:p-7"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Morning check-in</Eyebrow>
            <h2 id="checkin-title" className="mt-1 font-display text-3xl font-semibold text-slate-100">How did you wake up?</h2>
          </div>
          <button onClick={onClose} aria-label="Close check-in"
            className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Moon size={15} /> Sleep</legend>
            <Slider id="sleepHours" label="Duration" value={f.sleepHours} min={3} max={10} step={0.1} unit="h" onChange={set("sleepHours")} />
            <Slider id="sleepQuality" label="Quality" value={f.sleepQuality} min={1} max={10} unit="/10" onChange={set("sleepQuality")} />
          </fieldset>

          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><HeartPulse size={15} /> Autonomic</legend>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="hrv" label="HRV today" value={f.hrv} unit="ms" onChange={set("hrv")} />
              <NumberField id="hrvBaseline" label="HRV baseline" value={f.hrvBaseline} unit="ms" onChange={set("hrvBaseline")} />
              <NumberField id="rhr" label="Resting HR today" value={f.rhr} unit="bpm" onChange={set("rhr")} />
              <NumberField id="rhrBaseline" label="RHR baseline" value={f.rhrBaseline} unit="bpm" onChange={set("rhrBaseline")} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Activity size={15} /> Soreness & stiffness</legend>
            <Slider id="upper" label="Upper body" value={f.upper} min={1} max={5} unit="/5" onChange={set("upper")} hint="1 none · 5 severe" />
            <Slider id="lower" label="Lower body" value={f.lower} min={1} max={5} unit="/5" onChange={set("lower")} />
            <Slider id="ankleHip" label="Ankle / hips" value={f.ankleHip} min={1} max={5} unit="/5" onChange={set("ankleHip")} hint="Counts double during sprain rehab" />
          </fieldset>

          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Brain size={15} /> Mind</legend>
            <Slider id="energy" label="Mental energy" value={f.energy} min={1} max={5} unit="/5" onChange={set("energy")} hint="1 drained · 5 sharp" />
          </fieldset>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-slate-950/50 p-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">Live preview</p>
            <p className="font-display text-lg font-semibold tracking-wide" style={{ color: arch.color }}>{arch.label}</p>
          </div>
          <span className="font-display text-4xl font-bold tabular-nums" style={{ color: arch.color }}>{preview.score}%</span>
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
   6. MAIN DASHBOARD
   ========================================================================= */
const STORAGE_KEY = "chinh-v1-2026-10-15";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

export default function CHINHDashboard() {
  const saved = loadSaved();
  const [checkin, setCheckin] = useState(saved?.checkin || DEFAULT_CHECKIN);
  const [done, setDone] = useState(saved?.done || {});
  const [modalOpen, setModalOpen] = useState(false);

  const result = useMemo(() => calculateRecovery(checkin), [checkin]);
  const archetype = getArchetype(result.score);
  const schedule = useMemo(() => generateSchedule(archetype.id, checkin), [archetype.id, checkin]);
  const drills = useMemo(() => buildMobility(checkin, archetype.id), [checkin, archetype.id]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ checkin, done })); } catch { /* storage unavailable */ }
  }, [checkin, done]);

  const toggle = (id) => setDone((d) => ({ ...d, [id]: !d[id] }));

  const handleSubmit = (next) => {
    setCheckin(next);
    setDone((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.includes("-")))); // keep drills, reset schedule
    setModalOpen(false);
  };

  const flags = [];
  if (checkin.ankleHip >= 4) flags.push("Ankle/hip stiffness is 4+. No cutting or sprint drills today.");
  if (result.hrvRatio < 0.85) flags.push(`HRV is ${Math.round(result.hrvRatio * 100)}% of baseline. Cap intensity at RPE 7.`);
  if (checkin.sleepHours < 6.5) flags.push("Under 6.5 h sleep. Add a 20-min NSDR block after lunch.");

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
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Thursday · 15 October 2026</p>
            </div>
          </div>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300">
            <ClipboardCheck size={17} /> Morning check-in
          </button>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <RecoveryCard result={result} archetype={archetype} />
          <div className="flex min-w-0 flex-col gap-4">
            <TrendCard history={DEMO_HISTORY} today={result.score} />
            <VitalsStrip c={checkin} hrvRatio={result.hrvRatio} />
            {flags.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-amber-300">
                  <Info size={15} /><span className="font-mono text-[11px] uppercase tracking-[0.14em]">Coach notes</span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {flags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <ScheduleTimeline items={schedule} done={done} toggle={toggle} accent={archetype.color} />
          <MobilityPanel drills={drills} done={done} toggle={toggle} />
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-slate-500">
          Example check-in and 6-day history pre-loaded. Open Morning check-in to enter your own numbers.
        </p>
      </div>

      {modalOpen && <CheckInModal initial={checkin} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} />}
    </div>
  );
}

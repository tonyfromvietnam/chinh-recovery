/* M5 — What CHINH has learned about you from the strap: sleep need, body clock, football recovery (M7.1), habit effects, baseline shifts. */
import React, { useMemo, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardHeader, Chips, VERDICT_TONE } from "./ui.jsx";
import {
  baselineMap, tagEffects, estimateSleepNeed, chronotype, baselineShift, footballRecoveryProfile, OUTCOMES, TAG_LABELS, TARGETS, LEARNING, LOAD,
} from "../engine.js";

const hm = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")} m`;

function Progress({ n, needed }) {
  return (
    <span className="font-mono text-[11px] text-slate-500">
      {Math.min(n, needed)}/{needed}
      <span className="ml-2 inline-block h-1 w-16 overflow-hidden rounded-full bg-slate-700/50 align-middle">
        <span className="block h-full bg-cyan-300/70" style={{ width: `${Math.min(1, n / needed) * 100}%` }} />
      </span>
    </span>
  );
}

function Learned({ label, value, fallback, n, needed, note }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-slate-900/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {value != null ? (
        <>
          <p className="mt-1 font-display text-xl font-semibold text-emerald-300">{value}</p>
          <p className="text-[11px] text-slate-400">Default was {fallback} · learned from {n}</p>
        </>
      ) : (
        <>
          <p className="mt-1 font-display text-xl font-semibold text-slate-300">{fallback} <span className="text-xs text-slate-500">default</span></p>
          <Progress n={n} needed={needed} />
        </>
      )}
      {note && <p className="mt-1 text-[11px] text-slate-500">{note}</p>}
    </div>
  );
}

export default function InsightsCard({ history, today }) {
  const [lag, setLag] = useState(1);
  const [outcome, setOutcome] = useState("nextHrvPct");
  const bmap = useMemo(() => baselineMap(history), [history]);
  const sleep = useMemo(() => estimateSleepNeed(history, bmap), [history, bmap]);
  const chrono = useMemo(() => chronotype(history), [history]);
  const football = useMemo(() => footballRecoveryProfile(history, bmap), [history, bmap]);
  const shift = useMemo(() => baselineShift(history, today), [history, today]);
  const effects = useMemo(() => tagEffects(history, today, { outcome, lag, bmap }), [history, today, outcome, lag, bmap]);
  const meta = OUTCOMES[outcome];

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Personal insights" title="What CHINH has learned about you"
        sub="Values switch from the research default to yours only once there's enough data." right={<Sparkles size={20} className="text-amber-300" />} />

      {shift.ready && shift.hrv?.shifted && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${shift.hrv.direction === "up" ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>
          {shift.hrv.direction === "up" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          <span>{shift.hrv.direction === "up"
            ? `Your HRV baseline has risen ${shift.hrv.pct} % since ${shift.hrv.sinceDate}. Fitness is improving.`
            : `Your HRV baseline has dropped ${Math.abs(shift.hrv.pct)} % since ${shift.hrv.sinceDate}. Check sleep, stress and load.`}</span>
        </div>
      )}
      {shift.ready && shift.rhr?.shifted && (
        <p className="mt-2 text-xs text-slate-400">Resting HR has shifted {shift.rhr.direction} ({shift.rhr.delta > 0 ? "+" : ""}{shift.rhr.delta} bpm) since {shift.rhr.sinceDate}.</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Learned label="Sleep need" value={sleep.hours != null ? hm(sleep.hours) : null} fallback={`${TARGETS.sleepNeedH} h`}
          n={sleep.n} needed={sleep.needed} note="Nights before a morning with energy ≥ 4 and normal HRV" />
        <Learned label="Body clock" value={chrono.ready ? `${chrono.type} (mid-sleep ${chrono.msfsc})` : null} fallback="Not known"
          n={Math.min(chrono.nFree, LEARNING.chronotypeMinFree) + Math.min(chrono.nWork, LEARNING.chronotypeMinWork)}
          needed={LEARNING.chronotypeMinFree + LEARNING.chronotypeMinWork}
          note={chrono.ready ? `Social jetlag ${chrono.socialJetlagH} h (aim < 1 h)` : "Needs bed and wake times from the Shortcut"} />
        <Learned label="Football recovery" value={football.hours != null ? `${football.hours} h` : null} fallback={`${LOAD.defaultFootballRecoveryH} h`}
          n={football.n} needed={football.needed}
          note="Hours until HRV and resting HR are back to normal after football days the strap picked up" />
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">What late nights and big days do to you</p>
            <p className="text-xs text-slate-500">Bed after 23:30, and days with 1.5× your usual active energy, against the rest (from the strap), last 90 days. Needs {LEARNING.tagMinEach} of each.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chips label="Outcome" value={outcome} onChange={setOutcome}
              options={["nextHrvPct", "nextRhr", "sleepHours", "energy"].map((k) => ({ value: k, label: OUTCOMES[k].label.replace("Next-morning ", "").replace("Next-day ", "") }))} />
            <Chips label="Window" value={lag} onChange={setLag} options={[{ value: 1, label: "Next day" }, { value: 3, label: "Next 3 days" }]} />
          </div>
        </div>
        {effects.length ? (
          <ul className="mt-3 space-y-1.5">
            {effects.map((r) => (
              <li key={r.tag} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-slate-900/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="text-slate-200">{TAG_LABELS[r.tag] || r.tag}</span>
                  <span className="ml-2 font-mono text-[11px] text-slate-500">
                    {r.verdict === "not enough data" ? `${r.nWith}/${LEARNING.tagMinEach} days with · ${r.nWithout}/${LEARNING.tagMinEach} without`
                      : `${r.diff > 0 ? "+" : ""}${r.diff} ${meta.unit} (95 % CI ${r.ci95[0]} to ${r.ci95[1]})`}
                  </span>
                </div>
                <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${VERDICT_TONE[r.verdict]}`}>{r.verdict}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Needs bed and wake times from the morning Shortcut (v2). Effects appear here once there are enough nights.</p>
        )}
      </div>

    </Card>
  );
}

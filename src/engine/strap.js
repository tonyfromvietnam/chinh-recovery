/* M7 — More from the Helio Strap: heart-rate training load (7.1), steps and active energy (7.2),
   overnight blood oxygen (7.3) and sleep stages (7.4). Everything here comes from the strap via
   Zepp → Apple Health → Shortcut; nothing is entered by hand. */
import { isNum, mean, median, round1, shiftKey, weekday } from "./util.js";
import { usableForLearning } from "./confidence.js";

/* Zones are fractions of max HR: zone 1 is 50–60 %, … zone 5 is 90–100 % */
export const HR = {
  zones: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  maxWindowDays: 90,
  maxMinDays: 10, // days of hrMax needed before max HR is learned
  maxPercentile: 98, // the 98th percentile ignores the odd spike from a loose strap
  defaultInterval: 60, // seconds between HR samples during activity (`hri`)
  sessionMin: 60, // a day with this much TRIMP counts as a session
  loadMinPriorDays: 4, // the 4-week comparison starts once the 4 prior weeks have this many days with HR data
  loadSpikeRatio: 1.5, // advisory only
};

export const ACTIVITY = {
  medianDays: 30,
  minDays: 7, // days of history before a median is shown
  bigDayRatio: 1.5, // active energy ≥ 1.5 × your median → "big-day" tag
  lowSteps: 5000, // under this yesterday → an easy walk on restoration days
  walkMin: 30,
  walkTime: "15:45",
};

export const SPO2 = {
  baselineDays: 30,
  minDays: 5,
  dropPts: 2, // average this far under baseline supports a raised-RHR warning
  artefactMin: 88, // a single overnight minimum below this is most likely a loose strap
};

/* ---------- M7.1 Heart-rate training load ---------- */

/* Max HR: profile.maxHr if set, else the 98th percentile of daily maxima over 90 days (≥ 10 days), else null */
export function personalMaxHr(history, profile = null, today = null) {
  if (isNum(profile?.maxHr) && profile.maxHr > 100) return { bpm: Math.round(profile.maxHr), source: "set" };
  const end = today ?? history[history.length - 1]?.date;
  const from = end ? shiftKey(end, -HR.maxWindowDays) : "";
  const xs = history.filter((h) => h.date > from && (!end || h.date <= end) && isNum(h.hrMax)).map((h) => h.hrMax).sort((a, b) => a - b);
  if (xs.length < HR.maxMinDays) return { bpm: null, source: null, days: xs.length, needed: HR.maxMinDays };
  const rank = (HR.maxPercentile / 100) * (xs.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return { bpm: Math.round(xs[lo] + (xs[hi] - xs[lo]) * (rank - lo)), source: "learned", days: xs.length, needed: HR.maxMinDays };
}

/* bpm boundaries of zones 1–5, for setting up the Shortcut */
export function zoneBounds(maxHr) {
  if (!isNum(maxHr)) return [];
  return [1, 2, 3, 4, 5].map((z) => ({ zone: z, from: Math.round(maxHr * HR.zones[z - 1]), to: Math.round(maxHr * HR.zones[z]) }));
}

/* HR sample counts per zone → minutes per zone */
export function zoneMinutes(counts, hri = HR.defaultInterval) {
  if (!Array.isArray(counts) || counts.length !== 5 || !counts.every((c) => isNum(c) && c >= 0)) return null;
  const interval = isNum(hri) && hri > 0 ? hri : HR.defaultInterval;
  return counts.map((c) => round1((c * interval) / 60));
}

/* Edwards TRIMP: minutes in each zone × the zone number */
export function hrLoad(minutes) {
  if (!Array.isArray(minutes) || minutes.length !== 5) return null;
  return Math.round(minutes.reduce((s, m, i) => s + (isNum(m) ? m : 0) * (i + 1), 0));
}

const dayLoad = (h) => (h && Array.isArray(h.hrZones) ? hrLoad(h.hrZones) : null);

/* A day with enough load becomes a session, typed from the weekly plan. Zone 2+ minutes are its length. */
export function autoSession(date, minutes, profile = null) {
  const load = hrLoad(minutes);
  if (load == null || load < HR.sessionMin) return null;
  const planned = profile?.template?.[weekday(date)];
  return {
    type: planned && planned !== "rest" ? planned : "other",
    auto: true,
    minutes: Math.round(minutes.slice(1).reduce((s, m) => s + m, 0)),
    load,
  };
}

/* This week's load vs the 4 weeks before. Advisory only: it never changes a decision. */
export function hrLoadSummary(history, today) {
  const byDate = new Map(history.map((h) => [h.date, h]));
  const series = (from, to) => {
    const out = [];
    for (let d = from; d <= to; d = shiftKey(d, 1)) out.push({ date: d, load: dayLoad(byDate.get(d)) });
    return out;
  };
  const week = series(shiftKey(today, -6), today);
  const prior = series(shiftKey(today, -34), shiftKey(today, -7));
  const priorDays = prior.filter((d) => d.load != null).length;
  const weekLoad = week.reduce((s, d) => s + (d.load ?? 0), 0);
  const ready = priorDays >= HR.loadMinPriorDays;
  const chronic = ready ? Math.round(prior.reduce((s, d) => s + (d.load ?? 0), 0) / 4) : null;
  const ratio = chronic ? round1(weekLoad / chronic) : null;
  return {
    week: weekLoad, chronic4wkAvg: chronic, ratio, ready, priorDays, needed: HR.loadMinPriorDays,
    spike: ratio != null && ratio > HR.loadSpikeRatio,
    sessions: week.filter((d) => (d.load ?? 0) >= HR.sessionMin).length,
    days: series(shiftKey(today, -27), today),
    hasData: history.some((h) => Array.isArray(h.hrZones)),
  };
}

/* ---------- M7.2 Steps and active energy ---------- */

/* Median of `key` over the 30 days before `date` (needs ACTIVITY.minDays) */
export function medianBefore(byDate, date, key) {
  const xs = [];
  for (let k = 1; k <= ACTIVITY.medianDays; k++) {
    const v = byDate.get(shiftKey(date, -k))?.[key];
    if (isNum(v)) xs.push(v);
  }
  return xs.length >= ACTIVITY.minDays ? median(xs) : null;
}

export function isBigDay(day, byDate) {
  if (!isNum(day?.activeKcal)) return false;
  const m = medianBefore(byDate, day.date, "activeKcal");
  return m != null && m > 0 && day.activeKcal >= ACTIVITY.bigDayRatio * m;
}

/* Yesterday's steps and active energy against your 30-day median */
export function activityVitals(history, today) {
  const byDate = new Map(history.map((h) => [h.date, h]));
  const date = shiftKey(today, -1);
  const y = byDate.get(date);
  if (!isNum(y?.steps) && !isNum(y?.activeKcal)) return null;
  return {
    date,
    steps: isNum(y.steps) ? y.steps : null,
    activeKcal: isNum(y.activeKcal) ? y.activeKcal : null,
    stepsMedian: medianBefore(byDate, date, "steps"),
    kcalMedian: medianBefore(byDate, date, "activeKcal"),
    bigDay: isBigDay(y, byDate),
    lowSteps: isNum(y.steps) && y.steps < ACTIVITY.lowSteps,
  };
}

/* Restoration days after a low-step day get a gentle walk. Movement, not training. */
export function addEasyWalk(schedule, archetypeId, activity) {
  if (archetypeId !== "restore" || !activity?.lowSteps || schedule.some((i) => i.id === "easy-walk")) return schedule;
  const walk = { id: "easy-walk", time: ACTIVITY.walkTime, dur: ACTIVITY.walkMin, type: "sun", title: `${ACTIVITY.walkMin}-min easy walk`,
    detail: `Only ${activity.steps.toLocaleString("en-GB")} steps yesterday. Conversational pace, outdoors if you can.` };
  return [...schedule, walk].sort((a, b) => a.time.localeCompare(b.time));
}

/* ---------- M7.3 Overnight blood oxygen ---------- */

/* 30-day mean, with the same exclusions as HRV (override and low-confidence days) */
export function spo2Baseline(history, today) {
  const xs = history.filter((h) => h.date < today && h.date >= shiftKey(today, -SPO2.baselineDays) && isNum(h.spo2) && usableForLearning(h)).map((h) => h.spo2);
  return xs.length >= SPO2.minDays ? { mean: round1(mean(xs)), days: xs.length } : { mean: null, days: xs.length, needed: SPO2.minDays };
}

/* Supporting signal only: never a direction of its own */
export function spo2Status(checkin, history, today) {
  if (!isNum(checkin?.spo2) && !isNum(checkin?.spo2Min)) return null;
  const base = spo2Baseline(history, today);
  const drop = isNum(checkin.spo2) && base.mean != null ? round1(base.mean - checkin.spo2) : null;
  return {
    value: isNum(checkin.spo2) ? checkin.spo2 : null,
    min: isNum(checkin.spo2Min) ? checkin.spo2Min : null,
    baseline: base.mean, baselineDays: base.days,
    drop, down: drop != null && drop >= SPO2.dropPts,
    artefact: isNum(checkin.spo2Min) && checkin.spo2Min < SPO2.artefactMin,
  };
}

/* ---------- M7.4 Sleep stages (display only) ---------- */
export function sleepStages(stages) {
  if (!stages) return null;
  const parts = [["deep", "Deep"], ["core", "Core"], ["rem", "REM"]]
    .map(([key, label]) => ({ key, label, min: isNum(stages[key]) ? stages[key] : 0 }));
  const total = parts.reduce((s, p) => s + p.min, 0);
  return total > 0 ? { total, parts: parts.map((p) => ({ ...p, pct: Math.round((p.min / total) * 100) })) } : null;
}

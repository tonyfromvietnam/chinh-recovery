/* =========================================================================
   Morning sync and the decision record. Pure: the same steps run in the browser (sync link)
   and on the server (api/ingest.js), so both always reach the same score and plan.
   Imports from ../engine.js are used inside function bodies only (re-export cycle, see CLAUDE.md).
   ========================================================================= */
import { shiftKey } from "./util.js";
import { planDay, upsertDay, applyYesterday, learnProfile } from "../engine.js";

/* Bump when scoring, directions or the plan change, so every stored decision says which rules made it */
export const ENGINE_VERSION = "2026-10-26";

/* Example values used until the first real check-in */
export const DEFAULT_CHECKIN = {
  sleepHours: 7.2, sleepQuality: 7, hrv: 62, hrvBaseline: 66, rhr: 55, rhrBaseline: 54,
  upper: 2, lower: 3, ankleHip: 3, energy: 4,
};

/* Overnight readings belong to one night: stored on today's record, never carried over */
export const OVERNIGHT_KEYS = ["spo2", "spo2Min", "stages"];
export const overnightOf = (day) => Object.fromEntries(OVERNIGHT_KEYS.filter((k) => day?.[k] != null).map((k) => [k, day[k]]));

/* What a new check-in carries over from the newest real one, as the browser's saved check-in does:
   the self-ratings and when they were made, and the last readings in case one is missing today */
const CARRY_KEYS = ["hrv", "rhr", "sleepHours", "hrvCount", "hrvWindow", "bedTime", "wakeTime",
  "sleepQuality", "upper", "lower", "ankleHip", "energy", "ratedOn", "sleepQualityRatedOn"];
export function carryOverCheckin(history, stored = {}) {
  const last = [...history].reverse().find((d) => Number.isFinite(d.score));
  const fromDay = last ? Object.fromEntries(CARRY_KEYS.filter((k) => last[k] != null).map((k) => [k, last[k]])) : {};
  const { busy, fixtures, override, ...rest } = { ...DEFAULT_CHECKIN, ...stored, ...fromDay };
  return rest;
}

/* "Today" for CHINH is the owner's calendar day in London, wherever the code runs */
export function londonDate(now) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(now));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* Score a check-in and build today's day record. `extra` holds per-day fields (override, overnight
   readings) that must not carry over. Returns the plan and the record to upsert. */
export function checkinDay({ next, extra = {}, history, today, profile = null, now }) {
  const todayDay = history.find((h) => h.date === today) || null;
  const override = "override" in extra ? extra.override : todayDay?.override ?? null;
  const plan = planDay({ checkin: { ...next, ...overnightOf(todayDay), ...overnightOf(extra), override }, history, today, profile });
  const fields = {
    date: today, hrv: next.hrv, rhr: next.rhr, sleepHours: next.sleepHours, sleepQuality: next.sleepQuality,
    upper: next.upper, lower: next.lower, ankleHip: next.ankleHip, energy: next.energy, score: plan.result.score,
    hrvCount: next.hrvCount, hrvWindow: next.hrvWindow, bedTime: next.bedTime, wakeTime: next.wakeTime,
    ratedOn: next.ratedOn, sleepQualityRatedOn: next.sleepQualityRatedOn,
    confidence: plan.confidence.level, directives: plan.directives.map((d) => d.id), updatedAt: now, ...extra,
  };
  return { plan, entry: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
}

/* The whole morning sync: yesterday's strap data onto yesterday, today's readings scored with the
   carried-over ratings. `synced` is parseSyncHash's output. Returns everything a caller needs to save. */
export function ingestSync({ history, checkin, synced, today, profile = null, now }) {
  const { yesterday, overnight, ...measures } = synced;
  let next = history;
  const changed = [];
  if (yesterday && Object.keys(yesterday).length) {
    next = applyYesterday(next, today, yesterday, profile, now);
    changed.push(shiftKey(today, -1));
  }
  const fullProfile = profile ? { ...profile, learned: learnProfile(next, today) } : null;
  const nextCheckin = { ...checkin, ...measures };
  // syncedAt: when Apple Health data last arrived for today, whether the app or the server took it in
  const { plan, entry } = checkinDay({ next: nextCheckin, extra: { ...(overnight || {}), syncedAt: now }, history: next, today, profile: fullProfile, now });
  next = upsertDay(next, entry);
  changed.push(today);
  return { history: next, checkin: nextCheckin, plan, changedDates: changed };
}

/* ---------- The decision record ----------
   One immutable row per scoring: what went in, what the baselines were, how each part scored,
   and every direction with the number behind it. Small enough to keep forever. */
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v ?? null);
const INPUT_KEYS = ["hrv", "rhr", "sleepHours", "sleepQuality", "upper", "lower", "ankleHip", "energy", "hrvCount", "hrvWindow",
  "bedTime", "wakeTime", "spo2", "spo2Min", "ratedOn", "sleepQualityRatedOn", "override"];

export function buildDecision({ plan, checkin, today, source, now, version = ENGINE_VERSION }) {
  const b = plan.baselines;
  const session = plan.session && !plan.session.recovery ? {
    label: plan.session.label, minutes: plan.session.minutes,
    exercises: plan.session.blocks.flatMap((bl) => bl.pair.map((p) => ({ id: p.id, rung: p.rung ?? null }))),
  } : null;
  return {
    date: today, source, engine: version, at: new Date(now).toISOString(),
    inputs: Object.fromEntries(INPUT_KEYS.filter((k) => checkin[k] != null).map((k) => [k, checkin[k]])),
    baselines: {
      source: b.source, days: b.days,
      hrv: { mean: r2(b.hrv.mean), lnMean: r2(b.hrv.lnMean), lnSd: r2(b.hrv.lnSd) },
      rhr: { mean: r2(b.rhr.mean), sd: r2(b.rhr.sd) },
    },
    score: plan.result.score,
    parts: plan.result.parts.map((p) => ({ key: p.key, weight: p.weight, value: r2(p.value), points: r2(p.points) })),
    signals: { hrvZ: plan.result.hrvZ, rhrDelta: plan.result.rhrDelta, sleepQualityStale: !!plan.result.sleepQualityStale,
      sleepDebtH: r2(plan.sleepDebt), hrvTrend: plan.trend ? { band: plan.trend.band, avg7: plan.trend.avg7 } : null },
    archetype: plan.archetype.id,
    confidence: plan.confidence?.level ?? null,
    directives: plan.directives.map(({ id, level, title, why, action }) => ({ id, level, title, why, action })),
    training: plan.decision ? { planned: plan.planned, ...plan.decision } : null,
    session,
    drills: plan.drills.map((d) => d.id),
  };
}

/* One line for a phone notification: score, day type and the most important direction */
export function decisionSummary(plan) {
  const top = plan.directives[0];
  const label = plan.archetype.label.charAt(0) + plan.archetype.label.slice(1).toLowerCase();
  return `${plan.result.score}% · ${label}${top ? ` · ${top.title}` : ""}`;
}

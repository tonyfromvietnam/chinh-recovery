/* Tests for the strap-only feature set (docs/TECH_SPEC.md). Invented data only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  upsertDay, computeBaselines, calculateRecovery, parseSyncHash, parseBackfillHash, planDay, shiftKey, HISTORY_MAX_DAYS,
  dataConfidence, baselineNights, targetBedtime, eveningCutoffs, factOfTheDay, FACTS, dailyFocus,
  hrvTrend, trainingDecision, spacingConflicts,
  tagEffects, estimateSleepNeed, chronotype, baselineShift, learnProfile, generateSchedule,
} from "../src/engine.js";

const TODAY = "2026-10-15"; // a Thursday
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const hist = (n, f = () => ({}), end = TODAY) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(end, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), sleepHours: 7.5, score: 70,
  hrvWindow: "overnight", hrvCount: 3, ...f(i),
}));
const profile = {
  usualWake: "07:00",
  template: { mon: "upper", tue: "lower", wed: "football", thu: "upper", fri: "lower", sat: "football", sun: "rest" },
};

/* ================= Data quality (M0) ================= */
test("history: keeps 730 days", () => {
  let h = [];
  for (let i = 0; i < 800; i++) h = upsertDay(h, { date: shiftKey(TODAY, -800 + i), hrv: 60 });
  assert.equal(h.length, HISTORY_MAX_DAYS);
  assert.equal(h[h.length - 1].date, shiftKey(TODAY, -1));
});

test("baselines: ln-HRV z-scores are symmetric", () => {
  const h = hist(20, (i) => ({ hrv: [50, 60, 72][i % 3] }));
  const b = computeBaselines(h, TODAY, base);
  const lo = calculateRecovery({ ...base, hrv: 50 }, b).hrvZ;
  const hi = calculateRecovery({ ...base, hrv: 72 }, b).hrvZ;
  assert.ok(lo < 0 && hi > 0);
  assert.ok(Math.abs(Math.abs(lo) - Math.abs(hi)) < 0.2, `${lo} vs ${hi}`);
  assert.ok(Math.abs(b.hrv.mean - 60) < 1.5, "geometric mean near 60");
});

test("baselines: days marked ill are left out", () => {
  const h = hist(10).map((d, i) => (i === 9 ? { ...d, hrv: 20, override: "ill" } : d));
  assert.ok(computeBaselines(h, TODAY, base).hrv.mean > 55);
});

test("sync link: reads hrvn, hw, bed and wake; ignores retired calendar params", () => {
  const s = parseSyncHash("#hrv=58&hrvn=3&hw=o&bed=23:12&wake=0704&busy=0930-1030&fb=1900");
  assert.equal(s.hrvCount, 3);
  assert.equal(s.hrvWindow, "overnight");
  assert.equal(s.bedTime, "23:12");
  assert.equal(s.wakeTime, "07:04");
  assert.equal(s.busy, undefined);
  assert.equal(s.fixtures, undefined);
  assert.equal(parseSyncHash("#hrv=58&hw=d").hrvWindow, "24h");
});

test("backfill: accepts 4, 5 and 7 columns", () => {
  const d = parseBackfillHash("#history=2026-10-12,58,54,7.4;2026-10-13,61,53,26640,3;2026-10-14,62,52,7.2,2,23:05,07:01");
  assert.equal(d.length, 3);
  assert.equal(d[0].hrvWindow, undefined);
  assert.equal(d[1].hrvWindow, "overnight");
  assert.equal(d[1].hrvCount, 3);
  assert.equal(d[2].bedTime, "23:05");
  assert.equal(d[2].wakeTime, "07:01");
});

test("score: stale sleep quality falls back to duration only", () => {
  const b = computeBaselines(hist(12), TODAY, base);
  const fresh = calculateRecovery({ ...base, sleepHours: 8, sleepQuality: 3, ratedOn: TODAY }, b, { today: TODAY });
  const stale = calculateRecovery({ ...base, sleepHours: 8, sleepQuality: 3, ratedOn: shiftKey(TODAY, -4) }, b, { today: TODAY });
  assert.equal(stale.sleepQualityStale, true);
  assert.equal(fresh.sleepQualityStale, false);
  assert.ok(stale.parts[0].value > fresh.parts[0].value, "8 h of sleep scores full when quality is stale");
  assert.equal(stale.parts[0].weight, 35);
});

test("directions: one raised RHR morning adjusts, two in a row stops", () => {
  const one = planDay({ checkin: { ...base, rhr: 62 }, history: hist(12), today: TODAY });
  assert.equal(one.directives.find((d) => d.id === "rhr-high").level, "adjust");
  const h = hist(12).map((d, i) => (i === 11 ? { ...d, rhr: 62 } : d));
  const two = planDay({ checkin: { ...base, rhr: 62 }, history: h, today: TODAY });
  assert.equal(two.directives.find((d) => d.id === "rhr-high").level, "stop");
});

/* ================= Confidence & override (M1) ================= */
test("confidence: overnight with 2+ readings is high", () => {
  assert.equal(dataConfidence({ hrv: 60, hrvWindow: "overnight", hrvCount: 3, sleepHours: 7 }).level, "high");
  assert.equal(dataConfidence({ hrv: 60, hrvWindow: "overnight", hrvCount: 1, sleepHours: 7 }).level, "medium");
  assert.equal(dataConfidence({ hrv: 60, hrvWindow: "24h", hrvCount: 4, sleepHours: 7 }).level, "medium");
  assert.equal(dataConfidence({ sleepHours: 7 }).level, "low");
});

test("confidence: override is low and the day is recovery", () => {
  assert.equal(dataConfidence({ hrv: 60, hrvWindow: "overnight", hrvCount: 3, override: "ill" }).level, "low");
  const d = planDay({ checkin: { ...base, override: "ill" }, history: hist(12), today: TODAY });
  assert.equal(d.archetype.id, "restore");
  assert.equal(d.directives[0].id, "override");
  assert.equal(d.confidence.level, "low");
});

test("baseline nights: counts usable nights towards 19", () => {
  const b = baselineNights(hist(10), TODAY);
  assert.equal(b.nights, 10);
  assert.equal(b.ready, false);
});

/* ================= Morning brief (M2) ================= */
test("bedtime: debt moves it earlier, by at most the clamp", () => {
  assert.equal(targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8 }).time, "22:45");
  assert.equal(targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8, debtH: 3 }).time, "22:15");
  assert.equal(targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8, debtH: 3, avgBed7: "23:30" }).time, "22:45");
});

test("bedtime: hard session tomorrow adds 15 min", () => {
  assert.equal(targetBedtime({ wakeTomorrow: "07:00", hardTomorrow: true }).time, "22:30");
});

test("cutoffs: coffee is 8.8 h before bed", () => {
  const c = eveningCutoffs("22:30");
  assert.equal(c.coffee, "13:42");
  assert.equal(c.lastMeal, "19:30");
  assert.equal(c.screensOff, "21:30");
  assert.deepEqual(c.shower, ["20:30", "21:30"]);
});

test("fact: same date gives the same fact; prefers a matching when()", () => {
  const ctx = { shortSleep: false, debt: false, ankle: true, football: false, liftOrFootball: false, hrvLow: false, hrvHigh: false, winter: false, weekend: false };
  const a = factOfTheDay(ctx, TODAY), b = factOfTheDay(ctx, TODAY);
  assert.deepEqual(a, b);
  assert.equal(a.id, "ankle-balance");
  assert.ok(FACTS.length >= 15);
  assert.ok(FACTS.every((f) => f.source));
});

test("focus: picks the single weakest pillar", () => {
  const f = dailyFocus({ result: { hrvZ: 0, rhrDelta: 0, score: 70 }, debt: 3, checkin: { ankleHip: 3, energy: 4 }, bedtime: "22:15" });
  assert.equal(f.id, "f-sleep");
  assert.match(f.action, /22:15/);
});

test("brief: train call, bedtime and cut-offs only; evening blocks follow the bedtime", () => {
  const d = planDay({ checkin: base, history: hist(12), today: TODAY, profile });
  assert.equal(d.brief.planned, "upper");
  assert.ok(d.brief.bedtime.time);
  assert.equal(d.brief.water, undefined);
  assert.equal(d.brief.nutrition, undefined);
  const wind = d.schedule.find((i) => i.type === "wind");
  assert.equal(wind.time, d.brief.cutoffs.screensOff);
});

/* ================= Trend & decision (M3) ================= */
test("trend: 7-day average below range → band below", () => {
  const h = hist(40, (i) => ({ hrv: i >= 34 ? 45 : 60 + (i % 3) - 1 }));
  assert.equal(hrvTrend(h, TODAY).band, "below");
  assert.equal(hrvTrend(hist(40), TODAY).band, "in");
  assert.equal(hrvTrend(hist(8), TODAY).band, "unknown");
});

test("decision: a single low morning with a normal trend caps, not reduces", () => {
  const d = trainingDecision({ trend: { band: "in", avg7: 60, low: 58, high: 62 }, result: { hrvZ: -1.6, score: 60 }, planned: "upper" });
  assert.equal(d.decision, "cap");
});

test("decision: below range + RHR up 2 days → recover", () => {
  const d = trainingDecision({ trend: { band: "below", avg7: 48, low: 57, high: 63 }, result: { hrvZ: -2 }, planned: "lower", rhrDays: 2 });
  assert.equal(d.decision, "recover");
});

test("decision: ankle ≥ 4 blocks football whatever the readiness", () => {
  const d = trainingDecision({ trend: { band: "above", avg7: 70, low: 57, high: 63 }, result: { hrvZ: 1, score: 90 }, planned: "football", ankleHip: 4, sleepHours: 8 });
  assert.equal(d.label, "No football");
});

test("decision: trend above + good sleep + high score → push; football adds the 11+ warm-up", () => {
  const d = trainingDecision({ trend: { band: "above", avg7: 70, low: 57, high: 63 }, result: { hrvZ: 1, score: 85 }, planned: "upper", sleepHours: 8 });
  assert.equal(d.decision, "push");
  const f = trainingDecision({ trend: { band: "in", avg7: 60, low: 57, high: 63 }, result: { hrvZ: 0, score: 70 }, planned: "football" });
  assert.match(f.detail, /FIFA 11\+/);
});

test("planDay: low HRV inside a normal trend is downgraded to a cap", () => {
  const varied = hist(40, (i) => ({ hrv: [50, 60, 72][i % 3] }));
  const d = planDay({ checkin: { ...base, hrv: 44 }, history: varied, today: TODAY, profile });
  assert.equal(d.directives.find((x) => x.id === "hrv-low").level, "adjust");
  assert.equal(d.decision.decision, "cap");
  assert.match(d.schedule.find((i) => i.slot === "training").title, /cap at RPE 8/);
});

test("spacing: heavy lower 24 h before football is flagged", () => {
  const c = spacingConflicts(profile);
  assert.ok(c.some((x) => x.from === "tue" && x.to === "wed" && x.rule === "lower-before-football"));
  assert.equal(c.some((x) => x.from === "wed" && x.to === "thu"), false, "upper after football is fine");
});

/* ================= Learning (M5, strap-derived) ================= */
const richHist = (n, f) => hist(n, (i) => ({ ratedOn: shiftKey(TODAY, -(n - i)), energy: 4, ...f(i) }));

test("tag effects: late bedtimes (from the strap) show their effect with an interval", () => {
  // Odd days record a late bedtime the night before and a lower HRV that morning
  const h = richHist(60, (i) => (i % 2 ? { bedTime: "00:30", hrv: 50 + (i % 3) } : { bedTime: "23:00", hrv: 62 + (i % 3) }));
  const late = tagEffects(h, TODAY, { outcome: "nextHrvPct", lag: 1 }).find((r) => r.tag === "late-bed");
  assert.equal(late.verdict, "hurts");
  assert.ok(late.ci95[1] < 0);
});

test("tag effects: few days → not enough data", () => {
  const h = richHist(10, (i) => ({ bedTime: i % 2 ? "00:30" : "23:00" }));
  assert.equal(tagEffects(h, TODAY).find((r) => r.tag === "late-bed").verdict, "not enough data");
});

test("learning: values stay null until thresholds are met", () => {
  const l = learnProfile(hist(10), TODAY);
  assert.equal(l.sleepNeedH, null);
  assert.equal(l.chronotypeMSF, null);
});

test("sleep need: median of nights followed by good energy and normal HRV", () => {
  const h = richHist(50, (i) => ({ sleepHours: i % 2 ? 8.5 : 6.5, energy: i % 2 ? 5 : 2 }));
  const s = estimateSleepNeed(h);
  assert.equal(s.hours, 8.5);
  assert.ok(s.n >= 20);
});

test("chronotype: MSFsc and social jetlag from bed/wake times", () => {
  const h = Array.from({ length: 28 }, (_, i) => {
    const date = shiftKey(TODAY, -28 + i);
    const [y, m, dd] = date.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    const free = wd === 0 || wd === 6;
    return { date, bedTime: free ? "00:30" : "23:00", wakeTime: free ? "09:00" : "07:00" };
  });
  const c = chronotype(h);
  assert.equal(c.ready, true);
  assert.equal(c.msw, "03:00");
  assert.equal(c.msf, "04:45");
  assert.equal(c.socialJetlagH, 1.8);
  assert.ok(c.msfscMin < 4 * 60 + 45, "corrected for weekend catch-up sleep");
});

test("baseline shift: a sustained HRV rise is detected", () => {
  const h = hist(90, (i) => ({ hrv: i >= 60 ? 72 + (i % 3) : 60 + (i % 3) - 1 }));
  const s = baselineShift(h, TODAY);
  assert.equal(s.ready, true);
  assert.equal(s.hrv.shifted, true);
  assert.equal(s.hrv.direction, "up");
  assert.ok(s.hrv.pct > 15);
  assert.equal(baselineShift(hist(90), TODAY).hrv.shifted, false);
});

/* ================= Backwards compatibility ================= */
test("compat: planDay without a profile behaves as before", () => {
  const d = planDay({ checkin: base, history: hist(12), today: TODAY });
  assert.equal(d.brief, null);
  assert.equal(d.decision, null);
  assert.deepEqual(d.schedule.map((i) => i.id), generateSchedule(d.archetype.id, base, d.directives).map((i) => i.id));
});

test("compat: old day records with retired fields still plan without errors", () => {
  const old = hist(12, (i) => ({ evening: { tags: ["alcohol"] }, session: { type: "upper", rpe: 7, minutes: 60 }, ankleTest: { k2wL: 10 }, busy: [{ start: 540, end: 600 }] }));
  const d = planDay({ checkin: base, history: old, today: TODAY, profile });
  assert.ok(d.schedule.length > 0);
});

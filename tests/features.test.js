/* Tests for M0–M6 (docs/TECH_SPEC.md). Invented data only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  upsertDay, computeBaselines, calculateRecovery, parseSyncHash, parseBackfillHash, planDay, shiftKey, HISTORY_MAX_DAYS,
  dataConfidence, parseBusy, fitScheduleToCalendar, eveningTags, baselineNights,
  targetBedtime, eveningCutoffs, waterTarget, nutritionTargets, trendWeight, factOfTheDay, FACTS, dailyFocus,
  hrvTrend, trainingDecision, loadSummary, spacingConflicts, freshness,
  ankleSummary, tagEffects, estimateSleepNeed, chronotype, footballRecoveryProfile, predictiveCheck, baselineShift, learnProfile,
  EXPERIMENTS, assignArm, experimentResult, generateSchedule,
} from "../src/engine.js";

const TODAY = "2026-10-15"; // a Thursday
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const hist = (n, f = () => ({}), end = TODAY) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(end, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), sleepHours: 7.5, score: 70,
  hrvWindow: "overnight", hrvCount: 3, ...f(i),
}));
const profile = {
  usualWake: "07:00", weightKg: 75,
  template: { mon: "upper", tue: "lower", wed: "football", thu: "upper", fri: "lower", sat: "football", sun: "rest" },
};

/* ================= M0 ================= */
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

test("sync link: reads hrvn, hw, bed, wake, busy and fb", () => {
  const s = parseSyncHash("#hrv=58&hrvn=3&hw=o&bed=23:12&wake=0704&busy=0930-1030,1400-1500&fb=1900");
  assert.equal(s.hrvCount, 3);
  assert.equal(s.hrvWindow, "overnight");
  assert.equal(s.bedTime, "23:12");
  assert.equal(s.wakeTime, "07:04");
  assert.deepEqual(s.busy, [{ start: 570, end: 630 }, { start: 840, end: 900 }]);
  assert.deepEqual(s.fixtures, [{ type: "football", start: 1140 }]);
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

/* ================= M1 ================= */
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

test("calendar: parse merges overlaps and ignores junk", () => {
  assert.deepEqual(parseBusy("0900-1000,0930-1100,junk,1400-1300"), [{ start: 540, end: 660 }]);
});

const sched = (items) => items.map(([id, time, dur, type]) => ({ id, time, dur, type, title: id, detail: "", ...(type === "training" ? { slot: "training" } : {}) }));

test("calendar: block overlapping a meeting moves to the nearest free slot", () => {
  const s = sched([["breath", "14:00", 15, "breath"], ["lunch", "12:30", 30, "fuel"]]);
  const { schedule, moved } = fitScheduleToCalendar(s, [{ start: 840, end: 900 }]);
  assert.equal(moved.length, 1);
  assert.equal(schedule.find((i) => i.id === "breath").time, "13:45");
});

test("calendar: deep work takes the longest morning gap", () => {
  const s = sched([["deep", "09:00", 120, "focus"]]);
  const busy = parseBusy("0900-0930,1000-1030");
  const { schedule } = fitScheduleToCalendar(s, busy);
  assert.equal(schedule[0].time, "10:30");
});

test("calendar: football fixture adds 11+ warm-up and pre-match meal", () => {
  const s = sched([["train", "17:30", 60, "training"]]);
  const { schedule } = fitScheduleToCalendar(s, [], [{ type: "football", start: 19 * 60 }]);
  assert.equal(schedule.find((i) => i.id === "train").time, "19:00");
  assert.equal(schedule.find((i) => i.id === "cal-warmup").time, "18:40");
  assert.equal(schedule.find((i) => i.id === "cal-prematch").time, "16:30");
});

test("calendar: no free slot shortens, then drops", () => {
  const s = sched([["study", "10:00", 90, "study"]]);
  const short = fitScheduleToCalendar(s, [{ start: 420, end: 600 }, { start: 645, end: 1260 }]);
  assert.equal(short.schedule[0].dur, 45);
  const none = fitScheduleToCalendar(s, [{ start: 420, end: 1260 }]);
  assert.equal(none.dropped.length, 1);
  assert.equal(none.schedule.length, 0);
});

test("evening: tags derive from check-out", () => {
  const tags = eveningTags({ stress: 4, alcohol: 2, lastCaffeine: "16:30", lastMeal: "21:45" }, { coffee: "13:40", lastMeal: "19:30" });
  assert.deepEqual(tags, ["alcohol", "alcohol-heavy", "high-stress", "late-caffeine", "late-meal"]);
  assert.deepEqual(eveningTags({ stress: 2, alcohol: 0, lastCaffeine: "11:00", lastMeal: "19:00" }), []);
});

/* ================= M2 ================= */
test("bedtime: debt moves it earlier, by at most the clamp", () => {
  const plain = targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8 });
  assert.equal(plain.time, "22:45");
  const debt = targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8, debtH: 3 });
  assert.equal(debt.time, "22:15");
  const clamped = targetBedtime({ wakeTomorrow: "07:00", sleepNeedH: 8, debtH: 3, avgBed7: "23:30" });
  assert.equal(clamped.time, "22:45");
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

test("water: parts add up; sweat rate overrides the default", () => {
  const w = waterTarget({ sessionMinutes: 90, maxTempC: 27, rhrFlag: true });
  assert.equal(w.litres, Math.round(w.parts.reduce((s, p) => s + p.litres, 0) * 10) / 10);
  assert.equal(w.parts.length, 4);
  const s = waterTarget({ sessionMinutes: 60, sweatRateLph: 1.2 });
  assert.equal(s.parts[1].litres, 1.5);
});

test("nutrition: 75 kg lift day gives 120 g protein in 4 × 30 g", () => {
  const n = nutritionTargets({ weightKg: 75, dayType: "lift", sessionStart: "17:30", sessionMinutes: 60, cutoffs: eveningCutoffs("22:30") });
  assert.equal(n.proteinG, 120);
  assert.equal(n.perMealG, 30);
  assert.deepEqual(n.carbsG, [300, 380]);
  assert.ok(n.meals.some((m) => m.id === "pre" && m.time === "15:00"));
  assert.ok(n.meals.some((m) => m.id === "dinner" && m.time === "19:30"));
  assert.equal(nutritionTargets({ weightKg: null }).proteinG, null);
});

test("trend weight ignores a single spike", () => {
  const log = [74, 74.2, 74.1, 74, 77.5].map((kg, i) => ({ date: shiftKey(TODAY, -5 + i), kg }));
  assert.ok(trendWeight(log, TODAY).kg < 74.6);
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

test("brief: planDay with a profile fills every row and couples the evening blocks", () => {
  const d = planDay({ checkin: base, history: hist(12), today: TODAY, profile });
  assert.equal(d.brief.planned, "upper");
  assert.ok(d.brief.water.litres >= 2);
  assert.equal(d.brief.nutrition.proteinG, 120);
  assert.ok(d.brief.bedtime.time);
  const wind = d.schedule.find((i) => i.type === "wind");
  assert.equal(wind.time, d.brief.cutoffs.screensOff);
});

/* ================= M3 ================= */
const longHist = (n, f) => hist(n, f);

test("trend: 7-day average below range → band below", () => {
  const h = longHist(40, (i) => ({ hrv: i >= 34 ? 45 : 60 + (i % 3) - 1 }));
  assert.equal(hrvTrend(h, TODAY).band, "below");
  assert.equal(hrvTrend(longHist(40), TODAY).band, "in");
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

test("decision: trend above + good sleep + high score → push", () => {
  const d = trainingDecision({ trend: { band: "above", avg7: 70, low: 57, high: 63 }, result: { hrvZ: 1, score: 85 }, planned: "upper", sleepHours: 8 });
  assert.equal(d.decision, "push");
});

test("planDay: low HRV inside a normal trend is downgraded to a cap", () => {
  // Realistic night-to-night spread (ln-SD ≈ 0.15), so one low morning doesn't drag the 7-day average out of range
  const varied = longHist(40, (i) => ({ hrv: [50, 60, 72][i % 3] }));
  const d = planDay({ checkin: { ...base, hrv: 44 }, history: varied, today: TODAY, profile });
  const h = d.directives.find((x) => x.id === "hrv-low");
  assert.equal(h.level, "adjust");
  assert.equal(d.decision.decision, "cap");
  assert.match(d.schedule.find((i) => i.slot === "training").title, /cap at RPE 8/);
});

const withSessions = (h, sessions) => h.map((d) => (sessions[d.date] ? { ...d, session: sessions[d.date] } : d));

test("load: spike flagged at ratio > 1.5 but the decision is unchanged", () => {
  const sessions = {};
  for (let k = 8; k <= 34; k += 3) sessions[shiftKey(TODAY, -k)] = { type: "upper", minutes: 60, rpe: 5 };
  for (let k = 0; k <= 6; k++) sessions[shiftKey(TODAY, -k)] = { type: "upper", minutes: 60, rpe: 8 };
  const h = withSessions(longHist(40), sessions);
  const l = loadSummary(h, TODAY);
  assert.ok(l.ratio > 1.5);
  assert.equal(l.spike, true);
  const d = planDay({ checkin: base, history: h, today: TODAY, profile });
  assert.ok(d.directives.some((x) => x.id === "load-spike" && x.level === "adjust"));
});

test("monotony: identical daily loads → high", () => {
  const sessions = {};
  for (let k = 0; k <= 6; k++) sessions[shiftKey(TODAY, -k)] = { type: "upper", minutes: 30, rpe: 5 };
  sessions[shiftKey(TODAY, -3)] = { type: "upper", minutes: 31, rpe: 5 };
  assert.equal(loadSummary(withSessions(longHist(10), sessions), TODAY).monotonyHigh, true);
});

test("spacing: heavy lower 24 h before football is flagged", () => {
  const c = spacingConflicts(profile);
  assert.ok(c.some((x) => x.from === "tue" && x.to === "wed" && x.rule === "lower-before-football"));
  assert.ok(c.some((x) => x.from === "wed" && x.to === "thu") === false, "upper after football is fine");
  assert.ok(c.some((x) => x.from === "sat" && x.rule === "football-before-lower") === false);
});

test("freshness: football yesterday leaves lower recovering", () => {
  const h = withSessions(hist(5), { [shiftKey(TODAY, -1)]: { type: "football", minutes: 90, rpe: 8, start: "19:00" } });
  const f = freshness(h, TODAY);
  assert.equal(f.lower.state, "recovering");
  assert.equal(f.upper.state, "fresh");
});

/* ================= M4 ================= */
const ankleHist = (vals) => vals.map((v, i) => ({ date: shiftKey(TODAY, -7 * (vals.length - 1 - i)), ankleTest: { injured: "R", ...v } }));

test("ankle: asymmetry and slope", () => {
  const h = ankleHist([{ k2wL: 12, k2wR: 8, balL: 30, balR: 15 }, { k2wL: 12, k2wR: 9, balL: 30, balR: 18 }, { k2wL: 12, k2wR: 10, balL: 30, balR: 22 }]);
  const s = ankleSummary(h, TODAY);
  assert.equal(s.metrics.k2w.gap, 2);
  assert.equal(s.metrics.k2w.slopePerWeek, 1);
  assert.equal(s.worsening, null);
  assert.equal(s.due, false);
});

test("ankle: two worsening weeks triggers the physio direction", () => {
  const h = ankleHist([{ k2wL: 12, k2wR: 10 }, { k2wL: 12, k2wR: 9.5 }, { k2wL: 12, k2wR: 8.5 }]);
  const d = planDay({ checkin: base, history: [...hist(5), ...h].sort((a, b) => a.date.localeCompare(b.date)), today: TODAY });
  const p = d.directives.find((x) => x.id === "ankle-physio");
  assert.ok(p);
  assert.match(p.why, /10 → 9.5 → 8.5 cm/);
});

test("ankle: clearance needs hop 5/5 both sides", () => {
  const ok = ankleSummary(ankleHist([{ hopL: 5, hopR: 5, balL: 30, balR: 27 }]), TODAY);
  assert.equal(ok.cleared, true);
  const no = ankleSummary(ankleHist([{ hopL: 5, hopR: 4, balL: 30, balR: 27 }]), TODAY);
  assert.equal(no.cleared, false);
});

/* ================= M5 ================= */
const richHist = (n, f) => hist(n, (i) => ({ ratedOn: shiftKey(TODAY, -(n - i)), energy: 4, ...f(i) }));

test("tag effects: a clear effect is reported with its interval", () => {
  // Late meal on even days lowers the next morning's HRV
  const h = richHist(60, (i) => ({
    evening: { tags: i % 2 === 0 ? ["late-meal"] : [] },
    hrv: i % 2 === 1 ? 50 + (i % 3) : 62 + (i % 3),
  }));
  const rows = tagEffects(h, TODAY, { outcome: "nextHrvPct", lag: 1 });
  const late = rows.find((r) => r.tag === "late-meal");
  assert.equal(late.verdict, "hurts");
  assert.ok(late.ci95[1] < 0);
});

test("tag effects: CI crossing 0 → no clear effect; few days → not enough data", () => {
  const h = richHist(60, (i) => ({ evening: { tags: i % 2 === 0 ? ["alcohol"] : [] }, hrv: 60 + ((i * 7) % 5) - 2 }));
  assert.equal(tagEffects(h, TODAY).find((r) => r.tag === "alcohol").verdict, "no clear effect");
  const few = richHist(10, (i) => ({ evening: { tags: i < 3 ? ["alcohol"] : [] } }));
  assert.equal(tagEffects(few, TODAY).find((r) => r.tag === "alcohol").verdict, "not enough data");
});

test("learning: values stay null until thresholds are met", () => {
  const l = learnProfile(hist(10), TODAY);
  assert.equal(l.sleepNeedH, null);
  assert.equal(l.chronotypeMSF, null);
  assert.equal(l.footballRecoveryH, null);
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

test("football recovery: median hours until HRV and RHR are back", () => {
  const h = hist(70, (i) => ({ ratedOn: null }));
  const matchIdx = [40, 47, 54, 61];
  matchIdx.forEach((mi) => {
    h[mi] = { ...h[mi], session: { type: "football", minutes: 90, rpe: 8, start: "19:00" } };
    h[mi + 1] = { ...h[mi + 1], hrv: 48, rhr: 60 }; // still down the next morning
  });
  const p = footballRecoveryProfile(h);
  assert.equal(p.ready, true);
  assert.equal(p.hours, 36); // second morning 07:00 − 19:00 kick-off
});

test("predictive check: needs 20 sessions, then ranks the parts", () => {
  assert.equal(predictiveCheck(hist(10)).ready, false);
  const h = hist(40, (i) => ({ sleepHours: 6 + (i % 4) * 0.7, session: { type: "upper", minutes: 60, rpe: 7, quality: 1 + (i % 4) } }));
  const p = predictiveCheck(h);
  assert.equal(p.ready, true);
  assert.equal(p.rows.find((r) => r.key === "sleep").r, 1);
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

/* ================= M6 ================= */
test("experiments: balanced alternation, stable assignment", () => {
  const e = EXPERIMENTS.find((x) => x.id === "late-dinner");
  const arms = Array.from({ length: 20 }, (_, i) => assignArm(e, "2026-10-01", shiftKey("2026-10-01", i)).arm);
  assert.equal(arms.filter((a) => a === 0).length, 10);
  for (let b = 0; b < 10; b++) assert.notEqual(arms[2 * b], arms[2 * b + 1], "each block has both arms");
  assert.deepEqual(assignArm(e, "2026-10-01", "2026-10-05"), assignArm(e, "2026-10-01", "2026-10-05"));
  const p = EXPERIMENTS.find((x) => x.id === "presleep-protein");
  assert.equal(assignArm(p, "2026-10-01", "2026-10-05", "rest"), null);
});

test("experiments: weekly unit keeps one arm for the whole week", () => {
  const e = EXPERIMENTS.find((x) => x.id === "caffeine-noon");
  const week = Array.from({ length: 7 }, (_, i) => assignArm(e, "2026-10-05", shiftKey("2026-10-05", i)).arm);
  assert.equal(new Set(week).size, 1);
});

test("experiments: result needs 8 units per arm, then gives a CI", () => {
  const e = EXPERIMENTS.find((x) => x.id === "late-dinner");
  const start = shiftKey(TODAY, -40);
  const h = hist(40, (i) => {
    const date = shiftKey(TODAY, -40 + i);
    const a = assignArm(e, start, date);
    return { experiment: { ...a, complied: true } };
  });
  // Next morning after arm 1 (late dinner) HRV is lower
  for (let i = 1; i < h.length; i++) if (h[i - 1].experiment.arm === 1) h[i] = { ...h[i], hrv: 50 + (i % 2) };
  const r = experimentResult(h, e, TODAY);
  assert.equal(r.enough, true);
  const hrv = r.outcomes.find((o) => o.key === "nextHrvPct");
  assert.equal(hrv.verdict, "Dinner finished before 19:30 is better");
  const few = experimentResult(h.slice(-6), e, TODAY);
  assert.equal(few.enough, false);
});

/* ================= Backwards compatibility ================= */
test("compat: planDay without a profile behaves as before", () => {
  const d = planDay({ checkin: base, history: hist(12), today: TODAY });
  assert.equal(d.brief, null);
  assert.equal(d.decision, null);
  assert.deepEqual(d.schedule.map((i) => i.id), generateSchedule(d.archetype.id, base, d.directives).map((i) => i.id));
});

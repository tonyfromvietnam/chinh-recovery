/* Tests for M8.2 — session log and progression (docs/TECH_SPEC.md). Invented data only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextRung, logEntries, currentRung, applyWorkoutLog, daySession, markExtraDone, applyYesterday, mergeHistories,
  buildSession, exerciseById, mobilityExtras, shiftKey,
} from "../src/engine.js";

const TODAY = "2026-10-19"; // a Monday
const day = (n) => shiftKey(TODAY, -n);
const log = (date, exercises, extra = {}) => ({ date, workout: { dayType: "full-a", exercises, minutes: 28, updatedAt: 1 }, ...extra });
const ex = (id, reps, more = {}) => ({ id, rung: exerciseById(id).rung, reps, last: "right", ...more });
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const profile = { template: { mon: "full-a", tue: "rest", wed: "football", thu: "full-b", fri: "rest", sat: "football", sun: "rest" } };

test("progression: no log → no opinion (start rung applies)", () => {
  assert.equal(nextRung([], "squat"), null);
});

test("progression: top of the range two sessions running moves up a rung", () => {
  // Split squat: target 8–10 (main pattern, non-entry)
  const once = [log(day(4), [ex("squat-3", [10, 10, 10])])];
  assert.equal(nextRung(once, "squat").change, "same");
  const twice = [...once, log(day(1), [ex("squat-3", [10, 10, 10])])];
  const n = nextRung(twice, "squat");
  assert.equal(n.change, "up");
  assert.equal(n.rung, 4);
  // One set short of the top: stay
  const nearly = [...once, log(day(1), [ex("squat-3", [10, 10, 9])])];
  assert.equal(nextRung(nearly, "squat").change, "same");
});

test("progression: missing the bottom twice running moves down", () => {
  const h = [log(day(4), [ex("pull-v-5", [3, 2, 2])]), log(day(1), [ex("pull-v-5", [3, 2, 1])])];
  const n = nextRung(h, "pull-v");
  assert.equal(n.change, "down");
  assert.equal(n.rung, 4);
  assert.equal(nextRung([log(day(1), [ex("pull-v-5", [2, 2, 2])])], "pull-v").change, "same"); // once isn't enough
});

test("progression: entry rungs progress within their own range; harder rungs jump at 12+ clean reps", () => {
  // Bodyweight squat (entry, 12–20): 15s twice is not the top → stay; 20s twice → up
  const mid = [log(day(4), [ex("squat-2", [15, 15, 15])]), log(day(1), [ex("squat-2", [15, 15, 15])])];
  assert.equal(nextRung(mid, "squat").change, "same");
  const top = [log(day(4), [ex("squat-2", [20, 20, 20])]), log(day(1), [ex("squat-2", [20, 20, 20])])];
  assert.equal(nextRung(top, "squat").rung, 3);
  // Push-up (8–20, target 8–10): a single set of 12+ means the next rung straight away
  const big = [log(day(1), [ex("push-h-2", [12, 10, 9])])];
  const n = nextRung(big, "push-h");
  assert.equal(n.change, "up");
  assert.equal(n.rung, 3);
});

test("progression: bands and backpacks count as half a rung", () => {
  // Banded split squat (squat-4, needs bands): first progression is a heavier band, same rung
  const h = [log(day(4), [ex("squat-4", [10, 10, 10])]), log(day(1), [ex("squat-4", [10, 10, 10])])];
  const half = nextRung(h, "squat");
  assert.deepEqual([half.rung, half.extra, half.change], [4, 1, "half"]);
  // With the heavier band at the top twice → the next rung, extra reset
  const h2 = [log(day(4), [ex("squat-4", [10, 10, 10], { extra: 1 })]), log(day(1), [ex("squat-4", [10, 10, 10], { extra: 1 })])];
  const up = nextRung(h2, "squat");
  assert.deepEqual([up.rung, up.extra, up.change], [5, 0, "up"]);
  // Missing the bottom with a heavier band drops the band first
  const h3 = [log(day(4), [ex("squat-4", [6, 6, 5], { extra: 1 })]), log(day(1), [ex("squat-4", [6, 5, 5], { extra: 1 })])];
  assert.deepEqual([nextRung(h3, "squat").rung, nextRung(h3, "squat").extra], [4, 0]);
});

test("progression: power moves up only when it felt easy twice", () => {
  const right = [log(day(4), [ex("power-u-1", [5, 5, 5])]), log(day(1), [ex("power-u-1", [5, 5, 5])])];
  assert.equal(nextRung(right, "power-u").change, "same");
  const easy = [log(day(4), [ex("power-u-1", [5, 5, 5], { last: "easy" })]), log(day(1), [ex("power-u-1", [5, 5, 5], { last: "easy" })])];
  assert.equal(nextRung(easy, "power-u").rung, 2);
});

test("session: the next session uses the progressed rung and shows the change", () => {
  const h = [log(day(7), [ex("squat-3", [10, 10, 10])]), log(day(3), [ex("squat-3", [10, 10, 10])])];
  const s = buildSession({ dayType: "full-a", archetypeId: "high", profile, history: h, checkin: base, today: TODAY });
  const squat = s.blocks[0].pair[0];
  assert.equal(squat.id, "squat-4");
  assert.equal(squat.change, "up");
});

test("mobility ticks: balance done two days running moves up and opens the leg-power gate at rung 4", () => {
  let h = [];
  for (const [n, id] of [[6, "balance-3"], [5, "balance-3"]]) h = markExtraDone(h, day(n), exerciseById(id), true, 1);
  assert.equal(nextRung(h, "balance").rung, 4);
  assert.equal(mobilityExtras({ history: h })[0].id, "balance-4");
  for (const n of [4, 3]) h = markExtraDone(h, day(n), exerciseById("balance-4"), true, 1);
  assert.equal(currentRung(h, "balance"), 4);
  const s = buildSession({ dayType: "full-a", archetypeId: "high", profile, history: h, checkin: base, today: TODAY });
  assert.equal(s.power[0].id, "power-l-1");
  // Unticking removes it
  const undone = markExtraDone(h, day(3), exerciseById("balance-4"), false, 2);
  assert.equal(logEntries(undone, "balance").length, 3);
});

test("log: saving stamps updatedAt; logs merge by newest updatedAt", () => {
  const w = { dayType: "full-a", exercises: [ex("squat-3", [10, 9, 8])], minutes: 28 };
  const phone = applyWorkoutLog([{ date: TODAY, hrv: 60, updatedAt: 1 }], TODAY, w, 100);
  assert.equal(phone[0].updatedAt, 100);
  assert.equal(phone[0].workout.updatedAt, 100);
  assert.equal(phone[0].hrv, 60);
  const desktop = applyWorkoutLog([{ date: TODAY, hrv: 60, updatedAt: 1 }], TODAY, { ...w, exercises: [ex("squat-3", [10, 10, 10])] }, 200);
  const merged = mergeHistories(phone, desktop);
  assert.deepEqual(merged[0].workout.exercises[0].reps, [10, 10, 10]);
  assert.deepEqual(mergeHistories(desktop, phone)[0].workout.exercises[0].reps, [10, 10, 10]);
});

test("log: today's own log doesn't change today's session or mobility drill", () => {
  const before = [log(day(3), [ex("squat-3", [10, 10, 10])])];
  const withToday = applyWorkoutLog(before, TODAY, { dayType: "full-a", exercises: [ex("squat-3", [10, 10, 10])], minutes: 28 }, 5);
  const s = buildSession({ dayType: "full-a", archetypeId: "high", profile, history: withToday, checkin: base, today: TODAY });
  assert.equal(s.blocks[0].pair[0].id, "squat-3");
  // Tomorrow it has moved up
  assert.equal(nextRung(withToday, "squat").rung, 4);
});

test("log vs HR session: the log sets the type, heart rate keeps minutes and load", () => {
  const hrDay = { date: day(1), session: { type: "other", auto: true, minutes: 31, load: 140 }, updatedAt: 1 };
  const logged = applyWorkoutLog([hrDay], day(1), { dayType: "full-b", exercises: [], minutes: 28 }, 5);
  assert.deepEqual(logged[0].session, { type: "full-b", auto: true, minutes: 31, load: 140 });
  assert.deepEqual(daySession(logged[0]), { type: "full-b", minutes: 31, load: 140, source: "log+hr" });
  // HR arriving the next morning for a day that already has a log
  const after = applyYesterday([{ date: day(1), workout: { dayType: "full-a", exercises: [] } }], TODAY, { hrZones: [10, 20, 25, 10, 0] }, profile, 9);
  assert.equal(after[0].session.type, "full-a");
  assert.equal(after[0].session.load, 165);
  // A log with no HR data: minutes from the log, load unknown
  assert.deepEqual(daySession({ date: TODAY, workout: { dayType: "upper", minutes: 25 } }), { type: "full-a", minutes: 25, load: null, source: "log" });
  assert.equal(daySession({ date: TODAY, session: { type: "other", auto: true, minutes: 30, load: 90, dismissed: true } }), null);
});

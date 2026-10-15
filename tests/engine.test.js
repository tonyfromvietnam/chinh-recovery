import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSyncHash, computeBaselines, calculateRecovery, planDay, upsertDay, shiftKey, sleepDebt,
  parseBackfillHash, mergeBackfill,
} from "../src/engine.js";

const TODAY = "2026-10-15";
const base = {
  sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55,
  upper: 2, lower: 2, ankleHip: 2, energy: 4,
};
const makeHistory = (n, f = () => ({})) =>
  Array.from({ length: n }, (_, i) => ({
    date: shiftKey(TODAY, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), sleepHours: 7.5, score: 70, ...f(i),
  }));

test("sync link: parses values and units", () => {
  assert.deepEqual(parseSyncHash("#hrv=58.4&rhr=54&sleep=26640"), { hrv: 58, rhr: 54, sleepHours: 7.4 });
  assert.deepEqual(parseSyncHash("#sleep=444"), { sleepHours: 7.4 }); // minutes
  assert.deepEqual(parseSyncHash("#sleep=7,4&hrv=62 ms"), { sleepHours: 7.4, hrv: 62 }); // comma + unit
  assert.equal(parseSyncHash("#schedule"), null);
  assert.equal(parseSyncHash("#hrv=900"), null); // out of range
});

test("baselines: manual until 5 days, then rolling", () => {
  const few = computeBaselines(makeHistory(3), TODAY, base);
  assert.equal(few.source, "manual");
  assert.equal(few.daysNeeded, 2);
  const many = computeBaselines(makeHistory(12), TODAY, { ...base, hrvBaseline: 99 });
  assert.equal(many.source, "rolling");
  assert.ok(Math.abs(many.hrv.mean - 60) < 1);
});

test("baselines: ignore today and anything older than 30 days", () => {
  const h = [...makeHistory(10), { date: TODAY, hrv: 10 }, { date: shiftKey(TODAY, -45), hrv: 200 }];
  const b = computeBaselines(h, TODAY, base);
  assert.ok(b.hrv.mean > 55 && b.hrv.mean < 65);
});

test("score: same inputs score higher when HRV is above your normal", () => {
  const b = computeBaselines(makeHistory(12), TODAY, base);
  const low = calculateRecovery({ ...base, hrv: 48 }, b).score;
  const high = calculateRecovery({ ...base, hrv: 70 }, b).score;
  assert.ok(high > low + 10);
});

test("directions: very low HRV stops intensity and swaps training", () => {
  const day = planDay({ checkin: { ...base, hrv: 45 }, history: makeHistory(12), today: TODAY });
  assert.equal(day.directives[0].id, "hrv-low");
  const training = day.schedule.find((s) => s.title.includes("training swapped"));
  assert.ok(training, "training block replaced");
});

test("directions: elevated RHR flagged", () => {
  const day = planDay({ checkin: { ...base, rhr: 62 }, history: makeHistory(12), today: TODAY });
  assert.ok(day.directives.some((d) => d.id === "rhr-high"));
});

test("directions: sleep debt moves wind-down 30 min earlier", () => {
  const h = makeHistory(12, () => ({ sleepHours: 6.5 }));
  const day = planDay({ checkin: { ...base, sleepHours: 6.6 }, history: h, today: TODAY });
  assert.ok(day.directives.some((d) => d.id === "sleep-debt"));
  const wind = day.schedule.find((s) => s.type === "wind");
  assert.ok(wind.title.includes("30 min earlier"));
  assert.equal(sleepDebt(6.6, [6.5, 6.5]), 4.4);
});

test("directions: ankle flare blocks football", () => {
  const day = planDay({ checkin: { ...base, ankleHip: 4 }, history: makeHistory(12), today: TODAY });
  assert.ok(day.directives.some((d) => d.id === "ankle-flare" && d.level === "stop"));
});

test("directions: 3-day falling trend", () => {
  const h = makeHistory(12, (i) => ({ score: i === 10 ? 72 : i === 11 ? 64 : 70 }));
  const day = planDay({ checkin: { ...base, sleepQuality: 3, energy: 2, lower: 3 }, history: h, today: TODAY });
  assert.ok(day.result.score < 64, `score ${day.result.score} should be falling`);
  assert.ok(day.directives.some((d) => d.id === "trend-down"));
});

test("directions: clean day says stay the course", () => {
  const day = planDay({ checkin: base, history: makeHistory(12), today: TODAY });
  assert.ok(day.directives.every((d) => d.level === "go"));
});

test("backfill: parses rows, drops bad ones", () => {
  const days = parseBackfillHash("#history=2026-10-13,58,54,26640;2026-10-14,61.2,0,444;bad,1,2,3;2026-10-12,0,0,0");
  assert.deepEqual(days, [
    { date: "2026-10-13", hrv: 58, rhr: 54, sleepHours: 7.4 },
    { date: "2026-10-14", hrv: 61, sleepHours: 7.4 },
  ]);
  assert.equal(parseBackfillHash("#hrv=50"), null);
});

test("backfill: fills gaps, never overwrites a real check-in", () => {
  const h = [{ date: "2026-10-14", hrv: 70, score: 80 }];
  const merged = mergeBackfill(h, [{ date: "2026-10-14", hrv: 50, rhr: 52 }, { date: "2026-10-13", hrv: 58 }]);
  assert.equal(merged.find((d) => d.date === "2026-10-14").hrv, 70);
  assert.equal(merged.find((d) => d.date === "2026-10-14").rhr, 52);
  assert.equal(merged.find((d) => d.date === "2026-10-13").source, "backfill");
});

test("backfill: 30 days makes baselines rolling immediately", () => {
  const rows = Array.from({ length: 30 }, (_, i) => `${shiftKey(TODAY, -(30 - i))},${55 + (i % 5)},${53 + (i % 3)},7.3`).join(";");
  const history = mergeBackfill([], parseBackfillHash(`#history=${rows}`));
  const b = computeBaselines(history, TODAY, base);
  assert.equal(b.source, "rolling");
  assert.equal(b.days, 30);
});

test("history: upsert merges same day", () => {
  const h = upsertDay([{ date: TODAY, hrv: 50 }], { date: TODAY, score: 70 });
  assert.deepEqual(h, [{ date: TODAY, hrv: 50, score: 70 }]);
});

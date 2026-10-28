// GET /api/stats: the public summary. Invented data, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { publicStats, handleStats } from "../api/_stats.js";
import { shiftKey } from "../src/engine.js";

const TODAY = "2026-10-15";
const NOW = Date.UTC(2026, 9, 15, 9, 0);
const seed = (n = 20) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(TODAY, -(n - 1 - i)), hrv: 50 + i, rhr: 60 - (i % 4), sleepHours: 7 + (i % 3) / 10, score: 60 + i,
  ankleHip: 3, energy: 4, directives: ["ankle-flare"], override: i === 3 ? "ill" : null, bedTime: "23:10", notes: "private",
}));

test("stats: score, day type and the 30-day pattern", () => {
  const s = publicStats(seed(), TODAY);
  assert.equal(s.updated, TODAY);
  assert.equal(s.today.score, 79);
  assert.equal(s.today.day, "Balanced Flow");
  assert.equal(s.last30.length, 30);
  assert.equal(s.last30.at(-1), 79);
  assert.equal(s.last30[0], null); // no data that far back
});

test("stats: HRV, RHR and sleep only as 7-day averages, never a single day's reading", () => {
  const s = publicStats(seed(), TODAY);
  assert.equal(s.trends.hrv.avg7, 66); // mean of 63…69
  assert.equal(s.trends.hrv.change, 7);
  assert.equal(s.trends.hrv.week.length, 7);
  assert.equal(s.trends.sleep.unit, "h");
  const today = seed().at(-1);
  assert.notEqual(s.trends.hrv.avg7, today.hrv);
});

test("stats: nothing private leaks", () => {
  const json = JSON.stringify(publicStats(seed(), TODAY));
  for (const word of ["ankle", "energy", "directive", "override", "ill", "bedTime", "23:10", "private", "notes"]) {
    assert.ok(!json.includes(word), word);
  }
});

test("stats: a short window gives no average rather than a guess", () => {
  const s = publicStats(seed(2), TODAY);
  assert.equal(s.trends.hrv.avg7, null);
  assert.equal(s.trends.hrv.change, null);
  assert.equal(publicStats([], TODAY), null);
});

test("stats: off unless PUBLIC_STATS=on, GET only", async () => {
  const db = { loadDays: async () => seed() };
  assert.equal((await handleStats({ method: "GET", env: { OWNER_USER_ID: "u" }, db, now: NOW })).status, 404);
  assert.equal((await handleStats({ method: "POST", env: { PUBLIC_STATS: "on", OWNER_USER_ID: "u" }, db, now: NOW })).status, 405);
  assert.equal((await handleStats({ method: "GET", env: { PUBLIC_STATS: "on" }, db, now: NOW })).status, 503);
  const ok = await handleStats({ method: "GET", env: { PUBLIC_STATS: "on", OWNER_USER_ID: "u" }, db, now: NOW });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.today.score, 79);
});

// Morning sync shared by the browser and the server, and the decision record
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ingestSync, carryOverCheckin, checkinDay, buildDecision, decisionSummary, londonDate, parseSyncHash, planDay,
  shiftKey, DEFAULT_CHECKIN, ENGINE_VERSION,
} from "../src/engine.js";

const TODAY = "2026-10-15";
const NOW = Date.UTC(2026, 9, 15, 6, 30);
// Invented history: 20 scored days with steady readings
const history = Array.from({ length: 20 }, (_, i) => ({
  date: shiftKey(TODAY, -(20 - i)), hrv: 60 + (i % 5), rhr: 52 + (i % 3), sleepHours: 7.4, sleepQuality: 7,
  upper: 2, lower: 2, ankleHip: 2, energy: 4, score: 70, ratedOn: shiftKey(TODAY, -3), updatedAt: 1,
}));

test("london date: follows BST and GMT, not the server's clock", () => {
  assert.equal(londonDate(Date.UTC(2026, 9, 14, 23, 30)), "2026-10-15"); // 00:30 BST
  assert.equal(londonDate(Date.UTC(2026, 11, 14, 23, 30)), "2026-12-14"); // 23:30 GMT
});

test("carry-over: newest check-in's ratings and readings, defaults before any", () => {
  const h = [...history, { date: shiftKey(TODAY, -1), hrv: 70, rhr: 50, ankleHip: 4, energy: 2, score: 60, ratedOn: shiftKey(TODAY, -1) }];
  const c = carryOverCheckin(h);
  assert.equal(c.ankleHip, 4);
  assert.equal(c.energy, 2);
  assert.equal(c.rhr, 50);
  assert.equal(c.ratedOn, shiftKey(TODAY, -1));
  assert.equal(c.hrvBaseline, DEFAULT_CHECKIN.hrvBaseline);
  assert.deepEqual(carryOverCheckin([]), DEFAULT_CHECKIN);
  assert.equal("override" in carryOverCheckin([], { override: "ill" }), false);
});

test("ingest: same score as planning the same check-in directly", () => {
  const synced = parseSyncHash("#hrv=55&rhr=58&sleep=6.2");
  const checkin = carryOverCheckin(history);
  const out = ingestSync({ history, checkin, synced, today: TODAY, now: NOW });
  const direct = planDay({ checkin: { ...checkin, ...synced }, history, today: TODAY });
  assert.equal(out.plan.result.score, direct.result.score);
  const day = out.history.find((d) => d.date === TODAY);
  assert.equal(day.score, direct.result.score);
  assert.equal(day.hrv, 55);
  assert.equal(day.updatedAt, NOW);
  assert.equal(day.syncedAt, NOW);
  assert.deepEqual(day.directives, direct.directives.map((d) => d.id));
  assert.deepEqual(out.changedDates, [TODAY]);
});

test("ingest: yesterday's strap data goes on yesterday, overnight oxygen on today only", () => {
  const synced = parseSyncHash("#hrv=62&rhr=53&sleep=7.5&st=9500&spo2=96");
  const out = ingestSync({ history, checkin: carryOverCheckin(history), synced, today: TODAY, now: NOW });
  assert.deepEqual(out.changedDates, [shiftKey(TODAY, -1), TODAY]);
  assert.equal(out.history.find((d) => d.date === shiftKey(TODAY, -1)).steps, 9500);
  assert.equal(out.history.find((d) => d.date === TODAY).spo2, 96);
  assert.equal("spo2" in out.checkin, false, "overnight readings never carry over");
});

test("check-in day: override stays on the day record", () => {
  const { entry, plan } = checkinDay({ next: { ...carryOverCheckin(history) }, extra: { override: "ill" }, history, today: TODAY, now: NOW });
  assert.equal(entry.override, "ill");
  assert.equal(plan.directives[0].id, "override");
});

test("decision: records inputs, baselines, every part and each direction's number", () => {
  const synced = parseSyncHash("#hrv=45&rhr=60&sleep=5.5");
  const out = ingestSync({ history, checkin: carryOverCheckin(history), synced, today: TODAY, now: NOW });
  const d = buildDecision({ plan: out.plan, checkin: out.checkin, today: TODAY, source: "server", now: NOW });
  assert.equal(d.engine, ENGINE_VERSION);
  assert.equal(d.source, "server");
  assert.equal(d.inputs.hrv, 45);
  assert.equal(d.baselines.source, "rolling");
  assert.equal(d.parts.map((p) => p.weight).join(), "35,35,20,10");
  assert.ok(Math.abs(d.parts.reduce((s, p) => s + p.points, 0) - d.score) < 1);
  assert.ok(d.directives.length > 0 && d.directives.every((x) => x.why && x.action), "every direction keeps its number and action");
  assert.ok(d.drills.includes("k2w"));
  assert.doesNotThrow(() => JSON.stringify(d));
  assert.match(decisionSummary(out.plan), /^\d+% · \w/);
});

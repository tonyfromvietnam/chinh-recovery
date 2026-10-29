// GET /api/public: the owner's data for visitors, minus bed/wake times and the reason for rest days
import { test } from "node:test";
import assert from "node:assert/strict";
import { handlePublic, publicDay, publicProfile } from "../api/_public.js";
import { planDay, shiftKey } from "../src/engine.js";

const NOW = Date.UTC(2026, 9, 29, 8, 0);
const ENV = { PUBLIC_DASHBOARD: "on", OWNER_USER_ID: "user-1" };
const days = [
  { date: "2026-10-27", hrv: 60, rhr: 52, sleepHours: 7, bedTime: "23:10", wakeTime: "07:02", score: 70, updatedAt: 1 },
  { date: "2026-10-28", hrv: 50, rhr: 58, sleepHours: 5, override: "ill", score: 40, directives: ["override"], updatedAt: 2 },
];
const profile = { usualWake: "07:00", wakeByDay: { sat: "09:00" }, template: { mon: "fullA" }, equipment: ["bar"], sessionMinutes: 30 };
const db = { loadDays: async () => days, loadProfile: async () => profile };

test("public: off unless switched on, GET only", async () => {
  assert.equal((await handlePublic({ method: "GET", env: {}, db, now: NOW })).status, 404);
  assert.equal((await handlePublic({ method: "POST", env: ENV, db, now: NOW })).status, 405);
  assert.equal((await handlePublic({ method: "GET", env: { PUBLIC_DASHBOARD: "on" }, db, now: NOW })).status, 503);
});

test("public: bed and wake times and the rest-day reason never leave the server", async () => {
  const res = await handlePublic({ method: "GET", env: ENV, db, now: NOW });
  assert.equal(res.status, 200);
  const text = JSON.stringify(res.json);
  for (const secret of ["23:10", "07:02", "07:00", "09:00", "ill", "bedTime", "wakeTime", "usualWake", "wakeByDay"]) {
    assert.equal(text.includes(secret), false, `${secret} must not be served`);
  }
  assert.equal(res.json.days[1].override, "rest");
  assert.equal(res.json.days[0].hrv, 60, "everything else is served");
  assert.deepEqual(res.json.profile.template, { mon: "fullA" });
  assert.equal(days[0].bedTime, "23:10", "the stored data itself is untouched");
  assert.deepEqual(Object.keys(res.json.learned).sort(), ["footballN", "footballRecoveryH", "sleepNeedH", "sleepNeedN"]);
  assert.equal("chronotypeMin" in res.json.learned, false, "body-clock timing stays private");
});

test("public: a rest day still plans as recovery, without saying why", () => {
  const plan = planDay({ checkin: { ...publicDay(days[1]), upper: 2, lower: 2, ankleHip: 2, energy: 3, sleepQuality: 5 },
    history: days.map(publicDay), today: "2026-10-28" });
  assert.equal(plan.directives[0].title, "Recover: rest day");
  assert.match(plan.directives[0].why, /a rest day/);
  assert.equal(plan.archetype.id, "restore");
  assert.equal(publicProfile(null), null);
  assert.equal(shiftKey("2026-10-28", 1), "2026-10-29");
});

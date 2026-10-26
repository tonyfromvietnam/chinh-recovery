// POST /api/ingest with an in-memory database: no network, invented data
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleIngest, toHash } from "../api/_ingest.js";
import { shiftKey, ingestSync, carryOverCheckin, parseSyncHash } from "../src/engine.js";

const NOW = Date.UTC(2026, 9, 15, 6, 30); // 07:30 in London
const TODAY = "2026-10-15";
const ENV = { INGEST_TOKEN: "test-token-123", OWNER_USER_ID: "user-1" };
const AUTH = { authorization: "Bearer test-token-123" };
const seed = () => Array.from({ length: 20 }, (_, i) => ({
  date: shiftKey(TODAY, -(20 - i)), hrv: 60 + (i % 5), rhr: 52 + (i % 3), sleepHours: 7.4, sleepQuality: 7,
  upper: 2, lower: 2, ankleHip: 3, energy: 4, score: 70, updatedAt: 1,
}));
function memoryDb(days = seed(), profile = null) {
  const db = { days: [...days], decisions: [], saved: [],
    loadDays: async () => db.days, loadProfile: async () => profile,
    saveDays: async (_u, rows) => { db.saved.push(...rows); for (const r of rows) db.days = [...db.days.filter((d) => d.date !== r.date), r]; },
    saveDecision: async (_u, d) => { db.decisions.push(d); } };
  return db;
}
const call = (over = {}) => handleIngest({ method: "POST", headers: AUTH, env: ENV, now: NOW,
  body: { link: "https://www.duychinhdinh.com/chinh-recovery/#hrv=58&rhr=54&sleep=26640" }, db: memoryDb(), ...over });

test("api: refuses anything but a POST with the right token", async () => {
  assert.equal((await call({ method: "GET" })).status, 405);
  assert.equal((await call({ headers: {} })).status, 401);
  assert.equal((await call({ headers: { authorization: "Bearer wrong" } })).status, 401);
  assert.equal((await call({ env: {} })).status, 500);
});

test("api: the link, a bare fragment, a query or flat JSON all work", () => {
  assert.equal(toHash({ link: "https://x/#hrv=58&rhr=54" }), "#hrv=58&rhr=54");
  assert.equal(toHash("hrv=58&rhr=54"), "#hrv=58&rhr=54");
  assert.equal(toHash({ query: "?hrv=58" }), "#hrv=58");
  assert.deepEqual(parseSyncHash(toHash({ hrv: 58, rhr: 54, sleep: 26640 })), { hrv: 58, rhr: 54, sleepHours: 7.4 });
  assert.equal(toHash({}), null);
});

test("api: scores today, saves the day and an immutable decision", async () => {
  const db = memoryDb();
  const res = await call({ db });
  assert.equal(res.status, 200);
  assert.equal(res.json.date, TODAY);
  const day = db.days.find((d) => d.date === TODAY);
  assert.equal(day.hrv, 58);
  assert.equal(day.score, res.json.score);
  assert.equal(day.updatedAt, NOW);
  assert.equal(day.ankleHip, 3, "ratings carried over from the last check-in");
  assert.equal(db.decisions.length, 1);
  assert.equal(db.decisions[0].source, "shortcut");
  assert.equal(db.decisions[0].score, res.json.score);
  assert.match(res.json.summary, /^\d+% · /);
});

test("api: the server and the app reach the same score from the same data", async () => {
  const db = memoryDb();
  const res = await call({ db });
  const history = seed();
  const app = ingestSync({ history, checkin: carryOverCheckin(history), synced: parseSyncHash("#hrv=58&rhr=54&sleep=26640"), today: TODAY, now: NOW });
  assert.equal(res.json.score, app.plan.result.score);
});

test("api: bad input says what's missing, and nothing is saved", async () => {
  const db = memoryDb();
  const res = await call({ db, body: { link: "https://x/#nothing=1" } });
  assert.equal(res.status, 400);
  assert.equal(db.saved.length + db.decisions.length, 0);
  assert.equal((await call({ body: "{not json" })).status, 400);
});

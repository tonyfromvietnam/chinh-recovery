/* Tests for M8.4 — the AI trainer's input, validator, fallback and server function. Invented data only;
   Claude, Supabase Auth and the usage counter are all mocked. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planDay, shiftKey, coachInput, coachConstraints, validateSession, sessionFromCoach, estimateMinutes, COACH, COACH_SCHEMA,
} from "../src/engine.js";
import { handleCoach } from "../api/_coach.js";

const TODAY = "2026-10-19"; // a Monday: Full A
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const week = { mon: "full-a", tue: "rest", wed: "football", thu: "full-b", fri: "rest", sat: "football", sun: "rest" };
const profile = { usualWake: "07:00", template: week, equipment: ["bands", "bar", "dip"], sessionMinutes: 30 };
const hist = (n) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(TODAY, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), sleepHours: 7.5, ankleHip: 2, score: 70, hrvWindow: "overnight", hrvCount: 3,
}));
const day = (checkin = base, history = hist(20)) => {
  const plan = planDay({ checkin, history, today: TODAY, profile });
  return { plan, history, c: coachConstraints({ session: plan.session, history, today: TODAY }) };
};

/* The standard session written the way the AI must answer: it has to pass the same checks */
function asAi(session, c) {
  return {
    power: session.power.map((p) => ({ id: p.id, rung: p.rung, sets: p.sets, reps: p.reps[1] })),
    blocks: session.blocks.map((b) => ({ rounds: b.rounds, restSec: b.restSec,
      pair: b.pair.map((p) => ({ id: p.id, rung: p.rung, sets: p.sets, reps: p.reps[0], rir: c.failureAllowed ? 0 : 2 })) })),
    why: "Score 82 and ankle 2/5: standard Full A.",
  };
}
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- Input ---------- */
test("coach: input is a summary with no identifiers, dates or raw history", () => {
  const { plan, history } = day();
  const input = coachInput({ plan, history: history.map((h) => ({ ...h, email: "me@example.com", name: "Someone" })), profile, today: TODAY });
  const json = JSON.stringify(input);
  assert.ok(input.library.length > 20);
  assert.ok(input.library.every((e) => e.pattern !== "balance"), "balance stays in the mobility panel");
  assert.equal(input.today.dayType, "full-a");
  assert.ok(!/example\.com|Someone|email|"name":"Someone"/.test(json));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(json), "days are sent as 'days ago', never as dates");
  assert.ok(!("hrv" in input) && !("history" in input));
});

test("coach: no input on a recovery day", () => {
  const { plan, history } = day({ ...base, override: "ill" });
  assert.equal(coachInput({ plan, history, profile, today: TODAY }), null);
});

test("coach: the schema asks for power, blocks and why only", () => {
  assert.deepEqual(COACH_SCHEMA.required, ["power", "blocks", "why"]);
  assert.equal(COACH_SCHEMA.additionalProperties, false);
});

/* ---------- Validator ---------- */
test("validator: the standard session passes", () => {
  const { plan, c } = day();
  const check = validateSession(asAi(plan.session, c), c);
  assert.deepEqual(check.errors, []);
  assert.equal(check.ok, true);
});

test("validator: each rule rejects a bad session", () => {
  const { plan, c } = day();
  const good = asAi(plan.session, c);
  const bad = (mutate, constraints = c) => { const s = clone(good); mutate(s); return validateSession(s, constraints); };
  const first = (s) => s.blocks[0].pair[0];

  assert.equal(bad((s) => { first(s).id = "squat-99"; }).ok, false, "unknown id");
  assert.equal(bad((s) => { first(s).id = "balance-1"; first(s).rung = 1; }).ok, false, "balance isn't the AI's");
  assert.equal(bad(() => {}, { ...c, equipment: [] }).ok, false, "kit switched off");
  assert.equal(bad((s) => { first(s).rung += 1; }).ok, false, "rung must match the id");
  assert.equal(bad((s) => { s.blocks[0].restSec = 30; }).ok, false, "rest 45–60 s");
  assert.equal(bad((s) => { first(s).sets = first(s).sets + 1; }).ok, false, "sets equal rounds");
  assert.equal(bad((s) => { first(s).reps = 40; }).ok, false, "reps inside the range");
  assert.equal(bad((s) => { first(s).rir = 0; }, { ...c, failureAllowed: false }).ok, false, "no failure on capped days");
  assert.equal(bad((s) => { s.blocks[1].pair[0] = clone(s.blocks[0].pair[0]); }).ok, false, "no duplicates");
  assert.equal(bad((s) => { s.why = ""; }).ok, false, "a reason is required");
  assert.equal(bad((s) => { s.blocks = []; }).ok, false, "at least one block");
  assert.equal(bad((s) => { s.blocks.forEach((b) => { b.rounds = 5; b.pair.forEach((p) => { p.sets = 5; }); }); }).ok, false, "fits the time");
  assert.equal(bad(() => {}, { ...c, noNordic: true }).ok, false, "no Nordic when it's not allowed");
});

test("validator: rungs stay within one of the progression rule", () => {
  const { plan, c } = day();
  const s = asAi(plan.session, c);
  const squat = s.blocks[0].pair.find((p) => p.id.startsWith("squat"));
  const want = c.rungs.squat;
  const far = want + 2 <= 6 ? want + 2 : want - 2;
  Object.assign(squat, { id: `squat-${far}`, rung: far, reps: 8 });
  assert.ok(validateSession(s, c).errors.some((e) => /more than 1/.test(e)));
});

test("validator: power ≤ 5 reps, ≤ 15 s, and no leg power above rung 0 until the ankle is ready", () => {
  const { c } = day();
  const blocks = asAi(day().plan.session, c).blocks;
  const power = (items, extra = {}) => validateSession({ power: items, blocks, why: "x" }, { ...c, powerCount: 2, ...extra });
  assert.equal(power([{ id: "power-u-2", rung: 2, sets: 3, reps: 6 }]).ok, false);
  assert.equal(power([{ id: "power-u-2", rung: 2, sets: 3, reps: 4 }]).ok, true);
  assert.equal(power([{ id: "power-l-1", rung: 1, sets: 2, reps: 15 }], { legPowerAllowed: false }).ok, false);
  assert.equal(power([{ id: "power-l-1", rung: 1, sets: 2, reps: 16 }], { legPowerAllowed: true }).ok, false);
  assert.equal(power([{ id: "power-l-0", rung: 0, sets: 3, reps: 5 }], { legPowerAllowed: false }).ok, true);
  assert.equal(power([{ id: "power-u-2", rung: 2, sets: 3, reps: 4 }, { id: "power-l-0", rung: 0, sets: 3, reps: 5 }], { powerCount: 1 }).ok, false);
});

test("validator: an ankle flare rules out high-ankle exercises", () => {
  const { plan, c } = day({ ...base, ankleHip: 4 });
  assert.equal(c.ankleMax, 1);
  const s = asAi(plan.session, c);
  s.power = [{ id: "power-l-2", rung: 2, sets: 3, reps: 4 }];
  assert.ok(validateSession(s, c).errors.some((e) => /ankle/.test(e)));
});

test("validator: Nordic is off after one in the last two days", () => {
  const history = hist(20);
  history[history.length - 1] = { ...history[history.length - 1], workout: { dayType: "full-b", exercises: [{ id: "nordic-2", rung: 2, reps: [5, 5] }] } };
  const { c } = day(base, history);
  assert.equal(c.noNordic, true);
});

/* ---------- Fallback and conversion ---------- */
test("fallback: an AI answer becomes a session the card can show and log", () => {
  const { plan, c } = day();
  const ai = asAi(plan.session, c);
  const s = sessionFromCoach(ai, plan.session);
  assert.equal(s.source, "ai");
  assert.equal(s.why, ai.why);
  assert.equal(s.minutes, estimateMinutes(s));
  assert.ok(s.minutes <= c.sessionMinutes);
  const item = s.blocks[0].pair[0];
  assert.deepEqual(item.reps, [ai.blocks[0].pair[0].reps, ai.blocks[0].pair[0].reps]);
  assert.ok(item.name && item.unit);
});

/* ---------- Server ---------- */
const ENV = { ANTHROPIC_API_KEY: "test", OWNER_EMAIL: "Owner@Example.com" };
function server(over = {}) {
  const { plan, c, history } = day();
  const calls = { claim: 0, claude: 0 };
  const deps = {
    method: "POST", env: ENV, headers: { authorization: "Bearer token-1" },
    body: { kind: "plan", input: coachInput({ plan, history, profile, today: TODAY }), constraints: c },
    verifyUser: async (t) => (t === "token-1" ? { email: "owner@example.com" } : t === "token-2" ? { email: "someone@else.com" } : null),
    claim: async () => { calls.claim++; return true; },
    askClaude: async () => { calls.claude++; return { session: asAi(plan.session, c), model: "claude-opus-5-5" }; },
    ...over,
  };
  return { run: () => handleCoach(deps), calls };
}

test("api: only POST, and not before it's set up", async () => {
  assert.equal((await server({ method: "GET" }).run()).status, 405);
  assert.equal((await server({ env: {} }).run()).status, 500);
});

test("api: a non-owner is refused before the counter or Claude", async () => {
  const s = server({ headers: { authorization: "Bearer token-2" } });
  assert.equal((await s.run()).status, 403);
  assert.deepEqual(s.calls, { claim: 0, claude: 0 });
  assert.equal((await server({ headers: {} }).run()).status, 401);
  assert.equal((await server({ headers: { authorization: "Bearer expired" } }).run()).status, 401);
});

test("api: 429 once today's requests are used up, without calling Claude", async () => {
  const s = server({ claim: async () => false });
  const out = await s.run();
  assert.equal(out.status, 429);
  assert.equal(s.calls.claude, 0);
});

test("api: a valid plan comes back checked; a bad one comes back marked for fallback", async () => {
  const good = await server().run();
  assert.equal(good.status, 200);
  assert.equal(good.json.ok, true);
  const { plan, c } = day();
  const broken = asAi(plan.session, c);
  broken.blocks[0].restSec = 10;
  const bad = await server({ askClaude: async () => ({ session: broken }) }).run();
  assert.equal(bad.status, 200);
  assert.equal(bad.json.ok, false);
  assert.ok(bad.json.errors.length > 0);
  assert.equal((await server({ askClaude: async () => ({ error: "declined" }) }).run()).status, 502);
  assert.equal((await server({ body: { kind: "nope", input: {}, constraints: {} } }).run()).status, 400);
});

test("api: limits match the spec", () => {
  assert.equal(COACH.plansPerDay, 1);
  assert.equal(COACH.regenerations, 3);
});

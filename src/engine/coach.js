/* M8.4 — AI trainer (Claude): what it's told, and the rules its answer must pass.
   The engine still decides how hard today is; the AI only picks what to do within that.
   Every AI session goes through `validateSession`; if it fails, CHINH shows the rule-based session. */
import { isNum, shiftKey, weekday, WEEKDAYS } from "./util.js";
import {
  EXERCISES, TRAINING, exerciseById, targetReps, logEntries, nextRung, pickRung, estimateMinutes, dayTypeOf,
} from "./exercises.js";

export const COACH = {
  plansPerDay: 1, // one plan a day…
  regenerations: 3, // …plus three "new plan" requests (counted in Supabase, see claim_coach_request)
  historyDays: 42, // six weeks of logged sessions go in
  ankleDays: 14, // ankle/hip ratings for the last fortnight
  recentPerPattern: 6, // logged attempts per pattern
  rungTolerance: 1, // the AI may move a rung either way from the progression rule, never more
  maxRounds: 5,
  maxBlocks: 4,
  maxPowerReps: 5,
  maxPowerSec: 15,
  maxRir: 4,
  nordicGapDays: 2, // Nordic ≥ 72 h apart: none if one was logged in the last two days
  whyMaxChars: 400,
};

const COACHED = (e) => e.pattern !== "balance"; // balance lives in the mobility panel, not the AI's to choose
const isPower = (pattern) => pattern.startsWith("power");

/* What the session may contain today, from buildSession's context and the log */
export function coachConstraints({ session, history = [], today }) {
  const ctx = session?.context;
  if (!ctx) return null;
  const past = history.filter((h) => h.date < today);
  const patterns = [...new Set(EXERCISES.filter(COACHED).map((e) => e.pattern))];
  const rungs = {};
  for (const p of patterns) {
    let wanted = nextRung(past, p)?.rung ?? (isPower(p) ? 1 : TRAINING.startRung);
    if (ctx.soreLegs && TRAINING.lowerPatterns.includes(p)) wanted -= 1;
    const ex = pickRung(p, wanted, { equipment: ctx.equipment, ankleMax: ctx.ankleMax });
    if (ex) rungs[p] = ex.rung;
  }
  const nordicRecent = [1, 2].some((n) => logEntries(past.filter((h) => h.date === shiftKey(today, -n)), "nordic").length > 0);
  return {
    dayType: session.type, equipment: ctx.equipment, sessionMinutes: ctx.sessionMinutes, ankleMax: ctx.ankleMax,
    legPowerAllowed: !!ctx.legsReady, powerCount: ctx.powerCount, failureAllowed: !!ctx.failure,
    noNordic: !!ctx.footballTomorrow || nordicRecent, rungs, restRange: TRAINING.restRange,
  };
}

/* ---------- Input: a summary, never identifiers or raw history ---------- */
export function coachInput({ plan, history = [], profile = null, today }) {
  const session = plan?.session;
  const c = coachConstraints({ session, history, today });
  if (!c || session.recovery) return null;
  const past = history.filter((h) => h.date < today && h.date >= shiftKey(today, -COACH.historyDays));

  const library = EXERCISES.filter((e) => COACHED(e) && e.needs.every((n) => c.equipment.includes(n)) && e.ankle <= c.ankleMax)
    .map((e) => ({ id: e.id, pattern: e.pattern, rung: e.rung, name: e.name, reps: targetReps(e), unit: e.unit, perSide: e.side, ankle: e.ankle }));

  const recent = {};
  for (const p of Object.keys(c.rungs)) {
    const entries = logEntries(past, p).slice(-COACH.recentPerPattern)
      .map((e) => ({ daysAgo: daysAgo(today, e.date), rung: e.rung, best: e.reps.length ? Math.max(...e.reps) : null, lastSet: e.last }));
    if (entries.length) recent[p] = entries;
  }

  const ankleHip = [];
  for (let n = COACH.ankleDays - 1; n >= 0; n--) {
    const d = history.find((h) => h.date === shiftKey(today, -n));
    if (isNum(d?.ankleHip)) ankleHip.push({ daysAgo: n, value: d.ankleHip });
  }

  const template = profile?.template || {};
  const footballDays = WEEKDAYS.filter((d) => dayTypeOf(template[d]) === "football");
  const monday = shiftKey(today, -WEEKDAYS.indexOf(weekday(today)));
  const thisWeek = history.filter((h) => h.date >= monday && h.date < today);
  const nordicSessions = thisWeek.filter((h) => logEntries([h], "nordic").length > 0).length;
  const copenhagenReps = thisWeek.flatMap((h) => logEntries([h], "copenhagen")).reduce((s, e) => s + e.reps.reduce((a, b) => a + b, 0), 0);

  return {
    today: {
      weekday: weekday(today), dayType: session.type, label: session.label,
      archetype: plan.archetype.label, score: plan.result?.score ?? null,
      decision: plan.decision?.decision ?? null, decisionDetail: plan.decision?.detail ?? null,
      directions: (plan.directives || []).map((d) => ({ id: d.id, level: d.level, why: d.why })),
    },
    limits: {
      sessionMinutes: c.sessionMinutes, equipment: c.equipment, maxAnkleLoad: c.ankleMax,
      legPowerAboveRung0: c.legPowerAllowed, powerExercises: c.powerCount, lastSetToFailureAllowed: c.failureAllowed,
      nordicAllowed: !c.noNordic, restSec: c.restRange, rungs: c.rungs, rungTolerance: COACH.rungTolerance,
    },
    standardSession: {
      power: session.power.map((p) => ({ id: p.id, sets: p.sets })),
      blocks: session.blocks.map((b) => ({ pair: b.pair.map((p) => p.id), rounds: b.rounds, restSec: b.restSec })),
      minutes: session.minutes,
    },
    recentLogs: recent,
    ankleHip,
    hrLoad: plan.load?.ready ? { week: plan.load.week, fourWeekAvg: plan.load.chronic4wkAvg, ratio: plan.load.ratio } : null,
    footballDays,
    prehabThisWeek: { nordicSessions, nordicTarget: 2, copenhagenReps, copenhagenTarget: 30 },
    library,
  };
}

const daysAgo = (today, date) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000);

/* ---------- What the AI must return (JSON schema for structured output) ---------- */
const POWER_ITEM = {
  type: "object", additionalProperties: false, required: ["id", "rung", "sets", "reps"],
  properties: { id: { type: "string" }, rung: { type: "integer" }, sets: { type: "integer" }, reps: { type: "integer" } },
};
const BLOCK_ITEM = {
  type: "object", additionalProperties: false, required: ["id", "rung", "sets", "reps", "rir"],
  properties: { id: { type: "string" }, rung: { type: "integer" }, sets: { type: "integer" }, reps: { type: "integer" }, rir: { type: "integer" } },
};
export const COACH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["power", "blocks", "why"],
  properties: {
    power: { type: "array", items: POWER_ITEM },
    blocks: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["pair", "rounds", "restSec"],
        properties: { pair: { type: "array", items: BLOCK_ITEM }, rounds: { type: "integer" }, restSec: { type: "integer" } },
      },
    },
    why: { type: "string" },
  },
};

export const COACH_SYSTEM = [
  "You are a strength coach picking today's calisthenics session for one person.",
  "Goal: strong for his size, springy and mobile for football; not bulk. Kit: bodyweight, resistance bands, a pull-up bar and dip bars.",
  "The app has already decided how hard today is (archetype, decision, directions). You only choose what to do within that; never make the day harder than the standard session.",
  "Use only exercise ids from `library`, at a rung within `rungTolerance` of `limits.rungs` for that pattern.",
  "Power: at most `limits.powerExercises` items, never more than 5 reps a set (timed power at most 15 s), never to failure; leg power above rung 0 only when `limits.legPowerAboveRung0` is true.",
  "Blocks are supersets of one or two exercises that alternate opposite muscles. restSec 45–60. Each item's sets equal the block's rounds. reps must sit inside the exercise's range. rir is reps in reserve: 0 only when `lastSetToFailureAllowed` is true, otherwise 1–4.",
  "No Nordic when `nordicAllowed` is false. Respect the ankle load limit. Keep 5 min warm-up and power + 45 s per set + rest within `sessionMinutes`.",
  "Prefer the day type's patterns, keep prehab on track for the week, and use recent logs to vary exercise choice sensibly.",
  "`why`: one or two sentences naming the numbers behind your choices (e.g. a rating, a direction or a log). British English.",
].join("\n");

/* ---------- Validator ---------- */
export function validateSession(ai, c) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  if (!ai || typeof ai !== "object" || !Array.isArray(ai.power) || !Array.isArray(ai.blocks)) return { ok: false, errors: ["Not a session."] };
  if (!c) return { ok: false, errors: ["No constraints for today."] };
  if (typeof ai.why !== "string" || !ai.why.trim()) fail("No reason given.");
  else if (ai.why.length > COACH.whyMaxChars) fail("Reason is too long.");

  const check = (item, where) => {
    const ex = exerciseById(item?.id);
    if (!ex || !COACHED(ex)) { fail(`${where}: unknown exercise ${item?.id}.`); return null; }
    if (!ex.needs.every((n) => c.equipment.includes(n))) fail(`${ex.id}: needs kit that's switched off.`);
    if (ex.ankle > c.ankleMax) fail(`${ex.id}: too much ankle load today.`);
    if (item.rung !== ex.rung) fail(`${ex.id}: rung doesn't match the exercise.`);
    const want = c.rungs[ex.pattern];
    if (isNum(want) && Math.abs(ex.rung - want) > COACH.rungTolerance) fail(`${ex.id}: rung ${ex.rung} is more than ${COACH.rungTolerance} from ${want}.`);
    if (ex.pattern === "nordic" && c.noNordic) fail("Nordic isn't allowed today.");
    if (!Number.isInteger(item.sets) || item.sets < 1) fail(`${ex.id}: sets must be a whole number ≥ 1.`);
    return ex;
  };

  if (ai.power.length > c.powerCount) fail(`At most ${c.powerCount} power exercise${c.powerCount === 1 ? "" : "s"} today.`);
  for (const p of ai.power) {
    const ex = check(p, "power");
    if (!ex) continue;
    if (!isPower(ex.pattern)) fail(`${ex.id} isn't a power exercise.`);
    if (ex.pattern === "power-l" && ex.rung > 0 && !c.legPowerAllowed) fail("Leg power above rung 0 isn't allowed yet.");
    const cap = ex.unit === "s" ? COACH.maxPowerSec : COACH.maxPowerReps;
    if (!Number.isInteger(p.reps) || p.reps < 1 || p.reps > Math.min(cap, ex.reps[1])) fail(`${ex.id}: power dose must be 1–${Math.min(cap, ex.reps[1])}.`);
  }

  if (!ai.blocks.length) fail("No blocks.");
  if (ai.blocks.length > COACH.maxBlocks) fail(`At most ${COACH.maxBlocks} blocks.`);
  const [restLo, restHi] = c.restRange;
  for (const b of ai.blocks) {
    if (!Array.isArray(b?.pair) || b.pair.length < 1 || b.pair.length > 2) { fail("Each block is one or two exercises."); continue; }
    if (!Number.isInteger(b.rounds) || b.rounds < 1 || b.rounds > COACH.maxRounds) fail(`Rounds must be 1–${COACH.maxRounds}.`);
    if (!Number.isInteger(b.restSec) || b.restSec < restLo || b.restSec > restHi) fail(`Rest must be ${restLo}–${restHi} s.`);
    for (const p of b.pair) {
      const ex = check(p, "block");
      if (!ex) continue;
      if (isPower(ex.pattern)) fail(`${ex.id}: power goes in the primer, not a superset.`);
      if (p.sets !== b.rounds) fail(`${ex.id}: sets must equal the block's rounds.`);
      const [lo, hi] = ex.unit === "reps" ? targetReps(ex) : ex.reps;
      if (!Number.isInteger(p.reps) || p.reps < lo || p.reps > hi) fail(`${ex.id}: reps must be ${lo}–${hi}.`);
      if (!Number.isInteger(p.rir) || p.rir < 0 || p.rir > COACH.maxRir) fail(`${ex.id}: reps in reserve must be 0–${COACH.maxRir}.`);
      else if (p.rir === 0 && !c.failureAllowed) fail(`${ex.id}: no sets to failure today.`);
    }
  }
  const ids = ai.blocks.flatMap((b) => (b?.pair || []).map((p) => p?.id));
  if (new Set(ids).size !== ids.length) fail("An exercise appears twice.");

  if (!errors.length && estimateMinutes(ai) > c.sessionMinutes) fail(`Takes ${estimateMinutes(ai)} min, over the ${c.sessionMinutes}-min plan.`);
  return { ok: errors.length === 0, errors };
}

/* ---------- A validated AI answer → the session shape TrainingCard shows and logs ---------- */
export function sessionFromCoach(ai, standard) {
  const rir = (n) => (n === 0 ? "last set to failure" : `${n} in reserve`);
  const item = (p, effort) => {
    const ex = exerciseById(p.id);
    const same = [...standard.power, ...standard.blocks.flatMap((b) => b.pair)].find((s) => s.id === p.id);
    return { id: ex.id, pattern: ex.pattern, rung: ex.rung, name: ex.name, sets: p.sets, reps: [p.reps, p.reps], unit: ex.unit, side: ex.side,
      extra: same?.extra ?? 0, change: same?.change ?? "ai", effort };
  };
  const session = {
    ...standard, source: "ai", why: ai.why.trim(),
    power: ai.power.map((p) => item(p, "fast, stop when reps slow")),
    blocks: ai.blocks.map((b, i) => ({ pair: b.pair.map((p) => item(p, rir(p.rir))), rounds: b.rounds, restSec: b.restSec,
      range: standard.blocks[i]?.range ?? standard.blocks[0]?.range ?? null })),
  };
  session.minutes = estimateMinutes(session);
  return session;
}

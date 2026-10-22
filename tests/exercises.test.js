/* Tests for M8.1 — exercise library and rule-based sessions (docs/TECH_SPEC.md). Invented data only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXERCISES, TRAINING, buildSession, estimateMinutes, targetReps, isEntryRung, pickRung, currentRung, mobilityExtras,
  exerciseById, dayTypeOf, planDay, spacingConflicts, shiftKey, formatDose,
} from "../src/engine.js";

const TODAY = "2026-10-19"; // a Monday
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const week = { mon: "full-a", tue: "rest", wed: "football", thu: "full-b", fri: "rest", sat: "football", sun: "rest" };
const profile = { usualWake: "07:00", template: week, equipment: ["bands", "bar", "dip"], sessionMinutes: 30 };
const session = (o = {}) => buildSession({ dayType: "full-a", archetypeId: "high", profile, checkin: base, today: TODAY, ...o });
const all = (s) => [...s.power, ...s.blocks.flatMap((b) => b.pair)];
const hist = (n, f = () => ({})) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(TODAY, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), sleepHours: 7.5, score: 70, hrvWindow: "overnight", hrvCount: 3, ...f(i),
}));

/* ---------- Library ---------- */
test("library: ids are unique and every power dose is ≤ 5 reps or ≤ 15 s", () => {
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  for (const e of EXERCISES.filter((x) => x.pattern.startsWith("power"))) {
    assert.ok(e.unit === "s" ? e.reps[1] <= 15 : e.reps[1] <= 5, `${e.id} ${e.reps}`);
  }
});

test("library: entry rungs keep their own range; harder main rungs aim for 5–10", () => {
  const box = exerciseById("squat-1"), split = exerciseById("squat-3"), pushup = exerciseById("push-h-2"), row = exerciseById("pull-h-1");
  assert.equal(isEntryRung(box), true);
  assert.equal(isEntryRung(row), true);
  assert.deepEqual(targetReps(box), [12, 20]);
  assert.deepEqual(targetReps(split), [8, 10]);
  assert.deepEqual(targetReps(pushup), [8, 10]); // 8–20 capped at 10: 12+ clean reps means the next rung
  assert.deepEqual(targetReps(exerciseById("nordic-1")), [3, 6]); // prehab keeps its own range
  assert.equal(formatDose(split, 3), "3 × 8–10 / side");
  assert.equal(formatDose(exerciseById("power-l-1")), "2 × 15 s");
});

test("library: old upper/lower plan days map to Full A / Full B", () => {
  assert.equal(dayTypeOf("upper"), "full-a");
  assert.equal(dayTypeOf("lower"), "full-b");
  assert.equal(buildSession({ dayType: "football", archetypeId: "high", profile }), null);
});

test("ladder: start at rung 2 with no log, then follow the log", () => {
  const s = session();
  assert.equal(s.blocks[0].pair[0].id, "squat-2");
  const logged = [{ date: shiftKey(TODAY, -3), workout: { exercises: [{ id: "squat-5", rung: 5 }] } }];
  assert.equal(currentRung(logged, "squat"), 5);
  assert.equal(session({ history: logged }).blocks[0].pair[0].id, "squat-5");
});

test("equipment: missing kit falls back to the nearest rung without it, or drops the exercise", () => {
  assert.equal(pickRung("squat", 4, { equipment: [] }).id, "squat-3"); // banded split squat → split squat
  const noBar = session({ profile: { ...profile, equipment: ["bands", "dip"] } });
  assert.ok(all(noBar).every((e) => !exerciseById(e.id).needs.includes("bar")));
  assert.deepEqual(noBar.blocks[0].pair.map((p) => p.pattern), ["squat"]);
});

/* ---------- Readiness ---------- */
test("high output: all rounds, last set to failure; balanced: one round fewer, never to failure", () => {
  const hi = session();
  assert.ok(hi.blocks.every((b) => b.rounds === 3));
  assert.ok(hi.blocks.flatMap((b) => b.pair).every((p) => /failure/.test(p.effort)));
  const bal = session({ archetypeId: "balanced" });
  assert.ok(bal.blocks.every((b) => b.rounds === 2));
  assert.ok(all(bal).every((p) => !/failure/.test(p.effort)));
});

test("failure sets only on High Output days, and never when capped or reduced", () => {
  const cap = session({ decision: { decision: "cap" } });
  assert.ok(all(cap).every((p) => !/failure/.test(p.effort)));
  const reduce = session({ decision: { decision: "reduce" } });
  assert.ok(reduce.blocks.every((b) => b.rounds === 2));
  assert.ok(all(reduce).every((p) => !/failure/.test(p.effort)));
});

test("restoration swap: Active Restoration, a stop or recover → mobility panel only", () => {
  for (const s of [
    session({ archetypeId: "restore" }),
    session({ directives: [{ id: "hrv-low", level: "stop" }] }),
    session({ directives: [{ id: "rhr-high", level: "stop" }] }),
    session({ decision: { decision: "recover" } }),
  ]) {
    assert.equal(s.recovery, true);
    assert.deepEqual(s.blocks, []);
    assert.deepEqual(s.power, []);
  }
  assert.equal(session({ directives: [{ id: "rhr-high", level: "adjust" }] }).recovery, false);
});

test("ankle flare: no exercise with ankle load 2, and balance stays at rungs 1–3", () => {
  const s = session({ directives: [{ id: "ankle-flare", level: "stop" }], checkin: { ...base, ankleHip: 4 } });
  assert.ok(all(s).every((e) => exerciseById(e.id).ankle < 2));
  assert.ok(s.blocks.every((b) => !b.range || b.range.ankle === 0));
  const deep = [{ date: shiftKey(TODAY, -2), workout: { exercises: [{ id: "balance-6", rung: 6 }] } }];
  const [bal] = mobilityExtras({ history: deep, flare: true });
  assert.ok(bal.rung <= 3);
  assert.equal(mobilityExtras({ history: deep })[0].rung, 6);
});

test("sore legs: leg patterns one rung easier and one round fewer", () => {
  const logged = [{ date: shiftKey(TODAY, -3), workout: { exercises: [{ id: "squat-5", rung: 5 }, { id: "pull-v-4", rung: 4 }] } }];
  const s = session({ history: logged, checkin: { ...base, lower: 4 } });
  const squatPair = s.blocks[0];
  assert.equal(squatPair.pair[0].id, "squat-4");
  assert.equal(squatPair.pair[1].id, "pull-v-4"); // upper pattern unchanged
  assert.equal(squatPair.rounds, 2);
});

/* ---------- Power primer ---------- */
test("power: High Output gets leg and upper power, Balanced Flow one, never to failure", () => {
  assert.deepEqual(session().power.map((p) => p.pattern), ["power-l", "power-u"]);
  assert.equal(session({ archetypeId: "balanced" }).power.length, 1);
  assert.ok(session().power.every((p) => /fast/.test(p.effort)));
});

test("power-l gate: jumps only with the ankle settled, legs fresh and balance at rung 4", () => {
  const notYet = session();
  assert.equal(notYet.power[0].id, "power-l-0"); // no balance log yet → glute-bridge fallback
  const ready = [{ date: shiftKey(TODAY, -2), workout: { exercises: [{ id: "balance-4", rung: 4 }] } }];
  assert.equal(session({ history: ready }).power[0].id, "power-l-1");
  assert.equal(session({ history: ready, checkin: { ...base, ankleHip: 3 } }).power[0].id, "power-l-0");
  assert.equal(session({ history: ready, checkin: { ...base, lower: 4 } }).power[0].id, "power-l-0");
  assert.equal(session({ history: ready, directives: [{ id: "ankle-flare", level: "stop" }] }).power[0].id, "power-l-0");
  // Balanced Flow gets leg power only when it's ready, otherwise upper power
  assert.equal(session({ archetypeId: "balanced" }).power[0].pattern, "power-u");
  assert.equal(session({ archetypeId: "balanced", history: ready }).power[0].pattern, "power-l");
});

/* ---------- Nordic and football ---------- */
test("nordic: in both Full A and Full B, never the day before football", () => {
  assert.ok(all(session()).some((e) => e.pattern === "nordic"));
  assert.ok(all(session({ dayType: "full-b" })).some((e) => e.pattern === "nordic"));
  // Tuesday Full A before Wednesday football
  const tue = buildSession({ dayType: "full-a", archetypeId: "high", profile, checkin: base, today: "2026-10-20" });
  assert.equal(all(tue).some((e) => e.pattern === "nordic"), false);
  assert.ok(tue.blocks.filter((b) => b.pair.some((p) => ["squat", "hinge"].includes(p.pattern))).every((b) => b.rounds === 2));
  assert.match(tue.why, /football tomorrow/);
});

test("spacing: full-body sessions count as leg days before football", () => {
  const c = spacingConflicts({ template: { ...week, tue: "full-a" } });
  assert.ok(c.some((x) => x.from === "tue" && x.to === "wed" && x.rule === "lower-before-football"));
  assert.equal(spacingConflicts({ template: week }).filter((x) => x.rule === "lower-before-football").length, 0);
});

/* ---------- Time ---------- */
test("time: estimated minutes fit 20 / 30 / 45 and rest stays at 45–60 s", () => {
  for (const m of [20, 30, 45]) {
    for (const archetypeId of ["high", "balanced"]) {
      const s = session({ archetypeId, profile: { ...profile, sessionMinutes: m } });
      assert.ok(s.minutes <= m, `${archetypeId} ${m}: ${s.minutes}`);
      assert.equal(s.minutes, estimateMinutes(s));
      assert.ok(s.blocks.every((b) => b.restSec >= TRAINING.restRange[0] && b.restSec <= TRAINING.restRange[1]));
    }
  }
  assert.equal(session().minutes, 28); // 5 + 3 pairs × 3 rounds × (2 × 45 s + 60 s)
});

test("range: one loaded end-range drill in each pair's rest", () => {
  assert.ok(session().blocks.every((b) => b.range && b.range.id.startsWith("range-")));
});

/* ---------- Mobility panel and planDay ---------- */
test("mobility: balance every day, calves on strength days, the four required drills stay", () => {
  const restDay = planDay({ checkin: base, history: hist(10), today: "2026-10-21", profile: { ...profile } }); // Wednesday: football
  assert.ok(restDay.drills.some((d) => d.id.startsWith("balance-")));
  assert.equal(restDay.drills.some((d) => d.id.startsWith("calf-")), false);
  const mon = planDay({ checkin: base, history: hist(10), today: TODAY, profile });
  assert.ok(mon.drills.some((d) => d.id.startsWith("calf-")));
  for (const name of ["Knee-to-Wall Dynamic Pulses", "90/90 Hip Switches", "World's Greatest Stretch", "Cossack Squats"]) {
    assert.ok(mon.drills.some((d) => d.name === name), name);
  }
});

test("planDay: a strength day gets a session and the training block shows its title and real minutes", () => {
  const d = planDay({ checkin: base, history: hist(10), today: TODAY, profile });
  assert.ok(d.session && !d.session.recovery);
  const block = d.schedule.find((i) => i.slot === "training");
  assert.match(block.title, /^Full A · \d+ min/);
  assert.equal(block.dur, d.session.minutes);
  const football = planDay({ checkin: base, history: hist(10), today: "2026-10-21", profile });
  assert.equal(football.session, null);
  const noProfile = planDay({ checkin: base, history: hist(10), today: TODAY });
  assert.equal(noProfile.session, null);
});

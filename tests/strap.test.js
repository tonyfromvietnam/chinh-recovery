/* Tests for M7 — More from your Helio Strap (docs/TECH_SPEC.md). Invented data only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSyncHash, applyYesterday, planDay, shiftKey, dataConfidence, tagsForDay, learnProfile, footballRecoveryProfile,
  HR, ACTIVITY, SPO2, personalMaxHr, zoneBounds, zoneMinutes, hrLoad, autoSession, hrLoadSummary,
  medianBefore, isBigDay, activityVitals, addEasyWalk, spo2Baseline, spo2Status, sleepStages, generateSchedule,
} from "../src/engine.js";

const TODAY = "2026-10-15"; // a Thursday
const base = { sleepHours: 7.5, sleepQuality: 7, hrv: 60, hrvBaseline: 60, rhr: 55, rhrBaseline: 55, upper: 2, lower: 2, ankleHip: 2, energy: 4 };
const good = { hrvWindow: "overnight", hrvCount: 3, sleepHours: 7.5 };
const hist = (n, f = () => ({}), end = TODAY) => Array.from({ length: n }, (_, i) => ({
  date: shiftKey(end, -(n - i)), hrv: 60 + (i % 3) - 1, rhr: 55 + (i % 2), score: 70, ...good, ...f(i),
}));
const profile = { usualWake: "07:00", template: { mon: "upper", tue: "lower", wed: "football", thu: "upper", fri: "lower", sat: "football", sun: "rest" } };
const byDate = (h) => new Map(h.map((d) => [d.date, d]));

/* ================= Shortcut contract ================= */
test("sync: M7 params split into yesterday's and overnight values", () => {
  const s = parseSyncHash("#hrv=58&z=12,30,25,10,2&hri=30&hrmax=181&st=9450&ae=640&spo2=96.4&spo2min=92&deep=62&rem=95&core=240");
  assert.equal(s.hrv, 58);
  assert.deepEqual(s.yesterday, { hrZones: [6, 15, 12.5, 5, 1], hrMax: 181, steps: 9450, activeKcal: 640 });
  assert.deepEqual(s.overnight, { spo2: 96.4, spo2Min: 92, stages: { deep: 62, rem: 95, core: 240 } });
});

test("sync: out-of-range and malformed M7 values are dropped; v1 links unchanged", () => {
  const s = parseSyncHash("#hrv=58&z=1,2,3&hrmax=300&st=-5&spo2=40&deep=0&rem=0");
  assert.equal(s.yesterday, undefined);
  assert.equal(s.overnight, undefined);
  assert.deepEqual(parseSyncHash("#hrv=58&rhr=54&sleep=26640"), { hrv: 58, rhr: 54, sleepHours: 7.4 });
  assert.deepEqual(parseSyncHash("#spo2=95").overnight, { spo2: 95 });
  assert.deepEqual(parseSyncHash("#spo2=0.955&spo2min=0.91").overnight, { spo2: 95.5, spo2Min: 91 }); // Health's fraction form
  assert.deepEqual(parseSyncHash("#deep=3720").overnight.stages, { deep: 62 }); // seconds → minutes
});

/* ================= M7.1 Heart-rate training load ================= */
test("hr: zone conversion uses the sample interval", () => {
  assert.deepEqual(zoneMinutes([10, 20, 30, 40, 50]), [10, 20, 30, 40, 50]);
  assert.deepEqual(zoneMinutes([10, 20, 30, 40, 50], 30), [5, 10, 15, 20, 25]);
  assert.equal(zoneMinutes([1, 2, 3]), null);
  assert.equal(zoneMinutes([1, 2, -3, 4, 5]), null);
});

test("hr: Edwards TRIMP weights each zone by its number", () => {
  assert.equal(hrLoad([10, 10, 10, 10, 10]), 150);
  assert.equal(hrLoad([0, 30, 20, 0, 0]), 120);
  assert.equal(hrLoad(null), null);
});

test("hr: max HR is the 98th percentile of 90 days once 10 days exist; a set value wins", () => {
  const few = hist(9, (i) => ({ hrMax: 170 + i }));
  assert.equal(personalMaxHr(few, null, TODAY).bpm, null);
  const h = hist(40, (i) => ({ hrMax: i === 5 ? 240 : 170 + (i % 10) }));
  const m = personalMaxHr(h, null, TODAY);
  assert.equal(m.source, "learned");
  assert.ok(m.bpm >= 179 && m.bpm < 240, `got ${m.bpm}`); // one spike doesn't set the max
  assert.equal(personalMaxHr(h, { maxHr: 192 }, TODAY).bpm, 192);
  assert.deepEqual(zoneBounds(200)[0], { zone: 1, from: 100, to: 120 });
  assert.deepEqual(zoneBounds(200)[4], { zone: 5, from: 180, to: 200 });
});

test("hr: auto session only above the threshold, typed from the weekly plan", () => {
  assert.equal(autoSession("2026-10-14", [20, 10, 0, 0, 0], profile), null); // load 40
  const s = autoSession("2026-10-14", [10, 20, 25, 10, 0], profile); // a Wednesday
  assert.deepEqual(s, { type: "football", auto: true, minutes: 55, load: 165 });
  assert.equal(autoSession("2026-10-18", [10, 20, 25, 10, 0], profile).type, "other"); // Sunday is rest
  assert.equal(autoSession("2026-10-14", [10, 20, 25, 10, 0], null).type, "other");
});

test("hr: yesterday's values land on yesterday's record with an auto session; a hand-logged one is kept", () => {
  const y = { hrZones: [10, 20, 25, 10, 0], steps: 9000, activeKcal: 600, hrMax: 180 };
  const h = applyYesterday([{ date: "2026-10-14", hrv: 60, updatedAt: 1 }], TODAY, y, profile, 99);
  const d = h.find((x) => x.date === "2026-10-14");
  assert.equal(d.hrv, 60);
  assert.equal(d.steps, 9000);
  assert.equal(d.updatedAt, 99);
  assert.equal(d.session.auto, true);
  const manual = { type: "upper", minutes: 60, rpe: 7 };
  const kept = applyYesterday([{ date: "2026-10-14", session: manual }], TODAY, y, profile, 99);
  assert.deepEqual(kept[0].session, manual);
  const untouched = [{ date: "2026-10-14", hrv: 60 }];
  assert.equal(applyYesterday(untouched, TODAY, {}, profile), untouched);
  // Below the session threshold: no session
  assert.equal(applyYesterday([], TODAY, { hrZones: [10, 5, 0, 0, 0] }, profile)[0].session, null);
});

test("hr: load summary waits for 4 prior days with HR data, then compares the week", () => {
  const z = [0, 20, 20, 0, 0]; // load 100
  const early = hrLoadSummary(hist(9, () => ({ hrZones: z })), TODAY); // only 2 days before the current week
  assert.equal(early.ready, false);
  assert.equal(early.ratio, null);
  const h = hist(35, (i) => ({ hrZones: i % 3 === 0 ? z : undefined }));
  const s = hrLoadSummary(h, TODAY);
  assert.equal(s.ready, true);
  assert.ok(s.ratio > 0);
  assert.equal(s.days.length, 28);
  const spike = hrLoadSummary(hist(35, (i) => ({ hrZones: i >= 28 ? [0, 0, 0, 30, 30] : i % 7 === 0 ? z : undefined })), TODAY);
  assert.equal(spike.spike, true);
});

test("hr: the load ratio is advisory: today's decision is the same with or without HR data", () => {
  const plain = hist(30);
  const loaded = hist(30, (i) => ({ hrZones: i >= 23 ? [0, 0, 0, 40, 40] : [0, 10, 0, 0, 0] }));
  const a = planDay({ checkin: base, history: plain, today: TODAY, profile });
  const b = planDay({ checkin: base, history: loaded, today: TODAY, profile });
  assert.equal(b.load.spike, true);
  assert.deepEqual(b.decision, a.decision);
  assert.deepEqual(b.directives.map((d) => d.id), a.directives.map((d) => d.id));
});

test("hr: football recovery is learned from auto-detected football days only", () => {
  const h = hist(60, (i) => {
    const date = shiftKey(TODAY, -(60 - i));
    const match = i >= 25 && (i - 25) % 7 === 0;
    return { wakeTime: "07:00", ...(match ? { session: { type: "football", auto: true, minutes: 70 } } : {}),
      ...((i - 25) % 7 === 1 && i > 25 ? { hrv: 45, rhr: 62 } : {}) };
  });
  const f = footballRecoveryProfile(h);
  assert.equal(f.ready, true);
  assert.equal(f.hours, 36); // match 19:00, still down the next morning, back to normal at 07:00 the morning after
  assert.equal(learnProfile(h, TODAY).footballRecoveryH, 36);
  const manual = h.map((d) => (d.session ? { ...d, session: { type: "football", minutes: 70, rpe: 8 } } : d));
  assert.equal(footballRecoveryProfile(manual).n, 0);
});

/* ================= M7.2 Steps and active energy ================= */
test("activity: 30-day median needs 7 days", () => {
  const h = hist(10, (i) => ({ steps: 6000 + i * 100 }));
  assert.equal(medianBefore(byDate(h), TODAY, "steps"), 6450);
  assert.equal(medianBefore(byDate(hist(5, () => ({ steps: 6000 }))), TODAY, "steps"), null);
});

test("activity: big-day tag at 1.5 × median active energy, and it feeds the habit tags", () => {
  const h = hist(20, (i) => ({ activeKcal: i === 19 ? 900 : 500 }));
  const last = h[h.length - 1];
  assert.equal(isBigDay(last, byDate(h)), true);
  assert.equal(isBigDay(h[18], byDate(h)), false);
  assert.ok(tagsForDay(last, byDate(h)).has("big-day"));
  const v = activityVitals(h, TODAY);
  assert.equal(v.activeKcal, 900);
  assert.equal(v.kcalMedian, 500);
  assert.equal(v.bigDay, true);
});

test("activity: easy walk only on restoration days after a low-step day", () => {
  const low = { steps: 3200, lowSteps: true };
  const restore = generateSchedule("restore", base, []);
  const withWalk = addEasyWalk(restore, "restore", low);
  assert.equal(withWalk.length, restore.length + 1);
  assert.equal(withWalk.find((i) => i.id === "easy-walk").dur, ACTIVITY.walkMin);
  assert.deepEqual(withWalk.map((i) => i.time), [...withWalk.map((i) => i.time)].sort());
  assert.equal(addEasyWalk(generateSchedule("balanced", base, []), "balanced", low).length, generateSchedule("balanced", base, []).length);
  assert.equal(addEasyWalk(restore, "restore", { steps: 8000, lowSteps: false }).length, restore.length);
  assert.equal(addEasyWalk(restore, "restore", null).length, restore.length);
});

test("activity: planDay adds the walk on a low-score day after few steps", () => {
  const h = hist(20, (i) => ({ steps: i === 19 ? 2500 : 8000 }));
  const rough = { ...base, sleepHours: 4.5, sleepQuality: 3, hrv: 40, upper: 4, lower: 4, energy: 1 };
  const d = planDay({ checkin: rough, history: h, today: TODAY });
  assert.equal(d.archetype.id, "restore");
  assert.ok(d.schedule.some((i) => i.id === "easy-walk"));
  assert.equal(d.activity.steps, 2500);
});

/* ================= M7.3 Overnight blood oxygen ================= */
test("spo2: 30-day baseline excludes override and low-confidence days", () => {
  const h = hist(10, (i) => ({ spo2: i < 2 ? 85 : 96, ...(i < 2 ? { override: "ill" } : {}) }));
  assert.equal(spo2Baseline(h, TODAY).mean, 96);
  assert.equal(spo2Baseline(hist(3, () => ({ spo2: 96 })), TODAY).mean, null);
});

test("spo2: supporting only — no direction on its own, but it strengthens the RHR warning", () => {
  const h = hist(20, () => ({ spo2: 96 }));
  const lowO2 = planDay({ checkin: { ...base, spo2: 93 }, history: h, today: TODAY });
  const plain = planDay({ checkin: base, history: h, today: TODAY });
  assert.deepEqual(lowO2.directives.map((d) => d.id), plain.directives.map((d) => d.id));
  assert.equal(lowO2.spo2.down, true);

  const sick = planDay({ checkin: { ...base, rhr: 62, spo2: 93 }, history: h, today: TODAY });
  const rhr = sick.directives.find((d) => d.id === "rhr-high");
  assert.match(rhr.why, /oxygen is down 3 points/);
  const sickNoO2 = planDay({ checkin: { ...base, rhr: 62 }, history: h, today: TODAY });
  assert.doesNotMatch(sickNoO2.directives.find((d) => d.id === "rhr-high").why, /oxygen/);
});

test("spo2: a single very low minimum is a data-quality note, not a health claim", () => {
  const c = dataConfidence({ hrv: 60, hrvWindow: "overnight", hrvCount: 3, sleepHours: 7, spo2Min: 84 });
  assert.equal(c.level, "high");
  assert.match(c.notes[0], /loose strap/);
  assert.deepEqual(dataConfidence({ hrv: 60, hrvWindow: "overnight", hrvCount: 3, sleepHours: 7, spo2Min: 91 }).notes, []);
  const s = spo2Status({ spo2: 92, spo2Min: 84 }, hist(20, () => ({ spo2: 96 })), TODAY);
  assert.equal(s.artefact, true);
  // An artefact night doesn't add to the RHR warning
  const d = planDay({ checkin: { ...base, rhr: 62, spo2: 92, spo2Min: 84 }, history: hist(20, () => ({ spo2: 96 })), today: TODAY });
  assert.doesNotMatch(d.directives.find((x) => x.id === "rhr-high").why, /oxygen/);
  assert.equal(SPO2.artefactMin, 88);
});

/* ================= M7.4 Sleep stages ================= */
test("stages: display only — shares add up, score unchanged", () => {
  const s = sleepStages({ deep: 60, core: 240, rem: 100 });
  assert.equal(s.total, 400);
  assert.deepEqual(s.parts.map((p) => p.pct), [15, 60, 25]);
  assert.equal(sleepStages({ deep: 0 }), null);
  assert.equal(sleepStages(null), null);
  const a = planDay({ checkin: base, history: hist(20), today: TODAY });
  const b = planDay({ checkin: { ...base, stages: { deep: 10, core: 300, rem: 20 } }, history: hist(20), today: TODAY });
  assert.equal(b.result.score, a.result.score);
  assert.ok(b.stages);
});

test("compat: days without any M7 fields plan exactly as before", () => {
  const d = planDay({ checkin: base, history: hist(20), today: TODAY, profile });
  assert.equal(d.activity, null);
  assert.equal(d.spo2, null);
  assert.equal(d.stages, null);
  assert.equal(d.load.hasData, false);
  assert.equal(d.maxHr.bpm, null);
  assert.equal(HR.sessionMin, 60);
});

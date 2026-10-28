/* M8.1 — Calisthenics + bands: the exercise library and rule-based sessions.
   Library and rules: docs/knowledge/calisthenics-and-bands.md. The engine decides how hard today is
   (archetype, directions, decision); this module only chooses what to do within that. */
import { isNum, shiftKey, weekday } from "./util.js";

/* ---------- Library ----------
   reps: [low, high]; unit "reps" or "s"; side: per side; ankle 0 none · 1 low · 2 high; needs: equipment keys */
const L = (pattern, rung, name, reps, extra = {}) => ({
  id: `${pattern}-${rung}`, pattern, rung, name, reps, unit: "reps", side: false, ankle: 0, needs: [], ...extra,
});
const S = { side: true };
const A1 = { ankle: 1 }, A2 = { ankle: 2 };
const BAND = ["bands"], BAR = ["bar"], DIP = ["dip"];

export const EXERCISES = [
  // Squat
  L("squat", 1, "Box squat (sit to a chair)", [12, 20], A1),
  L("squat", 2, "Bodyweight squat, 3 s down", [12, 20], A1),
  L("squat", 3, "Split squat", [8, 15], { ...S, ...A1 }),
  L("squat", 4, "Banded split squat", [8, 15], { ...S, ...A1, needs: BAND }),
  L("squat", 5, "Rear-foot-elevated split squat", [8, 15], { ...S, ...A1 }),
  L("squat", 6, "Banded Bulgarian split squat", [8, 15], { ...S, ...A1, needs: BAND }),
  L("squat", 7, "Shrimp squat to a cushion", [5, 10], { ...S, ...A2 }),
  L("squat", 8, "Pistol squat to a box", [5, 10], { ...S, ...A2 }),
  // Hinge
  L("hinge", 1, "Glute bridge", [12, 20]),
  L("hinge", 2, "Single-leg glute bridge", [10, 15], S),
  L("hinge", 3, "Banded hip thrust", [10, 20], { needs: BAND }),
  L("hinge", 4, "Single-leg RDL, bodyweight", [8, 12], { ...S, ...A1 }),
  L("hinge", 5, "Banded single-leg RDL", [8, 12], { ...S, ...A1, needs: BAND }),
  L("hinge", 6, "Banded good morning + single-leg RDL", [8, 10], { ...S, ...A1, needs: BAND }),
  // Calves
  L("calf", 1, "Double-leg calf raise, 2 s pause", [15, 25], A1),
  L("calf", 2, "Single-leg calf raise", [10, 20], { ...S, ...A1 }),
  L("calf", 3, "Single-leg calf raise off a step", [10, 20], { ...S, ...A1 }),
  L("calf", 4, "Banded single-leg calf raise off a step", [10, 20], { ...S, ...A1, needs: BAND }),
  // Horizontal push
  L("push-h", 1, "Incline push-up", [10, 20]),
  L("push-h", 2, "Push-up", [8, 20]),
  L("push-h", 3, "Banded push-up", [8, 15], { needs: BAND }),
  L("push-h", 4, "Deficit push-up", [8, 15]),
  L("push-h", 5, "Archer push-up", [5, 10], S),
  // Vertical push
  L("push-v", 1, "Pike push-up", [8, 15]),
  L("push-v", 2, "Feet-elevated pike push-up", [6, 12]),
  L("push-v", 3, "Banded overhead press, half-kneeling", [8, 15], { needs: BAND }),
  // Dips
  L("dip", 1, "Support hold, shoulders down", [20, 40], { unit: "s", needs: DIP }),
  L("dip", 2, "Band-assisted dip", [6, 12], { needs: [...DIP, ...BAND] }),
  L("dip", 3, "Dip negatives, 4 s down", [4, 8], { needs: DIP }),
  L("dip", 4, "Dip, full range", [5, 15], { needs: DIP }),
  L("dip", 5, "Dip, 2 s pause at the bottom", [5, 12], { needs: DIP }),
  L("dip", 6, "Weighted dip (backpack)", [5, 10], { needs: DIP }),
  // Horizontal pull
  L("pull-h", 1, "Banded seated row", [12, 20], { needs: BAND }),
  L("pull-h", 2, "Inverted row on the dip bars, knees bent", [10, 15], { needs: DIP }),
  L("pull-h", 3, "Inverted row, legs straight", [8, 15], { needs: DIP }),
  L("pull-h", 4, "Feet-elevated inverted row", [8, 12], { needs: DIP }),
  L("pull-h", 5, "Archer inverted row", [5, 10], { ...S, needs: DIP }),
  // Vertical pull
  L("pull-v", 1, "Scapular pull-up", [8, 12], { needs: BAR }),
  L("pull-v", 2, "Band-assisted pull-up", [5, 10], { needs: [...BAR, ...BAND] }),
  L("pull-v", 3, "Pull-up negatives, 4 s down", [4, 8], { needs: BAR }),
  L("pull-v", 4, "Chin-up", [3, 10], { needs: BAR }),
  L("pull-v", 5, "Pull-up", [3, 10], { needs: BAR }),
  L("pull-v", 6, "Weighted pull-up (backpack)", [3, 8], { needs: BAR }),
  // Core
  L("core", 1, "Dead bug", [8, 12], S),
  L("core", 2, "Side plank", [20, 45], { ...S, unit: "s" }),
  L("core", 3, "Banded Pallof press", [10, 15], { ...S, needs: BAND }),
  L("core", 4, "Banded Pallof press, split stance", [10, 15], { ...S, needs: BAND }),
  L("core", 5, "Side plank with top-leg raise", [20, 40], { ...S, unit: "s" }),
  L("core", 6, "Hanging knee raise", [8, 15], { needs: BAR }),
  L("core", 7, "Tuck L-sit on the dip bars", [10, 30], { unit: "s", needs: DIP }),
  L("core", 8, "Hanging leg raise", [6, 12], { needs: BAR }),
  // Power: never to failure, ≤ 5 reps a set, pogo hops timed (≤ 15 s)
  L("power-l", 0, "Explosive glute bridge", [5, 5], { sets: 3 }),
  L("power-l", 1, "Low pogo hops, soft and quiet", [15, 15], { ...A2, unit: "s", sets: 2 }),
  L("power-l", 2, "Squat jump, stick the landing", [4, 4], { ...A2, sets: 3 }),
  L("power-l", 3, "Broad jump, stick the landing", [3, 3], { ...A2, sets: 3 }),
  L("power-l", 4, "Lateral bound, stick each side", [3, 3], { ...S, ...A2, sets: 3 }),
  L("power-l", 5, "Continuous lateral bounds", [5, 5], { ...S, ...A2, sets: 3 }),
  L("power-l", 6, "Single-leg pogo hops", [10, 10], { ...S, ...A2, unit: "s", sets: 2 }),
  L("power-u", 1, "Band rotational chop, driven from the hips", [5, 5], { ...S, needs: BAND, sets: 3 }),
  L("power-u", 2, "Explosive push-up", [4, 4], { sets: 3 }),
  L("power-u", 3, "Explosive pull-up", [3, 3], { needs: BAR, sets: 3 }),
  L("power-u", 4, "Clap push-up", [4, 4], { sets: 3 }),
  L("power-u", 5, "Fast band punches, driven by the hips", [5, 5], { ...S, needs: BAND, sets: 3 }),
  // Football prehab
  L("nordic", 1, "Band-assisted Nordic", [3, 6], { needs: BAND }),
  L("nordic", 2, "Nordic to a cushion, hands catch", [3, 6]),
  L("nordic", 3, "Full Nordic, slower lowering", [4, 8]),
  L("copenhagen", 1, "Copenhagen, short lever", [5, 10], S),
  L("copenhagen", 2, "Copenhagen, long lever", [5, 10], S),
  // Ankle balance (lives in the mobility panel)
  L("balance", 1, "Single-leg stand, eyes open", [30, 30], { ...S, ...A1, unit: "s", sets: 3 }),
  L("balance", 2, "Single-leg stand, eyes closed", [30, 30], { ...S, ...A1, unit: "s", sets: 3 }),
  L("balance", 3, "Single-leg stand on a cushion", [30, 30], { ...S, ...A1, unit: "s", sets: 3 }),
  L("balance", 4, "Single-leg reach (star excursion)", [5, 5], { ...S, ...A1, sets: 3 }),
  L("balance", 5, "Hop and stick", [5, 5], { ...S, ...A2, sets: 3 }),
  L("balance", 6, "Lateral hop and stick", [5, 5], { ...S, ...A2, sets: 3 }),
];

/* Loaded end-range drills, one in the rest after each superset pair */
export const RANGE_DRILLS = [
  { id: "range-cossack", name: "Cossack squat holding the backpack", dose: "4 / side, 2 s at the bottom", ankle: 1, needs: [] },
  { id: "range-hang", name: "Dead hang", dose: "30–45 s", ankle: 0, needs: BAR },
  { id: "range-split", name: "Deep split-squat hold, back knee down", dose: "30 s / side", ankle: 1, needs: [] },
  { id: "range-pass", name: "Band shoulder pass-through", dose: "10 slow", ankle: 0, needs: BAND },
  { id: "range-straddle", name: "Band-loaded straddle good morning", dose: "8 slow", ankle: 0, needs: BAND },
];

export const TRAINING = {
  sessions: {
    "full-a": { label: "Full A", pairs: [["squat", "pull-v"], ["dip", "hinge"], ["nordic", "core"]] },
    "full-b": { label: "Full B", pairs: [["push-h", "pull-h"], ["squat", "push-v"], ["nordic", "copenhagen"]] },
  },
  legacy: { upper: "full-a", lower: "full-b" }, // old profiles keep working
  mainPatterns: ["squat", "hinge", "push-h", "push-v", "dip", "pull-h", "pull-v"],
  lowerPatterns: ["squat", "hinge", "calf", "nordic", "copenhagen"],
  mainTarget: [5, 10], // strength for your size, not bulk
  entryRepsFrom: 12, // a rung whose range starts at 12+ is an entry rung and keeps its own range
  roundsByMinutes: { 20: 2, 30: 3, 45: 4 },
  restSec: 60, // supersets alternate opposite muscles, so 45–60 s is enough
  restRange: [45, 60],
  secPerSet: 45,
  warmupMin: 5, // warm-up and power primer
  startRung: 2, // no log yet
  balanceFlareMax: 3,
  powerGate: { ankleHipBelow: 3, lowerBelow: 4, balanceRung: 4 },
  defaultEquipment: ["bands", "bar", "dip"],
  defaultMinutes: 30,
};

export const dayTypeOf = (planned) => TRAINING.legacy[planned] ?? planned ?? null;
export const isStrengthDay = (planned) => !!TRAINING.sessions[dayTypeOf(planned)];

const ladder = (pattern) => EXERCISES.filter((e) => e.pattern === pattern).sort((a, b) => a.rung - b.rung);
export const exerciseById = (id) => EXERCISES.find((e) => e.id === id) || null;
export const isEntryRung = (ex) => ex.unit === "reps" && ex.reps[0] >= TRAINING.entryRepsFrom;

/* The rep target: entry rungs keep their own range; harder rungs of the main patterns aim for 5–10 */
export function targetReps(ex) {
  if (!TRAINING.mainPatterns.includes(ex.pattern) || ex.unit !== "reps" || isEntryRung(ex)) return ex.reps;
  const [lo, hi] = TRAINING.mainTarget;
  return [Math.max(ex.reps[0], lo), Math.min(ex.reps[1], hi)];
}

/* ---------- M8.2 Session log and progression ----------
   A day's log: `workout = { dayType, exercises: [{ id, rung, extra, reps: [10, 9, 8], last }], minutes, updatedAt }`.
   Ticking the balance or calf drill in the mobility panel stores `extrasDone = { balance: { id, rung }, calf: … }`,
   which counts as a set at the top of its range. */

/* Every logged attempt at a pattern, oldest first */
export function logEntries(history, pattern) {
  const out = [];
  for (const d of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of d.workout?.exercises || []) {
      const ex = exerciseById(e.id);
      if (ex?.pattern === pattern) out.push({ date: d.date, id: e.id, rung: e.rung ?? ex.rung, extra: e.extra ?? 0, reps: e.reps || [], last: e.last ?? null });
    }
    const done = d.extrasDone?.[pattern];
    const dex = done && exerciseById(done.id);
    if (dex) out.push({ date: d.date, id: dex.id, rung: dex.rung, extra: 0, reps: [dex.reps[1]], last: "right" });
  }
  return out;
}

/* Highest rung logged for a pattern, or null (used for gates such as balance rung 4) */
export function currentRung(history, pattern) {
  const rungs = logEntries(history, pattern).map((e) => e.rung).filter(isNum);
  return rungs.length ? Math.max(...rungs) : null;
}

/* A heavier band or more backpack weight counts as half a rung */
export const isLoadable = (ex) => !!ex && (ex.needs.includes("bands") || /backpack/i.test(ex.name));

/* Double progression (calisthenics-and-bands.md):
   - top of the target range on every set, two sessions running → up (loadable rungs go up half a rung first: heavier band / more weight)
   - from the first harder rung of a main pattern, any set of 12+ clean reps → up straight away
   - missing the bottom of the range twice running → down
   - power moves up only when it felt easy twice running (it's never taken near failure), and always a whole rung: more load would slow it */
export function nextRung(history, pattern) {
  const entries = logEntries(history, pattern);
  if (!entries.length) return null;
  const last = entries[entries.length - 1];
  const ex = exerciseById(last.id);
  const steps = ladder(pattern);
  const [lo, hi] = ex.unit === "reps" ? targetReps(ex) : ex.reps;
  const same = entries.slice(-2).filter((e) => e.rung === last.rung && e.extra === last.extra);
  const power = pattern.startsWith("power");
  const hitTop = (e) => e.reps.length > 0 && e.reps.every((r) => r >= hi) && (!power || e.last === "easy");
  const missed = (e) => e.reps.some((r) => r < lo);
  const bigSet = TRAINING.mainPatterns.includes(pattern) && ex.unit === "reps" && !isEntryRung(ex) && last.reps.some((r) => r >= TRAINING.entryRepsFrom);
  const hold = { rung: last.rung, extra: last.extra, change: "same" };

  if (bigSet || (same.length === 2 && same.every(hitTop))) {
    const why = bigSet ? `${Math.max(...last.reps)} clean reps: time for a harder rung` : "top of the range two sessions running";
    const higher = steps.find((s) => s.rung > last.rung);
    if (isLoadable(ex) && !power && last.extra < 1 && !bigSet) return { rung: last.rung, extra: last.extra + 1, change: "half", why: `${why}: heavier band or more weight, same exercise` };
    return higher ? { rung: higher.rung, extra: 0, change: "up", why } : { rung: last.rung, extra: last.extra + 1, change: "half", why: `${why}: top rung, add load` };
  }
  if (same.length === 2 && same.every(missed)) {
    if (last.extra > 0) return { rung: last.rung, extra: last.extra - 1, change: "down", why: "missed the bottom of the range twice: lighter band or less weight" };
    const lower = [...steps].reverse().find((s) => s.rung < last.rung);
    if (lower) return { rung: lower.rung, extra: 0, change: "down", why: "missed the bottom of the range twice running" };
  }
  return hold;
}

/* Saves a log on a day. A logged workout sets that day's session type; an automatic HR session keeps its minutes and load. */
export function applyWorkoutLog(history, date, workout, now = Date.now()) {
  const prev = history.find((h) => h.date === date) || { date };
  const next = { ...prev, workout: workout ? { ...workout, updatedAt: now } : null, updatedAt: now };
  if (workout && prev.session?.auto) next.session = { ...prev.session, type: dayTypeOf(workout.dayType) };
  return [...history.filter((h) => h.date !== date), next].sort((a, b) => a.date.localeCompare(b.date));
}

/* The day's session for load and the week view: the log sets the type, the HR session the minutes and load */
export function daySession(day) {
  if (!day) return null;
  const auto = day.session?.auto && !day.session.dismissed ? day.session : null;
  if (day.workout) return { type: dayTypeOf(day.workout.dayType), minutes: auto?.minutes ?? day.workout.minutes ?? null, load: auto?.load ?? null, source: auto ? "log+hr" : "log" };
  return auto ? { type: auto.type, minutes: auto.minutes, load: auto.load, source: "hr" } : null;
}

/* Ticking the balance or calf drill in the mobility panel */
export function markExtraDone(history, date, ex, done, now = Date.now()) {
  const prev = history.find((h) => h.date === date) || { date };
  const extrasDone = { ...(prev.extrasDone || {}) };
  if (done) extrasDone[ex.pattern] = { id: ex.id, rung: ex.rung };
  else delete extrasDone[ex.pattern];
  return [...history.filter((h) => h.date !== date), { ...prev, extrasDone, updatedAt: now }].sort((a, b) => a.date.localeCompare(b.date));
}

/* The rung to use: the wanted one if the kit and the ankle allow it, else the nearest easier one, else the nearest harder */
export function pickRung(pattern, wanted, { equipment = TRAINING.defaultEquipment, ankleMax = 2 } = {}) {
  const ok = (e) => e.needs.every((n) => equipment.includes(n)) && e.ankle <= ankleMax;
  const steps = ladder(pattern);
  const fits = steps.filter(ok);
  if (!fits.length) return null;
  const lower = fits.filter((e) => e.rung <= wanted);
  return lower.length ? lower[lower.length - 1] : fits[0];
}

/* "3 × 8–15 / side", "2 × 15 s", "3 × 30 s / side" */
export function formatDose(ex, sets = ex.sets) {
  const [lo, hi] = ex.unit === "reps" ? targetReps(ex) : ex.reps;
  const reps = lo === hi ? `${lo}` : `${lo}–${hi}`;
  return `${sets ? `${sets} × ` : ""}${reps}${ex.unit === "s" ? " s" : ""}${ex.side ? " / side" : ""}`;
}

/* 5 min warm-up and power + 45 s a set + the rest after each pair */
export function estimateMinutes(session) {
  if (!session?.blocks?.length) return 0;
  const sec = session.blocks.reduce((s, b) => s + b.rounds * (b.pair.length * TRAINING.secPerSet + b.restSec), 0);
  return Math.round((TRAINING.warmupMin * 60 + sec) / 60);
}

const has = (directives, id, level) => directives.some((d) => d.id === id && (!level || d.level === level));

/* ---------- Today's session ----------
   Rules (TECH_SPEC M8.1): readiness sets rounds, power and effort; an ankle flare removes high-ankle work;
   sore legs lower the leg rungs; the day before football drops the Nordic and a leg round. */
export function buildSession({ dayType, archetypeId, decision = null, directives = [], profile = null, history = [], checkin = {}, today = null }) {
  const type = dayTypeOf(dayType);
  const plan = TRAINING.sessions[type];
  if (!plan) return null;
  const label = plan.label;
  if (today) history = history.filter((h) => h.date < today); // today's own log never re-plans today's session
  const equipment = Array.isArray(profile?.equipment) ? profile.equipment : TRAINING.defaultEquipment;
  const sessionMinutes = TRAINING.roundsByMinutes[profile?.sessionMinutes] ? profile.sessionMinutes : TRAINING.defaultMinutes;

  const stop = has(directives, "hrv-low", "stop") || has(directives, "rhr-high", "stop") || has(directives, "override");
  if (archetypeId === "restore" || stop || decision?.decision === "recover") {
    const why = archetypeId === "restore" ? "Active Restoration day" : stop ? "Autonomic or illness warning today" : "Today's decision is recover";
    return { type, label, recovery: true, power: [], blocks: [], minutes: 0, sessionMinutes,
      why: `${why}: no strength or power work. The mobility panel (with balance) is today's session.` };
  }

  const high = archetypeId === "high";
  const flare = has(directives, "ankle-flare");
  const soreLegs = isNum(checkin.lower) && checkin.lower >= 4;
  const footballTomorrow = today && dayTypeOf(profile?.template?.[weekday(shiftKey(today, 1))]) === "football";
  const ankleMax = flare ? 1 : 2;
  const reduce = decision?.decision === "reduce";
  const baseRounds = Math.max(1, TRAINING.roundsByMinutes[sessionMinutes] - (high ? 0 : 1) - (reduce ? 1 : 0));
  const failure = high && !["cap", "reduce"].includes(decision?.decision); // a capped or reduced day never goes to failure
  const why = [high ? `High Output: all rounds${failure ? ", last set to failure" : ""}` : "Balanced Flow: one round fewer, 2–3 reps in reserve"];
  if (reduce) why.push("today's decision is reduce: one more round off");
  if (high && decision?.decision === "cap") why.push("capped at RPE 8: no sets to failure");
  if (flare) why.push(`ankle/hip ${checkin.ankleHip}/5: no jumping or hopping`);
  if (soreLegs) why.push(`lower-body soreness ${checkin.lower}/5: legs one rung easier and one round fewer`);
  if (footballTomorrow) why.push("football tomorrow: no Nordic, legs one round fewer");

  const progress = {};
  const rungFor = (pattern) => {
    const next = nextRung(history, pattern);
    let r = next?.rung ?? TRAINING.startRung;
    if (soreLegs && TRAINING.lowerPatterns.includes(pattern)) r -= 1;
    const ex = pickRung(pattern, r, { equipment, ankleMax });
    if (ex) progress[ex.id] = { extra: ex.rung === next?.rung ? next.extra : 0, change: ex.rung === next?.rung ? next.change : next ? "adjusted" : "start", why: next?.why };
    return ex;
  };
  const item = (ex, rounds) => ({ id: ex.id, pattern: ex.pattern, rung: ex.rung, name: ex.name, sets: rounds, reps: targetReps(ex), unit: ex.unit, side: ex.side,
    extra: progress[ex.id]?.extra ?? 0, change: progress[ex.id]?.change ?? "start",
    effort: failure ? "1–2 in reserve, last set to failure" : high ? "1–2 in reserve" : "2–3 in reserve" });

  const ranges = RANGE_DRILLS.filter((d) => d.needs.every((n) => equipment.includes(n)) && !(flare && d.ankle >= 1));
  const blocks = [];
  plan.pairs.forEach((pair, i) => {
    const patterns = pair.filter((p) => !(footballTomorrow && p === "nordic"));
    const legs = patterns.some((p) => TRAINING.lowerPatterns.includes(p));
    const rounds = Math.max(1, baseRounds - (legs && (soreLegs || footballTomorrow) ? 1 : 0));
    const exs = patterns.map(rungFor).filter(Boolean);
    if (!exs.length) return;
    blocks.push({ pair: exs.map((ex) => item(ex, rounds)), rounds, restSec: TRAINING.restSec, range: ranges.length ? ranges[i % ranges.length] : null });
  });

  // Power primer: never to failure, not counted as hard sets
  const power = [];
  const balanceRung = currentRung(history, "balance") ?? 0;
  const g = TRAINING.powerGate;
  const legsReady = !flare && (checkin.ankleHip ?? 5) < g.ankleHipBelow && (checkin.lower ?? 5) < g.lowerBelow && balanceRung >= g.balanceRung;
  const powerL = pickRung("power-l", legsReady ? Math.max(1, nextRung(history, "power-l")?.rung ?? 1) : 0, { equipment, ankleMax: legsReady ? 2 : 0 });
  const powerU = pickRung("power-u", nextRung(history, "power-u")?.rung ?? 1, { equipment });
  if (high) power.push(powerL, powerU);
  else power.push(legsReady ? powerL : powerU);
  const powerItems = power.filter(Boolean).map((ex) => ({ id: ex.id, pattern: ex.pattern, rung: ex.rung, name: ex.name, sets: ex.sets, reps: ex.reps, unit: ex.unit, side: ex.side, effort: "fast, stop when reps slow" }));
  if (!legsReady) why.push("leg power stays at the glute-bridge rung until the ankle is ready (balance rung 4, ankle/hip < 3)");

  // The facts behind today's rules, so the AI trainer (M8.4) is checked against exactly the same limits
  const context = { equipment, sessionMinutes, ankleMax, flare, soreLegs, footballTomorrow: !!footballTomorrow, legsReady, high, failure,
    powerCount: high ? 2 : 1 };

  // Keep inside the time budget: take a round off the longest pair until it fits
  const session = { type, label, recovery: false, power: powerItems, blocks, sessionMinutes, why: why.join("; ") + ".", context };
  while (estimateMinutes(session) > sessionMinutes) {
    const b = [...session.blocks].sort((x, y) => y.rounds - x.rounds)[0];
    if (!b || b.rounds <= 1) break;
    b.rounds -= 1;
    b.pair.forEach((p) => { p.sets = b.rounds; });
  }
  session.minutes = estimateMinutes(session);
  return session;
}

/* Daily balance drill for the mobility panel (rungs 1–3 on an ankle flare) and calves on strength days */
export function mobilityExtras({ history = [], flare = false, strengthDay = false, equipment = TRAINING.defaultEquipment } = {}) {
  const want = Math.max(1, nextRung(history, "balance")?.rung ?? 1);
  const balance = pickRung("balance", flare ? Math.min(want, TRAINING.balanceFlareMax) : want, { equipment, ankleMax: flare ? 1 : 2 });
  const calf = strengthDay ? pickRung("calf", nextRung(history, "calf")?.rung ?? TRAINING.startRung, { equipment, ankleMax: flare ? 1 : 2 }) : null;
  return [balance, calf].filter(Boolean);
}

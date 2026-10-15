/* =========================================================================
   CHINH recovery engine — pure functions, no React. Run tests with `npm test`.

   Data flow:
   Helio Strap → Zepp → Apple Health → iOS Shortcut → CHINH (#hrv=…&rhr=…&sleep=…)
   → history (on device) → rolling baselines → score → archetype → directions + plan
   ========================================================================= */

export const SLEEP_TARGET_H = 8;
export const BASELINE_WINDOW_DAYS = 30;
export const BASELINE_MIN_DAYS = 5;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round1 = (v) => Math.round(v * 10) / 10;

/* ---------- Dates ---------- */
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

/* ---------- 1. Apple Health sync link ----------
   The Shortcut opens …/#hrv=58&rhr=54&sleep=26640
   Everything after # stays on the phone; it is never sent to a server.
   Sleep is accepted in hours, minutes or seconds and normalised to hours. */
export function parseSyncHash(hash) {
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const num = (k) => {
    const raw = params.get(k);
    if (raw == null || raw === "") return null;
    const n = parseFloat(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const out = {};
  const hrv = num("hrv");
  if (hrv != null && hrv > 5 && hrv < 300) out.hrv = Math.round(hrv);
  const rhr = num("rhr");
  if (rhr != null && rhr > 25 && rhr < 120) out.rhr = Math.round(rhr);
  let sleep = num("sleep");
  if (sleep != null) {
    if (sleep > 1440) sleep /= 3600; // seconds
    else if (sleep > 24) sleep /= 60; // minutes
    if (sleep >= 1 && sleep <= 14) out.sleepHours = round1(sleep);
  }
  const sq = num("sq");
  if (sq != null && sq >= 1 && sq <= 10) out.sleepQuality = Math.round(sq);

  return Object.keys(out).length ? out : null;
}

/* ---------- 2. History ---------- */
export function upsertDay(history, entry) {
  const rest = history.filter((h) => h.date !== entry.date);
  const prev = history.find((h) => h.date === entry.date) || {};
  return [...rest, { ...prev, ...entry }].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
}

/* ---------- 3. Rolling baselines ----------
   Mean and spread of the last 30 days, excluding today.
   Until 5 days exist, falls back to the manual baselines from the check-in. */
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

export function computeBaselines(history, today, manual) {
  const from = shiftKey(today, -BASELINE_WINDOW_DAYS);
  const past = history.filter((h) => h.date < today && h.date >= from);
  const hrvs = past.map((h) => h.hrv).filter(Number.isFinite);
  const rhrs = past.map((h) => h.rhr).filter(Number.isFinite);

  const hrvRolling = hrvs.length >= BASELINE_MIN_DAYS;
  const rhrRolling = rhrs.length >= BASELINE_MIN_DAYS;
  const hrvMean = hrvRolling ? mean(hrvs) : manual.hrvBaseline;
  const rhrMean = rhrRolling ? mean(rhrs) : manual.rhrBaseline;

  // The 2 nights before today; sleepDebt() adds last night to make 3
  const recentSleep = history
    .filter((h) => h.date > shiftKey(today, -3) && h.date < today && Number.isFinite(h.sleepHours))
    .map((h) => h.sleepHours);

  return {
    source: hrvRolling ? "rolling" : "manual",
    days: hrvs.length,
    daysNeeded: Math.max(0, BASELINE_MIN_DAYS - hrvs.length),
    hrv: { mean: hrvMean, sd: hrvRolling ? Math.max(stdev(hrvs), hrvMean * 0.05) : hrvMean * 0.1 },
    rhr: { mean: rhrMean, sd: rhrRolling ? Math.max(stdev(rhrs), 1.5) : 3 },
    recentSleep,
  };
}

export function sleepDebt(todaySleep, recentSleep) {
  return round1([todaySleep, ...recentSleep].reduce((s, h) => s + Math.max(0, SLEEP_TARGET_H - h), 0));
}

/* ---------- 4. Recovery score ----------
   Sleep 35% · HRV & RHR 35% · Soreness 20% · Mental energy 10%
   HRV and RHR are scored as distance from YOUR baseline (z-score), not fixed numbers. */
export function calculateRecovery(c, b) {
  const sleep = clamp01(c.sleepHours / SLEEP_TARGET_H) * 0.5 + (c.sleepQuality / 10) * 0.5;

  const hrvZ = (c.hrv - b.hrv.mean) / b.hrv.sd; // higher is better
  const rhrZ = (c.rhr - b.rhr.mean) / b.rhr.sd; // lower is better
  const hrvScore = clamp01((hrvZ + 1.5) / 2.5); // −1.5 SD → 0, +1 SD → 1
  const rhrScore = clamp01((1.5 - rhrZ) / 2.5);
  const autonomic = hrvScore * 0.6 + rhrScore * 0.4;

  // 1 = none, 5 = severe. Ankle/hips count double during sprain rehab.
  const soreness = clamp01((5 - (c.upper + c.lower + c.ankleHip * 2) / 4) / 4);
  const mental = clamp01((c.energy - 1) / 4);

  const parts = [
    { key: "sleep", label: "Sleep", weight: 35, value: sleep },
    { key: "autonomic", label: "HRV & RHR", weight: 35, value: autonomic },
    { key: "soreness", label: "Soreness", weight: 20, value: soreness },
    { key: "mental", label: "Mental energy", weight: 10, value: mental },
  ].map((p) => ({ ...p, points: p.value * p.weight }));

  return {
    score: Math.round(parts.reduce((s, p) => s + p.points, 0)),
    parts,
    hrvZ: round1(hrvZ),
    rhrDelta: Math.round(c.rhr - b.rhr.mean),
    hrvPct: Math.round((c.hrv / b.hrv.mean) * 100),
  };
}

export function getArchetype(score) {
  if (score >= 80)
    return { id: "high", label: "HIGH OUTPUT DAY", color: "#22e58b", tint: "rgba(34,229,139,0.12)",
      summary: "Green light. Load heavy, go deep on focus work, chase intensity." };
  if (score >= 50)
    return { id: "balanced", label: "BALANCED FLOW DAY", color: "#facc15", tint: "rgba(250,204,21,0.12)",
      summary: "Train with intent, not ego. Technique-first volume and structured work." };
  return { id: "restore", label: "ACTIVE RESTORATION DAY", color: "#fb5a6e", tint: "rgba(251,90,110,0.12)",
    summary: "Your system is asking for parasympathetic time. Recover hard today." };
}

/* ---------- 5. Directions ----------
   Each direction: what to do, and the number that triggered it. */
const LEVEL_ORDER = { stop: 0, adjust: 1, go: 2 };

export function generateDirectives({ c, result, baselines, history, today, archetypeId }) {
  const d = [];
  const hrvBase = Math.round(baselines.hrv.mean);
  const rhrBase = Math.round(baselines.rhr.mean);
  const debt = sleepDebt(c.sleepHours, baselines.recentSleep);

  // Autonomic
  if (result.hrvZ <= -1.5) {
    d.push({ id: "hrv-low", level: "stop", title: "No high-intensity work today",
      why: `HRV ${c.hrv} ms vs your ${hrvBase} ms normal (${result.hrvZ} SD).`,
      action: "Swap training for a 30-min Zone 2 walk and mobility." });
  } else if (result.hrvZ <= -1) {
    d.push({ id: "hrv-dip", level: "adjust", title: "Cap intensity at RPE 7",
      why: `HRV ${c.hrv} ms is ${100 - result.hrvPct}% under your ${hrvBase} ms normal.`,
      action: "Keep the session, drop the top sets, stop 3 reps short of failure." });
  }
  if (result.rhrDelta >= 5) {
    d.push({ id: "rhr-high", level: "stop", title: "Resting heart rate is elevated",
      why: `${c.rhr} bpm, ${result.rhrDelta} above your ${rhrBase} bpm normal.`,
      action: "Possible illness or dehydration. 750 ml water before noon, skip football, re-check tomorrow." });
  } else if (result.rhrDelta >= 3) {
    d.push({ id: "rhr-up", level: "adjust", title: "Hydrate early",
      why: `Resting HR ${c.rhr} bpm, ${result.rhrDelta} above normal.`,
      action: "500 ml water with electrolytes before 10:00. No caffeine after 13:00." });
  }

  // Sleep
  if (debt >= 2) {
    d.push({ id: "sleep-debt", level: "adjust", title: "Lights out by 22:00 tonight",
      why: `${debt} h sleep debt across the last 3 nights.`,
      action: "Wind-down moved 30 min earlier. Bedroom cool and dark." });
  }
  if (c.sleepHours < 6) {
    d.push({ id: "short-sleep", level: "adjust", title: "Add a 20-min NSDR after lunch",
      why: `Only ${c.sleepHours} h sleep last night.`,
      action: "Lie down, eyes closed, guided NSDR. Not a nap longer than 25 min." });
  }

  // Ankle / kinetic chain
  if (c.ankleHip >= 4) {
    d.push({ id: "ankle-flare", level: "stop", title: "No football, jumping or cutting",
      why: `Ankle/hip stiffness ${c.ankleHip}/5.`,
      action: "Knee-to-Wall Pulses and Ankle CARs every 3–4 hours today." });
  } else if (c.ankleHip === 3) {
    d.push({ id: "ankle-prime", level: "adjust", title: "Prime the ankle before loading",
      why: `Ankle/hip stiffness ${c.ankleHip}/5.`,
      action: "Knee-to-Wall Pulses + Ankle CARs before any training." });
  }
  if (c.lower >= 4) {
    d.push({ id: "lower-sore", level: "adjust", title: "Train upper body today",
      why: `Lower-body soreness ${c.lower}/5.`, action: "Schedule now shows an upper session." });
  }

  // Mind
  if (c.energy <= 2) {
    d.push({ id: "low-energy", level: "adjust", title: "Split your deep work",
      why: `Mental energy ${c.energy}/5.`,
      action: "Two 45-min sprints with a 10-min walk between, instead of one long block." });
  }

  // Trend: 3 days falling
  const recent = history.filter((h) => h.date <= today && Number.isFinite(h.score)).slice(-3);
  if (recent.length === 3 && recent[0].score > recent[1].score && recent[1].score > recent[2].score && recent[2].score < 65) {
    d.push({ id: "trend-down", level: "adjust", title: "Plan a lighter week",
      why: `Recovery fell 3 days in a row: ${recent.map((r) => r.score).join(" → ")}%.`,
      action: "Drop one training session this week or make it a deload." });
  }

  // Green lights
  if (result.score >= 80 && result.hrvZ >= 0.5 && !d.some((x) => x.level === "stop")) {
    d.push({ id: "push", level: "go", title: "Green light: push today",
      why: `Score ${result.score}% and HRV ${result.hrvZ > 0 ? "+" : ""}${result.hrvZ} SD above normal.`,
      action: "Attempt a top set or go full intensity at football." });
  }
  if (!d.some((x) => x.level !== "go")) {
    const byDay = {
      high: "Hit the heavy session and protect your 09:00 deep-work block.",
      balanced: "Technique-focused training and steady work. Nothing to fix.",
      restore: "Follow the restoration plan. Recovery is the training today.",
    };
    d.push({ id: "on-track", level: "go", title: "Stay the course",
      why: "No warning signs in sleep, HRV, resting HR or soreness.", action: byDay[archetypeId] });
  }

  return d.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/* ---------- 6. Schedule ---------- */
const PLANS = {
  high: [
    ["07:00", 15, "sun", "Morning sun & 500 ml water", "10 min outside before screens. Add electrolytes."],
    ["07:30", 10, "mobility", "Dynamic warm-up + ankle primer", "Knee-to-Wall Pulses, Ankle CARs, World's Greatest Stretch."],
    ["09:00", 120, "focus", "Deep focus engineering block", "Phone in another room. One problem, two hours."],
    ["11:15", 60, "work", "CRM analysis & reporting", "Batch Slack and email at the end of the block."],
    ["12:30", 40, "fuel", "Lunch + 10-min walk", "40 g protein. Walk to bank daylight."],
    ["14:00", 10, "breath", "Box breathing 4-4-4-4", "Reset before the afternoon push."],
    ["14:15", 120, "work", "Structured work & meetings", "Hardest stakeholder tasks first."],
    ["17:00", 75, "training", "Heavy lift or football session", "Top sets at RPE 8–9. Full ankle warm-up before any football."],
    ["19:00", 45, "fuel", "Recovery dinner", "Carbs + protein within 2 h of training."],
    ["21:30", 45, "wind", "Wind-down & screens off", "Dim lights, 10-min reading, 18 °C bedroom."],
  ],
  balanced: [
    ["07:00", 15, "sun", "Morning sun & hydration", "Light exposure anchors tonight's sleep."],
    ["07:30", 15, "mobility", "Ankle & hip mobility drills", "Full drill list in the mobility panel."],
    ["09:00", 180, "work", "Structured work & meetings", "CRM pipeline review, then meetings."],
    ["12:30", 30, "fuel", "Lunch + short walk", "Easy pace. Keep steps flowing."],
    ["14:00", 15, "breath", "Breathwork & meditation", "Physiological sighs, then 10 min guided."],
    ["14:30", 90, "study", "Deep study block", "One 90-min sprint. Stop while it's going well."],
    ["17:30", 60, "training", "Hypertrophy session (technique focus)", "Moderate load, 2–3 reps in reserve, controlled tempo."],
    ["19:00", 45, "fuel", "Dinner & meal prep for tomorrow", "Prep tomorrow's lunch now."],
    ["21:30", 45, "wind", "Wind-down routine", "No screens after 22:00. Lights out 22:30."],
  ],
  restore: [
    ["08:00", 20, "sun", "Gentle walk & hydration", "Nasal breathing only. Zone 1 pace."],
    ["09:00", 20, "breath", "Deep meditation & breathwork", "NSDR or 4-7-8 breathing. Lie down."],
    ["10:30", 90, "study", "Passive study / reading", "Lectures, docs, or a book. No hard problem solving."],
    ["12:30", 40, "fuel", "Nutrient-dense lunch", "Extra protein and colourful veg for repair."],
    ["14:00", 90, "errands", "Grocery shopping & meal prep", "Light movement that counts. Prep 3 meals."],
    ["16:30", 30, "mobility", "Full mobility & foam rolling", "Calves, quads, adductors, T-spine. Slow tempo."],
    ["18:30", 45, "fuel", "Early dinner", "Finish eating 3 h before bed."],
    ["21:00", 60, "wind", "Extended wind-down", "Warm shower, journal, lights out by 22:00."],
  ],
};

const minusMinutes = (hhmm, m) => {
  const [h, mm] = hhmm.split(":").map(Number);
  const t = h * 60 + mm - m;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function generateSchedule(archetypeId, c, directives = []) {
  const has = (id) => directives.some((d) => d.id === id);
  return PLANS[archetypeId].map(([time, dur, type, title, detail], i) => {
    const item = { id: `${archetypeId}-${i}`, time, dur, type, title, detail };

    if (type === "training" && archetypeId !== "restore") {
      if (has("hrv-low") || has("rhr-high")) {
        return { ...item, type: "mobility", title: "Zone 2 walk + mobility (training swapped)",
          detail: "Autonomic markers are low. 30-min easy walk, then the mobility panel." };
      }
      if (has("ankle-flare")) {
        return { ...item, title: archetypeId === "high" ? "Heavy upper lift (football on hold)" : item.title,
          detail: "Ankle/hip stiffness is 4+. No cutting, sprinting or jumping." };
      }
      if (has("lower-sore")) {
        return { ...item, title: "Upper-body session (technique focus)", detail: "Lower body is sore. Keep 2 reps in reserve." };
      }
      if (has("hrv-dip")) return { ...item, detail: `${detail} Cap at RPE 7 today.` };
    }
    if ((type === "focus" || type === "study") && has("low-energy")) {
      return { ...item, detail: "Split into 2 × 45-min sprints with a 10-min walk between." };
    }
    if (type === "wind" && has("sleep-debt")) {
      return { ...item, time: minusMinutes(time, 30), title: `${title} (30 min earlier)`, detail: "Paying down sleep debt. Lights out by 22:00." };
    }
    return item;
  });
}

/* ---------- 7. Mobility ---------- */
const DRILLS = [
  { id: "k2w", name: "Knee-to-Wall Dynamic Pulses", area: "ankle", required: true,
    dose: "10–12 reps / side", cue: "Foot 5–8 cm from wall. Heel stays down." },
  { id: "cars", name: "Ankle CARs", area: "ankle", dose: "5 reps each direction", cue: "Slow 360° circles at your end range." },
  { id: "9090", name: "90/90 Hip Switches", area: "hip", required: true,
    dose: "8–10 reps / side", cue: "Switch knees without using your hands." },
  { id: "cossack", name: "Cossack Squats", area: "hip", required: true,
    dose: "6–8 reps / side", cue: "Sit deep into one side, opposite leg long." },
  { id: "wgs", name: "World's Greatest Stretch", area: "hip", required: true,
    dose: "5 reps / side", cue: "Lunge, elbow to ankle, rotate to ceiling." },
  { id: "drop", name: "Drop Squats", area: "chain", minDay: "balanced", dose: "3 × 8", cue: "Drop fast through the hips. Stick the landing." },
  { id: "slrdl", name: "Single-Leg RDL", area: "chain", minDay: "balanced", dose: "3 × 8–10 / side", cue: "Hips level. Ankle grips the floor." },
  { id: "carry", name: "Suitcase Carry", area: "chain", minDay: "high", dose: "3 × 20–30 m / side", cue: "Heavy bell. Torso stays vertical." },
];
const DAY_RANK = { restore: 0, balanced: 1, high: 2 };

export function buildMobility(c, archetypeId) {
  const areaLoad = { ankle: c.ankleHip, hip: Math.max(c.ankleHip, c.lower), chain: c.lower };
  return DRILLS
    .filter((d) => d.required || d.area !== "chain" || DAY_RANK[archetypeId] >= DAY_RANK[d.minDay])
    .map((d) => {
      const load = areaLoad[d.area];
      return { ...d, load, priority: load >= 4 ? "High" : load >= 3 ? "Medium" : "Maintain" };
    })
    .sort((a, b) => b.load - a.load || Number(!!b.required) - Number(!!a.required));
}

/* ---------- 8. One call for the whole day ---------- */
export function planDay({ checkin, history, today }) {
  const baselines = computeBaselines(history, today, checkin);
  const result = calculateRecovery(checkin, baselines);
  const archetype = getArchetype(result.score);
  const withToday = upsertDay(history, { date: today, score: result.score });
  const directives = generateDirectives({ c: checkin, result, baselines, history: withToday, today, archetypeId: archetype.id });
  return {
    baselines, result, archetype, directives,
    schedule: generateSchedule(archetype.id, checkin, directives),
    drills: buildMobility(checkin, archetype.id),
    sleepDebt: sleepDebt(checkin.sleepHours, baselines.recentSleep),
  };
}

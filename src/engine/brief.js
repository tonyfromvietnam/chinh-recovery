/* M2 — The morning brief: training call, bedtime and cut-offs, one focus and a fact.
   Every number traces back to docs/FEATURE_RESEARCH.md. */
import { toMin, fromMin, eveningMin, isHHMM, isNum, mean, round1, weekday, shiftKey, hashSeed, clamp } from "./util.js";

export const TARGETS = {
  sleepNeedH: 8, sleepLatencyMin: 15, debtRepayMinPerNight: 30, hardTomorrowMin: 15, maxShiftEarlierMin: 45, maxShiftLaterMin: 30,
  caffeineCutoffH: 8.8, preworkoutCutoffH: 13.2, lastMealBeforeBedH: 3, showerBeforeBedH: [1, 2], screensOffMin: 60,
  defaultWake: "07:00",
};

export const SESSION_DEFAULTS = {
  upper: { label: "Upper-body" },
  lower: { label: "Lower-body" },
  football: { label: "Football" },
  zone2: { label: "Zone 2" },
  rest: { label: "Rest" },
};
const HARD = new Set(["upper", "lower", "football"]);
export const isHardSession = (t) => HARD.has(t);

/* ---------- Profile helpers ---------- */
export function plannedSession(profile, date) {
  return profile?.template?.[weekday(date)] ?? null;
}

export function wakeFor(profile, date) {
  const w = profile?.wakeByDay?.[weekday(date)];
  return isHHMM(w) ? w : isHHMM(profile?.usualWake) ? profile.usualWake : TARGETS.defaultWake;
}

/* ---------- Bedtime ---------- */
/* Mean bedtime of the last 7 nights (bedTime is stored on the morning after) */
export function avgBedtime7(history, today) {
  const from = shiftKey(today, -7);
  const mins = history.filter((h) => h.date > from && h.date <= today && isHHMM(h.bedTime)).map((h) => eveningMin(h.bedTime));
  return mins.length >= 3 ? fromMin(mean(mins)) : null;
}

export function targetBedtime({ wakeTomorrow, sleepNeedH = TARGETS.sleepNeedH, debtH = 0, hardTomorrow = false, avgBed7 = null }) {
  const T = TARGETS;
  const wake = toMin(wakeTomorrow ?? T.defaultWake) + 1440; // tomorrow, on the evening-anchored scale
  const repay = Math.min(Math.round(Math.max(0, debtH) * 60), T.debtRepayMinPerNight);
  const hard = hardTomorrow ? T.hardTomorrowMin : 0;
  let bed = wake - Math.round(sleepNeedH * 60) - T.sleepLatencyMin - repay - hard;
  const parts = [`wake ${wakeTomorrow ?? T.defaultWake}`, `${round1(sleepNeedH)} h sleep`, `${T.sleepLatencyMin} min to fall asleep`];
  if (repay) parts.push(`${repay} min towards ${round1(debtH)} h debt`);
  if (hard) parts.push(`${hard} min extra before a hard day`);

  let clampedBy = null;
  if (avgBed7) {
    const avg = eveningMin(avgBed7);
    const lo = avg - T.maxShiftEarlierMin, hi = avg + T.maxShiftLaterMin;
    if (bed < lo) { bed = lo; clampedBy = `kept within ${T.maxShiftEarlierMin} min of your usual ${avgBed7}`; }
    if (bed > hi) { bed = hi; clampedBy = `kept within ${T.maxShiftLaterMin} min of your usual ${avgBed7}`; }
  }
  return { time: fromMin(bed), reason: parts.join(" · ") + (clampedBy ? ` (${clampedBy})` : ""), clampedBy };
}

export function eveningCutoffs(bedtime) {
  const bed = eveningMin(bedtime);
  const T = TARGETS;
  return {
    bedtime,
    coffee: fromMin(bed - T.caffeineCutoffH * 60),
    preworkout: fromMin(bed - T.preworkoutCutoffH * 60),
    lastMeal: fromMin(bed - T.lastMealBeforeBedH * 60),
    shower: [fromMin(bed - T.showerBeforeBedH[1] * 60), fromMin(bed - T.showerBeforeBedH[0] * 60)],
    screensOff: fromMin(bed - T.screensOffMin),
  };
}

/* ---------- One focus ---------- */
export function dailyFocus({ result, debt = 0, trend = null, checkin = {}, bedtime = null, avgBed7 = null, lastBed = null }) {
  const c = [];
  if (debt >= 1) c.push({ sev: debt / 2, id: "f-sleep", title: "Sleep", why: `${debt} h sleep debt across the last 3 nights.`,
    action: bedtime ? `In bed by ${bedtime} tonight.` : "Get to bed 30 min earlier tonight." });
  if (trend?.band === "below") c.push({ sev: 1.5, id: "f-hrv-trend", title: "Recovery",
    why: `7-day HRV ${trend.avg7} ms is below your normal range (${trend.low}–${trend.high} ms).`,
    action: "Keep intensity moderate until it's back in range." });
  else if (isNum(result?.hrvZ) && result.hrvZ <= -1) c.push({ sev: 1, id: "f-hrv", title: "Recovery",
    why: `HRV ${result.hrvZ} SD under your normal this morning.`, action: "Cap training at RPE 8 and get outside for 10 min." });
  if (isNum(result?.rhrDelta) && result.rhrDelta >= 3) c.push({ sev: result.rhrDelta / 4, id: "f-rhr", title: "Hydration",
    why: `Resting HR ${result.rhrDelta} bpm above your normal.`, action: "500 ml water before 10:00; watch for illness." });
  if (checkin.ankleHip >= 3) c.push({ sev: (checkin.ankleHip - 2) * 0.6, id: "f-ankle", title: "Ankle",
    why: `Ankle/hip stiffness ${checkin.ankleHip}/5.`, action: "Knee-to-Wall Pulses + Ankle CARs before any training." });
  if (avgBed7 && lastBed) {
    const drift = eveningMin(lastBed) - eveningMin(avgBed7);
    if (drift >= 45) c.push({ sev: 1, id: "f-regularity", title: "Regularity",
      why: `Last night's bedtime ${lastBed} was ${drift} min later than your 7-day average.`,
      action: bedtime ? `Back to ${bedtime} tonight.` : "Back to your usual bedtime tonight." });
  }
  if (checkin.energy <= 2) c.push({ sev: 0.8, id: "f-energy", title: "Energy",
    why: `Mental energy ${checkin.energy}/5.`, action: "Two 45-min work sprints, with a walk between them." });
  if (!c.length) return { id: "f-steady", title: "Consistency", why: `Score ${result?.score ?? "–"}% with nothing off your normal.`,
    action: "Same routine as yesterday: protect bedtime and mobility." };
  return c.sort((a, b) => b.sev - a.sev)[0];
}

/* ---------- Fact of the day ---------- */
export const FACTS = [
  { id: "caffeine-cutoff", when: (x) => x.liftOrFootball || x.shortSleep,
    text: () => "A standard coffee needs to be finished about 8.8 h before bed; caffeine cut total sleep by roughly 45 minutes on average.",
    source: "Gardiner et al. 2023, Sleep Medicine Reviews" },
  { id: "caffeine-halflife", text: () => "Caffeine's half-life is around 5 hours, so half of a 15:00 coffee is still active at 20:00.",
    source: "Gardiner et al. 2023, Sleep Medicine Reviews" },
  { id: "short-sleep-injury", when: (x) => x.shortSleep,
    text: () => "Young athletes who slept under 8 hours had about 1.7× the injury rate of those who slept more.",
    source: "Milewski et al. 2014, J Pediatr Orthop" },
  { id: "sleep-extension", when: (x) => x.debt,
    text: () => "Extending sleep towards 10 h improved sprint times and shooting accuracy in college basketball players.",
    source: "Mah et al. 2011, SLEEP" },
  { id: "sleep-need", when: (x) => x.debt,
    text: () => "In a sleep-extension study, young men needed about 8.4 h but habitually slept around 1 h less without noticing.",
    source: "Kitamura et al. 2016, Scientific Reports" },
  { id: "regularity", when: (x) => x.irregular,
    text: () => "In 60,977 UK Biobank participants, regular sleep timing predicted lower mortality more strongly than sleep duration.",
    source: "Windred et al. 2024, SLEEP" },
  { id: "ankle-balance", when: (x) => x.ankle,
    text: () => "An 8-week home balance programme cut repeat ankle sprains by 35 %. A previous sprain is the biggest risk factor for the next.",
    source: "Hupperets et al. 2009, BMJ" },
  { id: "fifa-11", when: (x) => x.football,
    text: () => "The FIFA 11+ warm-up reduced injuries in footballers by roughly a third.",
    source: "Soligard et al. 2008, BMJ" },
  { id: "cyclic-sighing", when: (x) => x.hrvLow || x.stress,
    text: () => "Five minutes of cyclic sighing (double inhale, long exhale) improved mood more than mindfulness meditation.",
    source: "Balban et al. 2023, Cell Reports Medicine" },
  { id: "warm-shower", when: (x) => x.debt || x.shortSleep,
    text: () => "A warm shower or bath (40–42.5 °C) 1–2 h before bed helps you fall asleep about 10 minutes faster.",
    source: "Haghayegh et al. 2019, Sleep Medicine Reviews" },
  { id: "protein-plateau", when: (x) => x.liftOrFootball,
    text: () => "Muscle gains from protein plateau around 1.6 g per kg per day, best spread over about four meals.",
    source: "Morton et al. 2018, BJSM; Schoenfeld & Aragon 2018" },
  { id: "presleep-protein", when: (x) => x.liftOrFootball,
    text: () => "Around 40 g of slow-digesting protein before sleep raised overnight muscle protein synthesis after evening training.",
    source: "Res et al. 2012, MSSE" },
  { id: "vitamin-d", when: (x) => x.winter,
    text: () => "The NHS advises 10 µg of vitamin D a day from October to March: UK winter sunlight is too weak to make enough.",
    source: "NHS vitamin D guidance" },
  { id: "subjective", text: () => "Across 56 studies, athletes' own ratings tracked training load better than blood and hormone markers.",
    source: "Saw, Main & Gastin 2016, BJSM" },
  { id: "hrv-saturation", when: (x) => x.hrvHigh,
    text: () => "Very high HRV isn't always good news: in elite endurance athletes it can signal detraining or parasympathetic saturation.",
    source: "Plews et al., HRV-guided training research" },
  { id: "social-jetlag", when: (x) => x.weekend,
    text: () => "Sleeping much later at weekends ('social jetlag') is linked with higher BMI and poorer metabolic health.",
    source: "Roenneberg et al. 2012, Current Biology" },
  { id: "alcohol-hrv", when: (x) => x.alcohol,
    text: () => "Alcohol lowered overnight HRV in a dose-dependent way in a study of over 4,000 Finnish employees.",
    source: "Pietilä et al. 2018, JMIR Mental Health" },
];

export function factContext({ checkin = {}, result = {}, debt = 0, trend = null, planned = null, today, irregular = false }) {
  const month = Number(today.slice(5, 7));
  return {
    shortSleep: isNum(checkin.sleepHours) && checkin.sleepHours < 7,
    debt: debt >= 1,
    ankle: checkin.ankleHip >= 3,
    football: planned === "football",
    liftOrFootball: isHardSession(planned),
    hrvLow: trend?.band === "below" || (isNum(result.hrvZ) && result.hrvZ <= -1),
    hrvHigh: trend?.band === "above" || (isNum(result.hrvZ) && result.hrvZ >= 1.5),
    winter: month >= 10 || month <= 3,
    weekend: ["sat", "sun"].includes(weekday(today)),
    irregular, alcohol: false, stress: false,
  };
}

/* Stable for the whole day; prefers a fact that matches today's data */
export function factOfTheDay(ctx, seed) {
  const matching = FACTS.filter((f) => f.when && f.when(ctx));
  const pool = matching.length ? matching : FACTS.filter((f) => !f.when);
  const f = pool[hashSeed(String(seed)) % pool.length];
  return { id: f.id, text: f.text(ctx), source: f.source, matched: matching.length > 0 };
}

/* ---------- Plan coupling ---------- */
export function applyBriefToSchedule(schedule, brief) {
  if (!brief?.cutoffs) return schedule;
  const { cutoffs } = brief;
  const dinnerCut = toMin(cutoffs.lastMeal);
  const lastFuel = [...schedule].reverse().find((i) => i.type === "fuel" && toMin(i.time) >= 17 * 60);
  return schedule.map((i) => {
    if (i.type === "wind") {
      return { ...i, time: cutoffs.screensOff, dur: TARGETS.screensOffMin,
        title: "Wind-down: screens off", detail: `Lights out ${cutoffs.bedtime}. Warm shower ${cutoffs.shower[0]}–${cutoffs.shower[1]}. ${i.detail}` };
    }
    if (lastFuel && i.id === lastFuel.id && toMin(i.time) + i.dur > dinnerCut) {
      return { ...i, time: fromMin(clamp(dinnerCut - i.dur, 17 * 60, dinnerCut)), detail: `Finish by ${cutoffs.lastMeal}. ${i.detail}` };
    }
    return i;
  }).sort((a, b) => toMin(a.time) - toMin(b.time));
}

/* M5 — Learning about you. Each function returns a value only once its confidence rule is met;
   until then it reports progress ("5/8 days"). Nothing here changes the score weights. */
import { isNum, mean, stdev, median, round1, shiftKey, isWeekend, toMin, fromMin, eveningMin, isHHMM, welch, clamp } from "./util.js";
import { usableForLearning } from "./confidence.js";
import { computeBaselines, isBigDay } from "../engine.js";

export const LEARNING = {
  initNights: 19,
  sleepNeedMinNights: 20, sleepNeedQualifyEnergy: 4, sleepNeedHrvZ: -0.5,
  chronotypeMinFree: 4, chronotypeMinWork: 8,
  tagMinEach: 8, tagWindowDays: 90,
  shiftRefDays: [90, 42], shiftMinRef: 20, shiftMinMonitor: 14,
  cusumK: 0.5, cusumH: 5,
  chronotypeAnchor: 3 * 60 + 30, chronotypeMaxShiftMin: 60,
  footballMinMatches: 4, footballLookaheadDays: 4, footballHrvZ: -0.5, footballRhrMargin: 2,
  footballDefaultStart: 19 * 60, footballDefaultWake: 7 * 60, // auto-detected matches have no start time
};

/* ---------- Baseline at each date (computed once, reused) ---------- */
export function baselineMap(history) {
  const map = new Map();
  for (const d of history) {
    const b = computeBaselines(history, d.date, {});
    if (b.source === "rolling") map.set(d.date, { hrvMean: b.hrv.mean, lnMean: b.hrv.lnMean, lnSd: b.hrv.lnSd, rhrMean: b.rhr.mean, full: b });
  }
  return map;
}

const byDateMap = (history) => new Map(history.map((h) => [h.date, h]));
const lnZ = (hrv, b) => (isNum(hrv) && hrv > 0 && b ? (Math.log(hrv) - b.lnMean) / b.lnSd : null);

/* Baselines exist after ~5 nights; "learned" features wait for the Garmin-style 19 */
export function baselineNights(history, today) {
  const n = history.filter((h) => h.date > shiftKey(today, -60) && h.date <= today && isNum(h.hrv) && usableForLearning(h)).length;
  return { nights: n, needed: LEARNING.initNights, ready: n >= LEARNING.initNights };
}

/* ---------- Outcomes ---------- */
export const OUTCOMES = {
  nextHrvPct: { label: "Next-morning HRV", unit: "%", higherBetter: true },
  nextRhr: { label: "Next-morning resting HR", unit: "bpm", higherBetter: false },
  nextScore: { label: "Next-morning score", unit: "pts", higherBetter: true },
  sleepHours: { label: "Sleep that night", unit: "h", higherBetter: true },
  energy: { label: "Next-day energy", unit: "/5", higherBetter: true },
  nextLowerSoreness: { label: "Next-day lower-body soreness", unit: "/5", higherBetter: false },
  bedTime: { label: "Bedtime that night", unit: "min", higherBetter: false },
};

export function outcomeOn(key, day, bmap) {
  if (!day || !usableForLearning(day) && ["nextHrvPct", "nextRhr", "nextScore"].includes(key)) return null;
  const b = bmap.get(day.date);
  const fresh = day.ratedOn === day.date;
  switch (key) {
    case "nextHrvPct": return isNum(day.hrv) && b ? round1((day.hrv / b.hrvMean - 1) * 100) : null;
    case "nextRhr": return isNum(day.rhr) && b ? round1(day.rhr - b.rhrMean) : null;
    case "nextScore": return isNum(day.score) ? day.score : null;
    case "sleepHours": return isNum(day.sleepHours) ? day.sleepHours : null;
    case "energy": return fresh && isNum(day.energy) ? day.energy : null;
    case "nextLowerSoreness": return fresh && isNum(day.lower) ? day.lower : null;
    case "bedTime": return isHHMM(day.bedTime) ? eveningMin(day.bedTime) : null;
    default: return null;
  }
}

/* Outcome after day D: 1 = next morning, 3 = mean of the next three mornings */
export function outcomeAfter(key, date, byDate, bmap, lag = 1) {
  if (lag === 0) return outcomeOn(key, byDate.get(date), bmap);
  const vals = [];
  for (let k = 1; k <= lag; k++) {
    const v = outcomeOn(key, byDate.get(shiftKey(date, k)), bmap);
    if (isNum(v)) vals.push(v);
  }
  return vals.length ? round1(mean(vals)) : null;
}

/* ---------- Tags ----------
   Only tags the strap's own data can set. "late-bed" comes from the bedtime the Shortcut sends;
   M7.2 adds "big-day" from active energy. */
export const TAG_LABELS = {
  "late-bed": "Bedtime after 23:30",
  "big-day": "Big activity day",
};

export function tagsForDay(day, byDate) {
  const tags = new Set();
  const next = byDate.get(shiftKey(day.date, 1));
  if (isHHMM(next?.bedTime) && eveningMin(next.bedTime) > eveningMin("23:30")) tags.add("late-bed");
  if (isBigDay(day, byDate)) tags.add("big-day");
  return tags;
}

function verdictFor(stat, nA, nB, higherBetter) {
  if (nA < LEARNING.tagMinEach || nB < LEARNING.tagMinEach || !stat) return "not enough data";
  const [lo, hi] = stat.ci;
  if (lo <= 0 && hi >= 0) return "no clear effect";
  return (stat.diff > 0) === higherBetter ? "helps" : "hurts";
}

export function tagEffects(history, today, { outcome = "nextHrvPct", lag = 1, bmap = null } = {}) {
  const byDate = byDateMap(history);
  const bm = bmap || baselineMap(history);
  const from = shiftKey(today, -LEARNING.tagWindowDays);
  // A day is "tracked" when tomorrow's bedtime is known, so "without the tag" means a real normal night
  const tracked = history.filter((h) => h.date >= from && h.date < today && usableForLearning(h)
    && isHHMM(byDate.get(shiftKey(h.date, 1))?.bedTime));
  const tagSets = new Map(tracked.map((d) => [d.date, tagsForDay(d, byDate)]));
  const all = new Set([...tagSets.values()].flatMap((s) => [...s]));
  const meta = OUTCOMES[outcome];
  const rows = [...all].map((tag) => {
    const withV = [], without = [];
    for (const d of tracked) {
      const v = outcomeAfter(outcome, d.date, byDate, bm, lag);
      if (!isNum(v)) continue;
      (tagSets.get(d.date).has(tag) ? withV : without).push(v);
    }
    const stat = welch(withV, without);
    return {
      tag, nWith: withV.length, nWithout: without.length,
      diff: stat ? round1(stat.diff) : null, ci95: stat ? stat.ci.map(round1) : null,
      verdict: verdictFor(stat, withV.length, without.length, meta.higherBetter),
    };
  });
  const order = { hurts: 0, helps: 1, "no clear effect": 2, "not enough data": 3 };
  return rows.sort((a, b) => order[a.verdict] - order[b.verdict] || Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0));
}

/* ---------- Sleep need ---------- */
export function estimateSleepNeed(history, bmap = null) {
  const bm = bmap || baselineMap(history);
  const nights = history.filter((d) => usableForLearning(d) && isNum(d.sleepHours) && d.ratedOn === d.date
    && d.energy >= LEARNING.sleepNeedQualifyEnergy && (lnZ(d.hrv, bm.get(d.date)) ?? -9) >= LEARNING.sleepNeedHrvZ)
    .map((d) => d.sleepHours);
  const n = nights.length;
  if (n < LEARNING.sleepNeedMinNights) return { hours: null, n, needed: LEARNING.sleepNeedMinNights };
  return { hours: Math.round(median(nights) * 12) / 12, n, needed: LEARNING.sleepNeedMinNights }; // nearest 5 min
}

/* ---------- Chronotype & social jetlag (MCTQ method) ---------- */
export function chronotype(history) {
  const nights = history.filter((d) => isHHMM(d.bedTime) && isHHMM(d.wakeTime)).map((d) => {
    const bed = eveningMin(d.bedTime);
    const wake = toMin(d.wakeTime) + 1440;
    const dur = wake - bed;
    return dur >= 180 && dur <= 840 ? { free: isWeekend(d.date), mid: bed + dur / 2, dur } : null;
  }).filter(Boolean);
  const free = nights.filter((n) => n.free), work = nights.filter((n) => !n.free);
  const out = { nFree: free.length, nWork: work.length, neededFree: LEARNING.chronotypeMinFree, neededWork: LEARNING.chronotypeMinWork };
  if (free.length < LEARNING.chronotypeMinFree || work.length < LEARNING.chronotypeMinWork) return { ...out, ready: false };
  const MSF = mean(free.map((n) => n.mid)), MSW = mean(work.map((n) => n.mid));
  const SDf = mean(free.map((n) => n.dur)), SDw = mean(work.map((n) => n.dur));
  const SDweek = (5 * SDw + 2 * SDf) / 7;
  const MSFsc = SDf > SDw ? MSF - (SDf - SDweek) / 2 : MSF;
  const sc = MSFsc - 1440; // minutes after midnight
  return {
    ...out, ready: true,
    msf: fromMin(MSF), msw: fromMin(MSW), msfsc: fromMin(MSFsc), msfscMin: Math.round(sc),
    socialJetlagH: round1(Math.abs(MSF - MSW) / 60),
    catchUpH: round1((SDf - SDw) / 60),
    type: sc < 180 ? "earlier" : sc > 300 ? "later" : "intermediate",
  };
}

export const chronotypeShiftMin = (msfscMin) =>
  isNum(msfscMin) ? clamp(Math.round((msfscMin - LEARNING.chronotypeAnchor) / 5) * 5, 0, LEARNING.chronotypeMaxShiftMin) : 0;

/* ---------- Baseline shift (CUSUM) ---------- */
function cusum(values, refMean, refSd) {
  let sp = 0, sn = 0, startP = null, startN = null;
  const { cusumK: k, cusumH: h } = LEARNING;
  for (const { date, v } of values) {
    const z = (v - refMean) / refSd;
    const np = Math.max(0, sp + z - k), nn = Math.min(0, sn + z + k);
    if (sp === 0 && np > 0) startP = date;
    if (sn === 0 && nn < 0) startN = date;
    sp = np; sn = nn;
    if (sp > h) return { shifted: true, direction: "up", sinceDate: startP };
    if (sn < -h) return { shifted: true, direction: "down", sinceDate: startN };
  }
  return { shifted: false };
}

export function baselineShift(history, today) {
  const [refFrom, monFrom] = LEARNING.shiftRefDays;
  const usable = history.filter((d) => usableForLearning(d) && d.date <= today);
  const ref = usable.filter((d) => d.date > shiftKey(today, -refFrom) && d.date <= shiftKey(today, -monFrom));
  const mon = usable.filter((d) => d.date > shiftKey(today, -monFrom));
  const out = { ready: false, refNights: ref.length, monitorNights: mon.length };
  if (ref.length < LEARNING.shiftMinRef || mon.length < LEARNING.shiftMinMonitor) return out;

  const lnRef = ref.filter((d) => isNum(d.hrv) && d.hrv > 0).map((d) => Math.log(d.hrv));
  const lnMon = mon.filter((d) => isNum(d.hrv) && d.hrv > 0).map((d) => ({ date: d.date, v: Math.log(d.hrv) }));
  const rhrRef = ref.filter((d) => isNum(d.rhr)).map((d) => d.rhr);
  const rhrMon = mon.filter((d) => isNum(d.rhr)).map((d) => ({ date: d.date, v: d.rhr }));
  const last14 = (xs) => xs.slice(-14).map((x) => x.v);

  const hrv = lnRef.length >= LEARNING.shiftMinRef ? {
    ...cusum(lnMon, mean(lnRef), Math.max(stdev(lnRef), 0.03)),
    pct: Math.round((Math.exp(mean(last14(lnMon))) / Math.exp(mean(lnRef)) - 1) * 100),
  } : null;
  const rhr = rhrRef.length >= LEARNING.shiftMinRef ? {
    ...cusum(rhrMon, mean(rhrRef), Math.max(stdev(rhrRef), 1)),
    delta: round1(mean(last14(rhrMon)) - mean(rhrRef)),
  } : null;
  return { ...out, ready: true, hrv, rhr };
}

/* ---------- Football recovery (M7.1) ----------
   Hours from a match until HRV and resting HR are back to normal, from football days the strap's
   heart-rate load picked up automatically. A match with no recovery inside 4 days counts as censored. */
export function footballRecoveryProfile(history, bmap = null) {
  const bm = bmap || baselineMap(history);
  const byDate = byDateMap(history);
  const matches = history.filter((d) => d.session?.auto && d.session.type === "football" && bm.get(d.date));
  const hours = [];
  let censored = 0;
  for (const m of matches) {
    const b = bm.get(m.date);
    let found = null;
    for (let k = 1; k <= LEARNING.footballLookaheadDays; k++) {
      const d = byDate.get(shiftKey(m.date, k));
      if (!d || !usableForLearning(d) || !isNum(d.rhr)) continue;
      const z = lnZ(d.hrv, b);
      if (z != null && z >= LEARNING.footballHrvZ && d.rhr <= b.rhrMean + LEARNING.footballRhrMargin) {
        const wake = toMin(d.wakeTime) ?? LEARNING.footballDefaultWake;
        found = Math.round((k * 1440 + wake - LEARNING.footballDefaultStart) / 60);
        break;
      }
    }
    if (found != null) hours.push(found); else censored++;
  }
  const n = hours.length + censored;
  const ready = n >= LEARNING.footballMinMatches;
  return { n, needed: LEARNING.footballMinMatches, censored, ready,
    hours: ready ? (censored > hours.length ? LEARNING.footballLookaheadDays * 24 : Math.round(median(hours))) : null };
}

/* ---------- Everything learned, for the profile ---------- */
export function learnProfile(history, today) {
  const bmap = baselineMap(history);
  const sleep = estimateSleepNeed(history, bmap);
  const chrono = chronotype(history);
  const football = footballRecoveryProfile(history, bmap);
  return {
    sleepNeedH: sleep.hours, sleepNeedN: sleep.n,
    chronotypeMSF: chrono.ready ? chrono.msfsc : null, chronotypeMin: chrono.ready ? chrono.msfscMin : null,
    chronotypeType: chrono.ready ? chrono.type : null, socialJetlagH: chrono.ready ? chrono.socialJetlagH : null,
    footballRecoveryH: football.hours, footballN: football.n,
    updatedOn: today,
  };
}


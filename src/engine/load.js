/* M3 — The 7-day HRV trend and the train / cap / reduce / recover decision.
   Training load comes back in M7.1, computed from the strap's heart-rate zones (no manual logging). */
import { isNum, mean, stdev, round1, shiftKey, WEEKDAYS } from "./util.js";
import { usableForLearning } from "./confidence.js";
import { SESSION_DEFAULTS, isHardSession } from "./brief.js";

export const LOAD = {
  normalRangeDays: 60,
  normalRangeMinNights: 14,
  trendMinNights: 4,
  swcSd: 0.5, // smallest worthwhile change, in SD of ln(HRV)
  lowerBeforeFootballH: 48,
  defaultFootballRecoveryH: 48,
  rhrConfirmDays: 2,
};

/* ---------- 7-day HRV trend vs your normal range ---------- */
export function hrvTrend(history, today) {
  const ln = (h) => Math.log(h.hrv);
  const ok = (h) => isNum(h.hrv) && h.hrv > 0 && usableForLearning(h);
  const week = history.filter((h) => h.date > shiftKey(today, -7) && h.date <= today && ok(h));
  const ref = history.filter((h) => h.date > shiftKey(today, -LOAD.normalRangeDays) && h.date <= shiftKey(today, -7) && ok(h));
  const base = { nights: week.length, refNights: ref.length };
  if (week.length < LOAD.trendMinNights || ref.length < LOAD.normalRangeMinNights) return { ...base, band: "unknown" };

  const w = week.map(ln), r = ref.map(ln);
  const m = mean(r), sd = Math.max(stdev(r), 0.03);
  const avg = mean(w);
  const lo = m - LOAD.swcSd * sd, hi = m + LOAD.swcSd * sd;
  const band = avg < lo ? "below" : avg > hi ? "above" : "in";
  return {
    ...base, band,
    avg7: Math.round(Math.exp(avg)), low: Math.round(Math.exp(lo)), high: Math.round(Math.exp(hi)),
    cv7: round1((stdev(w) / mean(w)) * 100),
  };
}

/* Consecutive mornings, ending today, with resting HR at or above baseline + delta */
export function rhrRun(history, today, baselineRhr, delta, todayRhr) {
  if (!isNum(baselineRhr) || !isNum(todayRhr) || todayRhr < baselineRhr + delta) return 0;
  let run = 1;
  for (let i = 1; i <= 14; i++) {
    const d = history.find((h) => h.date === shiftKey(today, -i));
    if (!d || !isNum(d.rhr) || d.rhr < baselineRhr + delta) break;
    run++;
  }
  return run;
}

/* ---------- Weekly template spacing ---------- */
const LEG_DAYS = new Set(["lower", "full-a", "full-b"]); // the M8 full-body sessions train legs too

export function spacingConflicts(profile, footballRecoveryH = LOAD.defaultFootballRecoveryH) {
  const t = profile?.template;
  if (!t) return [];
  const out = [];
  WEEKDAYS.forEach((a, i) => {
    for (let gap = 0; gap <= 3; gap++) {
      const b = WEEKDAYS[(i + gap) % 7];
      const hours = gap * 24;
      if (LEG_DAYS.has(t[a]) && t[b] === "football" && hours < LOAD.lowerBeforeFootballH) {
        out.push({ from: a, to: b, hours, rule: "lower-before-football",
          text: `Leg training on ${cap(a)} is ${hours} h before football on ${cap(b)} (keep ${LOAD.lowerBeforeFootballH} h).` });
      }
      if (gap > 0 && t[a] === "football" && LEG_DAYS.has(t[b]) && hours < footballRecoveryH) {
        out.push({ from: a, to: b, hours, rule: "football-before-lower",
          text: `Football on ${cap(a)} leaves ${hours} h before heavy legs on ${cap(b)} (you need ~${footballRecoveryH} h).` });
      }
    }
  });
  return out;
}
const cap = (d) => d[0].toUpperCase() + d.slice(1);

/* ---------- The decision ---------- */
const name = (t) => SESSION_DEFAULTS[t]?.label ?? "Training";

export function trainingDecision({ trend, result, planned, ankleHip, rhrDays = 0, override = null, sleepHours = null, ankleStop = 4, hrvStopZ = -1.5, hrvAdjustZ = -1, pushScore = 80 }) {
  const hard = isHardSession(planned);
  if (override) return { decision: "recover", label: "Recover", detail: "You marked today as ill or high stress: walk, mobility, early night.", why: ["Override set"] };
  if (planned === "rest") return { decision: "as-planned", label: "Rest day", detail: "Rest as planned: easy walk and the mobility list.", why: ["Rest day in your template"] };

  if (planned === "football" && ankleHip >= ankleStop) {
    return { decision: "reduce", label: "No football", detail: `Ankle/hip ${ankleHip}/5: upper lift or Zone 2 instead, no cutting or jumping.`, why: [`Ankle/hip stiffness ${ankleHip}/5`] };
  }

  const band = trend?.band ?? "unknown";
  if (band === "below" && rhrDays >= LOAD.rhrConfirmDays) {
    return { decision: "recover", label: "Recover", detail: "Swap the session for a 30-min walk and mobility.",
      why: [`7-day HRV ${trend.avg7} ms below your ${trend.low}–${trend.high} ms range`, `Resting HR up ${rhrDays} days running`] };
  }
  if (band === "below") {
    return { decision: "reduce", label: "Reduce", detail: hard ? "Cut volume by 30–40 % and keep RPE ≤ 7." : "Keep it easy.",
      why: [`7-day HRV ${trend.avg7} ms below your ${trend.low}–${trend.high} ms range`] };
  }
  if (band === "unknown" && isNum(result?.hrvZ)) {
    if (result.hrvZ <= hrvStopZ) return { decision: "reduce", label: "Reduce", detail: "Swap intensity for Zone 2 and mobility.", why: [`HRV ${result.hrvZ} SD under normal (no 7-day trend yet)`] };
    if (result.hrvZ <= hrvAdjustZ) return { decision: "cap", label: "Cap at RPE 8", detail: "Keep the session, drop the top sets.", why: [`HRV ${result.hrvZ} SD under normal`] };
  }
  if (isNum(result?.hrvZ) && result.hrvZ <= hrvAdjustZ) {
    return { decision: "cap", label: "Cap at RPE 8", detail: "One low morning with a normal trend: train, but no max efforts.",
      why: [`HRV ${result.hrvZ} SD under normal today`, `7-day trend ${band === "unknown" ? "not ready" : "in range"}`] };
  }
  const football = planned === "football" ? " Do the FIFA 11+ warm-up first (about a third fewer injuries)." : "";
  if (band === "above" && isNum(sleepHours) && sleepHours >= 7 && result?.score >= pushScore) {
    return { decision: "push", label: "Push", detail: (hard ? "Attempt top sets or go full intensity." : "Good day for extra Zone 2.") + football,
      why: [`7-day HRV ${trend.avg7} ms above your range`, `Score ${result.score}%`, `${sleepHours} h sleep`] };
  }
  const why = [band === "in" ? `7-day HRV ${trend.avg7} ms within your ${trend.low}–${trend.high} ms range` : "No warning signs"];
  return { decision: "as-planned", label: "As planned", detail: (hard ? `${name(planned)} session as planned.` : "As planned.") + football, why };
}

/* Rewrites the training block from the decision and the planned session */
export function applyDecision(schedule, decision, planned) {
  if (!decision || !planned) return schedule;
  return schedule.map((i) => {
    if (i.slot !== "training") return i;
    const n = name(planned);
    const d = decision.decision;
    if (planned === "rest" || d === "recover") {
      return { ...i, type: "mobility", title: planned === "rest" ? "Rest day: easy walk + mobility" : "Recovery: 30-min walk + mobility", detail: decision.detail };
    }
    if (decision.label === "No football") return { ...i, type: "training", title: "No football (ankle): upper lift or Zone 2", detail: decision.detail };
    const suffix = { push: " — push: top sets", "as-planned": "", cap: " — cap at RPE 8", reduce: " — reduced volume" }[d] ?? "";
    return { ...i, type: i.type === "mobility" && d !== "reduce" ? "training" : i.type, title: `${n} session${suffix}`, detail: decision.detail };
  });
}
